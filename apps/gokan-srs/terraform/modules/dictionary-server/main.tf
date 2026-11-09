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
# limit of at least 10 plus every reservation (10 + 10 + 10 with both environments reserving). A
# new account's limit is 10, so the limit has to be raised through Service Quotas (AWS Lambda,
# Concurrent executions) before any reservation applies; 1,000 is the lowest value it accepts.
# The reservation below, not the account limit, is the dictionary's ceiling (#209).
variable "reserved_concurrency" {
  description = "Most concurrent renders: the cost ceiling against a crawler burst (throttled requests answer 429, never cached). null reserves nothing, so only the account's limit applies."
  type        = number
  default     = 10
  nullable    = true
}

variable "memory_mb" {
  description = "Memory, sized from the heaviest pages (375 MB peak on the largest sentence files, #206)"
  type        = number
  default     = 1024
}

variable "alarm_email" {
  description = "Where the server's usage alarms are sent; empty creates no alarm. An Actions variable, never committed: the repository is public."
  type        = string
  default     = ""
}

# Hourly invocations above which something other than visitors and crawlers filling the cache is
# rendering pages. Organic misses ran at a few dozen a minute after the cutover (#209); a
# deliberate full re-render (`Check: deployed dictionary`, about 40k in 20 minutes) trips it.
variable "alarm_invocations_per_hour" {
  type    = number
  default = 20000
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
  # The Web Adapter execs run.sh: without the executable bit the function fails at init and
  # answers 502, where the placeholder is meant to answer 503.
  output_file_mode = "0755"

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

# What a browser is told about a page with no Cache-Control of its own (a prerendered list page):
# revalidate every time, as for a page uploaded to S3 (cacheControlFor in @gokan/deploy). A
# function rather than a response headers policy, which production's Free plan refuses; a page
# that has its own Cache-Control keeps it.
resource "aws_cloudfront_function" "page_cache_control" {
  name    = "${var.name}-page-cache-control"
  runtime = "cloudfront-js-2.0"
  comment = "Dictionary pages without a Cache-Control: browser revalidation"
  publish = true

  code = <<-EOT
    function handler(event) {
      var response = event.response;
      if (!response.headers['cache-control']) {
        response.headers['cache-control'] = { value: 'public, max-age=0, must-revalidate' };
      }
      return response;
    }
  EOT
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

# Usage alarms, by email: renders far above the organic rate (a loop over URLs that each miss the
# cache, or a crawler gone wrong), and throttling (the reservation is full, so visitors get 429s).
# The reservation caps what a loop can cost; these say that it is happening. The subscription
# has to be confirmed once from the email AWS sends.
resource "aws_sns_topic" "alarms" {
  count = var.alarm_email == "" ? 0 : 1
  name  = "${var.name}-alarms"
  tags  = var.tags
}

resource "aws_sns_topic_subscription" "alarms_email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "invocations" {
  count               = var.alarm_email == "" ? 0 : 1
  alarm_name          = "${var.name}-invocations"
  alarm_description   = "Dictionary server: more than ${var.alarm_invocations_per_hour} renders in an hour (pages missing the cache far above the organic rate)"
  namespace           = "AWS/Lambda"
  metric_name         = "Invocations"
  dimensions          = { FunctionName = aws_lambda_function.server.function_name }
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = var.alarm_invocations_per_hour
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms[0].arn]
  ok_actions          = [aws_sns_topic.alarms[0].arn]
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "throttles" {
  count               = var.alarm_email == "" ? 0 : 1
  alarm_name          = "${var.name}-throttles"
  alarm_description   = "Dictionary server: over 100 throttled renders in 5 minutes (the reserved concurrency is full; visitors get 429s)"
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  dimensions          = { FunctionName = aws_lambda_function.server.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 100
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms[0].arn]
  ok_actions          = [aws_sns_topic.alarms[0].arn]
  tags                = var.tags
}

output "alarm_topic_arn" {
  description = "The usage alarms' SNS topic (null without an alarm_email)"
  value       = one(aws_sns_topic.alarms[*].arn)
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

output "page_cache_control_function_arn" {
  description = "Viewer-response function for the pages' behavior: the browser's Cache-Control default"
  value       = aws_cloudfront_function.page_cache_control.arn
}

output "directory_index_function_arn" {
  value = aws_cloudfront_function.directory_index.arn
}
