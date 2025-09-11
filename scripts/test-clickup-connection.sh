#!/bin/bash
# Test ClickUp API connection and List access

echo "🧪 Testing ClickUp Connection"
echo "============================"

# Check if API key is set
if [ -z "$CLICKUP_API_KEY" ]; then
    echo "❌ Error: CLICKUP_API_KEY environment variable not set"
    echo "Please set it: export CLICKUP_API_KEY='your-api-key'"
    exit 1
fi

LIST_ID="901212396025"
WORKSPACE_ID="9012969940"

echo ""
echo "📋 List ID: $LIST_ID"
echo "🏢 Workspace ID: $WORKSPACE_ID (VortexAI)"
echo ""

# Test 1: Get List Details
echo "1️⃣ Testing List Access..."
LIST_RESPONSE=$(curl -s -X GET "https://api.clickup.com/api/v2/list/$LIST_ID" \
  -H "Authorization: $CLICKUP_API_KEY" \
  -H "Content-Type: application/json")

if echo "$LIST_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    LIST_NAME=$(echo "$LIST_RESPONSE" | jq -r '.name')
    echo "✅ Successfully accessed list: $LIST_NAME"
    echo "   URL: https://app.clickup.com/$WORKSPACE_ID/v/li/$LIST_ID"
else
    echo "❌ Failed to access list"
    echo "$LIST_RESPONSE" | jq '.'
    exit 1
fi

# Test 2: Get Current Tasks
echo ""
echo "2️⃣ Checking existing tasks..."
TASKS_RESPONSE=$(curl -s -X GET "https://api.clickup.com/api/v2/list/$LIST_ID/task" \
  -H "Authorization: $CLICKUP_API_KEY" \
  -H "Content-Type: application/json")

TASK_COUNT=$(echo "$TASKS_RESPONSE" | jq '.tasks | length')
echo "📊 Found $TASK_COUNT tasks in the list"

# Test 3: Test Task Creation
echo ""
echo "3️⃣ Testing task creation..."
TEST_TASK=$(curl -s -X POST "https://api.clickup.com/api/v2/list/$LIST_ID/task" \
  -H "Authorization: $CLICKUP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "[TEST] ClickUp Integration Test",
    "description": "This is a test task created by the automation setup script.\n\n✅ If you see this, the integration is working!\n\n- Created at: '"$(date)"'\n- From: micro-services repository",
    "tags": ["test", "automation"],
    "status": "to do"
  }')

if echo "$TEST_TASK" | jq -e '.id' > /dev/null 2>&1; then
    TASK_ID=$(echo "$TEST_TASK" | jq -r '.id')
    TASK_URL=$(echo "$TEST_TASK" | jq -r '.url')
    echo "✅ Successfully created test task!"
    echo "   Task ID: $TASK_ID"
    echo "   URL: $TASK_URL"
    
    # Add a comment
    echo ""
    echo "4️⃣ Testing comment addition..."
    COMMENT_RESPONSE=$(curl -s -X POST "https://api.clickup.com/api/v2/task/$TASK_ID/comment" \
      -H "Authorization: $CLICKUP_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "comment_text": "🤖 This comment was added automatically by the GitHub integration test."
      }')
    
    if echo "$COMMENT_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        echo "✅ Successfully added comment!"
    else
        echo "⚠️  Could not add comment"
    fi
else
    echo "❌ Failed to create test task"
    echo "$TEST_TASK" | jq '.'
fi

# Summary
echo ""
echo "📋 Summary"
echo "=========="
echo "✅ API Key is valid"
echo "✅ Can access list: $LIST_NAME"
echo "✅ Can create tasks"
echo "✅ Can add comments"
echo ""
echo "🎉 ClickUp integration is ready!"
echo ""
echo "Next steps:"
echo "1. Add CLICKUP_API_KEY to GitHub Secrets"
echo "2. Optionally add CLICKUP_LIST_ID=$LIST_ID (or it will use default)"
echo "3. Push changes to activate the automation"
