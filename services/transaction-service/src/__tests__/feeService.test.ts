import feeService from '../services/feeService';
import { TransactionType } from '../types';

describe('FeeService', () => {
  describe('calculateFees', () => {
    it('should calculate domestic transfer fees correctly', async () => {
      const result = await feeService.calculateFees({
        transactionType: TransactionType.TRANSFER,
        amount: 10000,
        sourceCurrency: 'NGN',
        isInternational: false
      });

      expect(result).toHaveProperty('totalFee');
      expect(result).toHaveProperty('breakdown');
      expect(result.totalFee).toBeGreaterThan(0);
      expect(result.feeCurrency).toBe('NGN');
    });

    it('should calculate international transfer fees higher than domestic', async () => {
      const domestic = await feeService.calculateFees({
        transactionType: TransactionType.TRANSFER,
        amount: 10000,
        sourceCurrency: 'NGN',
        isInternational: false
      });

      const international = await feeService.calculateFees({
        transactionType: TransactionType.TRANSFER,
        amount: 10000,
        sourceCurrency: 'NGN',
        isInternational: true
      });

      expect(international.totalFee).toBeGreaterThan(domestic.totalFee);
    });

    it('should add FX fee for cross-currency transactions', async () => {
      const result = await feeService.calculateFees({
        transactionType: TransactionType.TRANSFER,
        amount: 10000,
        sourceCurrency: 'NGN',
        destinationCurrency: 'USD',
        isInternational: true
      });

      const fxFee = result.breakdown.find(b => b.type === 'fx_fee');
      expect(fxFee).toBeDefined();
    });

    it('should apply minimum fee for small transactions', async () => {
      const result = await feeService.calculateFees({
        transactionType: TransactionType.TRANSFER,
        amount: 100,
        sourceCurrency: 'NGN',
        isInternational: false
      });

      // Fee should be at least the minimum
      expect(result.totalFee).toBeGreaterThanOrEqual(100);
    });
  });

  describe('validateTransactionLimits', () => {
    it('should pass for valid domestic amount', () => {
      const result = feeService.validateTransactionLimits(
        50000,
        TransactionType.TRANSFER,
        false
      );

      expect(result.valid).toBe(true);
    });

    it('should fail for amount exceeding limit', () => {
      const result = feeService.validateTransactionLimits(
        10000000,
        TransactionType.TRANSFER,
        false
      );

      expect(result.valid).toBe(false);
      expect(result.message).toContain('exceeds');
    });

    it('should fail for zero or negative amounts', () => {
      const result = feeService.validateTransactionLimits(
        0,
        TransactionType.TRANSFER,
        false
      );

      expect(result.valid).toBe(false);
      expect(result.message).toContain('greater than zero');
    });
  });
});
