#!/bin/bash
# GitHub-ClickUp Automation Quick Setup Script

echo "🚀 GitHub-ClickUp Automation Setup"
echo "=================================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository. Please run this from your project root."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p .github/workflows
mkdir -p .github/clickup-sync

# Copy automation files
echo "📋 Copying automation files..."
if [ -f "git-click.ts" ]; then
    cp git-click.ts .github/clickup-sync/index.ts
    echo "✅ Copied git-click.ts to .github/clickup-sync/index.ts"
else
    echo "⚠️  Warning: git-click.ts not found in current directory"
fi

# Create GitHub workflow
echo "📝 Creating GitHub Actions workflow..."
cat > .github/workflows/clickup-sync.yml << 'EOF'
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
EOF

echo "✅ Created .github/workflows/clickup-sync.yml"

# Create environment template
echo "🔐 Creating environment template..."
cat > .github/clickup-sync/.env.example << 'EOF'
# ClickUp Configuration
CLICKUP_API_KEY=your_clickup_api_key_here
CLICKUP_LIST_ID=your_list_id_here
CLICKUP_WORKSPACE_ID=your_workspace_id_here

# GitHub Configuration (usually auto-populated in Actions)
GITHUB_TOKEN=your_github_token_here
GITHUB_REPOSITORY=owner/repo

# Optional: User Mapping (GitHub username -> ClickUp user ID)
GITHUB_TO_CLICKUP_USER_MAP={"seyederick":"170610275"}
EOF

echo "✅ Created .github/clickup-sync/.env.example"

# Install dependencies
echo "📦 Installing dependencies..."
cd .github/clickup-sync
npm install
cd ../..

echo ""
echo "✨ Setup complete! Next steps:"
echo ""
echo "1. Get your ClickUp API key:"
echo "   https://app.clickup.com/settings/apps"
echo ""
echo "2. Find your ClickUp List ID:"
echo "   curl -X GET https://api.clickup.com/api/v2/team -H \"Authorization: YOUR_API_KEY\""
echo ""
echo "3. Add secrets to GitHub:"
echo "   - Go to: Settings → Secrets → Actions"
echo "   - Add: CLICKUP_API_KEY"
echo "   - Add: CLICKUP_LIST_ID"
echo ""
echo "4. Test locally:"
echo "   cd .github/clickup-sync"
echo "   cp .env.example .env"
echo "   # Edit .env with your values"
echo "   npm test"
echo ""
echo "5. Commit and push to activate:"
echo "   git add .github"
echo "   git commit -m \"feat: add GitHub-ClickUp automation\""
echo "   git push"
echo ""
echo "📚 Full documentation: git-click-automation.md"
