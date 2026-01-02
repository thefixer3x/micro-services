import { Router, Request, Response } from 'express';
import { getDatabase } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

export const adminRoutes = Router();

// ========================================================================
// Customer Management (Read-only views from other services)
// ========================================================================

adminRoutes.get('/customers', async (req: Request, res: Response) => {
  try {
    // This would typically call Identity Service API
    res.json({
      success: true,
      message: 'Customer list endpoint - integrate with Identity Service',
      data: [],
    });
  } catch (error: any) {
    logger.error('Failed to get customers:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// Support Tickets
// ========================================================================

adminRoutes.post('/tickets', async (req: Request, res: Response) => {
  try {
    const { customerId, category, priority, subject, description } = req.body;
    const db = getDatabase();

    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const result = await db.query(
      `INSERT INTO support_tickets (ticket_number, customer_id, category, priority, subject, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [ticketNumber, customerId, category, priority || 'medium', subject, description]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to create ticket:', error);
    res.status(500).json({ error: error.message });
  }
});

adminRoutes.get('/tickets', async (req: Request, res: Response) => {
  try {
    const { status, priority, page = 1, limit = 50 } = req.query;
    const db = getDatabase();

    let query = 'SELECT * FROM support_tickets WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get tickets:', error);
    res.status(500).json({ error: error.message });
  }
});

adminRoutes.get('/tickets/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const db = getDatabase();

    const ticketResult = await db.query(
      'SELECT * FROM support_tickets WHERE id = $1',
      [ticketId]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const messagesResult = await db.query(
      'SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC',
      [ticketId]
    );

    res.json({
      success: true,
      data: {
        ticket: ticketResult.rows[0],
        messages: messagesResult.rows,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get ticket:', error);
    res.status(500).json({ error: error.message });
  }
});

adminRoutes.put('/tickets/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const { status, assignedTo, resolution } = req.body;
    const db = getDatabase();

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (assignedTo) {
      updates.push(`assigned_to = $${paramIndex}`);
      params.push(assignedTo);
      paramIndex++;
    }

    if (resolution) {
      updates.push(`resolution = $${paramIndex}`);
      params.push(resolution);
      paramIndex++;
    }

    if (status === 'resolved' || status === 'closed') {
      updates.push(`resolved_at = NOW()`);
    }

    updates.push(`updated_at = NOW()`);
    params.push(ticketId);

    const query = `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to update ticket:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// Audit Logs
// ========================================================================

adminRoutes.post('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { adminUserId, actionType, resourceType, resourceId, changes } = req.body;
    const db = getDatabase();

    const result = await db.query(
      `INSERT INTO audit_logs (admin_user_id, action_type, resource_type, resource_id, changes, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        adminUserId,
        actionType,
        resourceType,
        resourceId,
        JSON.stringify(changes || {}),
        req.ip,
        req.get('user-agent'),
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to create audit log:', error);
    res.status(500).json({ error: error.message });
  }
});

adminRoutes.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { adminUserId, resourceType, page = 1, limit = 100 } = req.query;
    const db = getDatabase();

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (adminUserId) {
      query += ` AND admin_user_id = $${paramIndex}`;
      params.push(adminUserId);
      paramIndex++;
    }

    if (resourceType) {
      query += ` AND resource_type = $${paramIndex}`;
      params.push(resourceType);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get audit logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// Feature Flags
// ========================================================================

adminRoutes.get('/feature-flags', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM feature_flags ORDER BY flag_key ASC');

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Failed to get feature flags:', error);
    res.status(500).json({ error: error.message });
  }
});

adminRoutes.get('/feature-flags/:key', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const db = getDatabase();

    // Validate key format
    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      return res.status(400).json({ error: 'Invalid flag key format' });
    }

    const result = await db.query('SELECT * FROM feature_flags WHERE flag_key = $1', [key]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Failed to get feature flag:', error);
    res.status(500).json({ error: error.message });
  }
});

adminRoutes.post('/feature-flags', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { flagKey, flagValue, description, rolloutPercentage, enabledFor, disabledFor, metadata } = req.body;
    const db = getDatabase();

    // Validate key format
    if (!flagKey || !/^[a-zA-Z0-9_]+$/.test(flagKey)) {
      return res.status(400).json({ error: 'Invalid flag key format. Use alphanumeric and underscores only.' });
    }

    const result = await db.query(
      `INSERT INTO feature_flags (flag_key, flag_value, description, rollout_percentage, enabled_for, disabled_for, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        flagKey,
        flagValue || false,
        description,
        rolloutPercentage || 0,
        JSON.stringify(enabledFor || []),
        JSON.stringify(disabledFor || []),
        JSON.stringify(metadata || {})
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Failed to create feature flag:', error);
    res.status(500).json({ error: error.message });
  }
});

adminRoutes.put('/feature-flags/:key', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { flagValue, description, rolloutPercentage, enabledFor, disabledFor, metadata } = req.body;
    const db = getDatabase();

    // Validate key format
    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      return res.status(400).json({ error: 'Invalid flag key format' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (flagValue !== undefined) {
      updates.push(`flag_value = $${paramIndex++}`);
      params.push(flagValue);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (rolloutPercentage !== undefined) {
      updates.push(`rollout_percentage = $${paramIndex++}`);
      params.push(rolloutPercentage);
    }
    if (enabledFor !== undefined) {
      updates.push(`enabled_for = $${paramIndex++}`);
      params.push(JSON.stringify(enabledFor));
    }
    if (disabledFor !== undefined) {
      updates.push(`disabled_for = $${paramIndex++}`);
      params.push(JSON.stringify(disabledFor));
    }
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(metadata));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(key);

    const query = `UPDATE feature_flags SET ${updates.join(', ')} WHERE flag_key = $${paramIndex} RETURNING *`;
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Failed to update feature flag:', error);
    res.status(500).json({ error: error.message });
  }
});

adminRoutes.delete('/feature-flags/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const db = getDatabase();

    const result = await db.query('DELETE FROM feature_flags WHERE flag_key = $1 RETURNING id', [key]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    res.json({ success: true, message: 'Feature flag deleted' });
  } catch (error: any) {
    logger.error('Failed to delete feature flag:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if feature is enabled for a user
adminRoutes.get('/feature-flags/:key/check/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { key, userId } = req.params;
    const db = getDatabase();

    // Validate key format (alphanumeric with underscores)
    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      return res.status(400).json({ error: 'Invalid flag key format' });
    }

    const result = await db.query('SELECT * FROM feature_flags WHERE flag_key = $1', [key]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    const flag = result.rows[0];
    const disabledFor = flag.disabled_for || [];
    const enabledFor = flag.enabled_for || [];

    let isEnabled: boolean;

    // Proper precedence: disabled list > enabled list > rollout > global value
    if (disabledFor.includes(userId)) {
      // User explicitly disabled - highest priority
      isEnabled = false;
    } else if (enabledFor.includes(userId) || enabledFor.includes('all')) {
      // User explicitly enabled
      isEnabled = true;
    } else if (flag.rollout_percentage > 0 && flag.rollout_percentage < 100) {
      // Apply rollout percentage (deterministic based on userId hash)
      const hash = userId.split('').reduce((a: number, b: string) => ((a << 5) - a) + b.charCodeAt(0), 0);
      isEnabled = (Math.abs(hash) % 100) < flag.rollout_percentage;
    } else {
      // Fall back to global flag value
      isEnabled = flag.flag_value;
    }

    res.json({ success: true, data: { flagKey: key, userId, isEnabled } });
  } catch (error: any) {
    logger.error('Failed to check feature flag:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// Reporting Endpoints
// ========================================================================

adminRoutes.get('/reports/dashboard', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const ticketStats = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE status = 'closed') as closed,
        COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('resolved', 'closed')) as urgent_pending
      FROM support_tickets
    `);

    const todayActivity = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as tickets_today,
        COUNT(*) FILTER (WHERE resolved_at >= CURRENT_DATE) as resolved_today
      FROM support_tickets
    `);

    const auditCount = await db.query(
      'SELECT COUNT(*) as count FROM audit_logs WHERE created_at >= CURRENT_DATE'
    );

    res.json({
      success: true,
      data: {
        tickets: {
          total: parseInt(ticketStats.rows[0].total),
          open: parseInt(ticketStats.rows[0].open),
          inProgress: parseInt(ticketStats.rows[0].in_progress),
          resolved: parseInt(ticketStats.rows[0].resolved),
          closed: parseInt(ticketStats.rows[0].closed),
          urgentPending: parseInt(ticketStats.rows[0].urgent_pending),
        },
        today: {
          ticketsCreated: parseInt(todayActivity.rows[0].tickets_today),
          ticketsResolved: parseInt(todayActivity.rows[0].resolved_today),
          auditLogs: parseInt(auditCount.rows[0].count),
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get dashboard report:', error);
    res.status(500).json({ error: error.message });
  }
});

adminRoutes.get('/reports/tickets', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    const db = getDatabase();

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    const dateFormat = groupBy === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';

    const result = await db.query(`
      SELECT
        TO_CHAR(created_at, $3) as period,
        COUNT(*) as created,
        COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) as resolved,
        category,
        priority
      FROM support_tickets
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY period, category, priority
      ORDER BY period DESC
    `, [start, end, dateFormat]);

    const aggregated: Record<string, any> = {};
    result.rows.forEach((row: any) => {
      if (!aggregated[row.period]) {
        aggregated[row.period] = { period: row.period, created: 0, resolved: 0, byCategory: {}, byPriority: {} };
      }
      aggregated[row.period].created += parseInt(row.created);
      aggregated[row.period].resolved += parseInt(row.resolved);
      aggregated[row.period].byCategory[row.category] = (aggregated[row.period].byCategory[row.category] || 0) + parseInt(row.created);
      aggregated[row.period].byPriority[row.priority] = (aggregated[row.period].byPriority[row.priority] || 0) + parseInt(row.created);
    });

    res.json({
      success: true,
      data: { startDate: start.toISOString(), endDate: end.toISOString(), groupBy, periods: Object.values(aggregated) },
    });
  } catch (error: any) {
    logger.error('Failed to get ticket report:', error);
    res.status(500).json({ error: error.message });
  }
});

adminRoutes.get('/reports/audit-activity', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const db = getDatabase();

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const result = await db.query(`
      SELECT action_type, resource_type, COUNT(*) as count, TO_CHAR(created_at, 'YYYY-MM-DD') as date
      FROM audit_logs
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY action_type, resource_type, date
      ORDER BY date DESC, count DESC
    `, [start, end]);

    const byAction: Record<string, number> = {};
    const byResource: Record<string, number> = {};
    const byDate: Record<string, number> = {};

    result.rows.forEach((row: any) => {
      byAction[row.action_type] = (byAction[row.action_type] || 0) + parseInt(row.count);
      byResource[row.resource_type] = (byResource[row.resource_type] || 0) + parseInt(row.count);
      byDate[row.date] = (byDate[row.date] || 0) + parseInt(row.count);
    });

    res.json({
      success: true,
      data: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        summary: { totalActions: Object.values(byAction).reduce((a, b) => a + b, 0), byAction, byResource },
        timeline: Object.entries(byDate).map(([date, count]) => ({ date, count })),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get audit activity report:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// RBAC - Role-Based Access Control
// ========================================================================

import rbacService from '../services/rbacService';
import customer360Service from '../services/customer360Service';

// List all roles
adminRoutes.get('/roles', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const roles = await rbacService.getAllRoles(includeInactive);
    res.json({ success: true, data: roles });
  } catch (error: any) {
    logger.error('Failed to get roles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get role by ID with permissions
adminRoutes.get('/roles/:id', async (req: Request, res: Response) => {
  try {
    const role = await rbacService.getRoleById(req.params.id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ success: true, data: role });
  } catch (error: any) {
    logger.error('Failed to get role:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create role
adminRoutes.post('/roles', async (req: Request, res: Response) => {
  try {
    const { name, displayName, description } = req.body;
    const role = await rbacService.createRole({ name, displayName, description });
    res.status(201).json({ success: true, data: role });
  } catch (error: any) {
    logger.error('Failed to create role:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update role
adminRoutes.put('/roles/:id', async (req: Request, res: Response) => {
  try {
    const { displayName, description, isActive } = req.body;
    const role = await rbacService.updateRole(req.params.id, { displayName, description, isActive });
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ success: true, data: role });
  } catch (error: any) {
    logger.error('Failed to update role:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete role
adminRoutes.delete('/roles/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await rbacService.deleteRole(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ success: true, message: 'Role deleted' });
  } catch (error: any) {
    logger.error('Failed to delete role:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all permissions
adminRoutes.get('/permissions', async (req: Request, res: Response) => {
  try {
    const permissions = await rbacService.getAllPermissions();
    res.json({ success: true, data: permissions });
  } catch (error: any) {
    logger.error('Failed to get permissions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign permission to role
adminRoutes.post('/roles/:roleId/permissions/:permissionId', async (req: Request, res: Response) => {
  try {
    await rbacService.assignPermissionToRole(req.params.roleId, req.params.permissionId);
    res.json({ success: true, message: 'Permission assigned' });
  } catch (error: any) {
    logger.error('Failed to assign permission:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove permission from role
adminRoutes.delete('/roles/:roleId/permissions/:permissionId', async (req: Request, res: Response) => {
  try {
    const removed = await rbacService.removePermissionFromRole(req.params.roleId, req.params.permissionId);
    if (!removed) {
      return res.status(404).json({ error: 'Permission assignment not found' });
    }
    res.json({ success: true, message: 'Permission removed' });
  } catch (error: any) {
    logger.error('Failed to remove permission:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's roles
adminRoutes.get('/users/:userId/roles', async (req: Request, res: Response) => {
  try {
    const roles = await rbacService.getUserRoles(req.params.userId);
    res.json({ success: true, data: roles });
  } catch (error: any) {
    logger.error('Failed to get user roles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign role to user
adminRoutes.post('/users/:userId/roles/:roleId', async (req: Request, res: Response) => {
  try {
    const { assignedBy, expiresAt } = req.body;
    await rbacService.assignRoleToUser(
      req.params.userId,
      req.params.roleId,
      assignedBy || 'system',
      expiresAt ? new Date(expiresAt) : undefined
    );
    res.json({ success: true, message: 'Role assigned' });
  } catch (error: any) {
    logger.error('Failed to assign role:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove role from user
adminRoutes.delete('/users/:userId/roles/:roleId', async (req: Request, res: Response) => {
  try {
    const removed = await rbacService.removeRoleFromUser(req.params.userId, req.params.roleId);
    if (!removed) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }
    res.json({ success: true, message: 'Role removed' });
  } catch (error: any) {
    logger.error('Failed to remove role:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check user permission
adminRoutes.get('/users/:userId/permissions/:permission', async (req: Request, res: Response) => {
  try {
    const hasPermission = await rbacService.hasPermission(req.params.userId, req.params.permission);
    res.json({ success: true, data: { hasPermission } });
  } catch (error: any) {
    logger.error('Failed to check permission:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// Customer 360 View
// ========================================================================

// Get comprehensive customer view
adminRoutes.get('/customers/:userId/360', async (req: Request, res: Response) => {
  try {
    const view = await customer360Service.getCustomer360(req.params.userId);
    if (!view) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ success: true, data: view });
  } catch (error: any) {
    logger.error('Failed to get customer 360:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search customers
adminRoutes.get('/customers/search', async (req: Request, res: Response) => {
  try {
    const { email, phone, name, status, kycStatus, limit, offset } = req.query;
    const result = await customer360Service.searchCustomers({
      email: email as string,
      phone: phone as string,
      name: name as string,
      status: status as string,
      kycStatus: kycStatus as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Failed to search customers:', error);
    res.status(500).json({ error: error.message });
  }
});
