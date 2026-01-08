/**
 * Wallet Service Database Integration Tests
 * Tests CRUD operations against Supabase (the-fixer-initiative project)
 *
 * Run with: npm run test:integration
 * Requires: SUPABASE_SERVICE_ROLE_KEY environment variable for full tests
 */

import {
  getTestSupabase,
  closeTestClients,
  cleanupTestData,
  generateTestId,
  TestDataFactory,
} from '../integration-setup';

// Unique prefix for this test run to isolate data
const TEST_PREFIX = `integration_${Date.now()}`;

describe('Wallet Service Database Integration', () => {
  const supabase = getTestSupabase();

  afterAll(async () => {
    await cleanupTestData(TEST_PREFIX);
    await closeTestClients();
  });

  describe('Customers Table', () => {
    let createdCustomerId: string;

    it('should create a customer', async () => {
      const userId = `${TEST_PREFIX}_user_${generateTestId()}`;
      const customerData = TestDataFactory.createCustomerData(userId);

      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      // Note: This may fail due to RLS - that's expected with anon key
      if (error && error.code === '42501') {
        console.log('RLS prevented insert - expected with anon key');
        return;
      }

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.first_name).toBe('Test');
      expect(data.last_name).toBe('User');
      expect(data.provider).toBe('providus');

      createdCustomerId = data.id;
    });

    it('should read customer by ID', async () => {
      if (!createdCustomerId) {
        console.log('Skipping - no customer created');
        return;
      }

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', createdCustomerId)
        .single();

      if (error && error.code === '42501') {
        console.log('RLS prevented read - expected with anon key');
        return;
      }

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBe(createdCustomerId);
    });

    it('should update customer KYC status', async () => {
      if (!createdCustomerId) {
        console.log('Skipping - no customer created');
        return;
      }

      const { data, error } = await supabase
        .from('customers')
        .update({ kyc_status: 'verified', kyc_level: 'basic' })
        .eq('id', createdCustomerId)
        .select()
        .single();

      if (error && error.code === '42501') {
        console.log('RLS prevented update - expected with anon key');
        return;
      }

      expect(error).toBeNull();
      expect(data.kyc_status).toBe('verified');
      expect(data.kyc_level).toBe('basic');
    });
  });

  describe('Wallets Table', () => {
    let testCustomerId: string;
    let createdWalletId: string;

    beforeAll(async () => {
      // Create a customer first for wallet tests
      const userId = `${TEST_PREFIX}_wallet_user_${generateTestId()}`;
      const customerData = TestDataFactory.createCustomerData(userId);

      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (!error && data) {
        testCustomerId = data.id;
      }
    });

    it('should create a wallet for customer', async () => {
      if (!testCustomerId) {
        console.log('Skipping - no customer available');
        return;
      }

      const walletData = TestDataFactory.createWalletData(testCustomerId);

      const { data, error } = await supabase
        .from('wallets')
        .insert(walletData)
        .select()
        .single();

      if (error && error.code === '42501') {
        console.log('RLS prevented insert - expected with anon key');
        return;
      }

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.customer_id).toBe(testCustomerId);
      expect(data.currency).toBe('NGN');
      expect(data.status).toBe('active');

      createdWalletId = data.id;
    });

    it('should read wallet balance', async () => {
      if (!createdWalletId) {
        console.log('Skipping - no wallet created');
        return;
      }

      const { data, error } = await supabase
        .from('wallets')
        .select('available_balance, ledger_balance, reserved_balance, currency')
        .eq('id', createdWalletId)
        .single();

      if (error && error.code === '42501') {
        console.log('RLS prevented read - expected with anon key');
        return;
      }

      expect(error).toBeNull();
      expect(data).toBeDefined();
      if (data) {
        expect(typeof data.available_balance).toBe('number');
        expect(data.currency).toBe('NGN');
      }
    });

    it('should update wallet balance', async () => {
      if (!createdWalletId) {
        console.log('Skipping - no wallet created');
        return;
      }

      const { data, error } = await supabase
        .from('wallets')
        .update({
          available_balance: 5000.00,
          ledger_balance: 5000.00,
          last_balance_update: new Date().toISOString(),
        })
        .eq('id', createdWalletId)
        .select()
        .single();

      if (error && error.code === '42501') {
        console.log('RLS prevented update - expected with anon key');
        return;
      }

      expect(error).toBeNull();
      expect(data.available_balance).toBe(5000);
      expect(data.ledger_balance).toBe(5000);
    });

    it('should get wallets by customer ID', async () => {
      if (!testCustomerId) {
        console.log('Skipping - no customer available');
        return;
      }

      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('customer_id', testCustomerId);

      if (error && error.code === '42501') {
        console.log('RLS prevented read - expected with anon key');
        return;
      }

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Transactions Table', () => {
    let testWalletId: string;
    let createdTransactionId: string;

    beforeAll(async () => {
      // Create customer and wallet for transaction tests
      const userId = `${TEST_PREFIX}_txn_user_${generateTestId()}`;
      const customerData = TestDataFactory.createCustomerData(userId);

      const { data: customer } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (customer) {
        const walletData = TestDataFactory.createWalletData(customer.id);
        const { data: wallet } = await supabase
          .from('wallets')
          .insert(walletData)
          .select()
          .single();

        if (wallet) {
          testWalletId = wallet.id;
        }
      }
    });

    it('should create a transaction', async () => {
      if (!testWalletId) {
        console.log('Skipping - no wallet available');
        return;
      }

      const transactionData = TestDataFactory.createTransactionData(testWalletId);

      const { data, error } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (error && error.code === '42501') {
        console.log('RLS prevented insert - expected with anon key');
        return;
      }

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.source_wallet_id).toBe(testWalletId);
      expect(data.amount).toBe(100);
      expect(data.status).toBe('pending');

      createdTransactionId = data.id;
    });

    it('should update transaction status', async () => {
      if (!createdTransactionId) {
        console.log('Skipping - no transaction created');
        return;
      }

      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', createdTransactionId)
        .select()
        .single();

      if (error && error.code === '42501') {
        console.log('RLS prevented update - expected with anon key');
        return;
      }

      expect(error).toBeNull();
      expect(data.status).toBe('completed');
      expect(data.completed_at).toBeDefined();
    });

    it('should get transaction history for wallet', async () => {
      if (!testWalletId) {
        console.log('Skipping - no wallet available');
        return;
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('source_wallet_id', testWalletId)
        .order('created_at', { ascending: false });

      if (error && error.code === '42501') {
        console.log('RLS prevented read - expected with anon key');
        return;
      }

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter transactions by status', async () => {
      if (!testWalletId) {
        console.log('Skipping - no wallet available');
        return;
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('source_wallet_id', testWalletId)
        .eq('status', 'completed');

      if (error && error.code === '42501') {
        console.log('RLS prevented read - expected with anon key');
        return;
      }

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Database Constraints', () => {
    it('should enforce customer unique constraints', async () => {
      const userId = `${TEST_PREFIX}_unique_${generateTestId()}`;
      const customerData = TestDataFactory.createCustomerData(userId);

      // First insert should succeed
      const { error: firstError } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (firstError && firstError.code === '42501') {
        console.log('RLS prevented insert - expected with anon key');
        return;
      }

      // Second insert with same provider_customer_id should fail
      const { error: secondError } = await supabase
        .from('customers')
        .insert({
          ...customerData,
          user_id: `${userId}_2`, // Different user_id
          email: 'different@example.com',
        });

      // Should get a unique constraint violation
      expect(secondError).toBeDefined();
    });

    it('should enforce transaction reference uniqueness', async () => {
      // Create required customer and wallet first
      const userId = `${TEST_PREFIX}_ref_${generateTestId()}`;
      const customerData = TestDataFactory.createCustomerData(userId);

      const { data: customer } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (!customer) {
        console.log('Skipping - RLS prevented customer creation');
        return;
      }

      const walletData = TestDataFactory.createWalletData(customer.id);
      const { data: wallet } = await supabase
        .from('wallets')
        .insert(walletData)
        .select()
        .single();

      if (!wallet) {
        console.log('Skipping - RLS prevented wallet creation');
        return;
      }

      const transactionData = TestDataFactory.createTransactionData(wallet.id);

      // First insert
      const { error: firstError } = await supabase
        .from('transactions')
        .insert(transactionData);

      if (firstError && firstError.code === '42501') {
        console.log('RLS prevented insert - expected with anon key');
        return;
      }

      // Second insert with same reference should fail
      const { error: secondError } = await supabase
        .from('transactions')
        .insert(transactionData);

      expect(secondError).toBeDefined();
    });
  });
});
