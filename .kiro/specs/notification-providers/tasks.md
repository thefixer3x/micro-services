# Implementation Plan: Notification Provider Integration

## Overview

This implementation plan adds production-ready notification delivery to the existing notification infrastructure. The work is organized into provider implementations, factory setup, event consumer, retry queue, and webhook handling. Each task builds incrementally on previous work, with property tests validating correctness at each stage.

## Tasks

- [ ] 1. Set up project structure and dependencies
  - Install required packages: @sendgrid/mail, @aws-sdk/client-ses, twilio, firebase-admin, axios, fast-check
  - Create provider directory structure under `services/identity-service/src/providers/`
  - Create database migration for new tables (notification_retries, notification_delivery_events)
  - _Requirements: 4.1, 6.1, 7.1_

- [ ] 2. Implement Email Providers
  - [ ] 2.1 Implement SendGrid Email Provider
    - Create `src/providers/email/SendGridProvider.ts`
    - Implement EmailProviderExtended interface with sendWithTracking
    - Handle rate limits with exponential backoff
    - Support HTML and plain text multipart emails
    - _Requirements: 1.1, 1.5, 1.6, 1.7_

  - [ ] 2.2 Implement AWS SES Email Provider
    - Create `src/providers/email/SESProvider.ts`
    - Implement EmailProviderExtended interface with sendWithTracking
    - Configure AWS SDK client with credentials
    - Handle rate limits and throttling
    - _Requirements: 1.2, 1.5, 1.6, 1.7_

  - [ ] 2.3 Write property test for email providers
    - **Property 5: Email Multipart Content**
    - Test that HTML emails always include both plain text and HTML versions
    - Generate random email content and verify multipart structure
    - **Validates: Requirements 1.5**

- [ ] 3. Implement SMS Providers
  - [ ] 3.1 Implement Twilio SMS Provider
    - Create `src/providers/sms/TwilioProvider.ts`
    - Implement SMSProviderExtended interface with sendWithTracking
    - Handle message segmentation for long messages
    - Support configurable sender ID
    - _Requirements: 2.1, 2.5, 2.6, 2.7_

  - [ ] 3.2 Implement Termii SMS Provider
    - Create `src/providers/sms/TermiiProvider.ts`
    - Implement SMSProviderExtended interface with sendWithTracking
    - Support Nigerian phone number formatting
    - Handle channel selection (generic, dnd, whatsapp)
    - _Requirements: 2.2, 2.5, 2.6, 2.7_

  - [ ] 3.3 Write property test for SMS segmentation
    - **Property 6: SMS Message Segmentation**
    - Test that messages over 160 chars are correctly segmented
    - Generate random messages of various lengths
    - **Validates: Requirements 2.5**

- [ ] 4. Implement Push Provider
  - [ ] 4.1 Implement Firebase Push Provider
    - Create `src/providers/push/FirebaseProvider.ts`
    - Implement PushProviderExtended interface with sendBatch
    - Handle invalid token detection and reporting
    - Support iOS and Android notification formats
    - _Requirements: 3.1, 3.4, 3.5, 3.6, 3.7_

  - [ ] 4.2 Write property test for push batch sending
    - **Property 8: Push Batch Efficiency**
    - Test that multiple tokens result in single batch call
    - Verify success/failure counts match input
    - **Validates: Requirements 3.4**

  - [ ] 4.3 Write property test for invalid token handling
    - **Property 7: Invalid Push Token Deactivation**
    - Test that invalid tokens are marked inactive
    - **Validates: Requirements 3.3, 3.6**

- [ ] 5. Checkpoint - Ensure all provider tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Provider Factory
  - [ ] 6.1 Create NotificationProviderFactory
    - Create `src/providers/NotificationProviderFactory.ts`
    - Implement singleton pattern for provider instances
    - Add environment-based provider selection logic
    - Implement fallback to stub providers when credentials missing
    - Add credential validation on startup
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 6.2 Write property test for factory configuration
    - **Property 1: Provider Factory Configuration Consistency**
    - Test all valid provider configurations create correct types
    - Test missing credentials fall back to stubs
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 4.1, 4.7**

- [ ] 7. Update Notification Service to use Factory
  - [ ] 7.1 Integrate factory with NotificationService
    - Update NotificationService constructor to use factory
    - Replace stub providers with factory-provided instances
    - Add delivery tracking to send methods
    - _Requirements: 1.3, 2.3, 3.2_

  - [ ] 7.2 Write property test for delivery status updates
    - **Property 2: Successful Delivery Status Update**
    - Test that successful sends update status to 'sent' with timestamp
    - **Validates: Requirements 1.3, 2.3, 3.2**

- [ ] 8. Implement Retry Queue
  - [ ] 8.1 Create database migration for retry tables
    - Create migration `005_notification_retries.sql`
    - Add notification_retries table
    - Add notification_delivery_events table
    - Add indexes for efficient querying
    - _Requirements: 6.1, 7.1_

  - [ ] 8.2 Implement RetryQueueService
    - Create `src/services/RetryQueueService.ts`
    - Implement scheduleRetry with exponential backoff delays
    - Implement processRetries for batch processing
    - Add max retry limit enforcement (3 retries)
    - Add permanent failure marking
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ] 8.3 Write property test for retry scheduling
    - **Property 12: Retry Scheduling with Exponential Delays**
    - Test that retry delays match [1min, 5min, 15min] pattern
    - **Validates: Requirements 6.1, 6.4**

  - [ ] 8.4 Write property test for max retry limit
    - **Property 13: Maximum Retry Limit Enforcement**
    - Test that 3 failures result in permanent failure marking
    - **Validates: Requirements 6.2**

  - [ ] 8.5 Write property test for retry order
    - **Property 14: Retry Processing Order**
    - Test that retries are processed in scheduled_at order
    - **Validates: Requirements 6.6**

- [ ] 9. Checkpoint - Ensure retry queue tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Event Consumer
  - [ ] 10.1 Create NotificationEventConsumer
    - Create `src/consumers/NotificationEventConsumer.ts`
    - Subscribe to TRANSACTION, WALLET, IDENTITY topics
    - Implement event type routing to handlers
    - Add error handling for failed event processing
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8_

  - [ ] 10.2 Implement event handlers
    - Implement handleTransactionCompleted
    - Implement handleTransactionFailed
    - Implement handleWalletCredited
    - Implement handleWalletDebited
    - Implement handleUserLogin (new device detection)
    - Extract template variables from event payloads
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 10.3 Add user preference checking
    - Query user preferences before sending
    - Filter channels based on preferences
    - Skip notifications for disabled categories
    - _Requirements: 5.7_

  - [ ] 10.4 Write property test for event-to-template mapping
    - **Property 9: Event-to-Template Variable Extraction**
    - Test that all template variables are extracted from events
    - Verify no unresolved placeholders in final text
    - **Validates: Requirements 5.1, 5.6**

  - [ ] 10.5 Write property test for preference enforcement
    - **Property 10: User Notification Preferences Enforcement**
    - Test that disabled channels are not used
    - **Validates: Requirements 5.7**

  - [ ] 10.6 Write property test for event processing resilience
    - **Property 11: Event Processing Resilience**
    - Test that one failed event doesn't stop others
    - **Validates: Requirements 5.8**

- [ ] 11. Implement Webhook Handling
  - [ ] 11.1 Create webhook endpoints
    - Create `src/controllers/webhookController.ts`
    - Add POST /webhooks/sendgrid for SendGrid events
    - Add POST /webhooks/twilio for Twilio status callbacks
    - Add signature validation for each provider
    - _Requirements: 7.1, 7.3_

  - [ ] 11.2 Implement webhook processors
    - Process delivery status updates (delivered, bounced, failed)
    - Update notification records with delivery status
    - Create delivery_event records for audit
    - Handle email bounces by marking email invalid
    - Handle SMS failures by marking phone invalid
    - _Requirements: 7.1, 7.3, 7.5, 7.6_

  - [ ] 11.3 Write property test for webhook status updates
    - **Property 15: Webhook Delivery Status Update**
    - Test that webhooks update notification status correctly
    - **Validates: Requirements 7.1, 7.3**

  - [ ] 11.4 Write property test for invalid contact marking
    - **Property 17: Invalid Contact Marking**
    - Test that bounces/invalid numbers mark contacts invalid
    - **Validates: Requirements 7.5, 7.6**

- [ ] 12. Implement Delivery Metrics
  - [ ] 12.1 Add metrics tracking
    - Track sent, delivered, failed counts per channel
    - Store metrics in database or Redis
    - _Requirements: 7.2_

  - [ ] 12.2 Create admin statistics endpoint
    - Add GET /admin/notifications/stats endpoint
    - Return delivery metrics by channel and time period
    - _Requirements: 7.4_

  - [ ] 12.3 Write property test for metrics accuracy
    - **Property 16: Delivery Metrics Accuracy**
    - Test that metrics match actual notification counts
    - **Validates: Requirements 7.2**

- [ ] 13. Wire everything together
  - [ ] 13.1 Update identity-service startup
    - Initialize provider factory on startup
    - Start event consumer
    - Start retry queue processor (cron job or interval)
    - Add health checks for providers
    - _Requirements: 4.1, 4.8_

  - [ ] 13.2 Update environment configuration
    - Add .env.example with all provider config vars
    - Document required vs optional configuration
    - _Requirements: 4.1_

  - [ ] 13.3 Write property test for failed delivery retry queueing
    - **Property 3: Failed Delivery Retry Queueing**
    - Test end-to-end: failed delivery creates retry entry
    - **Validates: Requirements 1.4, 2.4**

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- External provider APIs should be mocked in tests using nock or jest mocks
