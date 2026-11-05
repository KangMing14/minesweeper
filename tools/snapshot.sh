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
#
# Zip tool: uses the first one found of zip, 7z/7za/7zz, python3/python, PowerShell.
# Git Bash on Windows has none of the first one, so the others are fallbacks.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
mkdir -p ../snapshots
stamp="$(date +%Y%m%d-%H%M)"
suffix=""
if [ "$#" -gt 0 ]; then suffix="-partial"; fi
out="$(cd ../snapshots && pwd)/minesweeper-${stamp}${suffix}.zip"
rm -f "$out"

list_all() { git ls-files --cached --others --exclude-standard; }

if [ "$#" -eq 0 ]; then
  files="$(list_all)"
else
  files="$( { list_all | grep -v "/" || true
              for p in "$@"; do git ls-files --cached --others --exclude-standard -- "$p"; done
            } | sort -u )"
fi

# Never include secrets: drop .env and .env.* but keep .env.example
files="$(printf "%s\n" "$files" | awk "!/(^|\/)\.env(\.|\$)/ || /\.env\.example\$/")"

if [ -z "$files" ]; then
  echo "No files matched." >&2
  exit 1
fi

# Tools that can zip a list of paths directly, keeping repo-relative paths.
zip_with_list() {
  if command -v zip >/dev/null 2>&1; then
    printf "%s\n" "$files" | zip -q "$out" -@
  elif command -v 7z >/dev/null 2>&1 || command -v 7za >/dev/null 2>&1 || command -v 7zz >/dev/null 2>&1; then
    local z; z="$(command -v 7z || command -v 7za || command -v 7zz)"
    printf "%s\n" "$files" > "$list_file"
    "$z" a -tzip -bd -bso0 "$out" "@$list_file"
  elif command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1; then
    local py; py="$(command -v python3 || command -v python)"
    printf "%s\n" "$files" | "$py" -c "
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], \"w\", zipfile.ZIP_DEFLATED) as z:
    for line in sys.stdin:
        p = line.rstrip(\"\r\n\")
        if p:
            z.write(p, p)
" "$out"
  else
    return 1
  fi
}

# Last resort: stage a copy of the files, then zip the folder with PowerShell.
zip_with_powershell() {
  local ps
  ps="$(command -v powershell.exe || command -v pwsh || true)"
  [ -n "$ps" ] || return 1
  local stage; stage="$(mktemp -d)"
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    mkdir -p "$stage/$(dirname "$f")"
    cp "$f" "$stage/$f"
  done <<<"$files"
  local win_stage win_out
  win_stage="$(cygpath -w "$stage" 2>/dev/null || echo "$stage")"
  win_out="$(cygpath -w "$out" 2>/dev/null || echo "$out")"
  "$ps" -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory(\"$win_stage\", \"$win_out\")"
  rm -rf "$stage"
}

list_file="$(mktemp)"
trap "rm -f \"$list_file\"" EXIT

if ! zip_with_list; then
  zip_with_powershell || {
    echo "No zip tool found. Install one of: zip, 7-Zip, Python, or run from WSL (sudo apt install zip)." >&2
    exit 1
  }
fi

count="$(printf "%s\n" "$files" | wc -l | tr -d " ")"
size="$(du -h "$out" | cut -f1)"
echo "Wrote $out ($count files, $size)"
