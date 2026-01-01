import auditRepository from '../repositories/auditRepository';
import {
  AuditLog,
  AuditActionType,
  AuditLogFilter,
  PaginationParams,
  PaginatedResponse
} from '../types';
import { logger } from '../utils/logger';

export class AuditService {
  async logAction(data: {
    adminUserId: string;
    actionType: AuditActionType;
    resourceType: string;
    resourceId?: string;
    changes?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    const auditLog = await auditRepository.create(data);

    logger.debug('Audit log created', {
      auditId: auditLog.id,
      action: data.actionType,
      resource: data.resourceType
    });

    return auditLog;
  }

  async listAuditLogs(
    filter: AuditLogFilter,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<AuditLog>> {
    return auditRepository.findAll(filter, pagination);
  }

  async getRecentActivity(limit: number = 10): Promise<AuditLog[]> {
    return auditRepository.getRecentActivity(limit);
  }

  async getTodayCount(): Promise<number> {
    return auditRepository.getTodayCount();
  }

  async logLogin(
    adminUserId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLog> {
    return this.logAction({
      adminUserId,
      actionType: AuditActionType.LOGIN,
      resourceType: 'session',
      ipAddress,
      userAgent
    });
  }

  async logLogout(adminUserId: string): Promise<AuditLog> {
    return this.logAction({
      adminUserId,
      actionType: AuditActionType.LOGOUT,
      resourceType: 'session'
    });
  }

  async logDataExport(
    adminUserId: string,
    resourceType: string,
    exportDetails: Record<string, unknown>
  ): Promise<AuditLog> {
    return this.logAction({
      adminUserId,
      actionType: AuditActionType.EXPORT,
      resourceType,
      changes: exportDetails
    });
  }
}

export default new AuditService();
