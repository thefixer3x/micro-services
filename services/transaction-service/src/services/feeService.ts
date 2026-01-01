import { TransactionType, FeeCalculationRequest, FeeCalculationResponse } from '../types';
import logger from '../utils/logger';

interface FeeConfig {
  percentageFee: number;
  minimumFee: number;
  maximumFee?: number;
  flatFee?: number;
}

const FEE_CONFIGURATIONS: Record<string, FeeConfig> = {
  'transfer:domestic': {
    percentageFee: parseFloat(process.env.DOMESTIC_FEE_PERCENTAGE || '0.5'),
    minimumFee: parseFloat(process.env.MINIMUM_FEE || '100'),
    maximumFee: 5000
  },
  'transfer:international': {
    percentageFee: parseFloat(process.env.INTERNATIONAL_FEE_PERCENTAGE || '1.5'),
    minimumFee: 500,
    maximumFee: 25000,
    flatFee: 250
  },
  'payment:default': {
    percentageFee: 0.5,
    minimumFee: 50,
    maximumFee: 2000
  },
  'remittance:default': {
    percentageFee: 2.0,
    minimumFee: 1000,
    flatFee: 500
  }
};

export class FeeService {
  calculateFees(request: FeeCalculationRequest): FeeCalculationResponse {
    const { transactionType, amount, sourceCurrency, destinationCurrency, isInternational } = request;

    const configKey = this.getConfigKey(transactionType, isInternational);
    const config = FEE_CONFIGURATIONS[configKey] || FEE_CONFIGURATIONS['payment:default'];

    const breakdown: FeeCalculationResponse['breakdown'] = [];
    let totalFee = 0;

    // Calculate percentage fee
    let percentageFeeAmount = (amount * config.percentageFee) / 100;

    // Apply minimum
    if (percentageFeeAmount < config.minimumFee) {
      percentageFeeAmount = config.minimumFee;
    }

    // Apply maximum if defined
    if (config.maximumFee && percentageFeeAmount > config.maximumFee) {
      percentageFeeAmount = config.maximumFee;
    }

    breakdown.push({
      type: 'processing_fee',
      amount: percentageFeeAmount,
      description: `${config.percentageFee}% processing fee`
    });
    totalFee += percentageFeeAmount;

    // Add flat fee if applicable
    if (config.flatFee) {
      breakdown.push({
        type: 'service_fee',
        amount: config.flatFee,
        description: 'Service fee'
      });
      totalFee += config.flatFee;
    }

    // Add currency conversion fee for cross-currency transactions
    if (destinationCurrency && sourceCurrency !== destinationCurrency) {
      const conversionFee = amount * 0.002; // 0.2% conversion spread
      breakdown.push({
        type: 'fx_fee',
        amount: conversionFee,
        description: 'Currency conversion fee'
      });
      totalFee += conversionFee;
    }

    logger.debug('Fee calculated', {
      transactionType,
      amount,
      totalFee,
      breakdown: breakdown.length
    });

    return {
      baseFee: config.minimumFee,
      percentageFee: config.percentageFee,
      totalFee: Math.round(totalFee * 100) / 100, // Round to 2 decimal places
      feeCurrency: sourceCurrency,
      breakdown
    };
  }

  private getConfigKey(transactionType: TransactionType, isInternational?: boolean): string {
    if (transactionType === TransactionType.TRANSFER) {
      return isInternational ? 'transfer:international' : 'transfer:domestic';
    }
    return `${transactionType}:default`;
  }

  validateTransactionLimits(
    amount: number,
    transactionType: TransactionType,
    isInternational: boolean
  ): { valid: boolean; message?: string } {
    const maxDomestic = parseFloat(process.env.MAX_DOMESTIC_TRANSFER || '1000000');
    const maxInternational = parseFloat(process.env.MAX_INTERNATIONAL_TRANSFER || '500000');

    const limit = isInternational ? maxInternational : maxDomestic;

    if (amount > limit) {
      return {
        valid: false,
        message: `Transaction amount exceeds the ${isInternational ? 'international' : 'domestic'} limit of ${limit}`
      };
    }

    if (amount <= 0) {
      return {
        valid: false,
        message: 'Transaction amount must be greater than zero'
      };
    }

    return { valid: true };
  }
}

export default new FeeService();
