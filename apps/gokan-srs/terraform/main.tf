terraform {
  required_version = ">= 1.10" # native S3 state locking (use_lockfile)

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state in S3 with native locking, mirroring the staging stack. Partial
  # config: the `bucket` is supplied at `terraform init` time via -backend-config,
  # so the account-specific state-bucket name is never committed to the repo.
  #   CI:    terraform init -backend-config="bucket=$TF_STATE_BUCKET"
  #   local: terraform init -backend-config="bucket=<your-state-bucket>"
  #          (with AWS_PROFILE=terraform-deploy set in the environment)
  backend "s3" {
    key          = "production/terraform.tfstate"
    region       = "eu-west-3"
    encrypt      = true
    use_lockfile = true
  }
}

# No hardcoded profile: credentials come from the environment so this works both
# in CI (AWS_ACCESS_KEY_ID/SECRET from the gokan-terraform-ci user) and locally
# (export AWS_PROFILE=terraform-deploy before running).
provider "aws" {
  region = var.aws_region
}

# Provide an AWS provider specifically for the us-east-1 region (Required for CloudFront certs)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-3"
}

variable "domain_name" {
  description = "Domain name for the website (optional)"
  type        = string
  default     = "gokan-srs.com"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "gokan-srs"
}

# ARN of the console-created WAF WebACL currently attached to the production
# distribution. Kept as a variable (not hardcoded inline) so it's easy to override
# or clear. Default reflects the live association at the time state was migrated to CI.
variable "cloudfront_web_acl_arn" {
  description = "WAF WebACL ARN attached to the CloudFront distribution (empty to detach)"
  type        = string
  default     = "arn:aws:wafv2:us-east-1:413976099932:global/webacl/CreatedByCloudFront-0fb8c740/a68ad563-9024-481f-9f5d-fc949c42012f"
}

# S3 Bucket for website hosting (standard bucket, not website-enabled)
resource "aws_s3_bucket" "website" {
  bucket = "${var.project_name}-website-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "${var.project_name}-website"
    Environment = "production"
  }
}

# S3 Bucket Public Access Block (keep bucket private, CloudFront will access it)
resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket Versioning (optional but recommended)
resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.website.id

  versioning_configuration {
    status = "Disabled" # Set to "Enabled" if you want versioning
  }
}

# The audio bucket: VOICEVOX clips of words, sentences and grammar examples (#164, see
# docs/ARCHITECTURE.md, Audio). One bucket for both environments, owned by this stack and read
# by the staging stack's distribution too (staging/main.tf looks it up by name), so a clip is
# written once, not once per environment. Keys are content keys (`audio/{clip}.opus`), so an
# object is never overwritten or deleted: no versioning, no lifecycle rules, no replication
# (each would be charged per object, on ~107k of them). Only the maintainer's own credentials
# write here, through the dataset's `upload:audio`; the site deploy has its own bucket and
# never lists, writes or prunes this one.
resource "aws_s3_bucket" "audio" {
  bucket = "${var.project_name}-audio-${data.aws_caller_identity.current.account_id}"

  # Refilling it means ~15 hours of synthesis and ~107k PUTs again.
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-audio"
    Environment = "shared"
  }
}

resource "aws_s3_bucket_public_access_block" "audio" {
  bucket = aws_s3_bucket.audio.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Read by the CloudFront distributions of this account only (production here, staging in
# staging/main.tf), through OAC. A pattern rather than the two ARNs, because the staging
# distribution belongs to another state: naming it here would make each stack's apply wait on
# the other's. Every distribution in this account is one of Gokan's two.
resource "aws_s3_bucket_policy" "audio" {
  bucket = aws_s3_bucket.audio.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowGokanCloudFrontRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.audio.arn}/audio/*"
        Condition = {
          StringLike = {
            "AWS:SourceArn" = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/*"
          }
        }
      }
    ]
  })
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${var.project_name}-oac"
  description                       = "OAC for ${var.project_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Security-headers response policy, created via the console and imported into CI
# state during the state migration. Currently NOT attached to the distribution
# (its response_headers_policy_id is unset), so it has no effect on live traffic
# yet; recorded here so `terraform apply` doesn't delete it. To actually enforce
# these headers, add `response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id`
# to the default_cache_behavior below (a deliberate, reviewable change).
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "${var.project_name}-security-headers"
  comment = "Security headers for gokan-srs"

  cors_config {
    access_control_allow_credentials = false
    access_control_max_age_sec       = 0
    origin_override                  = true

    access_control_allow_headers {
      items = ["*"]
    }

    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }

    access_control_allow_origins {
      items = ["*"]
    }
  }

  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      override        = true
      referrer_policy = "strict-origin-when-cross-origin"
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
      preload                    = true
    }
    xss_protection {
      mode_block = true
      override   = true
      protection = true
    }
  }
}

# CloudFront Distribution
# CloudFront Function rewriting directory-style dictionary URLs onto the actual S3 object key.
#
# This is load-bearing, not a nicety. gokan-dictionary emits one page per entry as
# <path>/index.html, and the S3 origin is reached through OAC (the REST endpoint), which - unlike
# the S3 *website* endpoint - performs no directory-index resolution at all. Without this
# rewrite, a request for /dictionary/vocab/1589350/ looks up a key that does not exist, 404s,
# and gets swallowed by the SPA custom_error_response below: every dictionary page would silently
# serve the SRS app instead. `default_root_object` does not help, as it only applies to "/".
resource "aws_cloudfront_function" "dictionary_directory_index" {
  name    = "${var.project_name}-dictionary-directory-index"
  runtime = "cloudfront-js-2.0"
  comment = "Appends index.html to directory-style dictionary URLs"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
      } else if (!uri.split('/').pop().includes('.')) {
        // Extensionless and no trailing slash (e.g. /dictionary/vocab/1589350): treat it as the
        // same page rather than a 404, so a hand-typed or link-shortened URL still resolves.
        request.uri = uri + '/index.html';
      }

      return request;
    }
  EOT
}

resource "aws_cloudfront_distribution" "website" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  # Removed price_class = "PriceClass_100" to allow Flat Tier enrollment

  # Use domain if provided, otherwise use CloudFront domain
  aliases = var.domain_name != "" ? [var.domain_name] : []

  # WAF WebACL created via the CloudFront console's security-protections integration
  # (CreatedByCloudFront-*). It lives outside this Terraform (referenced by ARN, not
  # managed here); recorded so `terraform apply` never silently detaches it from prod.
  web_acl_id = var.cloudfront_web_acl_arn

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.website.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  # The shared audio bucket (above). OAC signs for any S3 origin, so the site's one is reused.
  origin {
    domain_name              = aws_s3_bucket.audio.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.audio.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${aws_s3_bucket.website.id}"

    # Use AWS Managed Cache Policy required for Flat Tier (replaces legacy forwarded_values & TTLs)
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }

  # The dictionary (apps/gokan-dictionary) is served from the /dictionary/* prefix of this same
  # bucket, so it shares this hostname's ranking signals instead of splitting them across a
  # subdomain. It is fully prerendered static HTML, so it must NOT inherit the SPA fallback
  # behavior - hence its own behavior with the directory-index function attached.
  #
  # Known limitation: custom_error_response is distribution-wide in CloudFront, so a genuinely
  # missing /dictionary/* URL still returns the SPA shell with a 200 rather than a 404 (a soft
  # 404). Every dictionary URL is generated and sitemap-listed, so this should only be reachable
  # via a stale link after a dataset change. Fixing it properly means moving the SPA fallback off
  # custom_error_response and into a function on the default behavior, which is a riskier change
  # to live app routing than the problem currently warrants.
  ordered_cache_behavior {
    path_pattern     = "/dictionary/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${aws_s3_bucket.website.id}"

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.dictionary_directory_index.arn
    }
  }

  # Clips, from the shared audio bucket: the request path is the object key (`audio/{clip}.opus`).
  # A clip never changes under its key and is uploaded with
  # `Cache-Control: public, max-age=31536000, immutable`, which CachingOptimized honours up to its
  # one-year maximum, so a clip is cached a year and never needs an invalidation. Not compressed:
  # Opus is already compressed.
  #
  # The SPA fallback below is distribution-wide, so a missing clip answers 200 with the app's
  # shell. The app only asks for clips the dataset lists, and the dataset lists only clips the
  # bucket holds, so it is not reached in practice.
  ordered_cache_behavior {
    path_pattern     = "/audio/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${aws_s3_bucket.audio.id}"

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized

    viewer_protocol_policy = "redirect-to-https"
    compress               = false
  }

  # Custom error response for SPA routing (CloudFront handles this, not S3)
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.domain_name == "" ? true : false

    # Custom domain ACM certificate
    acm_certificate_arn      = aws_acm_certificate.website.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name        = "${var.project_name}-cdn"
    Environment = "production"
  }
}

# S3 Bucket Policy for CloudFront
resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.website.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.website.arn
          }
        }
      }
    ]
  })
}

# Look up the existing Route 53 Hosted Zone
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# Request an SSL/TLS Certificate in us-east-1
resource "aws_acm_certificate" "website" {
  provider          = aws.us_east_1
  domain_name       = data.aws_route53_zone.main.name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Automatically create the DNS records required to validate the Certificate
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.website.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

# Wait for the Certificate to be fully validated before proceeding
resource "aws_acm_certificate_validation" "website" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.website.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Create the DNS A-Record pointing your domain to the CloudFront distribution
resource "aws_route53_record" "website_a_record" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = data.aws_route53_zone.main.name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.website.domain_name
    zone_id                = aws_cloudfront_distribution.website.hosted_zone_id
    evaluate_target_health = false
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.website.id
}

output "audio_bucket_name" {
  description = "The shared audio bucket, passed to the dataset's upload:audio as --bucket"
  value       = aws_s3_bucket.audio.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.website.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.website.id
}

output "website_url" {
  description = "Website URL"
  value       = "https://${var.domain_name}"
}