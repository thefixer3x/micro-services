#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install: https://cli.github.com/"
  exit 1
fi

OWNER="${1:-}"
REPO="${2:-}"
CSV_PATH="${3:-data/issues.csv}"

if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
  echo "Usage: $0 <OWNER> <REPO> [issues.csv]"
  exit 1
fi

if [ ! -f "$CSV_PATH" ]; then
  echo "CSV file not found: $CSV_PATH"
  exit 1
fi

echo "Importing issues into $OWNER/$REPO from $CSV_PATH ..."
# CSV columns: title,body,labels
tail -n +2 "$CSV_PATH" | while IFS=',' read -r title body labels; do
  # Handle commas inside fields by using Python to parse CSV robustly
  python3 - <<'PY'
import sys, csv, os, json, subprocess, shlex
OWNER = os.environ.get("OWNER")
REPO = os.environ.get("REPO")
CSV_PATH = os.environ.get("CSV_PATH")
with open(CSV_PATH, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        title = row.get("title","").strip()
        body = row.get("body","").strip()
        labels = [l.strip() for l in (row.get("labels","").split(";")) if l.strip()]
        if not title:
            continue
        cmd = ["gh","issue","create","-R", f"{OWNER}/{REPO}","-t", title,"-b", body]
        if labels:
            for lb in labels:
                cmd.extend(["-l", lb])
        # Create issue
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as e:
            print("Error creating issue:", e.stdout.decode("utf-8","ignore"))
PY
done
echo "Done."
