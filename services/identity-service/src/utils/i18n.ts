import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { logger } from './logger';

export const initializeI18n = async (): Promise<void> => {
  await i18next
    .use(Backend)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      debug: process.env.NODE_ENV === 'development',
      
      backend: {
        loadPath: path.join(__dirname, '../locales/{{lng}}.json'),
      },
      
      interpolation: {
        escapeValue: false, // React already does escaping
      },
      
      supportedLngs: ['en', 'pcm', 'yo', 'fr'],
      
      // Default resources for when files don't exist
      resources: {
        en: {
          translation: {
            'auth.registration_successful': 'Registration successful',
            'auth.login_successful': 'Login successful',
            'auth.logout_successful': 'Logout successful',
            'auth.invalid_credentials': 'Invalid credentials',
            'auth.user_already_exists': 'User already exists',
            'auth.token_expired': 'Token has expired',
            'auth.unauthorized': 'Unauthorized access',
            'validation.email_required': 'Email is required',
            'validation.password_required': 'Password is required',
            'validation.password_min_length': 'Password must be at least 8 characters',
            'validation.invalid_email': 'Invalid email format',
            'validation.phone_invalid': 'Invalid phone number',
            'error.internal_server': 'Internal server error',
            'error.not_found': 'Resource not found',
            'error.bad_request': 'Bad request',
            'kyc.upload_successful': 'KYC document uploaded successfully',
            'kyc.invalid_document_type': 'Invalid document type',
            'kyc.file_too_large': 'File size exceeds maximum limit',
            'profile.updated_successfully': 'Profile updated successfully',
            'biometric.enrolled_successfully': 'Biometric data enrolled successfully',
            'biometric.verification_successful': 'Biometric verification successful',
            'biometric.verification_failed': 'Biometric verification failed'
          }
        }
      }
    });
  
  logger.info('i18n initialized successfully');
};

export const t = (key: string, options?: any): string => {
  return i18next.t(key, options) as string;
};

export const getLanguageFromHeader = (acceptLanguage: string = 'en'): string => {
  const supportedLangs = ['en', 'pcm', 'yo', 'fr'];
  
  // Parse Accept-Language header
  const languages = acceptLanguage
    .split(',')
    .map(lang => lang.split(';')[0]?.trim())
    .filter(Boolean);
  
  // Find the first supported language
  for (const lang of languages) {
    if (lang && supportedLangs.includes(lang)) {
      return lang;
    }
    
    // Check language prefix (e.g., 'en-US' -> 'en')
    if (lang) {
      const langPrefix = lang.split('-')[0];
      if (langPrefix && supportedLangs.includes(langPrefix)) {
        return langPrefix;
      }
    }
  }
  
  return 'en'; // Default fallback
};

export const setLanguage = (lng: string): void => {
  i18next.changeLanguage(lng);
};