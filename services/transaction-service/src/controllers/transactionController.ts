import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import transactionService from '../services/transactionService';
import feeService from '../services/feeService';
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

// ========================================================================
// Statement Generation
// ========================================================================

router.get(
  '/statements/:walletId',
  authMiddleware,
  [
    param('walletId').isUUID().withMessage('Valid wallet ID required'),
    query('startDate').isISO8601().withMessage('Valid start date required'),
    query('endDate').isISO8601().withMessage('Valid end date required'),
    query('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv')
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { walletId } = req.params;
      const { startDate, endDate, format = 'json' } = req.query;

      const statement = await transactionService.generateStatement(
        walletId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      if (format === 'csv') {
        const csv = generateStatementCsv(statement);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=statement_${walletId}_${startDate}_${endDate}.csv`);
        res.send(csv);
        return;
      }

      res.json({
        success: true,
        data: statement
      });
    } catch (error) {
      logger.error('Generate statement failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate statement'
      });
    }
  }
);

// Helper function to generate CSV
function generateStatementCsv(statement: any): string {
  const headers = ['Date', 'Reference', 'Type', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = statement.transactions.map((txn: any) => [
    new Date(txn.created_at).toISOString(),
    txn.reference,
    txn.transaction_type,
    txn.narration || '',
    txn.direction === 'outbound' ? txn.amount : '',
    txn.direction === 'inbound' ? txn.amount : '',
    txn.running_balance || ''
  ]);

  return [
    `Statement for Wallet: ${statement.walletId}`,
    `Period: ${statement.startDate} to ${statement.endDate}`,
    `Opening Balance: ${statement.openingBalance}`,
    `Closing Balance: ${statement.closingBalance}`,
    '',
    headers.join(','),
    ...rows.map((row: any[]) => row.join(','))
  ].join('\n');
}

// ========================================================================
// Fee Configuration Admin Endpoints
// ========================================================================

// List all fee configurations
router.get(
  '/admin/fees',
  authMiddleware,
  [query('includeInactive').optional().isBoolean().toBoolean()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const includeInactive = req.query.includeInactive === true;
      const configs = await feeService.listFeeConfigurations(includeInactive);

      res.json({
        success: true,
        data: configs
      });
    } catch (error) {
      logger.error('List fee configurations failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve fee configurations'
      });
    }
  }
);

// Get single fee configuration
router.get(
  '/admin/fees/:id',
  authMiddleware,
  [param('id').isUUID().withMessage('Valid fee configuration ID required')],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await feeService.getFeeConfiguration(req.params.id);

      if (!config) {
        res.status(404).json({
          success: false,
          error: 'Fee configuration not found'
        });
        return;
      }

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Get fee configuration failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve fee configuration'
      });
    }
  }
);

// Create fee configuration
router.post(
  '/admin/fees',
  authMiddleware,
  [
    body('fee_type').isString().notEmpty().withMessage('Fee type required'),
    body('transaction_type').isString().notEmpty().withMessage('Transaction type required'),
    body('percentage_fee').isFloat({ min: 0, max: 1 }).withMessage('Percentage fee must be between 0 and 1'),
    body('minimum_fee').isFloat({ min: 0 }).withMessage('Minimum fee must be >= 0'),
    body('maximum_fee').optional().isFloat({ min: 0 }),
    body('flat_fee').optional().isFloat({ min: 0 }),
    body('currency').optional().isString().isLength({ min: 3, max: 3 })
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await feeService.createFeeConfiguration({
        fee_type: req.body.fee_type,
        transaction_type: req.body.transaction_type,
        percentage_fee: req.body.percentage_fee,
        minimum_fee: req.body.minimum_fee,
        maximum_fee: req.body.maximum_fee,
        flat_fee: req.body.flat_fee,
        currency: req.body.currency,
        created_by: req.user?.userId
      });

      res.status(201).json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Create fee configuration failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create fee configuration'
      });
    }
  }
);

// Update fee configuration
router.put(
  '/admin/fees/:id',
  authMiddleware,
  [
    param('id').isUUID().withMessage('Valid fee configuration ID required'),
    body('percentage_fee').optional().isFloat({ min: 0, max: 1 }),
    body('minimum_fee').optional().isFloat({ min: 0 }),
    body('maximum_fee').optional().isFloat({ min: 0 }),
    body('flat_fee').optional().isFloat({ min: 0 }),
    body('is_active').optional().isBoolean()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await feeService.updateFeeConfiguration(req.params.id, {
        percentage_fee: req.body.percentage_fee,
        minimum_fee: req.body.minimum_fee,
        maximum_fee: req.body.maximum_fee,
        flat_fee: req.body.flat_fee,
        is_active: req.body.is_active
      });

      if (!config) {
        res.status(404).json({
          success: false,
          error: 'Fee configuration not found'
        });
        return;
      }

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Update fee configuration failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update fee configuration'
      });
    }
  }
);

// Deactivate fee configuration
router.delete(
  '/admin/fees/:id',
  authMiddleware,
  [param('id').isUUID().withMessage('Valid fee configuration ID required')],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const success = await feeService.deactivateFeeConfiguration(req.params.id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Fee configuration not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Fee configuration deactivated'
      });
    } catch (error) {
      logger.error('Deactivate fee configuration failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate fee configuration'
      });
    }
  }
);

export default router;
