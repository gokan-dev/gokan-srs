# IAM policies for the dictionary's server (#209)

The two CI users are made by hand, outside Terraform (as the audio key is, `../main.tf`). These
are the permissions the dictionary's server adds to each, scoped to its own resources: the
function, role and log group named `gokan-srs-dictionary` and `gokan-srs-staging-dictionary`.
Attach each as an inline policy before the first plan or deploy that needs it.

- `terraform-ci-dictionary-server.json`, on `gokan-terraform-ci` (the `TF_AWS_*` secrets):
  create and manage the function, its role, Function URL, permissions and log group, and the
  CloudFront functions, cache and response headers policies and origin access controls the
  stacks now hold. A user that already has the CloudFront actions keeps them; the statement only
  makes the list explicit.
- `deploy-dictionary-server.json`, on the site's deploy user (the `AWS_*` secrets of the deploy
  workflows): upload the server's code (`aws lambda update-function-code`) and wait for it.
