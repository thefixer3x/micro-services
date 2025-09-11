# Project Setup (Optional but Recommended)

These steps help you stand up a GitHub **Project** (the new Projects, not classic) and pipe imported issues into it.

## 1) Create a Project (Org-level or User-level)

```bash
# Org-level example
gh project create --owner <ORG> --title "Platform Delivery" --format json --fields "Status:To do,In progress,Blocked,Done" > project.json

# User-level example
gh project create --user <USER> --title "Platform Delivery" --format json --fields "Status:To do,In progress,Blocked,Done" > project.json
```

Capture the project number from `project.json`:
```bash
jq -r '.number' project.json
```

## 2) Add a "Status" field to issues automatically (optional)

If you created a "Status" field, you can bulk set label-to-status policies manually, or rely on labels that map to status columns.

## 3) Add Issues to the Project

```bash
PROJECT_NUMBER=<NUMBER_FROM_STEP_1>
OWNER=<ORG_OR_USER>
REPO=<REPO>

# Add the last 200 open issues
gh issue list -R "$OWNER/$REPO" --state open --limit 200 --json number   | jq -r '.[].number'   | xargs -I {} gh project item-add --owner "$OWNER" --number "$PROJECT_NUMBER" --url "https://github.com/$OWNER/$REPO/issues/{}"
```

## 4) Automations (Optional)

- Use GitHub Actions to auto-add new issues to the project.
- Use label-based workflows to drive status.

See `.github/workflows/auto-project.yml` for a starter workflow.
