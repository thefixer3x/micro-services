import ticketRepository from '../repositories/ticketRepository';
import auditRepository from '../repositories/auditRepository';
import {
  SupportTicket,
  TicketMessage,
  CreateTicketRequest,
  UpdateTicketRequest,
  TicketFilter,
  PaginationParams,
  PaginatedResponse,
  TicketStats,
  AuditActionType
} from '../types';
import { logger } from '../utils/logger';

export class TicketService {
  async createTicket(
    data: CreateTicketRequest,
    adminUserId?: string
  ): Promise<SupportTicket> {
    logger.info('Creating support ticket', {
      customerId: data.customerId,
      category: data.category
    });

    const ticket = await ticketRepository.create(data);

    // Log audit trail
    if (adminUserId) {
      await auditRepository.create({
        adminUserId,
        actionType: AuditActionType.CREATE,
        resourceType: 'ticket',
        resourceId: ticket.id,
        changes: { ticketNumber: ticket.ticketNumber }
      });
    }

    logger.info('Support ticket created', {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber
    });

    return ticket;
  }

  async getTicket(id: string): Promise<SupportTicket | null> {
    return ticketRepository.findById(id);
  }

  async getTicketByNumber(ticketNumber: string): Promise<SupportTicket | null> {
    return ticketRepository.findByTicketNumber(ticketNumber);
  }

  async getTicketWithMessages(
    id: string
  ): Promise<{ ticket: SupportTicket; messages: TicketMessage[] } | null> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) {
      return null;
    }

    const messages = await ticketRepository.getMessages(id);
    return { ticket, messages };
  }

  async listTickets(
    filter: TicketFilter,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<SupportTicket>> {
    return ticketRepository.findAll(filter, pagination);
  }

  async updateTicket(
    id: string,
    data: UpdateTicketRequest,
    adminUserId: string
  ): Promise<SupportTicket> {
    const existingTicket = await ticketRepository.findById(id);
    if (!existingTicket) {
      throw new Error('Ticket not found');
    }

    const updatedTicket = await ticketRepository.update(id, data);
    if (!updatedTicket) {
      throw new Error('Failed to update ticket');
    }

    // Log audit trail
    await auditRepository.create({
      adminUserId,
      actionType: AuditActionType.UPDATE,
      resourceType: 'ticket',
      resourceId: id,
      changes: {
        before: {
          status: existingTicket.status,
          priority: existingTicket.priority,
          assignedTo: existingTicket.assignedTo
        },
        after: {
          status: updatedTicket.status,
          priority: updatedTicket.priority,
          assignedTo: updatedTicket.assignedTo
        }
      }
    });

    logger.info('Ticket updated', {
      ticketId: id,
      newStatus: updatedTicket.status,
      updatedBy: adminUserId
    });

    return updatedTicket;
  }

  async addMessage(
    ticketId: string,
    senderId: string,
    senderType: 'customer' | 'admin',
    message: string
  ): Promise<TicketMessage> {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const ticketMessage = await ticketRepository.addMessage(
      ticketId,
      senderId,
      senderType,
      message
    );

    logger.info('Message added to ticket', {
      ticketId,
      messageId: ticketMessage.id,
      senderType
    });

    return ticketMessage;
  }

  async assignTicket(
    ticketId: string,
    assigneeId: string,
    adminUserId: string
  ): Promise<SupportTicket> {
    return this.updateTicket(
      ticketId,
      { assignedTo: assigneeId, status: 'in_progress' as any },
      adminUserId
    );
  }

  async resolveTicket(
    ticketId: string,
    resolution: string,
    adminUserId: string
  ): Promise<SupportTicket> {
    return this.updateTicket(
      ticketId,
      { status: 'resolved' as any, resolution },
      adminUserId
    );
  }

  async getStats(): Promise<TicketStats> {
    return ticketRepository.getStats();
  }

  async getCustomerTickets(
    customerId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<SupportTicket>> {
    return ticketRepository.findAll({ customerId }, pagination);
  }
}

export default new TicketService();
