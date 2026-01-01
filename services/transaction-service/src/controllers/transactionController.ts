import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import transactionService from '../services/transactionService';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth';
import { TransactionType } from '../types';
import logger from '../utils/logger';

const router = Router();

// Validation middleware
const validate = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

// Create domestic transfer
router.post(
  '/transfers/domestic',
  authMiddleware,
  [
    body('sourceWalletId').isUUID().withMessage('Valid source wallet ID required'),
    body('destinationWalletId').optional().isUUID(),
    body('destinationAccountNumber').optional().isString().isLength({ min: 10, max: 10 }),
    body('destinationBankCode').optional().isString().isLength({ min: 3, max: 6 }),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    body('currencyCode').isString().isLength({ min: 3, max: 3 }).withMessage('Valid currency code required'),
    body('narration').optional().isString().isLength({ max: 100 }),
    body('idempotencyKey').optional().isString()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await transactionService.createTransfer({
        sourceWalletId: req.body.sourceWalletId,
        destinationWalletId: req.body.destinationWalletId,
        destinationAccountNumber: req.body.destinationAccountNumber,
        destinationBankCode: req.body.destinationBankCode,
        amount: req.body.amount,
        currencyCode: req.body.currencyCode,
        narration: req.body.narration,
        idempotencyKey: req.body.idempotencyKey
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Create transfer failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed'
      });
    }
  }
);

// Create international transfer
router.post(
  '/transfers/international',
  authMiddleware,
  [
    body('sourceWalletId').isUUID().withMessage('Valid source wallet ID required'),
    body('destinationAccountNumber').isString().notEmpty(),
    body('destinationBankCode').isString().notEmpty(),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    body('currencyCode').isString().isLength({ min: 3, max: 3 }),
    body('narration').optional().isString().isLength({ max: 100 }),
    body('idempotencyKey').optional().isString()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await transactionService.createTransfer({
        sourceWalletId: req.body.sourceWalletId,
        destinationAccountNumber: req.body.destinationAccountNumber,
        destinationBankCode: req.body.destinationBankCode,
        amount: req.body.amount,
        currencyCode: req.body.currencyCode,
        narration: req.body.narration,
        idempotencyKey: req.body.idempotencyKey
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Create international transfer failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed'
      });
    }
  }
);

// Get transaction by ID
router.get(
  '/:transactionId',
  authMiddleware,
  [param('transactionId').isUUID().withMessage('Valid transaction ID required')],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const transaction = await transactionService.getTransaction(req.params.transactionId);

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
        return;
      }

      res.json({
        success: true,
        data: transaction
      });
    } catch (error) {
      logger.error('Get transaction failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve transaction'
      });
    }
  }
);

// List transactions for a wallet
router.get(
  '/',
  authMiddleware,
  [
    query('walletId').isUUID().withMessage('Valid wallet ID required'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await transactionService.getWalletTransactions(
        req.query.walletId as string,
        {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20
        }
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('List transactions failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve transactions'
      });
    }
  }
);

// Cancel pending transaction
router.post(
  '/:transactionId/cancel',
  authMiddleware,
  [param('transactionId').isUUID().withMessage('Valid transaction ID required')],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const transaction = await transactionService.cancelTransaction(req.params.transactionId);

      res.json({
        success: true,
        data: transaction
      });
    } catch (error) {
      logger.error('Cancel transaction failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Cancellation failed'
      });
    }
  }
);

// Calculate fees
router.post(
  '/fees/calculate',
  authMiddleware,
  [
    body('transactionType').isIn(Object.values(TransactionType)),
    body('amount').isFloat({ min: 1 }),
    body('currencyCode').isString().isLength({ min: 3, max: 3 }),
    body('isInternational').optional().isBoolean()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const fees = await transactionService.calculateFees(
        req.body.transactionType,
        req.body.amount,
        req.body.currencyCode,
        req.body.isInternational || false
      );

      res.json({
        success: true,
        data: fees
      });
    } catch (error) {
      logger.error('Calculate fees failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to calculate fees'
      });
    }
  }
);

// Get transaction stats
router.get(
  '/stats/:walletId',
  authMiddleware,
  [param('walletId').isUUID().withMessage('Valid wallet ID required')],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await transactionService.getTransactionStats(req.params.walletId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Get stats failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }
  }
);

export default router;
