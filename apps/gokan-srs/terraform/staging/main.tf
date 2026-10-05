# Staging stack for staging.gokan-srs.com: an independent Terraform root with
# its own state, so applying it can never affect the production stack in
# ../main.tf. Mirrors the production infra: private S3 bucket, CloudFront with
# SPA error handling, an ACM cert (us-east-1) for the staging subdomain, and a
# Route53 record in the existing gokan-srs.com hosted zone.

terraform {
  required_version = ">= 1.10" # native S3 state locking (use_lockfile)

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state in S3 with native locking. Partial config: the `bucket` is
  # supplied at `terraform init` time via -backend-config, so the account-specific
  # state-bucket name is never committed to the repo.
  #   CI:    terraform init -backend-config="bucket=$TF_STATE_BUCKET"
  #   local: terraform init -backend-config="bucket=<your-state-bucket>"
  #          (with AWS_PROFILE=terraform-deploy set in the environment)
  backend "s3" {
    key          = "staging/terraform.tfstate"
    region       = "eu-west-3"
    encrypt      = true
    use_lockfile = true
  }
}

variable "aws_region" {
  description = "AWS region for the bucket"
  type        = string
  default     = "eu-west-3"
}

variable "zone_name" {
  description = "Existing Route53 hosted zone (the apex domain)"
  type        = string
  default     = "gokan-srs.com"
}

variable "site_domain" {
  description = "Fully-qualified domain the staging site is served at"
  type        = string
  default     = "staging.gokan-srs.com"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "gokan-srs"
}

# No hardcoded profile: credentials come from the environment so this works both
# in CI (AWS_ACCESS_KEY_ID/SECRET from the gokan-terraform-ci user) and locally
# (export AWS_PROFILE=terraform-deploy before running).
provider "aws" {
  region = var.aws_region
}

# CloudFront ACM certs must live in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "aws_caller_identity" "current" {}

# Read-only lookup of the existing zone: production owns/creates it.
data "aws_route53_zone" "main" {
  name         = var.zone_name
  private_zone = false
}

resource "aws_s3_bucket" "website" {
  bucket = "${var.project_name}-staging-website-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "${var.project_name}-staging-website"
    Environment = "staging"
  }
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${var.project_name}-staging-oac"
  description                       = "OAC for ${var.project_name} staging"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "website" {
  provider          = aws.us_east_1
  domain_name       = var.site_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

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

resource "aws_acm_certificate_validation" "website" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.website.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}


# Adds X-Robots-Tag: noindex to everything staging serves.
#
# staging.gokan-srs.com shares gokan-srs.com's robots.txt content (it is the same built app), so
# robots.txt alone will not keep crawlers out. Once the dictionary is deployed here that means a
# second, complete, crawlable copy of ~39k pages duplicating production - a far worse duplicate
# content problem than the one the dictionary exists to solve. A response header is the reliable
# way to say noindex for non-HTML responses too.
resource "aws_cloudfront_response_headers_policy" "staging_noindex" {
  name = "${var.project_name}-staging-noindex"

  custom_headers_config {
    items {
      header   = "X-Robots-Tag"
      value    = "noindex, nofollow"
      override = true
    }
  }
}

# CloudFront Function rewriting directory-style dictionary URLs onto the actual S3 object key.
#
# This is load-bearing, not a nicety. gokan-dictionary emits one page per entry as
# <path>/index.html, and the S3 origin is reached through OAC (the REST endpoint), which - unlike
# the S3 *website* endpoint - performs no directory-index resolution at all. Without this
# rewrite, a request for /dictionary/vocab/1589350/ looks up a key that does not exist, 404s,
# and gets swallowed by the SPA custom_error_response below: every dictionary page would silently
# serve the SRS app instead. `default_root_object` does not help, as it only applies to "/".
resource "aws_cloudfront_function" "dictionary_directory_index" {
  name    = "${var.project_name}-staging-dictionary-directory-index"
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
  aliases             = [var.site_domain]

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.website.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${aws_s3_bucket.website.id}"

    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.staging_noindex.id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
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

    response_headers_policy_id = aws_cloudfront_response_headers_policy.staging_noindex.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.dictionary_directory_index.arn
    }
  }

  # SPA routing: serve index.html for client-side routes.
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
    acm_certificate_arn      = aws_acm_certificate_validation.website.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name        = "${var.project_name}-staging-cdn"
    Environment = "staging"
  }
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.website.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.website.arn
          }
        }
      }
    ]
  })
}

resource "aws_route53_record" "website_a_record" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.site_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.website.domain_name
    zone_id                = aws_cloudfront_distribution.website.hosted_zone_id
    evaluate_target_health = false
  }
}

output "s3_bucket_name" {
  description = "Staging S3 bucket name, set as the STAGING_S3_BUCKET_NAME Actions variable"
  value       = aws_s3_bucket.website.id
}

output "cloudfront_distribution_id" {
  description = "Staging CloudFront distribution ID, set as the STAGING_CLOUDFRONT_DISTRIBUTION_ID Actions secret"
  value       = aws_cloudfront_distribution.website.id
}

output "cloudfront_domain_name" {
  description = "Staging CloudFront domain name"
  value       = aws_cloudfront_distribution.website.domain_name
}

output "website_url" {
  value = "https://${var.site_domain}"
}
