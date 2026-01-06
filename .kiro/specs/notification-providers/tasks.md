# Implementation Plan: Notification Provider Integration

## Overview

This implementation plan adds production-ready notification delivery to the existing notification infrastructure. The work is organized into provider implementations, factory setup, event consumer, retry queue, and webhook handling. Each task builds incrementally on previous work, with property tests validating correctness at each stage.

## Current State Analysis

The identity-service has:
- ✅ NotificationService with stub providers (StubPushProvider, StubEmailProvider, StubSMSProvider)
- ✅ Provider interfaces (PushProvider, EmailProvider, SMSProvider)
- ✅ Database tables: notifications, notification_templates, notification_preferences, device_tokens
- ✅ Template rendering and preference management
- ❌ No real provider implementations
- ❌ No Provider Factory
- ❌ No Event Consumer
- ❌ No Retry Queue
- ❌ No Webhook handling
- ❌ No delivery tracking tables (notification_retries, notification_delivery_events)

## Tasks

- [ ] 1. Set up project structure and dependencies
  - [ ] 1.1 Install required packages
    - Add to package.json: @sendgrid/mail, @aws-sdk/client-ses, twilio, firebase-admin, axios, fast-check
    - Run npm install
    - _Requirements: 4.1, 6.1, 7.1_

  - [ ] 1.2 Create provider directory structure
    - Create `src/providers/` directory
    - Create `src/providers/email/` directory
    - Create `src/providers/sms/` directory
    - Create `src/providers/push/` directory
    - Create `src/consumers/` directory
    - _Requirements: 4.1_

  - [ ] 1.3 Create database migration for retry and delivery tables
    - Create migration `005_notification_retries.sql`
    - Add notification_retries table with: id, notification_id, channel, retry_count, scheduled_at, processed, processed_at, error_message
    - Add notification_delivery_events table with: id, notification_id, channel, external_message_id, event_type, event_data, received_at
    - Add columns to notifications table: external_message_id, retry_count, last_retry_at, permanently_failed
    - Add indexes for efficient querying
    - _Requirements: 6.1, 7.1_

- [ ] 2. Implement Extended Provider Interfaces
  - [ ] 2.1 Create extended provider interfaces
    - Create `src/providers/types.ts`
    - Define EmailProviderExtended interface with sendWithTracking method
    - Define SMSProviderExtended interface with sendWithTracking method
    - Define PushProviderExtended interface with sendBatch method
    - Define result types: EmailDeliveryResult, SMSDeliveryResult, PushBatchResult
    - _Requirements: 1.3, 2.3, 3.2, 3.4_

- [ ] 3. Implement Email Providers
  - [ ] 3.1 Implement SendGrid Email Provider
    - Create `src/providers/email/SendGridProvider.ts`
    - Implement EmailProviderExtended interface with sendWithTracking
    - Handle rate limits with exponential backoff
    - Support HTML and plain text multipart emails
    - Support configurable sender name and reply-to address
    - _Requirements: 1.1, 1.5, 1.6, 1.7_

  - [ ] 3.2 Implement AWS SES Email Provider
    - Create `src/providers/email/SESProvider.ts`
    - Implement EmailProviderExtended interface with sendWithTracking
    - Configure AWS SDK client with credentials
    - Handle rate limits and throttling
    - Support configurable sender name
    - _Requirements: 1.2, 1.5, 1.6, 1.7_

  - [ ] 3.3 Write property test for email providers
    - **Property 5: Email Multipart Content**
    - Test that HTML emails always include both plain text and HTML versions
    - Generate random email content and verify multipart structure
    - **Validates: Requirements 1.5**

- [ ] 4. Implement SMS Providers
  - [ ] 4.1 Implement Twilio SMS Provider
    - Create `src/providers/sms/TwilioProvider.ts`
    - Implement SMSProviderExtended interface with sendWithTracking
    - Handle message segmentation for long messages
    - Support configurable sender ID
    - Handle rate limits with exponential backoff
    - _Requirements: 2.1, 2.5, 2.6, 2.7_

  - [ ] 4.2 Implement Termii SMS Provider
    - Create `src/providers/sms/TermiiProvider.ts`
    - Implement SMSProviderExtended interface with sendWithTracking
    - Support Nigerian phone number formatting
    - Handle channel selection (generic, dnd, whatsapp)
    - Handle rate limits with exponential backoff
    - _Requirements: 2.2, 2.5, 2.6, 2.7_

  - [ ] 4.3 Write property test for SMS segmentation
    - **Property 6: SMS Message Segmentation**
    - Test that messages over 160 chars are correctly segmented
    - Generate random messages of various lengths
    - **Validates: Requirements 2.5**

- [ ] 5. Implement Push Provider
  - [ ] 5.1 Implement Firebase Push Provider
    - Create `src/providers/push/FirebaseProvider.ts`
    - Implement PushProviderExtended interface with sendBatch
    - Handle invalid token detection and reporting
    - Support iOS and Android notification formats
    - Support notification payloads with title, body, and custom data
    - _Requirements: 3.1, 3.4, 3.5, 3.6, 3.7_

  - [ ] 5.2 Write property test for push batch sending
    - **Property 8: Push Batch Efficiency**
    - Test that multiple tokens result in single batch call
    - Verify success/failure counts match input
    - **Validates: Requirements 3.4**

  - [ ] 5.3 Write property test for invalid token handling
    - **Property 7: Invalid Push Token Deactivation**
    - Test that invalid tokens are marked inactive
    - **Validates: Requirements 3.3, 3.6**

- [ ] 6. Checkpoint - Ensure all provider tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement Provider Factory
  - [ ] 7.1 Create NotificationProviderFactory
    - Create `src/providers/NotificationProviderFactory.ts`
    - Implement singleton pattern for provider instances
    - Add environment-based provider selection logic (EMAIL_PROVIDER, SMS_PROVIDER, PUSH_PROVIDER)
    - Implement fallback to stub providers when credentials missing
    - Add credential validation on startup
    - Export StubEmailProvider, StubSMSProvider, StubPushProvider from notificationService
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 7.2 Write property test for factory configuration
    - **Property 1: Provider Factory Configuration Consistency**
    - Test all valid provider configurations create correct types
    - Test missing credentials fall back to stubs
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 4.1, 4.7**

- [ ] 8. Update Notification Service to use Factory
  - [ ] 8.1 Integrate factory with NotificationService
    - Update NotificationService constructor to optionally use factory
    - Add delivery tracking to send methods (update external_message_id)
    - Add method to queue failed deliveries for retry
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.2, 3.3_

  - [ ] 8.2 Write property test for delivery status updates
    - **Property 2: Successful Delivery Status Update**
    - Test that successful sends update status to 'sent' with timestamp
    - **Validates: Requirements 1.3, 2.3, 3.2**

- [ ] 9. Implement Retry Queue
  - [ ] 9.1 Implement RetryQueueService
    - Create `src/services/RetryQueueService.ts`
    - Implement scheduleRetry with exponential backoff delays [1min, 5min, 15min]
    - Implement processRetries for batch processing (ordered by scheduled_at)
    - Add max retry limit enforcement (3 retries)
    - Add permanent failure marking
    - Add provider pause functionality when unavailable
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ] 9.2 Write property test for retry scheduling
    - **Property 12: Retry Scheduling with Exponential Delays**
    - Test that retry delays match [1min, 5min, 15min] pattern
    - **Validates: Requirements 6.1, 6.4**

  - [ ] 9.3 Write property test for max retry limit
    - **Property 13: Maximum Retry Limit Enforcement**
    - Test that 3 failures result in permanent failure marking
    - **Validates: Requirements 6.2**

  - [ ] 9.4 Write property test for retry order
    - **Property 14: Retry Processing Order**
    - Test that retries are processed in scheduled_at order
    - **Validates: Requirements 6.6**

- [ ] 10. Checkpoint - Ensure retry queue tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement Event Consumer
  - [ ] 11.1 Create NotificationEventConsumer
    - Create `src/consumers/NotificationEventConsumer.ts`
    - Subscribe to TRANSACTION, WALLET, IDENTITY topics using common-events library
    - Implement event type routing to handlers
    - Add error handling for failed event processing (log and continue)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8_

  - [ ] 11.2 Implement event handlers
    - Implement handleTransactionCompleted (trigger transaction_debit template)
    - Implement handleTransactionFailed (trigger transaction_failed template)
    - Implement handleWalletCredited (trigger transaction_credit template)
    - Implement handleWalletDebited (trigger transaction_debit template)
    - Implement handleUserLogin (detect new device, trigger security_login template)
    - Extract template variables from event payloads
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 11.3 Add user preference checking
    - Query user preferences before sending
    - Filter channels based on preferences
    - Skip notifications for disabled categories
    - _Requirements: 5.7_

  - [ ] 11.4 Write property test for event-to-template mapping
    - **Property 9: Event-to-Template Variable Extraction**
    - Test that all template variables are extracted from events
    - Verify no unresolved placeholders in final text
    - **Validates: Requirements 5.1, 5.6**

  - [ ] 11.5 Write property test for preference enforcement
    - **Property 10: User Notification Preferences Enforcement**
    - Test that disabled channels are not used
    - **Validates: Requirements 5.7**

  - [ ] 11.6 Write property test for event processing resilience
    - **Property 11: Event Processing Resilience**
    - Test that one failed event doesn't stop others
    - **Validates: Requirements 5.8**

- [ ] 12. Implement Webhook Handling
  - [ ] 12.1 Create webhook endpoints
    - Create `src/controllers/webhookController.ts`
    - Add POST /webhooks/sendgrid for SendGrid events
    - Add POST /webhooks/twilio for Twilio status callbacks
    - Add signature validation for each provider
    - _Requirements: 7.1, 7.3_

  - [ ] 12.2 Implement webhook processors
    - Process delivery status updates (delivered, bounced, failed)
    - Update notification records with delivery status
    - Create delivery_event records for audit
    - Handle email bounces by marking email invalid
    - Handle SMS failures by marking phone invalid
    - _Requirements: 7.1, 7.3, 7.5, 7.6_

  - [ ] 12.3 Write property test for webhook status updates
    - **Property 15: Webhook Delivery Status Update**
    - Test that webhooks update notification status correctly
    - **Validates: Requirements 7.1, 7.3**

  - [ ] 12.4 Write property test for invalid contact marking
    - **Property 17: Invalid Contact Marking**
    - Test that bounces/invalid numbers mark contacts invalid
    - **Validates: Requirements 7.5, 7.6**

- [ ] 13. Implement Delivery Metrics
  - [ ] 13.1 Add metrics tracking
    - Track sent, delivered, failed counts per channel
    - Store metrics in database (aggregate queries on notifications table)
    - _Requirements: 7.2_

  - [ ] 13.2 Create admin statistics endpoint
    - Add GET /admin/notifications/stats endpoint to notificationController
    - Return delivery metrics by channel and time period
    - _Requirements: 7.4_

  - [ ] 13.3 Write property test for metrics accuracy
    - **Property 16: Delivery Metrics Accuracy**
    - Test that metrics match actual notification counts
    - **Validates: Requirements 7.2**

- [ ] 14. Wire everything together
  - [ ] 14.1 Update identity-service startup
    - Initialize provider factory on startup
    - Start event consumer
    - Start retry queue processor (setInterval for periodic processing)
    - Add health checks for providers
    - _Requirements: 4.1, 4.8_

  - [ ] 14.2 Update environment configuration
    - Update .env.example with all provider config vars
    - Document required vs optional configuration
    - _Requirements: 4.1_

  - [ ] 14.3 Write property test for failed delivery retry queueing
    - **Property 3: Failed Delivery Retry Queueing**
    - Test end-to-end: failed delivery creates retry entry
    - **Validates: Requirements 1.4, 2.4**

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- External provider APIs should be mocked in tests using nock or jest mocks
- The common-events library provides EventConsumer for Kafka integration
