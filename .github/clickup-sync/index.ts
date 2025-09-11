#!/usr/bin/env node
// Save as: ~/DevOps/_project_folders/micro-services/.github/clickup-sync/index.ts

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

/**
 * Zero-Touch ClickUp Automation System
 * 
 * This system automatically syncs your GitHub activity to ClickUp without manual intervention.
 * It watches for:
 * - Commits with issue references (#123)
 * - PR merges
 * - Issue state changes
 * - Branch creation/deletion
 * 
 * And automatically updates ClickUp tasks accordingly.
 */

interface GitHubEvent {
  action?: string;
  issue?: any;
  pull_request?: any;
  commits?: any[];
  ref?: string;
  repository: any;
}

interface ClickUpTask {
  id: string;
  name: string;
  status: string;
  github_issue?: number;
  github_pr?: number;
}

class ClickUpAutomation {
  private clickupApiKey: string;
  private clickupListId: string;
  private githubToClickupMap: Map<string, string> = new Map();
  
  constructor() {
    this.clickupApiKey = process.env.CLICKUP_API_KEY || '';
    this.clickupListId = process.env.CLICKUP_LIST_ID || '';
    this.loadMapping();
  }

  /**
   * Load or create GitHub Issue -> ClickUp Task mapping
   */
  private loadMapping() {
    try {
      const mapFile = '.github/clickup-sync/mapping.json';
      const data = JSON.parse(readFileSync(mapFile, 'utf8'));
      this.githubToClickupMap = new Map(Object.entries(data));
    } catch {
      // First run - will create mapping
      this.githubToClickupMap = new Map();
    }
  }

  /**
   * Save mapping for persistence
   */
  private saveMapping() {
    const mapFile = '.github/clickup-sync/mapping.json';
    const data = Object.fromEntries(this.githubToClickupMap);
    writeFileSync(mapFile, JSON.stringify(data, null, 2));
  }

  /**
   * Parse commit messages for issue references and task keywords
   */
  private parseCommitForActions(message: string): {
    issueRefs: number[];
    actions: string[];
    progress?: number;
  } {
    // Extract issue references (#123, GH-123, etc.)
    const issuePattern = /#(\d+)|GH-(\d+)/gi;
    const issueRefs: number[] = [];
    let match;
    while ((match = issuePattern.exec(message)) !== null) {
      issueRefs.push(parseInt(match[1] || match[2]));
    }

    // Extract action keywords
    const actions: string[] = [];
    const actionKeywords = {
      'wip': 'in progress',
      'working on': 'in progress',
      'started': 'in progress',
      'completed': 'complete',
      'done': 'complete',
      'fixed': 'complete',
      'resolved': 'complete',
      'closes': 'complete',
      'implements': 'in review',
      'ready for review': 'in review',
      'blocked': 'blocked',
      'waiting': 'blocked'
    };

    const lowerMessage = message.toLowerCase();
    for (const [keyword, status] of Object.entries(actionKeywords)) {
      if (lowerMessage.includes(keyword)) {
        actions.push(status);
      }
    }

    // Extract progress percentage if mentioned
    const progressMatch = message.match(/(\d+)%/);
    const progress = progressMatch ? parseInt(progressMatch[1]) : undefined;

    return { issueRefs, actions, progress };
  }

  /**
   * Create ClickUp task from GitHub issue
   */
  async createClickUpTask(issue: any): Promise<string> {
    const taskData = {
      name: `[GH-${issue.number}] ${issue.title}`,
      description: `${issue.body}\n\n---\n🔗 GitHub: ${issue.html_url}`,
      tags: issue.labels.map((l: any) => l.name),
      status: 'to do',
      custom_fields: [
        {
          id: 'github_issue_number',
          value: issue.number
        }
      ]
    };

    // Using MCP tool to create task
    const response = await this.callMCPTool('clickup-mcp:createTask', {
      list_id: this.clickupListId,
      name: taskData.name,
      description: taskData.description,
      tags: taskData.tags,
      status: taskData.status
    });

    return response.id;
  }

  /**
   * Update ClickUp task status based on GitHub activity
   */
  async updateClickUpTaskStatus(taskId: string, status: string, comment?: string) {
    await this.callMCPTool('clickup-mcp:updateTask', {
      task_id: taskId,
      status: status
    });

    if (comment) {
      await this.callMCPTool('clickup-mcp:addComment', {
        task_id: taskId,
        comment: `🤖 Auto-update: ${comment}`
      });
    }
  }

  /**
   * Main handler for GitHub webhook events
   */
  async handleGitHubWebhook(event: GitHubEvent) {
    const eventType = process.env.GITHUB_EVENT_NAME;

    switch (eventType) {
      case 'push':
        await this.handlePushEvent(event);
        break;
      
      case 'issues':
        await this.handleIssueEvent(event);
        break;
      
      case 'pull_request':
        await this.handlePREvent(event);
        break;
      
      case 'workflow_run':
        await this.handleWorkflowEvent(event);
        break;
    }
  }

  /**
   * Handle push events (commits)
   */
  private async handlePushEvent(event: GitHubEvent) {
    if (!event.commits) return;

    for (const commit of event.commits) {
      const { issueRefs, actions, progress } = this.parseCommitForActions(commit.message);
      
      for (const issueNum of issueRefs) {
        const clickupTaskId = this.githubToClickupMap.get(`issue-${issueNum}`);
        
        if (clickupTaskId) {
          // Determine new status
          const newStatus = actions[0] || 'in progress';
          
          // Update ClickUp task
          await this.updateClickUpTaskStatus(
            clickupTaskId,
            newStatus,
            `Commit by ${commit.author.name}: "${commit.message.substring(0, 100)}..."`
          );

          // Log time if commit indicates work done
          if (newStatus === 'in progress' || newStatus === 'complete') {
            await this.logTimeEntry(clickupTaskId, commit);
          }
        }
      }
    }
  }

  /**
   * Auto-log time based on commit activity
   */
  private async logTimeEntry(taskId: string, commit: any) {
    // Estimate time based on commit size and complexity
    const additions = commit.added?.length || 0;
    const modifications = commit.modified?.length || 0;
    const deletions = commit.removed?.length || 0;
    
    // Simple heuristic: 15 min base + 5 min per file touched
    const estimatedMinutes = 15 + (additions + modifications + deletions) * 5;
    const hours = Math.min(estimatedMinutes / 60, 2); // Cap at 2 hours per commit

    await this.callMCPTool('clickup-mcp:createTimeEntry', {
      task_id: taskId,
      hours: hours,
      description: `Auto-logged from commit: ${commit.id.substring(0, 7)}`
    });
  }

  /**
   * Handle issue events
   */
  private async handleIssueEvent(event: GitHubEvent) {
    if (!event.issue) return;

    const issueNum = event.issue.number;
    const clickupTaskId = this.githubToClickupMap.get(`issue-${issueNum}`);

    switch (event.action) {
      case 'opened':
        // Create new ClickUp task
        const taskId = await this.createClickUpTask(event.issue);
        this.githubToClickupMap.set(`issue-${issueNum}`, taskId);
        this.saveMapping();
        break;
      
      case 'closed':
        if (clickupTaskId) {
          await this.updateClickUpTaskStatus(
            clickupTaskId, 
            'complete',
            `Issue closed by ${event.issue.closed_by?.login}`
          );
        }
        break;
      
      case 'reopened':
        if (clickupTaskId) {
          await this.updateClickUpTaskStatus(
            clickupTaskId,
            'to do',
            'Issue reopened'
          );
        }
        break;
      
      case 'assigned':
        if (clickupTaskId && event.issue.assignee) {
          // Map GitHub user to ClickUp user (configure in env)
          await this.callMCPTool('clickup-mcp:updateTask', {
            task_id: clickupTaskId,
            assignees: [this.mapGitHubToClickUpUser(event.issue.assignee.login)]
          });
        }
        break;
    }
  }

  /**
   * Handle PR events
   */
  private async handlePREvent(event: GitHubEvent) {
    if (!event.pull_request) return;

    // Extract linked issues from PR body
    const linkedIssues = this.extractLinkedIssues(event.pull_request.body);
    
    for (const issueNum of linkedIssues) {
      const clickupTaskId = this.githubToClickupMap.get(`issue-${issueNum}`);
      
      if (clickupTaskId) {
        switch (event.action) {
          case 'opened':
            await this.updateClickUpTaskStatus(
              clickupTaskId,
              'in review',
              `PR #${event.pull_request.number} opened by ${event.pull_request.user.login}`
            );
            break;
          
          case 'closed':
            if (event.pull_request.merged) {
              await this.updateClickUpTaskStatus(
                clickupTaskId,
                'complete',
                `PR #${event.pull_request.number} merged! 🎉`
              );
            }
            break;
        }
      }
    }
  }

  /**
   * Handle workflow events (CI/CD status)
   */
  private async handleWorkflowEvent(event: any) {
    // Update task based on CI/CD results
    if (event.workflow_run?.conclusion === 'failure') {
      // Find related tasks and mark as blocked
      const branchName = event.workflow_run.head_branch;
      const issueMatch = branchName.match(/issue-(\d+)/);
      
      if (issueMatch) {
        const clickupTaskId = this.githubToClickupMap.get(`issue-${issueMatch[1]}`);
        if (clickupTaskId) {
          await this.updateClickUpTaskStatus(
            clickupTaskId,
            'blocked',
            `CI/CD failed on ${branchName}. Check workflow: ${event.workflow_run.html_url}`
          );
        }
      }
    }
  }

  /**
   * Extract linked issues from PR body
   */
  private extractLinkedIssues(body: string): number[] {
    if (!body) return [];
    
    const patterns = [
      /closes #(\d+)/gi,
      /fixes #(\d+)/gi,
      /resolves #(\d+)/gi,
      /relates to #(\d+)/gi
    ];
    
    const issues = new Set<number>();
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(body)) !== null) {
        issues.add(parseInt(match[1]));
      }
    }
    
    return Array.from(issues);
  }

  /**
   * Map GitHub username to ClickUp user ID
   */
  private mapGitHubToClickUpUser(githubUsername: string): string {
    const mapping: Record<string, string> = {
      'seyederick': '170610275',
      // Add more mappings as needed
    };
    
    return mapping[githubUsername] || '170610275'; // Default to you
  }

  /**
   * Call MCP tool (simplified - in real implementation, use actual MCP client)
   */
  private async callMCPTool(toolName: string, params: any): Promise<any> {
    console.log(`Calling MCP tool: ${toolName}`, params);
    // This would actually call the MCP tool
    // For now, we'll use the CLI approach
    
    const command = `echo '${JSON.stringify(params)}' | mcp-cli call ${toolName}`;
    const result = execSync(command, { encoding: 'utf8' });
    return JSON.parse(result);
  }
}

// GitHub Actions entry point
if (require.main === module) {
  const automation = new ClickUpAutomation();
  const eventPath = process.env.GITHUB_EVENT_PATH;
  
  if (eventPath) {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    automation.handleGitHubWebhook(event).catch(console.error);
  }
}

export { ClickUpAutomation };