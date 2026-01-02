import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { getDatabase } from '../database/connection';
import { AuthenticatedRequest } from '../types';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const ANSWER_SALT_ROUNDS = 10;
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 5;

// Predefined security questions
const PREDEFINED_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was your childhood nickname?",
  "What is the name of your favorite childhood friend?",
  "What street did you grow up on?",
  "What was the make of your first car?",
  "What was the name of your elementary school?",
  "What is your favorite movie?",
  "What was the first concert you attended?"
];

// Validation middleware
const validate = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }
  next();
};

/**
 * @route GET /api/v1/security-questions/predefined
 * @description Get list of predefined security questions
 * @access Public
 */
router.get('/predefined', (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: PREDEFINED_QUESTIONS.map((question, index) => ({
      id: index + 1,
      question
    }))
  });
});

/**
 * @route GET /api/v1/security-questions
 * @description Get user's security questions (without answers)
 * @access Private
 */
router.get('/',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.user_id;
      const db = getDatabase();

      const result = await db.query(
        `SELECT id, question, question_order, created_at
         FROM security_questions
         WHERE user_id = $1
         ORDER BY question_order ASC`,
        [userId]
      );

      res.json({
        success: true,
        data: {
          questions: result.rows,
          count: result.rows.length,
          minimum_required: MIN_QUESTIONS
        }
      });
    } catch (error) {
      logger.error('Failed to get security questions', { error, userId: req.user?.user_id });
      res.status(500).json({
        success: false,
        error: 'Failed to get security questions'
      });
    }
  }
);

/**
 * @route POST /api/v1/security-questions
 * @description Set security questions and answers
 * @access Private
 */
router.post('/',
  authenticateToken,
  [
    body('questions')
      .isArray({ min: MIN_QUESTIONS, max: MAX_QUESTIONS })
      .withMessage(`Must provide ${MIN_QUESTIONS}-${MAX_QUESTIONS} questions`),
    body('questions.*.question')
      .isString()
      .isLength({ min: 10, max: 500 })
      .withMessage('Question must be 10-500 characters'),
    body('questions.*.answer')
      .isString()
      .isLength({ min: 2, max: 100 })
      .withMessage('Answer must be 2-100 characters')
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.user_id;
      const { questions } = req.body;
      const db = getDatabase();

      // Check if user already has questions
      const existing = await db.query(
        'SELECT COUNT(*) as count FROM security_questions WHERE user_id = $1',
        [userId]
      );

      if (parseInt(existing.rows[0].count) > 0) {
        return res.status(400).json({
          success: false,
          error: 'Security questions already set. Use PUT to update.'
        });
      }

      // Insert questions
      for (let i = 0; i < questions.length; i++) {
        const { question, answer } = questions[i];
        const answerHash = await bcrypt.hash(answer.toLowerCase().trim(), ANSWER_SALT_ROUNDS);

        await db.query(
          `INSERT INTO security_questions (user_id, question, answer_hash, question_order)
           VALUES ($1, $2, $3, $4)`,
          [userId, question, answerHash, i + 1]
        );
      }

      logger.info('Security questions set', { userId, count: questions.length });

      res.status(201).json({
        success: true,
        message: 'Security questions set successfully',
        data: { count: questions.length }
      });
    } catch (error) {
      logger.error('Failed to set security questions', { error, userId: req.user?.user_id });
      res.status(500).json({
        success: false,
        error: 'Failed to set security questions'
      });
    }
  }
);

/**
 * @route PUT /api/v1/security-questions
 * @description Update security questions (requires current answers)
 * @access Private
 */
router.put('/',
  authenticateToken,
  [
    body('current_answers')
      .isArray({ min: 1 })
      .withMessage('Current answers required'),
    body('current_answers.*.question_id')
      .isUUID()
      .withMessage('Valid question ID required'),
    body('current_answers.*.answer')
      .isString()
      .withMessage('Answer required'),
    body('new_questions')
      .isArray({ min: MIN_QUESTIONS, max: MAX_QUESTIONS })
      .withMessage(`Must provide ${MIN_QUESTIONS}-${MAX_QUESTIONS} questions`)
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.user_id;
      const { current_answers, new_questions } = req.body;
      const db = getDatabase();

      // Verify at least 2 current answers
      if (current_answers.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Must verify at least 2 current answers'
        });
      }

      // Get current questions
      const questions = await db.query(
        'SELECT id, answer_hash FROM security_questions WHERE user_id = $1',
        [userId]
      );

      if (questions.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No security questions set'
        });
      }

      // Verify answers
      let verifiedCount = 0;
      for (const { question_id, answer } of current_answers) {
        const question = questions.rows.find((q: any) => q.id === question_id);
        if (question) {
          const isValid = await bcrypt.compare(answer.toLowerCase().trim(), question.answer_hash);
          if (isValid) verifiedCount++;
        }
      }

      if (verifiedCount < 2) {
        return res.status(401).json({
          success: false,
          error: 'Could not verify enough answers'
        });
      }

      // Delete old questions and insert new ones
      await db.query('DELETE FROM security_questions WHERE user_id = $1', [userId]);

      for (let i = 0; i < new_questions.length; i++) {
        const { question, answer } = new_questions[i];
        const answerHash = await bcrypt.hash(answer.toLowerCase().trim(), ANSWER_SALT_ROUNDS);

        await db.query(
          `INSERT INTO security_questions (user_id, question, answer_hash, question_order)
           VALUES ($1, $2, $3, $4)`,
          [userId, question, answerHash, i + 1]
        );
      }

      logger.info('Security questions updated', { userId, count: new_questions.length });

      res.json({
        success: true,
        message: 'Security questions updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update security questions', { error, userId: req.user?.user_id });
      res.status(500).json({
        success: false,
        error: 'Failed to update security questions'
      });
    }
  }
);

/**
 * @route POST /api/v1/security-questions/verify
 * @description Verify security question answers (for account recovery)
 * @access Public
 */
router.post('/verify',
  [
    body('user_id').isUUID().withMessage('Valid user ID required'),
    body('answers')
      .isArray({ min: 2 })
      .withMessage('At least 2 answers required'),
    body('answers.*.question_id')
      .isUUID()
      .withMessage('Valid question ID required'),
    body('answers.*.answer')
      .isString()
      .withMessage('Answer required')
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user_id, answers } = req.body;
      const db = getDatabase();

      // Get user's questions
      const questions = await db.query(
        'SELECT id, answer_hash FROM security_questions WHERE user_id = $1',
        [user_id]
      );

      if (questions.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No security questions found'
        });
      }

      // Verify answers
      let correctCount = 0;
      for (const { question_id, answer } of answers) {
        const question = questions.rows.find((q: any) => q.id === question_id);
        if (question) {
          const isValid = await bcrypt.compare(answer.toLowerCase().trim(), question.answer_hash);
          if (isValid) correctCount++;
        }
      }

      // Require at least 2 correct answers
      const isVerified = correctCount >= 2;

      logger.info('Security questions verification attempt', {
        userId: user_id,
        attempted: answers.length,
        correct: correctCount,
        verified: isVerified
      });

      res.json({
        success: isVerified,
        message: isVerified ? 'Verification successful' : 'Verification failed',
        data: {
          verified: isVerified,
          correct_count: correctCount,
          required: 2
        }
      });
    } catch (error) {
      logger.error('Failed to verify security questions', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to verify security questions'
      });
    }
  }
);

/**
 * @route GET /api/v1/security-questions/challenge/:userId
 * @description Get random questions for verification challenge
 * @access Public
 */
router.get('/challenge/:userId',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const db = getDatabase();

      // Get 2-3 random questions for the user
      const result = await db.query(
        `SELECT id, question, question_order
         FROM security_questions
         WHERE user_id = $1
         ORDER BY RANDOM()
         LIMIT 3`,
        [userId]
      );

      if (result.rows.length < 2) {
        return res.status(404).json({
          success: false,
          error: 'Insufficient security questions configured'
        });
      }

      res.json({
        success: true,
        data: {
          questions: result.rows.map((q: any) => ({
            id: q.id,
            question: q.question
          })),
          minimum_required: 2
        }
      });
    } catch (error) {
      logger.error('Failed to get security challenge', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get security challenge'
      });
    }
  }
);

export default router;
