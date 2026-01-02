import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import settlementService from '../services/settlementService';
import refundService from '../services/refundService';
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

// ========================================================================
// Settlement Endpoints
// ========================================================================

// Create settlement batch
router.post(
  '/settlements/batches',
  authMiddleware,
  [
    body('settlementDate').isISO8601().withMessage('Valid settlement date required'),
    body('currencyCode').optional().isString().isLength({ min: 3, max: 3 })
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const batch = await settlementService.createBatch(
        new Date(req.body.settlementDate),
        req.body.currencyCode
      );
      res.status(201).json({ success: true, data: batch });
    } catch (error) {
      logger.error('Create settlement batch failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create batch'
      });
    }
  }
);

// Process settlement batch
router.post(
  '/settlements/batches/:batchId/process',
  authMiddleware,
  [param('batchId').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const batch = await settlementService.processBatch(
        req.params.batchId,
        req.user?.userId || 'system'
      );
      res.json({ success: true, data: batch });
    } catch (error) {
      logger.error('Process settlement batch failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process batch'
      });
    }
  }
);

// Get settlement batch
router.get(
  '/settlements/batches/:batchId',
  authMiddleware,
  [param('batchId').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const batch = await settlementService.getBatch(req.params.batchId);
      if (!batch) {
        res.status(404).json({ success: false, error: 'Batch not found' });
        return;
      }
      const items = await settlementService.getBatchItems(req.params.batchId);
      res.json({ success: true, data: { ...batch, items } });
    } catch (error) {
      logger.error('Get settlement batch failed', { error });
      res.status(500).json({ success: false, error: 'Failed to get batch' });
    }
  }
);

// List settlement batches
router.get(
  '/settlements/batches',
  authMiddleware,
  [
    query('status').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await settlementService.listBatches({
        status: req.query.status as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        limit: req.query.limit as unknown as number,
        offset: req.query.offset as unknown as number
      });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('List settlement batches failed', { error });
      res.status(500).json({ success: false, error: 'Failed to list batches' });
    }
  }
);

// ========================================================================
// Refund Endpoints
// ========================================================================

// Request refund
router.post(
  '/refunds',
  authMiddleware,
  [
    body('originalTransactionId').isUUID().withMessage('Valid transaction ID required'),
    body('amount').optional().isFloat({ min: 0 }),
    body('includeFees').optional().isBoolean(),
    body('reason').isString().isLength({ min: 5, max: 500 }),
    body('reasonCode').optional().isIn(['duplicate', 'fraud', 'customer_request', 'merchant_error', 'other'])
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const refund = await refundService.requestRefund({
        originalTransactionId: req.body.originalTransactionId,
        amount: req.body.amount,
        includeFees: req.body.includeFees,
        reason: req.body.reason,
        reasonCode: req.body.reasonCode,
        requestedBy: req.user?.userId || 'system'
      });
      res.status(201).json({ success: true, data: refund });
    } catch (error) {
      logger.error('Request refund failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to request refund'
      });
    }
  }
);

// Approve refund
router.post(
  '/refunds/:refundId/approve',
  authMiddleware,
  [
    param('refundId').isUUID(),
    body('comments').optional().isString()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const refund = await refundService.approveRefund(
        req.params.refundId,
        req.user?.userId || 'system',
        req.body.comments
      );
      res.json({ success: true, data: refund });
    } catch (error) {
      logger.error('Approve refund failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve refund'
      });
    }
  }
);

// Reject refund
router.post(
  '/refunds/:refundId/reject',
  authMiddleware,
  [
    param('refundId').isUUID(),
    body('reason').isString().isLength({ min: 5, max: 500 })
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const refund = await refundService.rejectRefund(
        req.params.refundId,
        req.user?.userId || 'system',
        req.body.reason
      );
      res.json({ success: true, data: refund });
    } catch (error) {
      logger.error('Reject refund failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject refund'
      });
    }
  }
);

// Get refund
router.get(
  '/refunds/:refundId',
  authMiddleware,
  [param('refundId').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const refund = await refundService.getRefund(req.params.refundId);
      if (!refund) {
        res.status(404).json({ success: false, error: 'Refund not found' });
        return;
      }
      const approvals = await refundService.getRefundApprovals(req.params.refundId);
      res.json({ success: true, data: { ...refund, approvals } });
    } catch (error) {
      logger.error('Get refund failed', { error });
      res.status(500).json({ success: false, error: 'Failed to get refund' });
    }
  }
);

// List refunds
router.get(
  '/refunds',
  authMiddleware,
  [
    query('walletId').optional().isUUID(),
    query('status').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await refundService.listRefunds({
        walletId: req.query.walletId as string,
        status: req.query.status as string,
        limit: req.query.limit as unknown as number,
        offset: req.query.offset as unknown as number
      });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('List refunds failed', { error });
      res.status(500).json({ success: false, error: 'Failed to list refunds' });
    }
  }
);

// Get pending refunds
router.get('/refunds/pending', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const refunds = await refundService.getPendingRefunds();
    res.json({ success: true, data: refunds });
  } catch (error) {
    logger.error('Get pending refunds failed', { error });
    res.status(500).json({ success: false, error: 'Failed to get pending refunds' });
  }
});

export default router;
