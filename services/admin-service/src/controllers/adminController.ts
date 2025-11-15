import { Router, Request, Response } from 'express';
import { getDatabase } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

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
