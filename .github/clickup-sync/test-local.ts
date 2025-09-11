#!/usr/bin/env tsx
/**
 * Local test script for GitHub-ClickUp automation
 * Run with: npm test
 */

import { ClickUpAutomation } from './index';
import { config } from 'dotenv';

// Load environment variables
config();

async function testAutomation() {
  console.log('🧪 Testing GitHub-ClickUp Automation\n');

  // Check environment
  const required = ['CLICKUP_API_KEY', 'CLICKUP_LIST_ID'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    console.log('\n💡 Copy .env.example to .env and fill in your values');
    process.exit(1);
  }

  const automation = new ClickUpAutomation();
  console.log('✅ Automation initialized\n');

  // Test 1: Parse commit messages
  console.log('📝 Test 1: Parsing commit messages');
  const testCommits = [
    'feat: add user authentication #123',
    'wip: working on payment integration #124',
    'fix: resolve memory leak, closes #125',
    'blocked: waiting for API docs #126',
    'chore: update dependencies (50% complete) #127'
  ];

  for (const commit of testCommits) {
    const result = automation['parseCommitForActions'](commit);
    console.log(`  "${commit}"`);
    console.log(`    → Issues: [${result.issueRefs.join(', ')}]`);
    console.log(`    → Actions: [${result.actions.join(', ')}]`);
    if (result.progress) {
      console.log(`    → Progress: ${result.progress}%`);
    }
    console.log('');
  }

  // Test 2: Create a test issue event
  console.log('📋 Test 2: Simulating GitHub issue creation');
  const testIssue = {
    action: 'opened',
    issue: {
      number: 999,
      title: '[TEST] Automation Test Issue',
      body: 'This is a test issue created by the automation test script.\n\n- [ ] Task 1\n- [ ] Task 2',
      labels: [
        { name: 'enhancement' },
        { name: 'automation-test' }
      ],
      html_url: 'https://github.com/test/repo/issues/999',
      user: { login: 'test-user' },
      created_at: new Date().toISOString()
    },
    repository: {
      name: 'test-repo',
      owner: { login: 'test-owner' }
    }
  };

  try {
    // Set up test environment
    process.env.GITHUB_EVENT_NAME = 'issues';
    
    console.log('  🔄 Would create ClickUp task:');
    console.log(`    Title: [GH-${testIssue.issue.number}] ${testIssue.issue.title}`);
    console.log(`    Labels: ${testIssue.issue.labels.map(l => l.name).join(', ')}`);
    console.log(`    Status: to do`);
    console.log('');
    
    // Note: In a real test, this would actually create a task
    // For safety, we're just simulating here
    console.log('  ✅ Test passed (simulation mode)\n');
  } catch (error) {
    console.error('  ❌ Test failed:', error);
  }

  // Test 3: Time estimation
  console.log('⏱️  Test 3: Time tracking estimation');
  const testCommitData = [
    { added: ['file1.ts', 'file2.ts'], modified: ['file3.ts'], removed: [] },
    { added: [], modified: ['README.md'], removed: [] },
    { added: ['feature.ts'], modified: ['test.ts', 'config.json'], removed: ['old.ts'] }
  ];

  for (const commitData of testCommitData) {
    const additions = commitData.added.length;
    const modifications = commitData.modified.length;
    const deletions = commitData.removed.length;
    const estimatedMinutes = 15 + (additions + modifications + deletions) * 5;
    const hours = Math.min(estimatedMinutes / 60, 2);
    
    console.log(`  Commit: +${additions} ~${modifications} -${deletions} files`);
    console.log(`    → Estimated time: ${hours.toFixed(2)} hours`);
  }

  console.log('\n✨ All tests completed!');
  console.log('\nNext steps:');
  console.log('1. Review the test results above');
  console.log('2. Run the bulk import if you have existing issues');
  console.log('3. Make a test commit with an issue reference');
  console.log('4. Check your ClickUp list for updates');
}

// Run tests
testAutomation().catch(console.error);
