# IAM policies for the dictionary's server (#209)

The two CI users are made by hand, outside Terraform (as the audio key is, `../main.tf`). These
are the permissions the dictionary's server adds to each, scoped to its own resources: the
function, role and log group named `gokan-srs-dictionary` and `gokan-srs-staging-dictionary`.
Attach each before the first apply or deploy that needs it.

- `terraform-ci-dictionary-server.json`, on `gokan-terraform-ci` (the `TF_AWS_*` secrets):
  create and manage the function, its role, Function URL, permissions and log group. Its
  CloudFront functions, cache and response headers policies and origin access controls come
  under the `cloudfront:*` the user already has. Merged into the user's managed policy, or its
  own managed policy beside an inline one (a user's inline policies share 2,048 characters).
- `terraform-ci-dictionary-guards.json`, on `gokan-terraform-ci` as well: the guards against a
  render loop: the usage alarms (an SNS topic, its email subscription, two CloudWatch alarms)
  named after the function. No WAF permission: the Free plan's web ACL refuses a custom rule.
- `deploy-dictionary-server.json`, on the site's deploy user (the `AWS_*` secrets of the deploy
  workflows): upload the server's code (`aws lambda update-function-code`) and wait for it.
