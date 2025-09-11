#!/bin/bash
# Script to setup ClickUp space and list for GitHub integration

echo "🔧 ClickUp Setup Script for Micro-Services Project"
echo "================================================"

# Check if API key is set
if [ -z "$CLICKUP_API_KEY" ]; then
    echo "❌ Error: CLICKUP_API_KEY environment variable not set"
    echo "Please set it: export CLICKUP_API_KEY='your-api-key'"
    exit 1
fi

# VortexAI Team ID
TEAM_ID="9012969940"
SPACE_NAME="Micro-Services"
LIST_NAME="GitHub Issues"

echo ""
echo "📍 Using VortexAI workspace (Team ID: $TEAM_ID)"
echo ""

# Step 1: Get existing spaces
echo "🔍 Checking for existing spaces..."
SPACES=$(curl -s -X GET "https://api.clickup.com/api/v2/team/$TEAM_ID/space" \
  -H "Authorization: $CLICKUP_API_KEY" \
  -H "Content-Type: application/json")

echo "$SPACES" | jq -r '.spaces[] | "   - \(.name) (ID: \(.id))"'

# Check if Micro-Services space exists
SPACE_ID=$(echo "$SPACES" | jq -r '.spaces[] | select(.name == "'$SPACE_NAME'") | .id')

if [ -z "$SPACE_ID" ]; then
    echo ""
    echo "📁 Creating new space: $SPACE_NAME..."
    
    # Create new space
    SPACE_RESPONSE=$(curl -s -X POST "https://api.clickup.com/api/v2/team/$TEAM_ID/space" \
      -H "Authorization: $CLICKUP_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "'$SPACE_NAME'",
        "multiple_assignees": true,
        "features": {
          "due_dates": {
            "enabled": true,
            "start_date": true,
            "remap_due_dates": false,
            "remap_closed_due_date": false
          },
          "sprints": {
            "enabled": false
          },
          "time_tracking": {
            "enabled": true
          },
          "tags": {
            "enabled": true
          },
          "time_estimates": {
            "enabled": true
          },
          "priorities": {
            "enabled": true,
            "priorities": [
              {"priority": "urgent", "color": "#f50000"},
              {"priority": "high", "color": "#ffcc00"},
              {"priority": "normal", "color": "#6fddff"},
              {"priority": "low", "color": "#d8d8d8"}
            ]
          }
        }
      }')
    
    SPACE_ID=$(echo "$SPACE_RESPONSE" | jq -r '.id')
    echo "✅ Created space with ID: $SPACE_ID"
else
    echo "✅ Found existing space: $SPACE_NAME (ID: $SPACE_ID)"
fi

# Step 2: Get lists in the space
echo ""
echo "🔍 Checking for lists in space..."
LISTS=$(curl -s -X GET "https://api.clickup.com/api/v2/space/$SPACE_ID/list" \
  -H "Authorization: $CLICKUP_API_KEY")

echo "$LISTS" | jq -r '.lists[] | "   - \(.name) (ID: \(.id))"'

# Check if GitHub Issues list exists
LIST_ID=$(echo "$LISTS" | jq -r '.lists[] | select(.name == "'$LIST_NAME'") | .id')

if [ -z "$LIST_ID" ]; then
    echo ""
    echo "📋 Creating new list: $LIST_NAME..."
    
    # Create new list
    LIST_RESPONSE=$(curl -s -X POST "https://api.clickup.com/api/v2/space/$SPACE_ID/list" \
      -H "Authorization: $CLICKUP_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "'$LIST_NAME'",
        "content": "GitHub issues automatically synced from thefixer3x/micro-services repository",
        "status": [
          {"status": "to do", "color": "#d3d3d3"},
          {"status": "in progress", "color": "#428bca"},
          {"status": "review", "color": "#ff9900"},
          {"status": "blocked", "color": "#cc0000"},
          {"status": "complete", "color": "#5cb85c"}
        ],
        "priority": {
          "priority": "urgent",
          "color": "#f50000"
        }
      }')
    
    LIST_ID=$(echo "$LIST_RESPONSE" | jq -r '.id')
    echo "✅ Created list with ID: $LIST_ID"
else
    echo "✅ Found existing list: $LIST_NAME (ID: $LIST_ID)"
fi

# Step 3: Output configuration
echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Add these to your GitHub Secrets:"
echo "  CLICKUP_API_KEY: [your-api-key]"
echo "  CLICKUP_LIST_ID: $LIST_ID"
echo "  CLICKUP_WORKSPACE_ID: $TEAM_ID"
echo ""
echo "List URL: https://app.clickup.com/$TEAM_ID/v/l/$LIST_ID"
echo ""
echo "Next steps:"
echo "1. Add the secrets to your GitHub repository"
echo "2. Run: ./setup-clickup-automation.sh"
echo "3. Push to GitHub to activate the automation"
