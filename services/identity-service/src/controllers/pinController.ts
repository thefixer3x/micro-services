import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { pool } from '../database/connection';
import { AuthenticatedRequest } from '../types';
import { authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const PIN_SALT_ROUNDS = 10;
const MAX_PIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

// Validation middleware
const validate = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }
  next();
};

// Set PIN (first time or reset)
router.post(
  '/set',
  authenticateToken,
  [
    body('pin')
      .isString()
      .isLength({ min: 4, max: 6 })
      .matches(/^\d+$/)
      .withMessage('PIN must be 4-6 digits'),
    body('confirmPin')
      .custom((value, { req }) => value === req.body.pin)
      .withMessage('PINs do not match')
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.user_id;
      const { pin } = req.body;

      // Check if user is locked out before allowing PIN set/reset
      const lockCheck = await pool.query(
        'SELECT pin_locked_until FROM users WHERE id = $1',
        [userId]
      );

      if (lockCheck.rows.length > 0 && lockCheck.rows[0].pin_locked_until) {
        const lockedUntil = new Date(lockCheck.rows[0].pin_locked_until);
        if (lockedUntil > new Date()) {
          const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
          res.status(423).json({
            success: false,
            error: `PIN is locked. Try again in ${remainingMinutes} minutes.`
          });
          return;
        }
      }

      // Hash the PIN
      const pinHash = await bcrypt.hash(pin, PIN_SALT_ROUNDS);

      // Update user's PIN
      await pool.query(
        `UPDATE users
         SET pin_hash = $1, pin_attempts = 0, pin_locked_until = NULL, pin_updated_at = NOW()
         WHERE id = $2`,
        [pinHash, userId]
      );

      logger.info('PIN set successfully', { userId });

      res.json({
        success: true,
        message: 'PIN set successfully'
      });
    } catch (error) {
      logger.error('Failed to set PIN', { error, userId: req.user?.user_id });
      res.status(500).json({
        success: false,
        error: 'Failed to set PIN'
      });
    }
  }
);

// Verify PIN
router.post(
  '/verify',
  authenticateToken,
  [
    body('pin')
      .isString()
      .isLength({ min: 4, max: 6 })
      .matches(/^\d+$/)
      .withMessage('Invalid PIN format')
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.user_id;
      const { pin } = req.body;

      // Get user's PIN data
      const result = await pool.query(
        'SELECT pin_hash, pin_attempts, pin_locked_until FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const user = result.rows[0];

      // Check if PIN is set
      if (!user.pin_hash) {
        res.status(400).json({
          success: false,
          error: 'PIN not set. Please set a PIN first.'
        });
        return;
      }

      // Check if locked
      if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
        const remainingMinutes = Math.ceil(
          (new Date(user.pin_locked_until).getTime() - Date.now()) / 60000
        );
        res.status(423).json({
          success: false,
          error: `PIN locked. Try again in ${remainingMinutes} minutes.`
        });
        return;
      }

      // Verify PIN
      const isValid = await bcrypt.compare(pin, user.pin_hash);

      if (!isValid) {
        const newAttempts = (user.pin_attempts || 0) + 1;
        const lockUntil = newAttempts >= MAX_PIN_ATTEMPTS
          ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60000)
          : null;

        await pool.query(
          'UPDATE users SET pin_attempts = $1, pin_locked_until = $2 WHERE id = $3',
          [newAttempts, lockUntil, userId]
        );

        const remainingAttempts = MAX_PIN_ATTEMPTS - newAttempts;

        logger.warn('Invalid PIN attempt', { userId, attempts: newAttempts });

        res.status(401).json({
          success: false,
          error: lockUntil
            ? `Too many attempts. PIN locked for ${LOCK_DURATION_MINUTES} minutes.`
            : `Invalid PIN. ${remainingAttempts} attempts remaining.`
        });
        return;
      }

      // Reset attempts on success
      await pool.query(
        'UPDATE users SET pin_attempts = 0, pin_locked_until = NULL WHERE id = $1',
        [userId]
      );

      logger.info('PIN verified successfully', { userId });

      res.json({
        success: true,
        message: 'PIN verified successfully'
      });
    } catch (error) {
      logger.error('Failed to verify PIN', { error, userId: req.user?.user_id });
      res.status(500).json({
        success: false,
        error: 'Failed to verify PIN'
      });
    }
  }
);

// Change PIN
router.post(
  '/change',
  authenticateToken,
  [
    body('currentPin')
      .isString()
      .isLength({ min: 4, max: 6 })
      .matches(/^\d+$/)
      .withMessage('Invalid current PIN format'),
    body('newPin')
      .isString()
      .isLength({ min: 4, max: 6 })
      .matches(/^\d+$/)
      .withMessage('New PIN must be 4-6 digits'),
    body('confirmNewPin')
      .custom((value, { req }) => value === req.body.newPin)
      .withMessage('New PINs do not match')
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.user_id;
      const { currentPin, newPin } = req.body;

      // Get current PIN hash and attempt info
      const result = await pool.query(
        'SELECT pin_hash, pin_attempts, pin_locked_until FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const user = result.rows[0];

      if (!user.pin_hash) {
        res.status(400).json({
          success: false,
          error: 'No PIN set. Use /set endpoint instead.'
        });
        return;
      }

      // Check if locked
      if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
        const remainingMinutes = Math.ceil(
          (new Date(user.pin_locked_until).getTime() - Date.now()) / 60000
        );
        res.status(423).json({
          success: false,
          error: `PIN is locked. Try again in ${remainingMinutes} minutes.`
        });
        return;
      }

      // Verify current PIN
      const isValid = await bcrypt.compare(currentPin, user.pin_hash);
      if (!isValid) {
        // Increment attempt counter and potentially lock
        const newAttempts = (user.pin_attempts || 0) + 1;
        const lockUntil = newAttempts >= MAX_PIN_ATTEMPTS
          ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60000)
          : null;

        await pool.query(
          'UPDATE users SET pin_attempts = $1, pin_locked_until = $2 WHERE id = $3',
          [newAttempts, lockUntil, userId]
        );

        const remainingAttempts = MAX_PIN_ATTEMPTS - newAttempts;

        logger.warn('Invalid PIN attempt during change', { userId, attempts: newAttempts });

        res.status(401).json({
          success: false,
          error: lockUntil
            ? `Too many attempts. PIN locked for ${LOCK_DURATION_MINUTES} minutes.`
            : `Current PIN is incorrect. ${remainingAttempts} attempts remaining.`
        });
        return;
      }

      // Hash new PIN
      const newPinHash = await bcrypt.hash(newPin, PIN_SALT_ROUNDS);

      // Update PIN
      await pool.query(
        `UPDATE users
         SET pin_hash = $1, pin_attempts = 0, pin_locked_until = NULL, pin_updated_at = NOW()
         WHERE id = $2`,
        [newPinHash, userId]
      );

      logger.info('PIN changed successfully', { userId });

      res.json({
        success: true,
        message: 'PIN changed successfully'
      });
    } catch (error) {
      logger.error('Failed to change PIN', { error, userId: req.user?.user_id });
      res.status(500).json({
        success: false,
        error: 'Failed to change PIN'
      });
    }
  }
);

// Get PIN status
router.get(
  '/status',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.user_id;

      const result = await pool.query(
        'SELECT pin_hash IS NOT NULL as has_pin, pin_locked_until, pin_updated_at FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const user = result.rows[0];
      const isLocked = user.pin_locked_until && new Date(user.pin_locked_until) > new Date();

      res.json({
        success: true,
        data: {
          hasPin: user.has_pin,
          isLocked,
          lockedUntil: isLocked ? user.pin_locked_until : null,
          lastUpdated: user.pin_updated_at
        }
      });
    } catch (error) {
      logger.error('Failed to get PIN status', { error, userId: req.user?.user_id });
      res.status(500).json({
        success: false,
        error: 'Failed to get PIN status'
      });
    }
  }
);

export default router;
