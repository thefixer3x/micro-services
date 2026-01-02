import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import beneficiaryService from '../services/beneficiaryService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const validate = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }
  next();
};

// Create beneficiary
router.post(
  '/',
  authMiddleware,
  [
    body('nickname').optional().isString().isLength({ max: 100 }),
    body('beneficiaryType').isIn(['wallet', 'bank_account', 'mobile_money']),
    body('walletId').optional().isUUID(),
    body('accountNumber').optional().isString().isLength({ min: 10, max: 20 }),
    body('bankCode').optional().isString().isLength({ min: 3, max: 10 }),
    body('bankName').optional().isString(),
    body('accountName').optional().isString(),
    body('phoneNumber').optional().isString(),
    body('mobileProvider').optional().isString()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const beneficiary = await beneficiaryService.create({
        userId: req.user?.userId || '',
        nickname: req.body.nickname,
        beneficiaryType: req.body.beneficiaryType,
        walletId: req.body.walletId,
        accountNumber: req.body.accountNumber,
        bankCode: req.body.bankCode,
        bankName: req.body.bankName,
        accountName: req.body.accountName,
        phoneNumber: req.body.phoneNumber,
        mobileProvider: req.body.mobileProvider
      });

      res.status(201).json({ success: true, data: beneficiary });
    } catch (error) {
      logger.error('Create beneficiary failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create beneficiary'
      });
    }
  }
);

// Get beneficiary
router.get(
  '/:id',
  authMiddleware,
  [param('id').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const beneficiary = await beneficiaryService.getById(req.params.id, req.user?.userId || '');

      if (!beneficiary) {
        res.status(404).json({ success: false, error: 'Beneficiary not found' });
        return;
      }

      res.json({ success: true, data: beneficiary });
    } catch (error) {
      logger.error('Get beneficiary failed', { error });
      res.status(500).json({ success: false, error: 'Failed to get beneficiary' });
    }
  }
);

// List beneficiaries
router.get(
  '/',
  authMiddleware,
  [
    query('type').optional().isIn(['wallet', 'bank_account', 'mobile_money']),
    query('favoritesOnly').optional().isBoolean().toBoolean(),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt()
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await beneficiaryService.listByUser(req.user?.userId || '', {
        type: req.query.type as any,
        favoritesOnly: req.query.favoritesOnly as unknown as boolean,
        search: req.query.search as string,
        limit: req.query.limit as unknown as number,
        offset: req.query.offset as unknown as number
      });

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('List beneficiaries failed', { error });
      res.status(500).json({ success: false, error: 'Failed to list beneficiaries' });
    }
  }
);

// Get recent beneficiaries
router.get(
  '/recent',
  authMiddleware,
  [query('limit').optional().isInt({ min: 1, max: 10 }).toInt()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const beneficiaries = await beneficiaryService.getRecent(
        req.user?.userId || '',
        (req.query.limit as unknown as number) || 5
      );
      res.json({ success: true, data: beneficiaries });
    } catch (error) {
      logger.error('Get recent beneficiaries failed', { error });
      res.status(500).json({ success: false, error: 'Failed to get recent beneficiaries' });
    }
  }
);

// Get favorites
router.get('/favorites', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const beneficiaries = await beneficiaryService.getFavorites(req.user?.userId || '');
    res.json({ success: true, data: beneficiaries });
  } catch (error) {
    logger.error('Get favorites failed', { error });
    res.status(500).json({ success: false, error: 'Failed to get favorites' });
  }
});

// Update beneficiary
router.put(
  '/:id',
  authMiddleware,
  [
    param('id').isUUID(),
    body('nickname').optional().isString().isLength({ max: 100 })
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const beneficiary = await beneficiaryService.update(
        req.params.id,
        req.user?.userId || '',
        { nickname: req.body.nickname }
      );

      if (!beneficiary) {
        res.status(404).json({ success: false, error: 'Beneficiary not found' });
        return;
      }

      res.json({ success: true, data: beneficiary });
    } catch (error) {
      logger.error('Update beneficiary failed', { error });
      res.status(500).json({ success: false, error: 'Failed to update beneficiary' });
    }
  }
);

// Toggle favorite
router.post(
  '/:id/favorite',
  authMiddleware,
  [param('id').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const beneficiary = await beneficiaryService.toggleFavorite(req.params.id, req.user?.userId || '');

      if (!beneficiary) {
        res.status(404).json({ success: false, error: 'Beneficiary not found' });
        return;
      }

      res.json({
        success: true,
        data: beneficiary,
        message: beneficiary.isFavorite ? 'Added to favorites' : 'Removed from favorites'
      });
    } catch (error) {
      logger.error('Toggle favorite failed', { error });
      res.status(500).json({ success: false, error: 'Failed to toggle favorite' });
    }
  }
);

// Delete beneficiary
router.delete(
  '/:id',
  authMiddleware,
  [param('id').isUUID()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const deleted = await beneficiaryService.delete(req.params.id, req.user?.userId || '');

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Beneficiary not found' });
        return;
      }

      res.json({ success: true, message: 'Beneficiary deleted' });
    } catch (error) {
      logger.error('Delete beneficiary failed', { error });
      res.status(500).json({ success: false, error: 'Failed to delete beneficiary' });
    }
  }
);

export default router;
