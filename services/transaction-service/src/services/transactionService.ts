import axios from 'axios';
import transactionRepository from '../repositories/transactionRepository';
import feeService from './feeService';
import { transaction as dbTransaction } from '../database/connection';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  CreateTransferRequest,
  TransferResponse,
  FeeCalculationResponse,
  PaginationParams,
  PaginatedResponse,
  TransactionFee
} from '../types';
import logger from '../utils/logger';

export class TransactionService {
  private walletServiceUrl: string;
  private identityServiceUrl: string;

  constructor() {
    this.walletServiceUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:3002';
    this.identityServiceUrl = process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';
  }

  async createTransfer(request: CreateTransferRequest): Promise<TransferResponse> {
    logger.info('Creating transfer', { sourceWallet: request.sourceWalletId, amount: request.amount });

    // Check for idempotency
    if (request.idempotencyKey) {
      const existing = await transactionRepository.findByIdempotencyKey(request.idempotencyKey);
      if (existing) {
        logger.info('Returning existing transaction for idempotency key', { id: existing.id });
        const fees = await transactionRepository.getFeesByTransactionId(existing.id);
        return { transaction: existing, fees };
      }
    }

    // Determine if international
    const isInternational = !!request.destinationBankCode &&
      !request.destinationBankCode.startsWith('000'); // Nigerian bank codes start with 000

    // Validate limits
    const limitCheck = feeService.validateTransactionLimits(
      request.amount,
      TransactionType.TRANSFER,
      isInternational
    );

    if (!limitCheck.valid) {
      throw new Error(limitCheck.message);
    }

    // Calculate fees
    const feeCalculation = feeService.calculateFees({
      transactionType: TransactionType.TRANSFER,
      amount: request.amount,
      sourceCurrency: request.currencyCode,
      isInternational
    });

    // Create transaction and fees atomically within a database transaction
    const { transaction, fees } = await dbTransaction(async (client) => {
      // Create transaction
      const txn = await transactionRepository.createWithClient(client, {
        transactionType: TransactionType.TRANSFER,
        sourceWalletId: request.sourceWalletId,
        destinationWalletId: request.destinationWalletId,
        destinationAccountNumber: request.destinationAccountNumber,
        destinationBankCode: request.destinationBankCode,
        amount: request.amount,
        currencyCode: request.currencyCode,
        feeAmount: feeCalculation.totalFee,
        narration: request.narration,
        metadata: { idempotencyKey: request.idempotencyKey }
      });

      // Record fees within same transaction
      const recordedFees: TransactionFee[] = [];
      for (const fee of feeCalculation.breakdown) {
        const recordedFee = await transactionRepository.addFeeWithClient(client, {
          transactionId: txn.id,
          feeType: fee.type,
          feeAmount: fee.amount,
          feeCurrency: request.currencyCode
        });
        recordedFees.push(recordedFee);
      }

      return { transaction: txn, fees: recordedFees };
    });

    logger.info('Transfer created', {
      transactionId: transaction.id,
      reference: transaction.referenceNumber
    });

    // Start async processing
    this.processTransactionAsync(transaction.id).catch(err => {
      logger.error('Async transaction processing failed', { transactionId: transaction.id, error: err.message });
    });

    return {
      transaction,
      fees,
      estimatedCompletionTime: isInternational ? '1-3 business days' : 'Within minutes'
    };
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    return transactionRepository.findById(id);
  }

  async getTransactionByReference(reference: string): Promise<Transaction | null> {
    return transactionRepository.findByReference(reference);
  }

  async getWalletTransactions(
    walletId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<Transaction>> {
    return transactionRepository.findByWalletId(walletId, pagination);
  }

  async cancelTransaction(id: string): Promise<Transaction> {
    const transaction = await transactionRepository.findById(id);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new Error(`Cannot cancel transaction in ${transaction.status} status`);
    }

    const updated = await transactionRepository.updateStatus(id, TransactionStatus.CANCELLED);

    if (!updated) {
      throw new Error('Failed to cancel transaction');
    }

    logger.info('Transaction cancelled', { transactionId: id });
    return updated;
  }

  async calculateFees(
    transactionType: TransactionType,
    amount: number,
    currency: string,
    isInternational: boolean
  ): Promise<FeeCalculationResponse> {
    return feeService.calculateFees({
      transactionType,
      amount,
      sourceCurrency: currency,
      isInternational
    });
  }

  async getTransactionStats(walletId: string) {
    return transactionRepository.getTransactionStats(walletId);
  }

  async generateStatement(
    walletId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    walletId: string;
    startDate: string;
    endDate: string;
    openingBalance: number;
    closingBalance: number;
    totalCredits: number;
    totalDebits: number;
    transactionCount: number;
    transactions: Transaction[];
  }> {
    logger.info('Generating statement', { walletId, startDate, endDate });

    // Get transactions for the period
    const transactions = await transactionRepository.findByWalletIdAndDateRange(
      walletId,
      startDate,
      endDate
    );

    // Calculate totals
    let totalCredits = 0;
    let totalDebits = 0;

    for (const txn of transactions) {
      if (txn.direction === 'inbound') {
        totalCredits += Number(txn.amount);
      } else {
        totalDebits += Number(txn.amount) + Number(txn.feeAmount || 0);
      }
    }

    // Get opening balance (balance at start of period)
    const openingBalance = await transactionRepository.getBalanceAtDate(walletId, startDate);

    // Calculate closing balance
    const closingBalance = openingBalance + totalCredits - totalDebits;

    // Add running balance to transactions
    let runningBalance = openingBalance;
    const transactionsWithBalance = transactions.map(txn => {
      if (txn.direction === 'inbound') {
        runningBalance += Number(txn.amount);
      } else {
        runningBalance -= Number(txn.amount) + Number(txn.feeAmount || 0);
      }
      return { ...txn, running_balance: runningBalance };
    });

    logger.info('Statement generated', {
      walletId,
      transactionCount: transactions.length,
      totalCredits,
      totalDebits
    });

    return {
      walletId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      openingBalance,
      closingBalance,
      totalCredits,
      totalDebits,
      transactionCount: transactions.length,
      transactions: transactionsWithBalance
    };
  }

  private async processTransactionAsync(transactionId: string): Promise<void> {
    try {
      // Update to processing
      await transactionRepository.updateStatus(transactionId, TransactionStatus.PROCESSING);

      const transaction = await transactionRepository.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real implementation, this would:
      // 1. Validate source wallet has sufficient balance via Wallet Service
      // 2. Debit source wallet
      // 3. Route through appropriate payment partner
      // 4. Credit destination wallet/account
      // 5. Update transaction status

      // For now, mark as completed
      await transactionRepository.updateStatus(
        transactionId,
        TransactionStatus.COMPLETED,
        new Date()
      );

      logger.info('Transaction processed successfully', { transactionId });
    } catch (error) {
      logger.error('Transaction processing failed', { transactionId, error });
      await transactionRepository.updateStatus(transactionId, TransactionStatus.FAILED);
    }
  }
}

export default new TransactionService();
