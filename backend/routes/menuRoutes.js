import express from 'express';
import {
  getMenuItems,
  getMenuItemById,
  checkMenuItems,
  uploadStandaloneImage,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
  uploadMenuImage,
  deleteMenuImage,
} from '../controllers/menuController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.route('/')
  .get(getMenuItems)
  .post(protect, adminOnly, upload.single('image'), createMenuItem);

// Dedicated endpoint to upload standalone food image to Cloudinary (returns { url, publicId, format })
router.post('/upload-image', protect, adminOnly, upload.single('image'), uploadStandaloneImage);

// Lightweight batch availability/price check for checkout
router.post('/check', checkMenuItems);

router.route('/:id')
  .get(getMenuItemById)
  .put(protect, adminOnly, upload.single('image'), updateMenuItem)
  .delete(protect, adminOnly, deleteMenuItem);

router.patch('/:id/availability', protect, adminOnly, toggleAvailability);

// Dedicated endpoints for image upload and removal on existing menu item
router.route('/:id/image')
  .post(protect, adminOnly, upload.single('image'), uploadMenuImage)
  .delete(protect, adminOnly, deleteMenuImage);

export default router;
