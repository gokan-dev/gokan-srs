# The dictionary's server (apps/gokan-dictionary, SvelteKit through @sveltejs/adapter-node): a
# Lambda on the Node 24 managed runtime, run through the AWS Lambda Web Adapter, reached only by
# the site's CloudFront distribution (a Function URL behind Origin Access Control). It renders
# the word, kanji and grammar point pages, and serves the prerendered list pages from its own
# bundle. One module, used by the production stack (../../main.tf) and the staging stack
# (../../staging/main.tf), so the two cannot drift. See docs/ARCHITECTURE.md, gokan-dictionary,
# Serving on request.
#
# Terraform owns the function's configuration, not its code: the deploy (deploy-site.yml)
# uploads each build with `aws lambda update-function-code`. The function is created from a
# placeholder that answers 503, so a stack applied before the first deploy serves an error, never
# a wrong page, and `ignore_changes` keeps applies from rolling a deployed build back.

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    archive = {
      source = "hashicorp/archive"
    }
  }
}

variable "name" {
  description = "Function name, e.g. gokan-srs-dictionary or gokan-srs-staging-dictionary"
  type        = string
}

variable "site_origin" {
  description = "The site the server is served on and reads the published dataset from, e.g. https://gokan-srs.com"
  type        = string
}

variable "distribution_arn" {
  description = "The CloudFront distribution allowed to invoke the function"
  type        = string
}

# AWS keeps at least 10 of an account's concurrency unreserved, so a reservation needs an account
# limit above 10 plus every reservation: a new account's limit is 10, raised through Service
# Quotas (AWS Lambda, Concurrent executions; 1,000 here, #209).
variable "reserved_concurrency" {
  description = "Most concurrent renders: the cost ceiling against a crawler burst (throttled requests answer 429, never cached)"
  type        = number
  default     = 10
}

variable "memory_mb" {
  description = "Memory, sized from the heaviest pages (375 MB peak on the largest sentence files, #206)"
  type        = number
  default     = 1024
}

variable "extra_response_headers" {
  description = "Headers added to every dictionary page response (staging's X-Robots-Tag)"
  type        = map(string)
  default     = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}

data "aws_region" "current" {}

# AWS Lambda Web Adapter v1.1.0 (2026-09-18), arm64: runs the Node server as it runs anywhere
# else and turns Lambda invocations into HTTP requests to it.
locals {
  web_adapter_layer = "arn:aws:lambda:${data.aws_region.current.region}:753240598075:layer:LambdaAdapterLayerArm64:30"
}

data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/.placeholder.zip"

  source {
    filename = "run.sh"
    # 404 on "/" (the adapter's readiness check, which must see a status below 500), 503 on the rest.
    content = "#!/bin/sh\nexec node -e \"require('http').createServer((q,s)=>{s.writeHead(q.url==='/'?404:503,{'cache-control':'no-store'});s.end('Not deployed yet')}).listen(process.env.PORT)\"\n"
  }
}

resource "aws_iam_role" "server" {
  name = var.name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

# Logs only: the server reads the published dataset over HTTP, like any client, so it needs no
# other permission.
resource "aws_iam_role_policy" "logs" {
  name = "logs"
  role = aws_iam_role.server.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.server.arn}:*"
    }]
  })
}

resource "aws_cloudwatch_log_group" "server" {
  name              = "/aws/lambda/${var.name}"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_lambda_function" "server" {
  function_name = var.name
  role          = aws_iam_role.server.arn
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "run.sh"
  memory_size   = var.memory_mb
  # A cold start reads the search index (about 2 MB) before the first page; a warm page renders
  # in under half a second. CloudFront waits 30 s for an origin.
  timeout = 20

  layers = [local.web_adapter_layer]

  reserved_concurrent_executions = var.reserved_concurrency

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      AWS_LAMBDA_EXEC_WRAPPER = "/opt/bootstrap"
      # The port the server listens on and the adapter forwards to.
      PORT         = "8080"
      AWS_LWA_PORT = "8080"
      # The adapter waits for the server before the first invocation. "/" is outside the base
      # path, so it answers 404 quickly, below the adapter's 500 "unhealthy" threshold.
      AWS_LWA_READINESS_CHECK_PATH = "/"
      # Where the dataset and the search index are read from: the site itself, through CloudFront.
      DATASET_ORIGIN = var.site_origin
      # adapter-node builds request URLs from it, not from the Function URL's host.
      ORIGIN = var.site_origin
    }
  }

  depends_on = [aws_cloudwatch_log_group.server, aws_iam_role_policy.logs]

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  tags = var.tags
}

# IAM auth: only a signed request (CloudFront's, through the OAC below) reaches the function.
resource "aws_lambda_function_url" "server" {
  function_name      = aws_lambda_function.server.function_name
  authorization_type = "AWS_IAM"
}

resource "aws_cloudfront_origin_access_control" "server" {
  name                              = var.name
  description                       = "Signs CloudFront's requests to the dictionary server's Function URL"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# The distribution may call the URL, and nothing else may. Both actions: a Function URL created
# since October 2025 checks lambda:InvokeFunction as well as lambda:InvokeFunctionUrl.
resource "aws_lambda_permission" "cloudfront_url" {
  statement_id  = "AllowCloudFrontInvokeFunctionUrl"
  action        = "lambda:InvokeFunctionUrl"
  function_name = aws_lambda_function.server.function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = var.distribution_arn
}

resource "aws_lambda_permission" "cloudfront_invoke" {
  statement_id  = "AllowCloudFrontInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.server.function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = var.distribution_arn
}

# Pages keep the cache lifetime the server gives them: a rendered page a year at the edge
# (s-maxage, invalidated by every deploy), a 404 five minutes, an error never
# (renderedPageCacheControl in @gokan/deploy). A prerendered list page carries no
# Cache-Control (the server sends it as a file), so it takes the default: a year at the edge as
# well. No query string, header or cookie is part of the key: no page reads one on the server.
resource "aws_cloudfront_cache_policy" "pages" {
  name        = "${var.name}-pages"
  comment     = "Dictionary pages: the server's Cache-Control, a year by default"
  min_ttl     = 0
  default_ttl = 31536000
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# What a browser is told about a page with no Cache-Control of its own (a prerendered list page):
# revalidate every time, as for a page uploaded to S3 (cacheControlFor in @gokan/deploy). A page
# that has one keeps it (override = false).
resource "aws_cloudfront_response_headers_policy" "pages" {
  name    = "${var.name}-pages"
  comment = "Dictionary pages: browser revalidation by default"

  custom_headers_config {
    items {
      header   = "Cache-Control"
      value    = "public, max-age=0, must-revalidate"
      override = false
    }

    dynamic "items" {
      for_each = var.extra_response_headers
      content {
        header   = items.key
        value    = items.value
        override = true
      }
    }
  }
}

# While the dictionary's pages are served from the bucket (before the cutover, and on rollback:
# the stacks' dictionary_on_request = false), a directory-style URL is rewritten onto its object
# key. The bucket is reached through OAC (the REST endpoint), which, unlike the S3 website
# endpoint, resolves no directory index: /dictionary/vocab/1589350/ would be a missing key.
resource "aws_cloudfront_function" "directory_index" {
  name    = "${var.name}-directory-index"
  runtime = "cloudfront-js-2.0"
  comment = "Appends index.html to directory-style dictionary URLs (pages served from the bucket)"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
      } else if (!uri.split('/').pop().includes('.')) {
        // Extensionless and no trailing slash (e.g. /dictionary/vocab/1589350): the same page.
        request.uri = uri + '/index.html';
      }

      return request;
    }
  EOT
}

output "function_name" {
  value = aws_lambda_function.server.function_name
}

output "origin_domain" {
  description = "The Function URL's host, as a CloudFront origin domain"
  value       = trimsuffix(trimprefix(aws_lambda_function_url.server.function_url, "https://"), "/")
}

output "origin_access_control_id" {
  value = aws_cloudfront_origin_access_control.server.id
}

output "cache_policy_id" {
  value = aws_cloudfront_cache_policy.pages.id
}

output "response_headers_policy_id" {
  value = aws_cloudfront_response_headers_policy.pages.id
}

output "directory_index_function_arn" {
  value = aws_cloudfront_function.directory_index.arn
}
