# Staging stack for staging.gokan-srs.com: an independent Terraform root with
# its own state, so applying it can never affect the production stack in
# ../main.tf. Mirrors the production infra: private S3 bucket, CloudFront with the
# app's routing function, the dictionary's server (../modules/dictionary-server), an ACM cert
# (us-east-1) for the staging subdomain, and a Route53 record in the existing gokan-srs.com
# hosted zone.

terraform {
  required_version = ">= 1.10" # native S3 state locking (use_lockfile)

  required_providers {
    # Exact versions, each released at least two weeks before it was adopted. 6.x for the
    # nodejs24.x Lambda runtime, which the 5.x line predates.
    aws = {
      source  = "hashicorp/aws"
      version = "6.70.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "2.7.1"
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

variable "dictionary_on_request" {
  description = "Serve the dictionary's pages from its server (true) or from the bucket (false: before the cutover, and the rollback). Set by the STAGING_DICTIONARY_ON_REQUEST Actions variable (terraform-staging.yml)."
  type        = bool
  default     = false
}

# The directory-index function moved into the dictionary module (#209), under the same name.
moved {
  from = aws_cloudfront_function.dictionary_directory_index
  to   = module.dictionary_server.aws_cloudfront_function.directory_index
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

# The shared audio bucket (#164): production's stack owns it and its policy, which lets this
# account's distributions read it. Staging serves the same clips and never writes them. Its name
# and address are built here, not looked up: a lookup fails this plan until production is
# applied, and production is applied only after a change merges, so the change adding the bucket
# could never plan green. Apply production first all the same: until the bucket exists, staging's
# /audio/* has nothing behind it, and the check below warns.
locals {
  audio_bucket = "${var.project_name}-audio-${data.aws_caller_identity.current.account_id}"
  # Production's region, which is this stack's (eu-west-3).
  audio_bucket_domain = "${local.audio_bucket}.s3.${var.aws_region}.amazonaws.com"
}

# A warning, never a failure: a data source inside a check block that cannot be read (the
# bucket does not exist yet) or an assert that does not hold is reported, and the plan goes on.
check "audio_bucket" {
  data "aws_s3_bucket" "audio" {
    bucket = local.audio_bucket
  }

  assert {
    condition     = data.aws_s3_bucket.audio.bucket_regional_domain_name == local.audio_bucket_domain
    error_message = "The shared audio bucket is at ${data.aws_s3_bucket.audio.bucket_regional_domain_name}, not ${local.audio_bucket_domain} as staging builds it: fix local.audio_bucket_domain."
  }
}

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

# The dictionary's server, rendering its pages on request (#209).
module "dictionary_server" {
  source = "../modules/dictionary-server"

  name             = "${var.project_name}-staging-dictionary"
  site_origin      = "https://${var.site_domain}"
  distribution_arn = aws_cloudfront_distribution.website.arn
  # Staging serves a second copy of every page: keep it out of search engines, as the rest.
  extra_response_headers = { "X-Robots-Tag" = "noindex, nofollow" }

  tags = { Environment = "staging" }
}

module "spa_fallback" {
  source = "../modules/spa-fallback"
  name   = "${var.project_name}-staging-spa-fallback"
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

  origin {
    domain_name              = module.dictionary_server.origin_domain
    origin_id                = "dictionary-server"
    origin_access_control_id = module.dictionary_server.origin_access_control_id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # The shared audio bucket. OAC signs for any S3 origin, so the site's one is reused.
  origin {
    domain_name              = local.audio_bucket_domain
    origin_id                = "S3-${local.audio_bucket}"
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

    function_association {
      event_type   = "viewer-request"
      function_arn = module.spa_fallback.arn
    }
  }

  # The dictionary (apps/gokan-dictionary), at /dictionary/ on this hostname, as on production
  # (../main.tf, where the split is explained): a file (a path with a dot: the hashed assets, the
  # search index, the sitemap, the favicon) from the bucket, a page from the dictionary's server.
  # The first matching behavior wins, so the files' comes first.
  dynamic "ordered_cache_behavior" {
    for_each = var.dictionary_on_request ? [1] : []
    content {
      path_pattern     = "/dictionary/*.*"
      allowed_methods  = ["GET", "HEAD", "OPTIONS"]
      cached_methods   = ["GET", "HEAD", "OPTIONS"]
      target_origin_id = "S3-${aws_s3_bucket.website.id}"

      cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
      response_headers_policy_id = aws_cloudfront_response_headers_policy.staging_noindex.id
      viewer_protocol_policy     = "redirect-to-https"
      compress                   = true
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.dictionary_on_request ? [1] : []
    content {
      path_pattern     = "/dictionary/*"
      allowed_methods  = ["GET", "HEAD", "OPTIONS"]
      cached_methods   = ["GET", "HEAD", "OPTIONS"]
      target_origin_id = "dictionary-server"

      cache_policy_id            = module.dictionary_server.cache_policy_id
      response_headers_policy_id = module.dictionary_server.response_headers_policy_id
      viewer_protocol_policy     = "redirect-to-https"
      compress                   = true
    }
  }

  # Before the cutover, and on rollback: every dictionary file and page from the bucket, as the
  # static deploy uploaded it.
  dynamic "ordered_cache_behavior" {
    for_each = var.dictionary_on_request ? [] : [1]
    content {
      path_pattern     = "/dictionary/*"
      allowed_methods  = ["GET", "HEAD", "OPTIONS"]
      cached_methods   = ["GET", "HEAD", "OPTIONS"]
      target_origin_id = "S3-${aws_s3_bucket.website.id}"

      cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
      response_headers_policy_id = aws_cloudfront_response_headers_policy.staging_noindex.id
      viewer_protocol_policy     = "redirect-to-https"
      compress                   = true

      function_association {
        event_type   = "viewer-request"
        function_arn = module.dictionary_server.directory_index_function_arn
      }
    }
  }

  # Clips, as on production (../main.tf, where the cache and the SPA fallback are explained).
  ordered_cache_behavior {
    path_pattern     = "/audio/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${local.audio_bucket}"

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized

    viewer_protocol_policy     = "redirect-to-https"
    compress                   = false
    response_headers_policy_id = aws_cloudfront_response_headers_policy.staging_noindex.id
  }

  # No custom_error_response: the app's routes get its shell from the routing function
  # (../modules/spa-fallback), so every other error reaches the visitor as it was sent.

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
      },
      {
        # Listing lets S3 answer a missing key with 404, not 403: a missing /dataset/ file is
        # then "absent" to the reader both apps share (isMissingFile), as it was when the SPA
        # fallback answered it with the app's shell.
        Sid       = "AllowCloudFrontListForNotFound"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:ListBucket"
        Resource  = aws_s3_bucket.website.arn
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

output "dictionary_function_name" {
  description = "The dictionary server's Lambda, set as the STAGING_DICTIONARY_FUNCTION Actions variable"
  value       = module.dictionary_server.function_name
}

output "website_url" {
  value = "https://${var.site_domain}"
}
