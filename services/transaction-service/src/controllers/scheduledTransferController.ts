import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import scheduledTransferService from '../services/scheduledTransferService';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

const validate = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }
  next();
};

// Create scheduled transfer
router.post(
  '/',
  authMiddleware,
  [
    body('sourceWalletId').isUUID().withMessage('Valid source wallet ID required'),
    body('destinationWalletId').optional().isUUID(),
    body('destinationAccountNumber').optional().isString(),
    body('destinationBankCode').optional().isString(),
    body('destinationName').optional().isString(),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    body('currencyCode').optional().isString().isLength({ min: 3, max: 3 }),
    body('narration').optional().isString().isLength({ max: 100 }),
    body('scheduleType').isIn(['once', 'daily', 'weekly', 'monthly', 'custom']),
    body('scheduledDate').optional().isISO8601(),
    body('scheduledTime').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
    body('dayOfWeek').optional().isInt({ min: 0, max: 6 }),
    body('dayOfMonth').optional().isInt({ min: 1, max: 31 }),
    body('maxExecutions').optional().isInt({ min: 1 })
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const transfer = await scheduledTransferService.create({
        userId: req.user?.userId || '',
        sourceWalletId: req.body.sourceWalletId,
        destinationWalletId: req.body.destinationWalletId,
        destinationAccountNumber: req.body.destinationAccountNumber,
        destinationBankCode: req.body.destinationBankCode,
        destinationName: req.body.destinationName,
        amount: req.body.amount,
        currencyCode: req.body.currencyCode,
        narration: req.body.narration,
        scheduleType: req.body.scheduleType,
        scheduledDate: req.body.scheduledDate ? new Date(req.body.scheduledDate) : undefined,
        scheduledTime: req.body.scheduledTime,
        dayOfWeek: req.body.dayOfWeek,
        dayOfMonth: req.body.dayOfMonth,
        maxExecutions: req.body.maxExecutions
      });

      res.status(201).json({ success: true, data: transfer });
    } catch (error) {
      logger.error('Create scheduled transfer failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create scheduled transfer'
      });
    }
  }
);

// Get scheduled transfer
router.get(
  '/:id',
  authMiddleware,
  [param('id').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const transfer = await scheduledTransferService.getById(req.params.id);

      if (!transfer) {
        res.status(404).json({ success: false, error: 'Scheduled transfer not found' });
        return;
      }

      // Verify ownership
      if (transfer.userId !== req.user?.userId) {
        res.status(403).json({ success: false, error: 'Unauthorized' });
        return;
      }

      res.json({ success: true, data: transfer });
    } catch (error) {
      logger.error('Get scheduled transfer failed', { error });
      res.status(500).json({ success: false, error: 'Failed to get scheduled transfer' });
    }
  }
);

// List user's scheduled transfers
router.get(
  '/',
  authMiddleware,
  [
    query('status').optional().isIn(['active', 'paused', 'completed', 'cancelled', 'failed']),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await scheduledTransferService.listByUser(req.user?.userId || '', {
        status: req.query.status as string,
        limit: req.query.limit as unknown as number,
        offset: req.query.offset as unknown as number
      });

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('List scheduled transfers failed', { error });
      res.status(500).json({ success: false, error: 'Failed to list scheduled transfers' });
    }
  }
);

// Pause scheduled transfer
router.post(
  '/:id/pause',
  authMiddleware,
  [param('id').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const transfer = await scheduledTransferService.pause(req.params.id, req.user?.userId || '');
      res.json({ success: true, data: transfer });
    } catch (error) {
      logger.error('Pause scheduled transfer failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pause scheduled transfer'
      });
    }
  }
);

// Resume scheduled transfer
router.post(
  '/:id/resume',
  authMiddleware,
  [param('id').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const transfer = await scheduledTransferService.resume(req.params.id, req.user?.userId || '');
      res.json({ success: true, data: transfer });
    } catch (error) {
      logger.error('Resume scheduled transfer failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume scheduled transfer'
      });
    }
  }
);

// Cancel scheduled transfer
router.delete(
  '/:id',
  authMiddleware,
  [param('id').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const transfer = await scheduledTransferService.cancel(req.params.id, req.user?.userId || '');
      res.json({ success: true, data: transfer, message: 'Scheduled transfer cancelled' });
    } catch (error) {
      logger.error('Cancel scheduled transfer failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel scheduled transfer'
      });
    }
  }
);

// Get execution history
router.get(
  '/:id/history',
  authMiddleware,
  [
    param('id').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Verify ownership
      const transfer = await scheduledTransferService.getById(req.params.id);
      if (!transfer || transfer.userId !== req.user?.userId) {
        res.status(404).json({ success: false, error: 'Scheduled transfer not found' });
        return;
      }

      const history = await scheduledTransferService.getExecutionHistory(
        req.params.id,
        (req.query.limit as unknown as number) || 20
      );

      res.json({ success: true, data: history });
    } catch (error) {
      logger.error('Get execution history failed', { error });
      res.status(500).json({ success: false, error: 'Failed to get execution history' });
    }
  }
);

export default router;
