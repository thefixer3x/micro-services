import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import notificationService from '../services/notificationService';
import { AuthenticatedRequest } from '../types';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const validate = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }
  next();
};

// ========================================================================
// Notification Management
// ========================================================================

// Get user's notifications
router.get(
  '/',
  authenticateToken,
  [
    query('unreadOnly').optional().isBoolean().toBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await notificationService.getUserNotifications(req.user?.user_id || '', {
        unreadOnly: req.query.unreadOnly as unknown as boolean,
        limit: req.query.limit as unknown as number,
        offset: req.query.offset as unknown as number
      });

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Get notifications failed', { error });
      res.status(500).json({ success: false, error: 'Failed to get notifications' });
    }
  }
);

// Mark notification as read
router.post(
  '/:id/read',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const marked = await notificationService.markAsRead(req.params.id, req.user?.user_id || '');

      if (!marked) {
        res.status(404).json({ success: false, error: 'Notification not found' });
        return;
      }

      res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
      logger.error('Mark as read failed', { error });
      res.status(500).json({ success: false, error: 'Failed to mark as read' });
    }
  }
);

// Mark all as read
router.post('/read-all', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await notificationService.markAllAsRead(req.user?.user_id || '');
    res.json({ success: true, message: `${count} notifications marked as read` });
  } catch (error) {
    logger.error('Mark all as read failed', { error });
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

// Dismiss notification
router.post(
  '/:id/dismiss',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const dismissed = await notificationService.dismissNotification(
        req.params.id,
        req.user?.user_id || ''
      );

      if (!dismissed) {
        res.status(404).json({ success: false, error: 'Notification not found' });
        return;
      }

      res.json({ success: true, message: 'Notification dismissed' });
    } catch (error) {
      logger.error('Dismiss notification failed', { error });
      res.status(500).json({ success: false, error: 'Failed to dismiss notification' });
    }
  }
);

// ========================================================================
// Preferences
// ========================================================================

// Get preferences for a category
router.get(
  '/preferences/:category',
  authenticateToken,
  [param('category').isString()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prefs = await notificationService.getUserPreferences(
        req.user?.user_id || '',
        req.params.category
      );

      res.json({
        success: true,
        data: prefs || {
          category: req.params.category,
          pushEnabled: true,
          emailEnabled: true,
          smsEnabled: false,
          inAppEnabled: true
        }
      });
    } catch (error) {
      logger.error('Get preferences failed', { error });
      res.status(500).json({ success: false, error: 'Failed to get preferences' });
    }
  }
);

// Update preferences
router.put(
  '/preferences/:category',
  authenticateToken,
  [
    param('category').isString(),
    body('pushEnabled').optional().isBoolean(),
    body('emailEnabled').optional().isBoolean(),
    body('smsEnabled').optional().isBoolean(),
    body('inAppEnabled').optional().isBoolean()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prefs = await notificationService.updatePreferences(
        req.user?.user_id || '',
        req.params.category,
        {
          pushEnabled: req.body.pushEnabled,
          emailEnabled: req.body.emailEnabled,
          smsEnabled: req.body.smsEnabled,
          inAppEnabled: req.body.inAppEnabled
        }
      );

      res.json({ success: true, data: prefs });
    } catch (error) {
      logger.error('Update preferences failed', { error });
      res.status(500).json({ success: false, error: 'Failed to update preferences' });
    }
  }
);

// ========================================================================
// Device Tokens
// ========================================================================

// Register device token
router.post(
  '/devices',
  authenticateToken,
  [
    body('deviceId').isString().withMessage('Device ID required'),
    body('token').isString().withMessage('Token required'),
    body('platform').isIn(['ios', 'android', 'web']).withMessage('Valid platform required'),
    body('appVersion').optional().isString()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await notificationService.registerDeviceToken(
        req.user?.user_id || '',
        req.body.deviceId,
        req.body.token,
        req.body.platform,
        req.body.appVersion
      );

      res.json({ success: true, message: 'Device registered' });
    } catch (error) {
      logger.error('Register device failed', { error });
      res.status(500).json({ success: false, error: 'Failed to register device' });
    }
  }
);

// Remove device token
router.delete(
  '/devices/:deviceId',
  authenticateToken,
  [param('deviceId').isString()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await notificationService.removeDeviceToken(req.user?.user_id || '', req.params.deviceId);
      res.json({ success: true, message: 'Device removed' });
    } catch (error) {
      logger.error('Remove device failed', { error });
      res.status(500).json({ success: false, error: 'Failed to remove device' });
    }
  }
);

// ========================================================================
// Send Notification (Admin)
// ========================================================================

// Send notification using template
router.post(
  '/send',
  authenticateToken,
  [
    body('userId').isUUID().withMessage('Valid user ID required'),
    body('templateName').isString().withMessage('Template name required'),
    body('variables').optional().isObject(),
    body('actionType').optional().isString(),
    body('actionData').optional().isObject()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const notification = await notificationService.sendFromTemplate(
        req.body.userId,
        req.body.templateName,
        req.body.variables || {},
        {
          actionType: req.body.actionType,
          actionData: req.body.actionData
        }
      );

      res.json({ success: true, data: notification });
    } catch (error) {
      logger.error('Send notification failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification'
      });
    }
  }
);

export default router;
