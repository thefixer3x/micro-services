import { Router, Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { logger } from '../utils/logger';

export const walletRoutes = Router();
const walletService = new WalletService();

// ========================================================================
// Customer Routes
// ========================================================================

// Create customer
walletRoutes.post('/customers', async (req: Request, res: Response) => {
  try {
    const { userId, firstName, lastName, email, phoneNumber, provider } = req.body;

    if (!userId || !firstName || !lastName || !email || !phoneNumber) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'firstName', 'lastName', 'email', 'phoneNumber'],
      });
    }

    const customer = await walletService.createCustomer(userId, {
      firstName,
      lastName,
      email,
      phoneNumber,
      provider,
    });

    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error: any) {
    logger.error('Failed to create customer:', error);
    res.status(500).json({
      error: 'Failed to create customer',
      message: error.message,
    });
  }
});

// Get customer by user ID
walletRoutes.get('/customers/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const customer = await walletService.getCustomerByUserId(userId);

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found',
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error: any) {
    logger.error('Failed to get customer:', error);
    res.status(500).json({
      error: 'Failed to get customer',
      message: error.message,
    });
  }
});

// ========================================================================
// Wallet Routes
// ========================================================================

// Create wallet
walletRoutes.post('/wallets', async (req: Request, res: Response) => {
  try {
    const { customerId, currency, walletType, provider } = req.body;

    if (!customerId) {
      return res.status(400).json({
        error: 'Missing required field: customerId',
      });
    }

    const wallet = await walletService.createWallet(customerId, {
      currency,
      walletType,
      provider,
    });

    res.status(201).json({
      success: true,
      data: wallet,
    });
  } catch (error: any) {
    logger.error('Failed to create wallet:', error);
    res.status(500).json({
      error: 'Failed to create wallet',
      message: error.message,
    });
  }
});

// Get wallet by ID
walletRoutes.get('/wallets/:walletId', async (req: Request, res: Response) => {
  try {
    const { walletId } = req.params;

    const wallet = await walletService.getWallet(walletId);

    if (!wallet) {
      return res.status(404).json({
        error: 'Wallet not found',
      });
    }

    res.json({
      success: true,
      data: wallet,
    });
  } catch (error: any) {
    logger.error('Failed to get wallet:', error);
    res.status(500).json({
      error: 'Failed to get wallet',
      message: error.message,
    });
  }
});

// Get wallets by customer
walletRoutes.get('/customers/:customerId/wallets', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const wallets = await walletService.getWalletsByCustomer(customerId);

    res.json({
      success: true,
      data: wallets,
    });
  } catch (error: any) {
    logger.error('Failed to get wallets:', error);
    res.status(500).json({
      error: 'Failed to get wallets',
      message: error.message,
    });
  }
});

// Get wallet balance
walletRoutes.get('/wallets/:walletId/balance', async (req: Request, res: Response) => {
  try {
    const { walletId } = req.params;
    const forceRefresh = req.query.refresh === 'true';

    const balance = await walletService.getWalletBalance(walletId, forceRefresh);

    res.json({
      success: true,
      data: balance,
    });
  } catch (error: any) {
    logger.error('Failed to get balance:', error);
    res.status(500).json({
      error: 'Failed to get balance',
      message: error.message,
    });
  }
});

// ========================================================================
// Transaction Routes
// ========================================================================

// Initiate transfer
walletRoutes.post('/wallets/:walletId/transfer', async (req: Request, res: Response) => {
  try {
    const { walletId } = req.params;
    const {
      destinationType,
      destinationId,
      amount,
      currency,
      narration,
      reference,
      bankCode,
      accountNumber,
      accountName,
    } = req.body;

    if (!destinationType || !destinationId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['destinationType', 'destinationId', 'amount'],
      });
    }

    const transaction = await walletService.initiateTransfer(walletId, {
      destinationType,
      destinationId,
      amount,
      currency,
      narration,
      reference,
      bankCode,
      accountNumber,
      accountName,
    });

    res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    logger.error('Failed to initiate transfer:', error);
    res.status(500).json({
      error: 'Failed to initiate transfer',
      message: error.message,
    });
  }
});

// Get transaction
walletRoutes.get('/transactions/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const transaction = await walletService.getTransaction(transactionId);

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    logger.error('Failed to get transaction:', error);
    res.status(500).json({
      error: 'Failed to get transaction',
      message: error.message,
    });
  }
});

// Get transaction history
walletRoutes.get('/wallets/:walletId/transactions', async (req: Request, res: Response) => {
  try {
    const { walletId } = req.params;
    const { page, limit, startDate, endDate } = req.query;

    const history = await walletService.getTransactionHistory(walletId, {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.json({
      success: true,
      ...history,
    });
  } catch (error: any) {
    logger.error('Failed to get transaction history:', error);
    res.status(500).json({
      error: 'Failed to get transaction history',
      message: error.message,
    });
  }
});

// ========================================================================
// Bank Routes
// ========================================================================

// Get bank list
walletRoutes.get('/banks', async (req: Request, res: Response) => {
  try {
    const { provider } = req.query;

    const banks = await walletService.getBankList(provider as string);

    res.json({
      success: true,
      data: banks,
    });
  } catch (error: any) {
    logger.error('Failed to get bank list:', error);
    res.status(500).json({
      error: 'Failed to get bank list',
      message: error.message,
    });
  }
});

// Validate bank account
walletRoutes.post('/banks/validate', async (req: Request, res: Response) => {
  try {
    const { accountNumber, bankCode, provider } = req.body;

    if (!accountNumber || !bankCode) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['accountNumber', 'bankCode'],
      });
    }

    const validation = await walletService.validateBankAccount(
      accountNumber,
      bankCode,
      provider
    );

    res.json({
      success: true,
      data: validation,
    });
  } catch (error: any) {
    logger.error('Failed to validate bank account:', error);
    res.status(500).json({
      error: 'Failed to validate bank account',
      message: error.message,
    });
  }
});
