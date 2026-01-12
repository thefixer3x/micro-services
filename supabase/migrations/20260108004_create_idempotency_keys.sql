-- Migration: Create idempotency_keys table
-- Critical for preventing duplicate payments/transfers

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Key identification
  project_id UUID NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,

  -- Request fingerprint
  request_path VARCHAR(255) NOT NULL,
  request_method VARCHAR(10) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,

  -- Response snapshot
  response_status INTEGER,
  response_body JSONB,

  -- Lifecycle
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(100),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',

  UNIQUE(project_id, idempotency_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys(project_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_cleanup ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_locked ON idempotency_keys(locked_at)
  WHERE locked_at IS NOT NULL AND completed_at IS NULL;

-- Cleanup function for expired keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_keys WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to acquire idempotency lock
CREATE OR REPLACE FUNCTION acquire_idempotency_lock(
  p_project_id UUID,
  p_key VARCHAR(100),
  p_path VARCHAR(255),
  p_method VARCHAR(10),
  p_hash VARCHAR(64),
  p_lock_id VARCHAR(100)
)
RETURNS TABLE (
  acquired BOOLEAN,
  existing_response JSONB,
  existing_status INTEGER
) AS $$
DECLARE
  v_existing RECORD;
BEGIN
  -- Try to find existing key
  SELECT ik.response_status, ik.response_body, ik.locked_at, ik.completed_at, ik.request_hash
  INTO v_existing
  FROM idempotency_keys ik
  WHERE ik.project_id = p_project_id AND ik.idempotency_key = p_key
  FOR UPDATE NOWAIT;

  IF FOUND THEN
    -- Key exists
    IF v_existing.completed_at IS NOT NULL THEN
      -- Already completed - check if same request
      IF v_existing.request_hash = p_hash THEN
        -- Same request - return cached response
        RETURN QUERY SELECT FALSE, v_existing.response_body, v_existing.response_status;
        RETURN;
      ELSE
        -- Different request with same key - error
        RAISE EXCEPTION 'Idempotency key already used for different request';
      END IF;
    ELSIF v_existing.locked_at IS NOT NULL
          AND v_existing.locked_at > NOW() - INTERVAL '5 minutes' THEN
      -- Currently locked (within timeout) - wait or error
      RAISE EXCEPTION 'Request in progress';
    ELSE
      -- Lock expired or not completed - reacquire
      UPDATE idempotency_keys
      SET locked_at = NOW(), locked_by = p_lock_id, request_hash = p_hash
      WHERE project_id = p_project_id AND idempotency_key = p_key;

      RETURN QUERY SELECT TRUE, NULL::JSONB, NULL::INTEGER;
      RETURN;
    END IF;
  ELSE
    -- New key - insert and acquire
    INSERT INTO idempotency_keys (project_id, idempotency_key, request_path, request_method, request_hash, locked_at, locked_by)
    VALUES (p_project_id, p_key, p_path, p_method, p_hash, NOW(), p_lock_id);

    RETURN QUERY SELECT TRUE, NULL::JSONB, NULL::INTEGER;
    RETURN;
  END IF;

EXCEPTION
  WHEN unique_violation THEN
    -- Race condition - retry
    RAISE EXCEPTION 'Concurrent request';
  WHEN lock_not_available THEN
    -- Row is locked
    RAISE EXCEPTION 'Request in progress';
END;
$$ LANGUAGE plpgsql;

-- Function to complete idempotency request
CREATE OR REPLACE FUNCTION complete_idempotency_request(
  p_project_id UUID,
  p_key VARCHAR(100),
  p_status INTEGER,
  p_body JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE idempotency_keys
  SET response_status = p_status,
      response_body = p_body,
      completed_at = NOW(),
      locked_at = NULL,
      locked_by = NULL
  WHERE project_id = p_project_id AND idempotency_key = p_key;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys to prevent duplicate operations';
COMMENT ON COLUMN idempotency_keys.request_hash IS 'SHA256 hash of request body for validation';
COMMENT ON COLUMN idempotency_keys.locked_at IS 'When the request was locked for processing';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'When this key can be cleaned up (default 24h)';
COMMENT ON FUNCTION acquire_idempotency_lock IS 'Atomically acquire lock for idempotency key';
COMMENT ON FUNCTION complete_idempotency_request IS 'Mark idempotency request as complete with response';
