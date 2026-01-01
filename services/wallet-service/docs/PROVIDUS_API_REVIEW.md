# Providus Bank Xpress Wallet API - Implementation Review

**Date:** 2025-01-XX  
**API Documentation:** https://developer.providusbank.com/xpress-wallet-api  
**Implementation Status:** Reviewing coverage against official API

---

## 📋 Executive Summary

The current implementation covers **~70%** of the Providus Bank Xpress Wallet API endpoints. There are several **critical gaps** and **API structure mismatches** that need to be addressed for full compliance.

---

## ✅ **IMPLEMENTED ENDPOINTS**

### Authentication ✅
- ✅ `POST /auth/login` - Authentication with clientId/clientSecret
- ✅ `POST /auth/refresh` - Token refresh
- ✅ Token management (X-Access-Token, X-Refresh-Token headers)

### Customer Management ✅ (Partial)
- ✅ `POST /customers` - Create customer (via `/customers` endpoint)
- ✅ `GET /customers/:customerId` - Get customer details
- ✅ `PUT /customers/:customerId` - Update customer profile
- ✅ `GET /customers/search` - Search customers

### Wallet Management ✅ (Partial)
- ✅ `POST /wallets` - Create wallet (separate from customer creation)
- ✅ `GET /wallets/:walletId` - Get wallet details
- ✅ `GET /customers/:customerId/wallets` - Get wallets by customer
- ✅ `GET /wallets/:walletId/balance` - Get wallet balance

### Transactions ✅ (Partial)
- ✅ `POST /transfers` - Initiate transfer (generic)
- ✅ `GET /transactions/:transactionId` - Get transaction details
- ✅ `GET /wallets/:walletId/transactions` - Transaction history with pagination

### Bank Operations ✅ (Partial)
- ✅ `GET /banks` - Get bank list
- ✅ `POST /banks/validate-account` - Validate bank account

---

## ❌ **MISSING ENDPOINTS**

### 1. **Create Customer Wallet (Combined Endpoint)** ❌ **CRITICAL**
**API Endpoint:** `POST {{base-url}}/wallet`

**What it does:** Creates both customer AND wallet in a single API call (more efficient)

**API Structure:**
```json
{
  "bvn": "22181029322",
  "firstName": "First",
  "lastName": "User",
  "dateOfBirth": "1992-05-16",
  "phoneNumber": "08020245368",
  "email": "access2emma@gmail.com",
  "address": "No 10, Adewale Ajasin University",
  "metadata": {...}
}
```

**Response:** Returns both `customer` and `wallet` objects

**Current Implementation:** 
- Uses separate `createCustomer()` and `createWallet()` calls
- Missing BVN field support
- Missing dateOfBirth field

**Impact:** HIGH - This is the primary way Providus expects wallets to be created. Our two-step process is less efficient.

---

### 2. **Get All Wallets** ❌
**API Endpoint:** `GET {{base-url}}/wallet`

**What it does:** Retrieves a list of ALL customer wallets (not filtered by customer)

**Current Implementation:** Only has `GET /customers/:customerId/wallets`

**Impact:** MEDIUM - Useful for admin/merchant operations

---

### 3. **Find Customer by Phone Number** ❌
**API Endpoint:** `GET {{base-url}}/customer/phone?phoneNumber={phoneNumber}`

**What it does:** Quick lookup of customer by phone number

**Current Implementation:** Only has generic search

**Impact:** MEDIUM - Convenience feature for customer support

---

### 4. **Get Merchant Wallet** ❌
**API Endpoint:** `GET {{base-url}}/merchant/wallet`

**What it does:** Retrieves the merchant's own wallet details (not customer wallets)

**Current Implementation:** Not implemented

**Impact:** HIGH - Essential for merchant operations (checking merchant balance, etc.)

---

### 5. **Customer-to-Customer Wallet Transfer** ❌ **CRITICAL MISMATCH**
**API Endpoint:** `POST {{base-url}}/transfer/wallet`

**API Structure:**
```json
{
  "amount": 200,
  "fromCustomerId": "aa4e9eea-d7a5-4ac2-a211-dc6d59b0c050",
  "toCustomerId": "a2c40f33-489c-480f-9d24-e2742502b85f"
}
```

**Current Implementation:**
- Uses `destinationType: 'wallet'` with `destinationId` (wallet ID)
- API expects `fromCustomerId` and `toCustomerId` (customer IDs, not wallet IDs)

**Impact:** CRITICAL - Current implementation won't work with Providus API

---

### 6. **Customer Bank Transfer** ❌ **CRITICAL MISMATCH**
**API Endpoint:** `POST {{base-url}}/transfer/bank/customer`

**API Structure:**
```json
{
  "amount": 150,
  "sortCode": "110005",  // ← Uses "sortCode", not "bankCode"
  "narration": "Just kidding",
  "accountNumber": "5400403011",
  "accountName": "Obagunwa Emmanuel",
  "customerId": "66f5a260-9462-4d36-ade1-beccd57e52bd",  // ← Requires customerId
  "metadata": {...}
}
```

**Current Implementation:**
- Uses `bankCode` instead of `sortCode`
- Uses `walletId` instead of `customerId`
- Missing `customerId` field

**Impact:** CRITICAL - Field name mismatch will cause API calls to fail

---

### 7. **Merchant Bank Transfer** ❌
**API Endpoint:** `POST {{base-url}}/transfer/bank`

**What it does:** Transfer from merchant wallet to bank account

**API Structure:**
```json
{
  "amount": 220,
  "sortCode": "000023",
  "narration": "Just kidding",
  "accountNumber": "1700263070",
  "accountName": "Obagunwa Emmanuel",
  "metadata": {...}
}
```

**Current Implementation:** Not implemented

**Impact:** MEDIUM - Needed for merchant operations

---

### 8. **Merchant Batch Bank Transfer** ❌
**API Endpoint:** `POST {{base-url}}/transfer/bank/batch`

**What it does:** Multiple bank transfers in a single batch

**Current Implementation:** Not implemented

**Impact:** LOW - Nice to have for bulk operations

---

### 9. **Get Bank Account Details** ❌ **CRITICAL MISMATCH**
**API Endpoint:** `GET {{base-url}}/transfer/account/details?sortCode={sortCode}&accountNumber={accountNumber}`

**What it does:** Validates and retrieves account name using sortCode (not bankCode)

**Current Implementation:**
- Uses `POST /banks/validate-account` with `bankCode`
- API uses `GET /transfer/account/details` with `sortCode`

**Impact:** CRITICAL - Wrong endpoint and field name

---

### 10. **Get Bank List** ⚠️ **ENDPOINT MISMATCH**
**API Endpoint:** `GET {{base-url}}/transfer/banks`

**Current Implementation:** Uses `GET /banks`

**Impact:** MEDIUM - Endpoint path mismatch

---

## 🔴 **CRITICAL ISSUES TO FIX**

### Issue 1: Transfer Endpoint Structure Mismatch
**Problem:** Our `initiateTransfer()` uses wallet IDs, but Providus API uses customer IDs for wallet-to-wallet transfers.

**Current Code:**
```typescript
// services/wallet-service/src/providers/providus/ProvidusProvider.ts:316-347
async initiateTransfer(data: TransferRequest): Promise<Transaction> {
  // Uses data.sourceWalletId and data.destinationId
  if (data.destinationType === 'wallet') {
    endpoint = '/transfers/wallet';
    payload = {
      ...payload,
      destination_wallet_id: data.destinationId,  // ❌ Wrong field
    };
  }
}
```

**Should be:**
```typescript
if (data.destinationType === 'wallet') {
  endpoint = '/transfer/wallet';  // Note: singular "transfer"
  payload = {
    amount: data.amount,
    fromCustomerId: sourceCustomerId,  // Need to get from wallet
    toCustomerId: destinationCustomerId,  // Need to get from wallet
  };
}
```

---

### Issue 2: Bank Transfer Uses Wrong Field Names
**Problem:** API uses `sortCode` and `customerId`, but we use `bankCode` and `walletId`.

**Current Code:**
```typescript
if (data.destinationType === 'bank') {
  endpoint = '/transfers/bank';
  payload = {
    ...payload,
    account_number: data.accountNumber,
    bank_code: data.bankCode,  // ❌ Should be "sortCode"
    account_name: data.accountName,
  };
}
```

**Should be:**
```typescript
if (data.destinationType === 'bank') {
  endpoint = '/transfer/bank/customer';  // Different endpoint for customer transfers
  payload = {
    amount: data.amount,
    sortCode: data.bankCode,  // Map bankCode to sortCode
    accountNumber: data.accountNumber,
    accountName: data.accountName,
    customerId: customerId,  // Need customerId, not walletId
    narration: data.narration,
  };
}
```

---

### Issue 3: Bank Account Validation Endpoint Mismatch
**Problem:** Wrong endpoint and field names.

**Current Code:**
```typescript
// services/wallet-service/src/providers/providus/ProvidusProvider.ts:438-461
async validateBankAccount(accountNumber: string, bankCode: string): Promise<BankAccountValidation> {
  const response = await this.request<any>({
    method: 'POST',
    url: '/banks/validate-account',  // ❌ Wrong endpoint
    data: {
      account_number: accountNumber,
      bank_code: bankCode,  // ❌ Should be "sortCode"
    },
  });
}
```

**Should be:**
```typescript
async validateBankAccount(accountNumber: string, bankCode: string): Promise<BankAccountValidation> {
  // Map bankCode to sortCode (they're the same thing)
  const sortCode = bankCode;
  
  const response = await this.request<any>({
    method: 'GET',
    url: '/transfer/account/details',  // ✅ Correct endpoint
    params: {
      sortCode: sortCode,
      accountNumber: accountNumber,
    },
  });
}
```

---

### Issue 4: Missing Combined Customer+Wallet Creation
**Problem:** Providus API has a single endpoint that creates both customer and wallet, but we use two separate calls.

**Recommendation:** Add a new method `createCustomerWallet()` that calls `POST /wallet` with BVN and all customer details.

---

### Issue 5: Missing BVN and dateOfBirth Fields
**Problem:** `CreateCustomerRequest` interface doesn't include `bvn` and `dateOfBirth` which are required by Providus API.

**Current Interface:**
```typescript
// services/wallet-service/src/providers/IWalletProvider.ts
export interface CreateCustomerRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: string;  // ⚠️ Optional, but Providus requires it for wallet creation
  address?: string;
  kycLevel?: string;
  metadata?: Record<string, any>;
  // ❌ Missing: bvn
}
```

---

## 📊 **COVERAGE SUMMARY**

| Category | Implemented | Missing | Coverage |
|----------|------------|---------|----------|
| Authentication | 2/2 | 0 | 100% ✅ |
| Customer Management | 3/5 | 2 | 60% ⚠️ |
| Wallet Management | 4/6 | 2 | 67% ⚠️ |
| Transactions | 3/6 | 3 | 50% ❌ |
| Bank Operations | 1/3 | 2 | 33% ❌ |
| **TOTAL** | **13/22** | **9** | **59%** ⚠️ |

---

## 🔧 **RECOMMENDED FIXES (Priority Order)**

### Priority 1: Critical Fixes (Blocking)
1. ✅ Fix transfer endpoint structure (customerId vs walletId)
2. ✅ Fix bank transfer field names (sortCode vs bankCode)
3. ✅ Fix bank validation endpoint and method
4. ✅ Add BVN and dateOfBirth to customer creation

### Priority 2: High Value Additions
5. ✅ Implement combined `createCustomerWallet()` endpoint
6. ✅ Add `getMerchantWallet()` method
7. ✅ Add `findCustomerByPhone()` method
8. ✅ Add `getAllWallets()` method

### Priority 3: Nice to Have
9. ✅ Add merchant bank transfer
10. ✅ Add batch transfer support

---

## 📝 **IMPLEMENTATION NOTES**

### Field Name Mapping
The Providus API uses different terminology:
- **sortCode** = bankCode (same thing, different name)
- **customerId** = used for transfers (not walletId)
- **BVN** = required for wallet creation
- **dateOfBirth** = required for wallet creation

### Endpoint Path Differences
- Our implementation: `/transfers/wallet`
- Providus API: `/transfer/wallet` (singular)
- Our implementation: `/banks/validate-account`
- Providus API: `/transfer/account/details`

### Customer vs Wallet IDs
- **Wallet-to-wallet transfers:** Providus uses `fromCustomerId` and `toCustomerId`, not wallet IDs
- **Bank transfers:** Providus requires `customerId`, not `walletId`
- **Solution:** Need to look up customerId from walletId before making transfer calls

---

## 🎯 **NEXT STEPS**

1. **Update `ProvidusProvider.ts`** to fix endpoint paths and field names
2. **Update `IWalletProvider.ts`** to include BVN and dateOfBirth
3. **Add new methods** for missing endpoints
4. **Update `WalletService.ts`** to support customerId lookups for transfers
5. **Add integration tests** to verify API compatibility
6. **Update documentation** to reflect correct API usage

---

## 📚 **REFERENCES**

- [Providus Bank API Documentation](https://developer.providusbank.com/xpress-wallet-api)
- [Create Customer Wallet](https://developer.providusbank.com/xpress-wallet-api/merchant/wallet/create-customer-wallet)
- [Customer to Customer Transfer](https://developer.providusbank.com/xpress-wallet-api/merchant/transfer/customer-to-customer-wallet-transfer)
- [Customer Bank Transfer](https://developer.providusbank.com/xpress-wallet-api/merchant/transfer/customer-bank-transfer)
- [Get Bank Account Details](https://developer.providusbank.com/xpress-wallet-api/merchant/transfer/get-bank-account-details)

