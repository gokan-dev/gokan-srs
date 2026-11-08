# The gokan-srs app's routing, on the distribution's default behavior: a path naming no file (its
# last segment has no extension: /, /vocab/123, /settings) is one of the app's routes and gets the
# app's shell, /index.html; a path naming a file is that file, and a missing one is a real 404.
#
# This replaces the distribution-wide custom_error_response (403 and 404 -> /index.html at 200),
# which also answered for the dictionary: its server's 404 page, and a missing /dataset/ file,
# came back as the app's shell at 200. A function on the default behavior touches only what that
# behavior serves; /dictionary/* and /audio/* have their own.
#
# /dictionary itself (no slash) is not matched by /dictionary/*: it is sent there.

variable "name" {
  type = string
}

resource "aws_cloudfront_function" "spa_fallback" {
  name    = var.name
  runtime = "cloudfront-js-2.0"
  comment = "App routes get /index.html; files are served as they are"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      if (uri === '/dictionary') {
        return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: '/dictionary/' } } };
      }
      if (uri.split('/').pop().indexOf('.') === -1) {
        request.uri = '/index.html';
      }
      return request;
    }
  EOT
}

output "arn" {
  value = aws_cloudfront_function.spa_fallback.arn
}
