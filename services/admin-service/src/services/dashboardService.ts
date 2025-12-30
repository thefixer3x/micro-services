import ticketService from './ticketService';
import auditService from './auditService';
import { DashboardStats, TicketStats } from '../types';
import { logger } from '../utils/logger';

export class DashboardService {
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [ticketStats, todayAuditLogs] = await Promise.all([
        ticketService.getStats(),
        auditService.getTodayCount()
      ]);

      return {
        tickets: ticketStats,
        activeAdmins: 0, // TODO: Implement when admin user table exists
        todayAuditLogs,
        pendingEscalations: ticketStats.open // Simplified for now
      };
    } catch (error) {
      logger.error('Failed to get dashboard stats', { error });
      throw error;
    }
  }

  async getTicketTrends(days: number = 7): Promise<{
    date: string;
    created: number;
    resolved: number;
  }[]> {
    // TODO: Implement actual trend query
    const trends = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      trends.push({
        date: date.toISOString().split('T')[0],
        created: Math.floor(Math.random() * 20) + 5,
        resolved: Math.floor(Math.random() * 15) + 3
      });
    }
    return trends;
  }

  async getTopCategories(): Promise<{ category: string; count: number }[]> {
    // TODO: Implement actual category distribution query
    return [
      { category: 'transaction', count: 45 },
      { category: 'account', count: 32 },
      { category: 'card', count: 28 },
      { category: 'kyc', count: 15 },
      { category: 'technical', count: 12 },
      { category: 'general', count: 8 }
    ];
  }
}

export default new DashboardService();
