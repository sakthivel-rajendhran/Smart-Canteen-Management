import express from 'express';
import {
  registerUser,
  loginUser,
  getGoogleAuthConfig,
  googleAuthLogin,
  startGoogleOAuth,
  handleGoogleOAuthCallback,
  exchangeGoogleSession,
  getUserProfile,
  updateUserProfile,
  changePassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/google/config', getGoogleAuthConfig);
router.post('/google', googleAuthLogin);
router.post('/firebase-google', googleAuthLogin);
router.get('/google', startGoogleOAuth);
router.get('/google/callback', handleGoogleOAuthCallback);
router.post('/google/exchange', exchangeGoogleSession);
router.get('/me', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.put('/change-password', protect, changePassword);

export default router;
