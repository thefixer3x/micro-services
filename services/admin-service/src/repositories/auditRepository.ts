import { getDatabase } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import {
  AuditLog,
  AuditActionType,
  AuditLogFilter,
  PaginationParams,
  PaginatedResponse
} from '../types';

export class AuditRepository {
  async create(data: {
    adminUserId: string;
    actionType: AuditActionType;
    resourceType: string;
    resourceId?: string;
    changes?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    const db = getDatabase();
    const id = uuidv4();

    const result = await db.query(
      `INSERT INTO audit_logs (id, admin_user_id, action_type, resource_type, resource_id, changes, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        data.adminUserId,
        data.actionType,
        data.resourceType,
        data.resourceId,
        JSON.stringify(data.changes || {}),
        data.ipAddress,
        data.userAgent
      ]
    );

    return this.mapToAuditLog(result.rows[0]);
  }

  async findAll(
    filter: AuditLogFilter,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<AuditLog>> {
    const db = getDatabase();
    const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.adminUserId) {
      whereClause += ` AND admin_user_id = $${paramIndex}`;
      params.push(filter.adminUserId);
      paramIndex++;
    }
    if (filter.actionType) {
      whereClause += ` AND action_type = $${paramIndex}`;
      params.push(filter.actionType);
      paramIndex++;
    }
    if (filter.resourceType) {
      whereClause += ` AND resource_type = $${paramIndex}`;
      params.push(filter.resourceType);
      paramIndex++;
    }
    if (filter.startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(filter.startDate);
      paramIndex++;
    }
    if (filter.endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(filter.endDate);
      paramIndex++;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, limit, offset];
    const result = await db.query(
      `SELECT * FROM audit_logs ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    return {
      data: result.rows.map(this.mapToAuditLog),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getTodayCount(): Promise<number> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs
       WHERE created_at >= CURRENT_DATE`
    );
    return parseInt(result.rows[0].count, 10);
  }

  async getRecentActivity(limit: number = 10): Promise<AuditLog[]> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map(this.mapToAuditLog);
  }

  private mapToAuditLog(row: Record<string, unknown>): AuditLog {
    return {
      id: row.id as string,
      adminUserId: row.admin_user_id as string,
      actionType: row.action_type as AuditActionType,
      resourceType: row.resource_type as string,
      resourceId: row.resource_id as string | undefined,
      changes: row.changes as Record<string, unknown> | undefined,
      ipAddress: row.ip_address as string | undefined,
      userAgent: row.user_agent as string | undefined,
      createdAt: new Date(row.created_at as string)
    };
  }
}

export default new AuditRepository();
