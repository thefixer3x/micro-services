/**
 * Integration Test Setup
 * Configures Supabase connection for integration tests (the-fixer-initiative project)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load from environment variables only
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

/**
 * Validate required environment variables
 */
function validateEnvVars(): void {
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL environment variable is required for integration tests');
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY environment variable is required for integration tests');
  }
}

/**
 * Get Supabase client for integration tests (anon key)
 */
export function getTestSupabase(): SupabaseClient {
  if (!supabase) {
    validateEnvVars();
    supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    console.log('Integration test Supabase client initialized');
  }
  return supabase;
}

/**
 * Get Supabase admin client (service role key - bypasses RLS)
 */
export function getTestSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    if (!SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY required for admin operations');
    }
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('Integration test Supabase admin client initialized');
  }
  return supabaseAdmin;
}

/**
 * Close Supabase clients after tests
 */
export async function closeTestClients(): Promise<void> {
  // Supabase clients don't need explicit closing
  supabase = null;
  supabaseAdmin = null;
  console.log('Integration test Supabase clients cleared');
}

/**
 * Clean up test data by user_id prefix
 * Use a unique prefix for test data to avoid conflicts
 * Requires service role key to bypass RLS
 */
export async function cleanupTestData(testPrefix: string): Promise<void> {
  // Skip cleanup if no service key (tests will use unique IDs anyway)
  if (!SUPABASE_SERVICE_KEY) {
    console.log('Skipping cleanup - no service role key available');
    return;
  }

  const admin = getTestSupabaseAdmin();

  try {
    // Get customer IDs matching prefix
    const { data: customers } = await admin
      .from('customers')
      .select('id')
      .like('user_id', `${testPrefix}%`);

    if (customers && customers.length > 0) {
      const customerIds = customers.map(c => c.id);

      // Get wallet IDs for these customers
      const { data: wallets } = await admin
        .from('wallets')
        .select('id')
        .in('customer_id', customerIds);

      if (wallets && wallets.length > 0) {
        const walletIds = wallets.map(w => w.id);

        // Delete transactions first
        await admin
          .from('transactions')
          .delete()
          .in('source_wallet_id', walletIds);
      }

      // Delete wallets
      await admin
        .from('wallets')
        .delete()
        .in('customer_id', customerIds);

      // Delete customers
      await admin
        .from('customers')
        .delete()
        .like('user_id', `${testPrefix}%`);
    }

    console.log(`Cleaned up test data with prefix: ${testPrefix}`);
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    // Don't throw - cleanup errors shouldn't fail tests
  }
}

/**
 * Generate unique test ID
 */
export function generateTestId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Test data factory
 */
export const TestDataFactory = {
  createCustomerData(userId: string) {
    return {
      provider: 'providus',
      provider_customer_id: `prov_${generateTestId()}`,
      user_id: userId,
      first_name: 'Test',
      last_name: 'User',
      email: `test_${Date.now()}@example.com`,
      phone_number: `080${Math.floor(10000000 + Math.random() * 90000000)}`,
      date_of_birth: '1990-01-15',
      bvn: '12345678901',
      address: '123 Test Street, Lagos',
      kyc_status: 'pending',
      status: 'active',
      metadata: JSON.stringify({ test: true }),
    };
  },

  createWalletData(customerId: string) {
    return {
      provider: 'providus',
      provider_wallet_id: `wallet_${generateTestId()}`,
      customer_id: customerId,
      account_number: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      account_name: 'Test User',
      currency: 'NGN',
      wallet_type: 'virtual',
      status: 'active',
      available_balance: 0,
      ledger_balance: 0,
      reserved_balance: 0,
      metadata: JSON.stringify({ test: true }),
    };
  },

  createTransactionData(sourceWalletId: string) {
    return {
      provider: 'providus',
      provider_transaction_id: `txn_${generateTestId()}`,
      reference: `REF_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      source_wallet_id: sourceWalletId,
      destination_type: 'bank',
      destination_id: '0123456789',
      destination_name: 'Test Recipient',
      amount: 100.00,
      currency: 'NGN',
      fee: 10.00,
      vat: 0.75,
      total_amount: 110.75,
      status: 'pending',
      narration: 'Test transaction',
      bank_code: '000013',
      sort_code: '000013',
      account_number: '0123456789',
      metadata: JSON.stringify({ test: true }),
    };
  },
};
