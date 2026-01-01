import { TransactionType, FeeCalculationRequest, FeeCalculationResponse } from '../types';
import feeRepository, { FeeConfiguration, CreateFeeConfigRequest, UpdateFeeConfigRequest } from '../repositories/feeRepository';
import logger from '../utils/logger';

interface FeeConfig {
  percentageFee: number;
  minimumFee: number;
  maximumFee?: number;
  flatFee?: number;
}

// Default configurations (fallback if database is unavailable)
const DEFAULT_FEE_CONFIGURATIONS: Record<string, FeeConfig> = {
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
  private configCache: Map<string, { config: FeeConfig; expires: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getConfig(feeType: string, transactionType: string, currency: string = 'NGN'): Promise<FeeConfig> {
    const cacheKey = `${feeType}:${transactionType}:${currency}`;
    const cached = this.configCache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      return cached.config;
    }

    try {
      const dbConfig = await feeRepository.findByType(feeType, transactionType, currency);
      if (dbConfig) {
        const config: FeeConfig = {
          percentageFee: Number(dbConfig.percentage_fee) * 100, // Convert decimal to percentage
          minimumFee: Number(dbConfig.minimum_fee),
          maximumFee: dbConfig.maximum_fee ? Number(dbConfig.maximum_fee) : undefined,
          flatFee: dbConfig.flat_fee ? Number(dbConfig.flat_fee) : undefined
        };
        this.configCache.set(cacheKey, { config, expires: Date.now() + this.CACHE_TTL });
        return config;
      }
    } catch (error) {
      logger.warn('Failed to fetch fee config from DB, using defaults', { error, feeType, transactionType });
    }

    // Fallback to defaults
    const defaultKey = `${feeType}:${transactionType}`;
    return DEFAULT_FEE_CONFIGURATIONS[defaultKey] || DEFAULT_FEE_CONFIGURATIONS['payment:default'];
  }

  calculateFees(request: FeeCalculationRequest): FeeCalculationResponse {
    const { transactionType, amount, sourceCurrency, destinationCurrency, isInternational } = request;

    const configKey = this.getConfigKey(transactionType, isInternational);
    const config = DEFAULT_FEE_CONFIGURATIONS[configKey] || DEFAULT_FEE_CONFIGURATIONS['payment:default'];

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

  // ========================================================================
  // Fee Configuration Admin Methods
  // ========================================================================

  async listFeeConfigurations(includeInactive: boolean = false): Promise<FeeConfiguration[]> {
    return feeRepository.findAll(includeInactive);
  }

  async getFeeConfiguration(id: string): Promise<FeeConfiguration | null> {
    return feeRepository.findById(id);
  }

  async createFeeConfiguration(data: CreateFeeConfigRequest): Promise<FeeConfiguration> {
    const config = await feeRepository.create(data);
    this.clearCache();
    logger.info('Fee configuration created', { id: config.id, feeType: data.fee_type });
    return config;
  }

  async updateFeeConfiguration(id: string, data: UpdateFeeConfigRequest): Promise<FeeConfiguration | null> {
    const config = await feeRepository.update(id, data);
    this.clearCache();
    logger.info('Fee configuration updated', { id });
    return config;
  }

  async deactivateFeeConfiguration(id: string): Promise<boolean> {
    const result = await feeRepository.deactivate(id);
    this.clearCache();
    logger.info('Fee configuration deactivated', { id });
    return result;
  }

  private clearCache(): void {
    this.configCache.clear();
    logger.debug('Fee configuration cache cleared');
  }
}

export default new FeeService();
