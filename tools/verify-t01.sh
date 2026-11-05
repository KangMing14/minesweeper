#!/usr/bin/env bash
# Verifies the M0-T01 repository conventions.
# Usage: tools/verify-t01.sh                      local checks (files, content, ignore rules, LF normalization)
#        tools/verify-t01.sh --remote OWNER/REPO  also checks GitHub settings and branch protection (needs gh, authenticated)
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 2
pass=0; fail=0
ok()  { echo "  ok   $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL $1"; fail=$((fail + 1)); }
check() { local d=$1; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }

echo "Files"
for f in .gitignore .gitattributes .editorconfig .env.example .github/pull_request_template.md \
         DEVELOPMENT_GUIDE.md README.md tools/github/protect-main.sh; do
  check "exists: $f" test -f "$f"
done

echo "Line endings and editor config"
check ".gitattributes sets '* text=auto eol=lf'" grep -qxF '* text=auto eol=lf' .gitattributes
check ".editorconfig is root, utf-8, lf" bash -c "grep -q '^root = true' .editorconfig && grep -q 'charset = utf-8' .editorconfig && grep -q 'end_of_line = lf' .editorconfig"

echo "Ignore rules"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
git init -q "$tmp/ignore"
[ -f .gitignore ] && cp .gitignore "$tmp/ignore/"
for p in node_modules/x dist/x coverage/x docs/api/x .env .env.local .worktrees/x; do
  check "ignored: $p" git -C "$tmp/ignore" check-ignore -q "$p"
done
check "tracked (not ignored): .env.example" bash -c "test -f .gitignore && ! git -C '$tmp/ignore' check-ignore -q .env.example"

echo "LF normalization from a CRLF-configured checkout"
for mode in true false; do
  d="$tmp/crlf-$mode"; git init -q "$d"
  [ -f .gitattributes ] && cp .gitattributes "$d/"
  git -C "$d" config core.autocrlf "$mode"
  printf 'a\r\nb\r\n' > "$d/crlf.txt"
  git -C "$d" add crlf.txt >/dev/null 2>&1
  check "CRLF file stored as LF (core.autocrlf=$mode)" bash -c "git -C '$d' ls-files --eol crlf.txt | grep -q '^i/lf'"
done

echo "PR template"
for s in "M[0-9]+-T[0-9]+" "Acceptance criteria" "Docs updated" "ROADMAP" "CHANGELOG" "ADR" "TSDoc"; do
  check "template mentions: $s" grep -Eq "$s" .github/pull_request_template.md
done

echo "Docs stubs"
check "DEVELOPMENT_GUIDE has branch naming rule" grep -qF 'm<n>/<task-id>-<slug>' DEVELOPMENT_GUIDE.md
check "DEVELOPMENT_GUIDE has Conventional Commits rule" grep -q 'Conventional Commits' DEVELOPMENT_GUIDE.md
check "DEVELOPMENT_GUIDE has squash-merge rule" grep -qi 'squash' DEVELOPMENT_GUIDE.md
check "no secrets in .env.example (placeholders only)" bash -c "! grep -Eq '=[A-Za-z0-9+/]{20,}' .env.example"

echo "Protection script"
check "protect-main.sh is executable" test -x tools/github/protect-main.sh
check "protect-main.sh passes bash -n" bash -n tools/github/protect-main.sh

if [ "${1:-}" = "--remote" ]; then
  R="${2:?usage: --remote OWNER/REPO}"
  echo "GitHub settings for $R"
  if ! command -v gh >/dev/null; then bad "gh CLI not installed"; else
    g() { gh api "repos/$R$1" --jq "$2" 2>/dev/null; }
    check "squash merge allowed"       test "$(g '' .allow_squash_merge)" = true
    check "merge commits disallowed"   test "$(g '' .allow_merge_commit)" = false
    check "rebase merge disallowed"    test "$(g '' .allow_rebase_merge)" = false
    check "linear history required"    test "$(g /branches/main/protection .required_linear_history.enabled)" = true
    check "force pushes blocked"       test "$(g /branches/main/protection .allow_force_pushes.enabled)" = false
    check "branch deletion blocked"    test "$(g /branches/main/protection .allow_deletions.enabled)" = false
    check "applies to admins"          test "$(g /branches/main/protection .enforce_admins.enabled)" = true
    check "pull request required"      test -n "$(g /branches/main/protection '.required_pull_request_reviews | tostring')"
  fi
fi

echo; echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
