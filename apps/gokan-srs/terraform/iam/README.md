# IAM policies for the dictionary's server (#209)

The two CI users are made by hand, outside Terraform (as the audio key is, `../main.tf`). These
are the permissions the dictionary's server adds to each, scoped to its own resources: the
function, role and log group named `gokan-srs-dictionary` and `gokan-srs-staging-dictionary`.
Attach each before the first apply or deploy that needs it: the Terraform one as a customer
managed policy (`gokan-dictionary-server-terraform`, attached to the user; at about 2,600
characters it is over the 2,048 an inline user policy may hold), the deploy one inline.

- `terraform-ci-dictionary-server.json`, on `gokan-terraform-ci` (the `TF_AWS_*` secrets):
  create and manage the function, its role, Function URL, permissions and log group, and the
  CloudFront functions, cache and response headers policies and origin access controls the
  stacks now hold. A user that already has the CloudFront actions keeps them; the statement only
  makes the list explicit.
- `deploy-dictionary-server.json`, on the site's deploy user (the `AWS_*` secrets of the deploy
  workflows): upload the server's code (`aws lambda update-function-code`) and wait for it.
