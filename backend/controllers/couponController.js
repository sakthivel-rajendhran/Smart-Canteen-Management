import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import CanteenSettings from '../models/CanteenSettings.js';

const getOrCreateGlobalSettings = async () => {
  let settings = await CanteenSettings.findOne({ key: 'default' });
  if (!settings) {
    settings = await CanteenSettings.create({ key: 'default', couponsEnabled: true });
  }
  return settings;
};

export const isGlobalCouponsEnabled = async () => {
  const settings = await CanteenSettings.findOne({ key: 'default' }).lean();
  return settings ? settings.couponsEnabled !== false : true;
};

// @desc    Get global coupon enable/disable setting
// @route   GET /api/coupons/settings
// @access  Public
const getCouponSettings = async (req, res) => {
  try {
    const couponsEnabled = await isGlobalCouponsEnabled();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      success: true,
      data: { couponsEnabled },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update global coupon enable/disable setting
// @route   PUT /api/coupons/settings
// @access  Private/Admin
const updateCouponSettings = async (req, res) => {
  try {
    const { couponsEnabled } = req.body;
    if (typeof couponsEnabled !== 'boolean' && couponsEnabled !== 'true' && couponsEnabled !== 'false') {
      return res.status(400).json({
        success: false,
        message: 'couponsEnabled must be a boolean value (true or false).',
      });
    }

    const enabledBool = couponsEnabled === true || couponsEnabled === 'true';
    const settings = await getOrCreateGlobalSettings();
    settings.couponsEnabled = enabledBool;
    await settings.save();

    const io = req.app.get('socketio');
    if (io) {
      io.emit('coupon:settingsUpdated', { couponsEnabled: enabledBool });
    }

    res.json({
      success: true,
      message: `Global customer coupons ${enabledBool ? 'enabled' : 'disabled'} successfully.`,
      data: { couponsEnabled: enabledBool },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all coupons (Admin only)
// @route   GET /api/coupons
// @access  Private/Admin
const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a coupon (Admin only)
// @route   POST /api/coupons
// @access  Private/Admin
const createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, minimumOrder, maxDiscount, expiryDate, usageLimit, active } = req.body;

    if (!code || !discountType || !discountValue || !expiryDate) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    const cleanCode = code.trim().toUpperCase();
    const couponExists = await Coupon.findOne({ code: cleanCode });
    if (couponExists) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create({
      code: cleanCode,
      discountType,
      discountValue: Number(discountValue),
      minimumOrder: minimumOrder ? Number(minimumOrder) : 0,
      maxDiscount: maxDiscount ? Number(maxDiscount) : 0,
      expiryDate: new Date(expiryDate),
      usageLimit: usageLimit ? Number(usageLimit) : 0,
      active: active !== undefined ? active : true,
    });

    res.status(201).json({ success: true, message: 'Coupon created successfully', data: coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a coupon (Admin only)
// @route   PUT /api/coupons/:id
// @access  Private/Admin
const updateCoupon = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const { code, discountType, discountValue, minimumOrder, maxDiscount, expiryDate, usageLimit, active } = req.body;
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    coupon.code = code !== undefined ? code.trim().toUpperCase() : coupon.code;
    coupon.discountType = discountType !== undefined ? discountType : coupon.discountType;
    coupon.discountValue = discountValue !== undefined ? Number(discountValue) : coupon.discountValue;
    coupon.minimumOrder = minimumOrder !== undefined ? Number(minimumOrder) : coupon.minimumOrder;
    coupon.maxDiscount = maxDiscount !== undefined ? Number(maxDiscount) : coupon.maxDiscount;
    coupon.expiryDate = expiryDate !== undefined ? new Date(expiryDate) : coupon.expiryDate;
    coupon.usageLimit = usageLimit !== undefined ? Number(usageLimit) : coupon.usageLimit;
    coupon.active = active !== undefined ? active : coupon.active;

    await coupon.save();
    res.json({ success: true, message: 'Coupon updated successfully', data: coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a coupon (Admin only)
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
const deleteCoupon = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    await coupon.deleteOne();
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Validate coupon code
// @route   POST /api/coupons/validate
// @access  Public
const validateCoupon = async (req, res) => {
  try {
    const globalEnabled = await isGlobalCouponsEnabled();
    if (!globalEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Coupons are currently disabled by the canteen admin.',
        couponsEnabled: false,
      });
    }

    const { code, subtotal } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const cleanCode = code.trim().toUpperCase();
    const orderSubtotal = Number(subtotal) || 0;

    const coupon = await Coupon.findOne({ code: cleanCode, active: true });

    if (!coupon) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive coupon code' });
    }

    // Expiry check
    if (new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({ success: false, message: 'Coupon has expired' });
    }

    // Usage limit check
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }

    // Minimum order subtotal check
    if (orderSubtotal < coupon.minimumOrder) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value to apply this coupon is ₹${coupon.minimumOrder}`,
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'flat') {
      discountAmount = coupon.discountValue;
    } else if (coupon.discountType === 'percentage') {
      discountAmount = (orderSubtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount > 0 && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    }

    // Cap discount amount to subtotal
    discountAmount = Math.min(orderSubtotal, discountAmount);

    res.json({
      success: true,
      message: 'Coupon applied successfully!',
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  getCouponSettings,
  updateCouponSettings,
};
