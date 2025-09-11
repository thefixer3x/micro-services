# Platform Functional Requirements – GitHub Import

This repository was generated from **Seyederick Platform functional requirements.xlsx** on 2025-09-11 00:56:06.

## What's inside

- `docs/` – Markdown renderings of each Excel sheet for quick browsing
- `data/issues.csv` – Issues extracted from the workbook (title, body, labels)
- `data/labels.csv` – Unique labels inferred from the workbook
- `.github/ISSUE_TEMPLATE/` – Standard issue templates for bugs & features
- `scripts/` – Helper scripts for importing labels and issues using the GitHub CLI

## Quick start

1. Create a **new empty repository on GitHub** (org or personal).
2. Clone it locally and copy these files in.
3. Ensure you have the [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`).
4. Run:
   ```bash
   # Create labels then import issues
   bash scripts/bootstrap_repo.sh <OWNER> <REPO>
   bash scripts/import_issues.sh <OWNER> <REPO> data/issues.csv
   ```
5. (Optional) Create a **Project** and add the imported issues. See `PROJECT_SETUP.md` for automation options.

> Note: You can re-run the import scripts safely; duplicates will be prevented if titles match and you keep the label set stable.
