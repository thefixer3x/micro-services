#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install: https://cli.github.com/"
  exit 1
fi

OWNER="${1:-}"
REPO="${2:-}"

if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
  echo "Usage: $0 <OWNER> <REPO>"
  exit 1
fi

echo "Creating labels in $OWNER/$REPO from data/labels.csv ..."

while IFS=, read -r name; do
  # skip header
  if [ "$name" = "name" ]; then continue; fi
  if [ -z "$name" ]; then continue; fi
  # Try to create; if exists, update color/desc lightly
  if gh label list -R "$OWNER/$REPO" | awk -F'\t' '{print $1}' | grep -iq "^${name}$"; then
    echo "Label exists: $name"
  else
    gh label create "$name" -R "$OWNER/$REPO" || true
  fi
done < data/labels.csv

echo "Done."
