/**
 * Supabase Database Types for Wallet Service
 * Auto-generated from Supabase schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Customer table types
 */
export interface CustomerRow {
  id: string;
  provider: string;
  provider_customer_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  date_of_birth: string | null;
  bvn: string | null;
  address: string | null;
  kyc_status: 'pending' | 'verified' | 'rejected';
  kyc_level: 'basic' | 'intermediate' | 'full' | null;
  status: 'active' | 'inactive' | 'suspended';
  metadata: Json | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerInsert {
  id?: string;
  provider?: string;
  provider_customer_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  date_of_birth?: string | null;
  bvn?: string | null;
  address?: string | null;
  kyc_status?: 'pending' | 'verified' | 'rejected';
  kyc_level?: 'basic' | 'intermediate' | 'full' | null;
  status?: 'active' | 'inactive' | 'suspended';
  metadata?: Json | null;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerUpdate {
  id?: string;
  provider?: string;
  provider_customer_id?: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  date_of_birth?: string | null;
  bvn?: string | null;
  address?: string | null;
  kyc_status?: 'pending' | 'verified' | 'rejected';
  kyc_level?: 'basic' | 'intermediate' | 'full' | null;
  status?: 'active' | 'inactive' | 'suspended';
  metadata?: Json | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Wallet table types
 */
export interface WalletRow {
  id: string;
  provider: string;
  provider_wallet_id: string;
  customer_id: string;
  account_number: string | null;
  account_name: string | null;
  currency: string;
  wallet_type: 'savings' | 'current' | 'virtual';
  status: 'active' | 'inactive' | 'frozen';
  available_balance: number;
  ledger_balance: number;
  reserved_balance: number;
  last_balance_update: string | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
}

export interface WalletInsert {
  id?: string;
  provider?: string;
  provider_wallet_id: string;
  customer_id: string;
  account_number?: string | null;
  account_name?: string | null;
  currency?: string;
  wallet_type?: 'savings' | 'current' | 'virtual';
  status?: 'active' | 'inactive' | 'frozen';
  available_balance?: number;
  ledger_balance?: number;
  reserved_balance?: number;
  last_balance_update?: string | null;
  metadata?: Json | null;
  created_at?: string;
  updated_at?: string;
}

export interface WalletUpdate {
  id?: string;
  provider?: string;
  provider_wallet_id?: string;
  customer_id?: string;
  account_number?: string | null;
  account_name?: string | null;
  currency?: string;
  wallet_type?: 'savings' | 'current' | 'virtual';
  status?: 'active' | 'inactive' | 'frozen';
  available_balance?: number;
  ledger_balance?: number;
  reserved_balance?: number;
  last_balance_update?: string | null;
  metadata?: Json | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Transaction table types
 */
export interface TransactionRow {
  id: string;
  provider: string;
  provider_transaction_id: string | null;
  reference: string;
  source_wallet_id: string;
  destination_type: 'wallet' | 'bank' | 'card';
  destination_id: string;
  destination_name: string | null;
  amount: number;
  currency: string;
  fee: number;
  vat: number;
  total_amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';
  narration: string | null;
  bank_code: string | null;
  sort_code: string | null;
  account_number: string | null;
  session_id: string | null;
  failure_reason: string | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TransactionInsert {
  id?: string;
  provider?: string;
  provider_transaction_id?: string | null;
  reference: string;
  source_wallet_id: string;
  destination_type: 'wallet' | 'bank' | 'card';
  destination_id: string;
  destination_name?: string | null;
  amount: number;
  currency?: string;
  fee?: number;
  vat?: number;
  total_amount: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';
  narration?: string | null;
  bank_code?: string | null;
  sort_code?: string | null;
  account_number?: string | null;
  session_id?: string | null;
  failure_reason?: string | null;
  metadata?: Json | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
}

export interface TransactionUpdate {
  id?: string;
  provider?: string;
  provider_transaction_id?: string | null;
  reference?: string;
  source_wallet_id?: string;
  destination_type?: 'wallet' | 'bank' | 'card';
  destination_id?: string;
  destination_name?: string | null;
  amount?: number;
  currency?: string;
  fee?: number;
  vat?: number;
  total_amount?: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';
  narration?: string | null;
  bank_code?: string | null;
  sort_code?: string | null;
  account_number?: string | null;
  session_id?: string | null;
  failure_reason?: string | null;
  metadata?: Json | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
}

/**
 * Beneficiary table types
 */
export interface BeneficiaryRow {
  id: string;
  user_id: string;
  name: string;
  account_number: string;
  bank_code: string;
  category: string | null;
  is_archived: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface BeneficiaryInsert {
  id?: string;
  user_id: string;
  name: string;
  account_number: string;
  bank_code: string;
  category?: string | null;
  is_archived?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface BeneficiaryUpdate {
  id?: string;
  user_id?: string;
  name?: string;
  account_number?: string;
  bank_code?: string;
  category?: string | null;
  is_archived?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Database table definitions for type safety
 */
export interface WalletServiceTables {
  customers: {
    Row: CustomerRow;
    Insert: CustomerInsert;
    Update: CustomerUpdate;
  };
  wallets: {
    Row: WalletRow;
    Insert: WalletInsert;
    Update: WalletUpdate;
  };
  transactions: {
    Row: TransactionRow;
    Insert: TransactionInsert;
    Update: TransactionUpdate;
  };
  beneficiaries: {
    Row: BeneficiaryRow;
    Insert: BeneficiaryInsert;
    Update: BeneficiaryUpdate;
  };
}
