import { getDatabase } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import {
  SupportTicket,
  TicketMessage,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  CreateTicketRequest,
  UpdateTicketRequest,
  TicketFilter,
  PaginationParams,
  PaginatedResponse
} from '../types';
import { logger } from '../utils/logger';

function generateTicketNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TKT-${timestamp}${random}`;
}

export class TicketRepository {
  async create(data: CreateTicketRequest): Promise<SupportTicket> {
    const db = getDatabase();
    const id = uuidv4();
    const ticketNumber = generateTicketNumber();

    const result = await db.query(
      `INSERT INTO support_tickets (id, ticket_number, customer_id, category, priority, status, subject, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        ticketNumber,
        data.customerId,
        data.category,
        data.priority || TicketPriority.MEDIUM,
        TicketStatus.OPEN,
        data.subject,
        data.description
      ]
    );

    return this.mapToTicket(result.rows[0]);
  }

  async findById(id: string): Promise<SupportTicket | null> {
    const db = getDatabase();
    const result = await db.query(
      'SELECT * FROM support_tickets WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? this.mapToTicket(result.rows[0]) : null;
  }

  async findByTicketNumber(ticketNumber: string): Promise<SupportTicket | null> {
    const db = getDatabase();
    const result = await db.query(
      'SELECT * FROM support_tickets WHERE ticket_number = $1',
      [ticketNumber]
    );
    return result.rows.length > 0 ? this.mapToTicket(result.rows[0]) : null;
  }

  async findAll(
    filter: TicketFilter,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<SupportTicket>> {
    const db = getDatabase();
    const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(filter.status);
      paramIndex++;
    }
    if (filter.priority) {
      whereClause += ` AND priority = $${paramIndex}`;
      params.push(filter.priority);
      paramIndex++;
    }
    if (filter.category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(filter.category);
      paramIndex++;
    }
    if (filter.assignedTo) {
      whereClause += ` AND assigned_to = $${paramIndex}`;
      params.push(filter.assignedTo);
      paramIndex++;
    }
    if (filter.customerId) {
      whereClause += ` AND customer_id = $${paramIndex}`;
      params.push(filter.customerId);
      paramIndex++;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM support_tickets ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, limit, offset];
    const result = await db.query(
      `SELECT * FROM support_tickets ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    return {
      data: result.rows.map(this.mapToTicket),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async update(id: string, data: UpdateTicketRequest): Promise<SupportTicket | null> {
    const db = getDatabase();
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.status) {
      updates.push(`status = $${paramIndex}`);
      params.push(data.status);
      paramIndex++;
    }
    if (data.priority) {
      updates.push(`priority = $${paramIndex}`);
      params.push(data.priority);
      paramIndex++;
    }
    if (data.assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramIndex}`);
      params.push(data.assignedTo);
      paramIndex++;
    }
    if (data.resolution !== undefined) {
      updates.push(`resolution = $${paramIndex}`);
      params.push(data.resolution);
      paramIndex++;
    }

    if (data.status === TicketStatus.RESOLVED || data.status === TicketStatus.CLOSED) {
      updates.push('resolved_at = NOW()');
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const result = await db.query(
      `UPDATE support_tickets SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows.length > 0 ? this.mapToTicket(result.rows[0]) : null;
  }

  async getStats(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    avgResolutionTimeHours: number;
  }> {
    const db = getDatabase();
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) as resolved,
        COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
          FILTER (WHERE resolved_at IS NOT NULL), 0) as avg_resolution_hours
      FROM support_tickets
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10),
      open: parseInt(row.open, 10),
      inProgress: parseInt(row.in_progress, 10),
      resolved: parseInt(row.resolved, 10),
      avgResolutionTimeHours: parseFloat(row.avg_resolution_hours) || 0
    };
  }

  async addMessage(ticketId: string, senderId: string, senderType: 'customer' | 'admin', message: string): Promise<TicketMessage> {
    const db = getDatabase();
    const id = uuidv4();

    const result = await db.query(
      `INSERT INTO ticket_messages (id, ticket_id, sender_id, sender_type, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, ticketId, senderId, senderType, message]
    );

    return this.mapToMessage(result.rows[0]);
  }

  async getMessages(ticketId: string): Promise<TicketMessage[]> {
    const db = getDatabase();
    const result = await db.query(
      'SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC',
      [ticketId]
    );
    return result.rows.map(this.mapToMessage);
  }

  private mapToTicket(row: Record<string, unknown>): SupportTicket {
    return {
      id: row.id as string,
      ticketNumber: row.ticket_number as string,
      customerId: row.customer_id as string,
      category: row.category as TicketCategory,
      priority: row.priority as TicketPriority,
      status: row.status as TicketStatus,
      subject: row.subject as string,
      description: row.description as string,
      assignedTo: row.assigned_to as string | undefined,
      resolution: row.resolution as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined
    };
  }

  private mapToMessage(row: Record<string, unknown>): TicketMessage {
    return {
      id: row.id as string,
      ticketId: row.ticket_id as string,
      senderId: row.sender_id as string,
      senderType: row.sender_type as 'customer' | 'admin',
      message: row.message as string,
      attachments: row.attachments as string[] | undefined,
      createdAt: new Date(row.created_at as string)
    };
  }
}

export default new TicketRepository();
