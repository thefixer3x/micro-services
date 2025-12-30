// Admin Service Type Definitions

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  PENDING = 'pending',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum TicketCategory {
  ACCOUNT = 'account',
  TRANSACTION = 'transaction',
  CARD = 'card',
  KYC = 'kyc',
  TECHNICAL = 'technical',
  GENERAL = 'general'
}

export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  SUPPORT_AGENT = 'support_agent',
  AUDITOR = 'auditor',
  VIEWER = 'viewer'
}

export enum AuditActionType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  VIEW = 'view',
  EXPORT = 'export',
  LOGIN = 'login',
  LOGOUT = 'logout'
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  department?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  customerId: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  assignedTo?: string;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: 'customer' | 'admin';
  message: string;
  attachments?: string[];
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  adminUserId: string;
  actionType: AuditActionType;
  resourceType: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface CreateTicketRequest {
  customerId: string;
  category: TicketCategory;
  priority?: TicketPriority;
  subject: string;
  description: string;
}

export interface UpdateTicketRequest {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string;
  resolution?: string;
}

export interface TicketMessageRequest {
  message: string;
  attachments?: string[];
}

export interface TicketFilter {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedTo?: string;
  customerId?: string;
}

export interface AuditLogFilter {
  adminUserId?: string;
  actionType?: AuditActionType;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  avgResolutionTimeHours: number;
}

export interface DashboardStats {
  tickets: TicketStats;
  activeAdmins: number;
  todayAuditLogs: number;
  pendingEscalations: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    roles: string[];
  };
}

// Re-export for convenience
import { Request } from 'express';
