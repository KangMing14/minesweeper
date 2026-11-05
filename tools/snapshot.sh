#!/usr/bin/env bash
# Makes a zip of the repository to attach to a Claude conversation.
#
# Usage (run from anywhere inside the repo, in Git Bash on Windows or any shell on macOS/Linux):
#   tools/snapshot.sh                      # whole repo (files git knows about, minus ignored files)
#   tools/snapshot.sh packages/engine      # root-level files + only the listed folders
#   tools/snapshot.sh packages/engine packages/protocol docs/adr
#
# What it includes: files tracked by git plus new files that are not ignored.
# What it leaves out: everything in .gitignore (node_modules, dist, coverage, ...),
# the .git folder, and any .env file except .env.example.
# The zip is written to ../snapshots/ (outside the repo, so it is never committed).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
mkdir -p ../snapshots
stamp="$(date +%Y%m%d-%H%M)"
suffix=""
if [ "$#" -gt 0 ]; then suffix="-partial"; fi
out="../snapshots/minesweeper-${stamp}${suffix}.zip"

list_all() { git ls-files --cached --others --exclude-standard; }

if [ "$#" -eq 0 ]; then
  files="$(list_all)"
else
  files="$( { list_all | grep -v '/' || true
              for p in "$@"; do git ls-files --cached --others --exclude-standard -- "$p"; done
            } | sort -u )"
fi

# Never include secrets: drop .env and .env.* but keep .env.example
files="$(printf '%s\n' "$files" | awk '!/(^|\/)\.env(\.|$)/ || /\.env\.example$/')"

if [ -z "$files" ]; then
  echo "No files matched." >&2
  exit 1
fi

printf '%s\n' "$files" | zip -q "$out" -@
count="$(printf '%s\n' "$files" | wc -l | tr -d ' ')"
size="$(du -h "$out" | cut -f1)"
echo "Wrote $out ($count files, $size)"
