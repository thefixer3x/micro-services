import { Request } from 'express';

// User types
export interface User {
  id: string;
  email: string;
  phone?: string;
  username?: string;
  password_hash: string;
  account_type: 'individual' | 'business' | 'joint';
  status: 'pending' | 'active' | 'suspended' | 'closed';
  created_at: Date;
  updated_at: Date;
  profile?: UserProfile;
}

export interface UserProfile {
  user_id: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: Date;
  language: 'en' | 'pcm' | 'yo' | 'fr';
  address?: Address;
  kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  created_at: Date;
  updated_at: Date;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

// Authentication types
export interface RegisterRequest {
  email: string;
  phone?: string;
  password: string;
  account_type: 'individual' | 'business' | 'joint';
  language?: 'en' | 'pcm' | 'yo' | 'fr';
}

export interface LoginRequest {
  username: string; // email or phone
  password: string;
  device_id?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: Omit<User, 'password_hash'> & { profile?: UserProfile };
}

export interface TokenPayload {
  user_id: string;
  email: string;
  account_type: string;
  status: string;
  language?: string;
  iat: number;
  exp: number;
}

// KYC types
export interface KycDocument {
  id: string;
  user_id: string;
  document_type: 'passport' | 'drivers_license' | 'national_id';
  document_number?: string;
  document_url: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  verified_at?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface KycUploadRequest {
  document_type: 'passport' | 'drivers_license' | 'national_id';
}

// Biometric types
export interface BiometricData {
  id: string;
  user_id: string;
  biometric_type: 'fingerprint' | 'face' | 'voice';
  template_data: Buffer;
  device_info?: Record<string, any>;
  created_at: Date;
}

export interface BiometricEnrollRequest {
  biometric_type: 'fingerprint' | 'face' | 'voice';
  data: string; // Base64 encoded
  device_info?: Record<string, any>;
}

// Express Request extensions
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  language?: string;
}

// Database query result types
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
}

// Profile update types
export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  address?: Address;
  language?: 'en' | 'pcm' | 'yo' | 'fr';
}