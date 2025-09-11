# 🚀 GitHub-ClickUp Zero-Touch Automation System

## The Problem We're Solving
You've got 500+ GitHub issues ready to go, but ClickUp becomes another manual chore instead of a productivity multiplier. This system makes ClickUp update itself based on your actual GitHub activity - no manual ticking required.

## 🎯 How It Works

This automation watches your GitHub activity and automatically updates ClickUp:

- **Commit with `#123`** → Updates ClickUp task status
- **PR merged** → Marks task as complete
- **Issue closed** → Completes the ClickUp task
- **CI/CD fails** → Sets task to blocked
- **Time tracking** → Auto-logs time based on commit activity

## 📦 Quick Setup (10 minutes)

### 1. Install the Automation

```bash
# Clone into your project
cd ~/dev-hub/micro-services
npm install -D @types/node tsx

# Set up the automation directory
mkdir -p .github/workflows
mkdir -p .github/clickup-sync

# Copy the automation script
cp git-click.ts .github/clickup-sync/index.ts
```

### 2. Get Your API Keys

#### ClickUp API Key:
1. Go to [ClickUp Settings](https://app.clickup.com/settings/apps)
2. Click "Apps" → "ClickUp API"
3. Generate Personal API Token
4. Copy the token

#### ClickUp List ID:
```bash
# Find your workspace and list IDs
curl -X GET https://api.clickup.com/api/v2/team \
  -H "Authorization: YOUR_API_KEY" | jq

# Get your lists
curl -X GET https://api.clickup.com/api/v2/space/SPACE_ID/folder \
  -H "Authorization: YOUR_API_KEY" | jq
```

### 3. Configure GitHub Secrets

In your GitHub repo:
1. Go to Settings → Secrets → Actions
2. Add these secrets:
   - `CLICKUP_API_KEY`: Your ClickUp API token
   - `CLICKUP_LIST_ID`: Your target list ID
   - `CLICKUP_WORKSPACE_ID`: Your workspace ID

### 4. Create GitHub Action Workflow

Create `.github/workflows/clickup-sync.yml`:

```yaml
name: ClickUp Sync
on:
  issues:
    types: [opened, closed, reopened, assigned]
  pull_request:
    types: [opened, closed, merged]
  push:
    branches: [main, develop]
  workflow_run:
    workflows: ["CI/CD"]
    types: [completed]

jobs:
  sync-clickup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd .github/clickup-sync
          npm install
      
      - name: Run ClickUp Sync
        env:
          CLICKUP_API_KEY: ${{ secrets.CLICKUP_API_KEY }}
          CLICKUP_LIST_ID: ${{ secrets.CLICKUP_LIST_ID }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          cd .github/clickup-sync
          npx tsx index.ts
```

## 🔧 Advanced Configuration

### Custom Status Mapping

Edit the status mapping in `git-click.ts` to match your workflow:

```typescript
const statusMapping = {
  'wip': 'in progress',
  'working on': 'in progress',
  'ready for review': 'review',
  'needs feedback': 'feedback',
  'blocked': 'blocked',
  'done': 'complete',
  'shipped': 'deployed'
};
```

### Time Tracking Rules

Customize how time is auto-logged:

```typescript
// In logTimeEntry function
const timeRules = {
  documentation: 30,      // 30 min for docs
  feature: 120,          // 2 hours for features
  bugfix: 60,           // 1 hour for bugs
  refactor: 90,         // 1.5 hours for refactoring
  test: 45              // 45 min for tests
};
```

### Bulk Import Existing Issues

One-time script to import your 500+ GitHub issues:

```bash
# Create bulk-import.ts
cat > .github/clickup-sync/bulk-import.ts << 'EOF'
import { Octokit } from '@octokit/rest';
import { ClickUpAutomation } from './index';

async function bulkImport() {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
  
  const automation = new ClickUpAutomation();
  
  // Fetch all open issues
  const issues = await octokit.paginate(octokit.issues.listForRepo, {
    owner: 'your-username',
    repo: 'your-repo',
    state: 'open',
    per_page: 100
  });
  
  console.log(`Found ${issues.length} issues to import...`);
  
  for (const issue of issues) {
    console.log(`Importing issue #${issue.number}: ${issue.title}`);
    await automation.createClickUpTask(issue);
    
    // Rate limit protection
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✅ Import complete!');
}

bulkImport().catch(console.error);
EOF

# Run the import
GITHUB_TOKEN=your-token CLICKUP_API_KEY=your-key npx tsx bulk-import.ts
```

## 📊 Usage Examples

### 1. Working on an Issue

```bash
# Your normal workflow - ClickUp updates automatically!
git checkout -b feature/123-user-auth
git commit -m "wip: implementing JWT logic #123"
# → ClickUp task #123 moves to "In Progress"

git commit -m "feat: complete auth flow, ready for review #123"
git push origin feature/123-user-auth
# → ClickUp task #123 moves to "Review"
```

### 2. Closing Multiple Issues

```bash
git commit -m "fix: batch processing bugs

Closes #123, #124, #125
- Fixed memory leak in worker threads
- Corrected validation logic
- Updated error messages"

# → All three ClickUp tasks marked as complete
```

### 3. Blocking Issues

```bash
git commit -m "blocked: waiting on API changes #126"
# → ClickUp task #126 marked as blocked with comment
```

## 🎨 ClickUp Dashboard Setup

Create a custom ClickUp dashboard to track automation:

1. **Automation Status Widget**
   - Filter: Tasks updated by API
   - Group by: Status
   - Sort: Last updated

2. **Time Tracking Widget**
   - Show: Auto-logged time entries
   - Group by: Day/Week
   - Filter: Description contains "Auto-logged"

3. **GitHub Integration View**
   - Custom field: GitHub Issue Number
   - Custom field: GitHub PR Link
   - Custom field: Last Commit SHA

## 🔍 Monitoring & Debugging

### Check GitHub Action Logs

```bash
gh run list --workflow=clickup-sync
gh run view <run-id> --log
```

### View Mapping File

```bash
cat .github/clickup-sync/mapping.json
```

### Test Locally

```bash
# Test with a mock event
cd .github/clickup-sync
cat > test-event.json << 'EOF'
{
  "action": "opened",
  "issue": {
    "number": 999,
    "title": "Test Issue",
    "body": "Testing automation",
    "labels": [{"name": "bug"}],
    "html_url": "https://github.com/user/repo/issues/999"
  }
}
EOF

GITHUB_EVENT_PATH=./test-event.json \
GITHUB_EVENT_NAME=issues \
npx tsx index.ts
```

## 🚨 Troubleshooting

### Common Issues

1. **Tasks not updating**
   - Check GitHub Action logs
   - Verify API keys are correct
   - Ensure mapping.json has the correct issue→task mappings

2. **Rate limiting**
   - ClickUp API: 900 requests/minute
   - Add delays in bulk operations
   - Use webhook batching

3. **Missing tasks**
   - Run bulk import for existing issues
   - Check if issue was created before automation

### Reset Mapping

```bash
# If mapping gets corrupted
rm .github/clickup-sync/mapping.json
# Re-run bulk import
```

## 🎉 Benefits

1. **Zero Manual Updates**: Work in GitHub, ClickUp stays in sync
2. **Accurate Time Tracking**: Auto-logs based on actual commits
3. **Real-time Status**: Tasks reflect current development state
4. **Team Visibility**: Everyone sees the same status
5. **Historical Data**: Complete audit trail in ClickUp comments

## 🔮 Future Enhancements

### Coming Soon
- [ ] Slack notifications for status changes
- [ ] Custom field sync (priority, estimates)
- [ ] Two-way sync (ClickUp → GitHub)
- [ ] Sprint automation
- [ ] Burndown chart generation

### MCP Server Integration

For even more powerful automation, integrate with MCP:

```typescript
// Future: Direct MCP server connection
import { MCPClient } from '@modelcontextprotocol/client';

const mcp = new MCPClient({
  servers: {
    clickup: {
      command: 'npx',
      args: ['@mcp-servers/clickup'],
      env: {
        CLICKUP_API_KEY: process.env.CLICKUP_API_KEY
      }
    }
  }
});
```

## 📚 Additional Resources

- [ClickUp API Docs](https://clickup.com/api)
- [GitHub Actions Events](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)
- [MCP ClickUp Server](https://github.com/modelcontextprotocol/servers/tree/main/src/clickup)

---

## 🎯 Quick Start Checklist

- [ ] Copy `git-click.ts` to `.github/clickup-sync/index.ts`
- [ ] Get ClickUp API key and List ID
- [ ] Add GitHub secrets
- [ ] Create workflow file
- [ ] Test with a commit
- [ ] Run bulk import for existing issues
- [ ] Celebrate automation! 🎉

---

💡 **Pro Tip**: Start with a test repository first to fine-tune the automation before deploying to your main project.

🤝 **Need Help?**: The automation logs everything - check GitHub Actions logs first, then ClickUp activity feed.
