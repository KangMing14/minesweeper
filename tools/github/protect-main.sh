#!/usr/bin/env bash
# Applies the repository merge settings and the `main` branch protection from DEVELOPMENT_GUIDE.md.
# Usage: tools/github/protect-main.sh OWNER/REPO [CHECK_NAME]
#   CHECK_NAME  Name of the CI job to require: `ci` (.github/workflows/ci.yml, M0-T04). Omit it until the
#               workflow has run once; re-run with `ci` afterwards. The script is idempotent.
# Requires: gh (authenticated, with admin rights on the repository).
set -euo pipefail

REPO="${1:?usage: protect-main.sh OWNER/REPO [CHECK_NAME]}"
CHECK="${2:-}"

# Squash-merge only: each task becomes one commit on main, titled by the PR title.
gh api -X PATCH "repos/${REPO}" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=BLANK >/dev/null

if [ -n "$CHECK" ]; then
  CHECKS="{\"strict\": true, \"contexts\": [\"${CHECK}\"]}"
else
  CHECKS="null"
fi

# Required approvals are 0 on purpose: a solo developer cannot approve their own PR.
# The PR is still required, and it is the gate where CI and /requesting-code-review run.
# enforce_admins=true applies the rules to the repository owner as well.
gh api -X PUT "repos/${REPO}/branches/main/protection" --input - >/dev/null <<JSON
{
  "required_status_checks": ${CHECKS},
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

echo "Applied settings and protection to ${REPO}:main${CHECK:+ (required check: ${CHECK})}"
