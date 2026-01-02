import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/connection';
import { logger } from '../utils/logger';

interface NotificationTemplate {
  id: string;
  name: string;
  category: string;
  titleTemplate: string;
  bodyTemplate: string;
  emailSubjectTemplate: string | null;
  emailBodyTemplate: string | null;
  smsTemplate: string | null;
  channels: string[];
  isActive: boolean;
  priority: string;
}

interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  channelsRequested: string[];
  pushStatus: string | null;
  emailStatus: string | null;
  smsStatus: string | null;
  isRead: boolean;
  readAt: Date | null;
  actionType: string | null;
  actionData: Record<string, unknown> | null;
  createdAt: Date;
}

interface NotificationPreferences {
  userId: string;
  category: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
}

// ========================================================================
// Provider Interfaces (Adapter Pattern)
// ========================================================================

export interface PushProvider {
  name: string;
  send(token: string, title: string, body: string, data?: Record<string, unknown>): Promise<boolean>;
}

export interface EmailProvider {
  name: string;
  send(to: string, subject: string, body: string, html?: string): Promise<boolean>;
}

export interface SMSProvider {
  name: string;
  send(phone: string, message: string): Promise<boolean>;
}

// ========================================================================
// Stub Providers for Development
// ========================================================================

class StubPushProvider implements PushProvider {
  name = 'stub-push';

  async send(token: string, title: string, body: string, data?: Record<string, unknown>) {
    logger.info('STUB PUSH', { token: token.slice(0, 20) + '...', title, body, data });
    return true;
  }
}

class StubEmailProvider implements EmailProvider {
  name = 'stub-email';

  async send(to: string, subject: string, body: string) {
    logger.info('STUB EMAIL', { to, subject, bodyLength: body.length });
    return true;
  }
}

class StubSMSProvider implements SMSProvider {
  name = 'stub-sms';

  async send(phone: string, message: string) {
    logger.info('STUB SMS', { phone, messageLength: message.length });
    return true;
  }
}

// ========================================================================
// Notification Service
// ========================================================================

export class NotificationService {
  private db = getDatabase();
  private pushProvider: PushProvider;
  private emailProvider: EmailProvider;
  private smsProvider: SMSProvider;
  private templateCache: Map<string, NotificationTemplate> = new Map();

  constructor(
    pushProvider?: PushProvider,
    emailProvider?: EmailProvider,
    smsProvider?: SMSProvider
  ) {
    this.pushProvider = pushProvider || new StubPushProvider();
    this.emailProvider = emailProvider || new StubEmailProvider();
    this.smsProvider = smsProvider || new StubSMSProvider();
  }

  setPushProvider(provider: PushProvider): void {
    this.pushProvider = provider;
    logger.info('Push provider changed', { provider: provider.name });
  }

  setEmailProvider(provider: EmailProvider): void {
    this.emailProvider = provider;
    logger.info('Email provider changed', { provider: provider.name });
  }

  setSMSProvider(provider: SMSProvider): void {
    this.smsProvider = provider;
    logger.info('SMS provider changed', { provider: provider.name });
  }

  // ========================================================================
  // Send Notifications
  // ========================================================================

  /**
   * Send notification using a template
   */
  async sendFromTemplate(
    userId: string,
    templateName: string,
    variables: Record<string, string>,
    options: {
      actionType?: string;
      actionData?: Record<string, unknown>;
      priority?: string;
    } = {}
  ): Promise<Notification> {
    const template = await this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Get user preferences
    const prefs = await this.getUserPreferences(userId, template.category);

    // Determine channels based on template and user preferences
    const channels = this.filterChannelsByPreferences(template.channels, prefs);

    if (channels.length === 0) {
      logger.info('All channels disabled by user', { userId, templateName });
    }

    // Render templates
    const title = this.renderTemplate(template.titleTemplate, variables);
    const body = this.renderTemplate(template.bodyTemplate, variables);

    // Create notification record
    const notification = await this.createNotification({
      userId,
      title,
      body,
      category: template.category,
      priority: options.priority || template.priority,
      channels,
      actionType: options.actionType,
      actionData: options.actionData
    });

    // Send through each channel
    await this.deliverNotification(notification, template, variables, prefs);

    return notification;
  }

  /**
   * Send custom notification (without template)
   */
  async sendCustom(
    userId: string,
    data: {
      title: string;
      body: string;
      category: string;
      channels: string[];
      priority?: string;
      actionType?: string;
      actionData?: Record<string, unknown>;
      emailSubject?: string;
      emailBody?: string;
      smsMessage?: string;
    }
  ): Promise<Notification> {
    const prefs = await this.getUserPreferences(userId, data.category);
    const channels = this.filterChannelsByPreferences(data.channels, prefs);

    const notification = await this.createNotification({
      userId,
      title: data.title,
      body: data.body,
      category: data.category,
      priority: data.priority || 'normal',
      channels,
      actionType: data.actionType,
      actionData: data.actionData
    });

    // Deliver through channels
    await this.deliverCustomNotification(notification, data, prefs);

    return notification;
  }

  private async deliverNotification(
    notification: Notification,
    template: NotificationTemplate,
    variables: Record<string, string>,
    prefs: NotificationPreferences | null
  ): Promise<void> {
    const user = await this.getUserContactInfo(notification.userId);
    if (!user) return;

    const promises: Promise<void>[] = [];

    if (notification.channelsRequested.includes('push') && prefs?.pushEnabled !== false) {
      promises.push(this.sendPush(notification, user.deviceTokens));
    }

    if (notification.channelsRequested.includes('email') && prefs?.emailEnabled !== false && user.email) {
      const subject = template.emailSubjectTemplate
        ? this.renderTemplate(template.emailSubjectTemplate, variables)
        : notification.title;
      const body = template.emailBodyTemplate
        ? this.renderTemplate(template.emailBodyTemplate, variables)
        : notification.body;
      promises.push(this.sendEmail(notification, user.email, subject, body));
    }

    if (notification.channelsRequested.includes('sms') && prefs?.smsEnabled !== false && user.phone) {
      const message = template.smsTemplate
        ? this.renderTemplate(template.smsTemplate, variables)
        : `${notification.title}: ${notification.body}`.slice(0, 160);
      promises.push(this.sendSMS(notification, user.phone, message));
    }

    await Promise.allSettled(promises);
  }

  private async deliverCustomNotification(
    notification: Notification,
    data: {
      emailSubject?: string;
      emailBody?: string;
      smsMessage?: string;
    },
    prefs: NotificationPreferences | null
  ): Promise<void> {
    const user = await this.getUserContactInfo(notification.userId);
    if (!user) return;

    const promises: Promise<void>[] = [];

    if (notification.channelsRequested.includes('push')) {
      promises.push(this.sendPush(notification, user.deviceTokens));
    }

    if (notification.channelsRequested.includes('email') && user.email) {
      promises.push(this.sendEmail(
        notification,
        user.email,
        data.emailSubject || notification.title,
        data.emailBody || notification.body
      ));
    }

    if (notification.channelsRequested.includes('sms') && user.phone) {
      const message = data.smsMessage || `${notification.title}: ${notification.body}`.slice(0, 160);
      promises.push(this.sendSMS(notification, user.phone, message));
    }

    await Promise.allSettled(promises);
  }

  private async sendPush(notification: Notification, tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      await this.updateChannelStatus(notification.id, 'push', 'no_device');
      return;
    }

    try {
      const results = await Promise.all(
        tokens.map(token =>
          this.pushProvider.send(token, notification.title, notification.body, {
            notificationId: notification.id,
            actionType: notification.actionType,
            ...notification.actionData
          })
        )
      );

      const success = results.some(r => r);
      await this.updateChannelStatus(notification.id, 'push', success ? 'sent' : 'failed');
    } catch (error) {
      logger.error('Push notification failed', { notificationId: notification.id, error });
      await this.updateChannelStatus(notification.id, 'push', 'failed');
    }
  }

  private async sendEmail(
    notification: Notification,
    email: string,
    subject: string,
    body: string
  ): Promise<void> {
    try {
      const success = await this.emailProvider.send(email, subject, body);
      await this.updateChannelStatus(notification.id, 'email', success ? 'sent' : 'failed');
    } catch (error) {
      logger.error('Email notification failed', { notificationId: notification.id, error });
      await this.updateChannelStatus(notification.id, 'email', 'failed');
    }
  }

  private async sendSMS(notification: Notification, phone: string, message: string): Promise<void> {
    try {
      const success = await this.smsProvider.send(phone, message);
      await this.updateChannelStatus(notification.id, 'sms', success ? 'sent' : 'failed');
    } catch (error) {
      logger.error('SMS notification failed', { notificationId: notification.id, error });
      await this.updateChannelStatus(notification.id, 'sms', 'failed');
    }
  }

  // ========================================================================
  // Notification Management
  // ========================================================================

  async getUserNotifications(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}
  ): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const { unreadOnly = false, limit = 20, offset = 0 } = options;

    const whereClause = unreadOnly
      ? 'WHERE user_id = $1 AND is_read = FALSE'
      : 'WHERE user_id = $1';

    const result = await this.db.query(
      `SELECT * FROM notifications ${whereClause}
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await this.db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );

    return {
      notifications: result.rows.map(this.mapNotification),
      unreadCount: parseInt(countResult.rows[0].count)
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND is_read = FALSE
       RETURNING id`,
      [notificationId, userId]
    );
    return result.rows.length > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND is_read = FALSE
       RETURNING id`,
      [userId]
    );
    return result.rows.length;
  }

  async dismissNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE notifications SET is_dismissed = TRUE, dismissed_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, userId]
    );
    return result.rows.length > 0;
  }

  // ========================================================================
  // Preferences Management
  // ========================================================================

  async getUserPreferences(userId: string, category: string): Promise<NotificationPreferences | null> {
    const result = await this.db.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1 AND category = $2',
      [userId, category]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      userId: row.user_id,
      category: row.category,
      pushEnabled: row.push_enabled,
      emailEnabled: row.email_enabled,
      smsEnabled: row.sms_enabled,
      inAppEnabled: row.in_app_enabled
    };
  }

  async updatePreferences(
    userId: string,
    category: string,
    prefs: Partial<Omit<NotificationPreferences, 'userId' | 'category'>>
  ): Promise<NotificationPreferences> {
    const result = await this.db.query(
      `INSERT INTO notification_preferences (user_id, category, push_enabled, email_enabled, sms_enabled, in_app_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, category)
       DO UPDATE SET
         push_enabled = COALESCE($3, notification_preferences.push_enabled),
         email_enabled = COALESCE($4, notification_preferences.email_enabled),
         sms_enabled = COALESCE($5, notification_preferences.sms_enabled),
         in_app_enabled = COALESCE($6, notification_preferences.in_app_enabled)
       RETURNING *`,
      [
        userId,
        category,
        prefs.pushEnabled,
        prefs.emailEnabled,
        prefs.smsEnabled,
        prefs.inAppEnabled
      ]
    );

    const row = result.rows[0];
    return {
      userId: row.user_id,
      category: row.category,
      pushEnabled: row.push_enabled,
      emailEnabled: row.email_enabled,
      smsEnabled: row.sms_enabled,
      inAppEnabled: row.in_app_enabled
    };
  }

  // ========================================================================
  // Device Token Management
  // ========================================================================

  async registerDeviceToken(
    userId: string,
    deviceId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
    appVersion?: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO device_tokens (user_id, device_id, token, platform, app_version)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET token = $3, platform = $4, app_version = $5, is_active = TRUE, last_used_at = NOW()`,
      [userId, deviceId, token, platform, appVersion]
    );
    logger.info('Device token registered', { userId, platform });
  }

  async removeDeviceToken(userId: string, deviceId: string): Promise<void> {
    await this.db.query(
      'UPDATE device_tokens SET is_active = FALSE WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId]
    );
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private async createNotification(data: {
    userId: string;
    title: string;
    body: string;
    category: string;
    priority: string;
    channels: string[];
    actionType?: string;
    actionData?: Record<string, unknown>;
  }): Promise<Notification> {
    const result = await this.db.query(
      `INSERT INTO notifications (user_id, title, body, category, priority, channels_requested, action_type, action_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.userId,
        data.title,
        data.body,
        data.category,
        data.priority,
        data.channels,
        data.actionType,
        data.actionData ? JSON.stringify(data.actionData) : null
      ]
    );

    return this.mapNotification(result.rows[0]);
  }

  private async updateChannelStatus(
    notificationId: string,
    channel: 'push' | 'email' | 'sms',
    status: string
  ): Promise<void> {
    const column = `${channel}_status`;
    const sentAtColumn = `${channel}_sent_at`;

    await this.db.query(
      `UPDATE notifications SET ${column} = $1, ${sentAtColumn} = NOW() WHERE id = $2`,
      [status, notificationId]
    );
  }

  private async getTemplate(name: string): Promise<NotificationTemplate | null> {
    if (this.templateCache.has(name)) {
      return this.templateCache.get(name)!;
    }

    const result = await this.db.query(
      'SELECT * FROM notification_templates WHERE name = $1 AND is_active = TRUE',
      [name]
    );

    if (result.rows.length === 0) return null;

    const template = this.mapTemplate(result.rows[0]);
    this.templateCache.set(name, template);
    return template;
  }

  private async getUserContactInfo(userId: string): Promise<{
    email: string | null;
    phone: string | null;
    deviceTokens: string[];
  } | null> {
    const userResult = await this.db.query(
      'SELECT email, phone FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) return null;

    const tokensResult = await this.db.query(
      'SELECT token FROM device_tokens WHERE user_id = $1 AND is_active = TRUE',
      [userId]
    );

    return {
      email: userResult.rows[0].email,
      phone: userResult.rows[0].phone,
      deviceTokens: tokensResult.rows.map((r: any) => r.token)
    };
  }

  private filterChannelsByPreferences(
    channels: string[],
    prefs: NotificationPreferences | null
  ): string[] {
    if (!prefs) return channels;

    return channels.filter(channel => {
      switch (channel) {
        case 'push': return prefs.pushEnabled;
        case 'email': return prefs.emailEnabled;
        case 'sms': return prefs.smsEnabled;
        case 'in_app': return prefs.inAppEnabled;
        default: return true;
      }
    });
  }

  private renderTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
  }

  private mapTemplate(row: any): NotificationTemplate {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      titleTemplate: row.title_template,
      bodyTemplate: row.body_template,
      emailSubjectTemplate: row.email_subject_template,
      emailBodyTemplate: row.email_body_template,
      smsTemplate: row.sms_template,
      channels: row.channels || [],
      isActive: row.is_active,
      priority: row.priority
    };
  }

  private mapNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      body: row.body,
      category: row.category,
      priority: row.priority,
      channelsRequested: row.channels_requested || [],
      pushStatus: row.push_status,
      emailStatus: row.email_status,
      smsStatus: row.sms_status,
      isRead: row.is_read,
      readAt: row.read_at ? new Date(row.read_at) : null,
      actionType: row.action_type,
      actionData: row.action_data,
      createdAt: new Date(row.created_at)
    };
  }
}

export default new NotificationService();
