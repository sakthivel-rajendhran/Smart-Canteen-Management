import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import { cache } from '../utils/cache.js';
import { isItemParcelEligible } from '../utils/parcelHelper.js';
import { parseVariantsInput } from '../utils/variantHelper.js';
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteCloudinaryAsset,
} from '../config/cloudinary.js';

// Helper to normalize image structure and multi-category array for backward compatibility
// When isList is true, huge legacy base64 data URIs are stripped to keep list payloads minimal
const normalizeMenuItemImage = (item, isList = false) => {
  const plain = item.toObject ? item.toObject() : { ...item };
  if (!plain.image || typeof plain.image === 'string') {
    plain.image = {
      url: plain.image || '',
      publicId: '',
    };
  }
  if (isList && plain.image?.url?.startsWith('data:')) {
    plain.image = { ...plain.image, url: '' };
  }
  const combined = [];
  if (plain.category) combined.push(plain.category);
  if (Array.isArray(plain.categories)) {
    for (const c of plain.categories) {
      if (c && !combined.some((x) => String(x._id || x) === String(c._id || c))) {
        combined.push(c);
      }
    }
  }
  plain.categories = combined;
  plain.variants = Array.isArray(plain.variants) ? plain.variants : [];
  return plain;
};

const parseCategoriesInput = (rawCategories, primaryCategory) => {
  let list = [];
  if (Array.isArray(rawCategories)) {
    list = rawCategories;
  } else if (typeof rawCategories === 'string' && rawCategories.trim()) {
    try {
      const parsed = JSON.parse(rawCategories);
      list = Array.isArray(parsed) ? parsed : rawCategories.split(',');
    } catch {
      list = rawCategories.split(',');
    }
  }
  const validExtras = list
    .map((c) => String(c?._id || c || '').trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  const result = [];
  if (primaryCategory && mongoose.Types.ObjectId.isValid(String(primaryCategory))) {
    result.push(String(primaryCategory));
  }
  for (const id of validExtras) {
    if (!result.includes(id)) result.push(id);
  }
  return result;
};

const itemHasAnyActiveCategory = (item) => {
  const allCats = [
    item.category,
    ...(Array.isArray(item.categories) ? item.categories : []),
  ].filter(Boolean);
  return allCats.some((c) => c.active !== false);
};

// @desc    Get all menu items
// @route   GET /api/menu
// @access  Public
const getMenuItems = async (req, res) => {
  try {
    const { category, search, availableOnly, featuredOnly, needsImage, activeCategoriesOnly } = req.query;

    // Cache key for identical queries
    const cacheKey = `menu:${category || 'all'}:${search || ''}:${availableOnly || ''}:${featuredOnly || ''}:${needsImage || ''}:${activeCategoriesOnly || ''}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      return res.json(cachedData);
    }

    const andConditions = [
      { $or: [{ variantParent: null }, { variantParent: { $exists: false } }] },
    ];
    let targetCategoryDoc = null;

    if (category && category !== 'all') {
      if (mongoose.Types.ObjectId.isValid(category)) {
        targetCategoryDoc = await Category.findById(category).lean();
        if (!targetCategoryDoc) {
          return res.json({ success: true, count: 0, data: [] });
        }
        andConditions.push({ $or: [{ category: targetCategoryDoc._id }, { categories: targetCategoryDoc._id }] });
      } else {
        targetCategoryDoc = await Category.findOne({ name: { $regex: new RegExp(`^${category}$`, 'i') } }).lean();
        if (targetCategoryDoc) {
          andConditions.push({ $or: [{ category: targetCategoryDoc._id }, { categories: targetCategoryDoc._id }] });
        } else {
          return res.json({ success: true, count: 0, data: [] });
        }
      }
    }

    if (activeCategoriesOnly === 'true' && targetCategoryDoc && targetCategoryDoc.active === false) {
      return res.json({ success: true, count: 0, data: [] });
    }

    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andConditions.push({
        $or: [
          { name: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } },
        ],
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    if (availableOnly === 'true') {
      query.available = true;
    }

    if (featuredOnly === 'true') {
      query.featured = true;
    }

    if (needsImage === 'true') {
      andConditions.push({
        $or: [
          { 'image.url': { $in: ['', null] } },
          { image: { $in: ['', null] } },
        ],
      });
      query.$and = andConditions;
    }

    const menuItems = await MenuItem.find(query)
      .select('name category categories description price image emoji backgroundColor available featured preparationTime adminReviewNote variants variantParent createdAt')
      .populate('category', 'name active parcelEligible')
      .populate('categories', 'name active parcelEligible')
      .sort({ createdAt: -1 })
      .lean();

    const filteredByCategoryStatus =
      activeCategoriesOnly === 'true'
        ? menuItems.filter((item) => itemHasAnyActiveCategory(item))
        : menuItems;

    const normalized = filteredByCategoryStatus.map((item) => normalizeMenuItemImage(item, true));
    const responsePayload = { success: true, count: normalized.length, data: normalized };

    // Cache list results for 45 seconds
    cache.set(cacheKey, responsePayload, 45);

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.json(responsePayload);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Get single menu item
// @route   GET /api/menu/:id
// @access  Public
const getMenuItemById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const cacheKey = `menu:item:${req.params.id}`;
    const cachedItem = cache.get(cacheKey);
    if (cachedItem) {
      return res.json(cachedItem);
    }

    const menuItem = await MenuItem.findById(req.params.id)
      .select('name category categories description price image emoji backgroundColor available featured preparationTime adminReviewNote variants variantParent createdAt')
      .populate('category', 'name active parcelEligible')
      .populate('categories', 'name active parcelEligible')
      .lean();

    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const responsePayload = { success: true, data: normalizeMenuItemImage(menuItem, false) };
    cache.set(cacheKey, responsePayload, 60);

    res.json(responsePayload);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Check status and price for multiple menu items (lightweight checkout check)
// @route   POST /api/menu/check
// @access  Public
const checkMenuItems = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const items = await MenuItem.find({ _id: { $in: validIds } })
      .select('_id name available price variants variantParent category categories')
      .populate('category', 'name active parcelEligible')
      .populate('categories', 'name active parcelEligible')
      .lean();

    const checked = items.map((item) => {
      const categoryInactive = !itemHasAnyActiveCategory(item);
      return {
        _id: item._id,
        name: item.name,
        available: categoryInactive ? false : item.available,
        price: item.price,
        variants: Array.isArray(item.variants) ? item.variants : [],
        categoryInactive,
        parcelEligible: isItemParcelEligible(item),
      };
    });

    res.json({ success: true, data: checked });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Standalone food image upload to Cloudinary
// @route   POST /api/menu/upload-image or POST /api/admin/menu/upload-image
// @access  Private/Admin
const uploadStandaloneImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided. Please attach a JPG, PNG, or WEBP image up to 5 MB.',
      });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary credentials are not configured on the server. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the environment settings.',
      });
    }

    let folderName = 'general';
    if (req.body.category) {
      try {
        if (mongoose.Types.ObjectId.isValid(req.body.category)) {
          const catDoc = await Category.findById(req.body.category).lean();
          if (catDoc?.name) folderName = catDoc.name.toLowerCase().trim();
        } else {
          folderName = String(req.body.category).toLowerCase().trim();
        }
      } catch {
        folderName = 'general';
      }
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer, { folder: folderName });

    res.status(200).json({
      success: true,
      message: 'Food image uploaded successfully',
      image: {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        format: uploadResult.format,
      },
    });
  } catch (error) {
    console.error('[CLOUDINARY UPLOAD ERROR]:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image to Cloudinary.',
    });
  }
};

// @desc    Create a menu item
// @route   POST /api/menu
// @access  Private/Admin
const createMenuItem = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const {
      name,
      category,
      categories,
      description,
      price,
      emoji,
      backgroundColor,
      available,
      featured,
      preparationTime,
      adminReviewNote,
      variants,
      imageUrl,
      imagePublicId,
    } = req.body;

    const parsedVariants = parseVariantsInput(variants, []);
    const resolvedPrice =
      parsedVariants && parsedVariants.length > 0 ? Number(parsedVariants[0].price) : Number(price);

    if (!name || !category || (!price && !(parsedVariants && parsedVariants.length > 0))) {
      return res.status(400).json({ success: false, message: 'Please provide name, category, and price' });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ success: false, message: 'Invalid category selected' });
    }

    const catDoc = await Category.findById(category);
    if (!catDoc) {
      return res.status(404).json({ success: false, message: 'Selected category not found' });
    }
    if (catDoc.active === false) {
      return res.status(400).json({
        success: false,
        message: `Category "${catDoc.name}" is currently inactive. Inactive categories cannot be assigned to new food items.`,
      });
    }

    const normalizedCatIds = parseCategoriesInput(categories, category);
    if (normalizedCatIds.length > 1) {
      const allCats = await Category.find({ _id: { $in: normalizedCatIds } }).lean();
      if (allCats.length !== normalizedCatIds.length) {
        return res.status(400).json({ success: false, message: 'One or more additional categories were not found.' });
      }
      const inactiveExtra = allCats.find((c) => c.active === false);
      if (inactiveExtra) {
        return res.status(400).json({
          success: false,
          message: `Category "${inactiveExtra.name}" is inactive and cannot be assigned.`,
        });
      }
    }

    // Determine category name for organized Cloudinary folder hierarchy
    const folderName = catDoc.name ? catDoc.name.toLowerCase().trim() : 'general';

    let imageData = {
      url: imageUrl || '',
      publicId: imagePublicId || '',
    };

    // If file was directly attached via multipart form
    if (req.file) {
      if (isCloudinaryConfigured()) {
        const uploadResult = await uploadToCloudinary(req.file.buffer, { folder: folderName });
        imageData = {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
        };
        uploadedPublicId = uploadResult.publicId;
      } else {
        return res.status(500).json({
          success: false,
          message: 'Cloudinary is not configured. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
        });
      }
    }

    let menuItem;
    try {
      menuItem = await MenuItem.create({
        name: name.trim(),
        category,
        categories: normalizedCatIds,
        description: description ? description.trim() : '',
        price: resolvedPrice,
        image: imageData,
        emoji: emoji || '🍛',
        backgroundColor: backgroundColor || '#fff',
        available: available !== undefined ? (available === 'true' || available === true) : true,
        featured: featured === 'true' || featured === true,
        preparationTime: preparationTime ? Number(preparationTime) : 10,
        adminReviewNote: adminReviewNote ? String(adminReviewNote).trim() : '',
        variants: parsedVariants || [],
      });
    } catch (dbError) {
      // Handle orphan cleanup: if upload succeeded but DB save failed, delete from Cloudinary
      if (uploadedPublicId) {
        await deleteCloudinaryAsset(uploadedPublicId);
      }
      throw dbError;
    }

    const populatedItem = await MenuItem.findById(menuItem._id)
      .populate('category', 'name active parcelEligible')
      .populate('categories', 'name active parcelEligible');
    const normalizedItem = normalizeMenuItemImage(populatedItem);

    // Broadcast real-time event via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:created', normalizedItem);
    }

    cache.clearPrefix('menu');
    cache.clearPrefix('categories');

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: normalizedItem,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Update menu item
// @route   PUT /api/menu/:id
// @access  Private/Admin
const updateMenuItem = async (req, res) => {
  let newUploadedPublicId = null;

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const {
      name,
      category,
      categories,
      description,
      price,
      emoji,
      backgroundColor,
      available,
      featured,
      preparationTime,
      adminReviewNote,
      variants,
      imageUrl,
      imagePublicId,
      removeImage,
    } = req.body;

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const oldPublicId = menuItem.image?.publicId || '';
    let imageData = menuItem.image || { url: '', publicId: '' };
    if (typeof imageData === 'string') {
      imageData = { url: imageData, publicId: '' };
    }

    // Handle Scenario B & C: New file upload or removal
    if (req.file) {
      let folderName = 'general';
      const targetCatId = category || menuItem.category;
      try {
        const catDoc = await Category.findById(targetCatId);
        if (catDoc?.name) {
          folderName = catDoc.name.toLowerCase().trim();
        }
      } catch {
        folderName = 'general';
      }

      if (isCloudinaryConfigured()) {
        const uploadResult = await uploadToCloudinary(req.file.buffer, { folder: folderName });
        newUploadedPublicId = uploadResult.publicId;
        imageData = {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
        };
      } else {
        return res.status(500).json({
          success: false,
          message: 'Cloudinary is not configured. Please configure CLOUDINARY credentials in environment variables.',
        });
      }
    } else if (removeImage === 'true' || removeImage === true) {
      // Scenario C: Admin explicitly removed the image
      imageData = { url: '', publicId: '' };
    } else if (imageUrl !== undefined) {
      // If image URL / publicId passed via upload-image workflow
      imageData = {
        url: imageUrl,
        publicId: imagePublicId || imageData.publicId || '',
      };
    }

    if (category !== undefined && String(category) !== String(menuItem.category)) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ success: false, message: 'Invalid category selected' });
      }
      const catDoc = await Category.findById(category);
      if (!catDoc) {
        return res.status(404).json({ success: false, message: 'Selected category not found' });
      }
      if (catDoc.active === false) {
        return res.status(400).json({
          success: false,
          message: `Category "${catDoc.name}" is inactive. Please select an active category.`,
        });
      }
      menuItem.category = category;
    }

    if (categories !== undefined) {
      const normalizedCatIds = parseCategoriesInput(categories, menuItem.category);
      const foundCats = await Category.find({ _id: { $in: normalizedCatIds } }).lean();
      if (foundCats.length !== normalizedCatIds.length) {
        return res.status(400).json({ success: false, message: 'One or more assigned categories were not found.' });
      }
      menuItem.categories = normalizedCatIds;
    } else {
      menuItem.categories = parseCategoriesInput(menuItem.categories || [], menuItem.category);
    }

    if (name !== undefined) menuItem.name = name.trim();
    if (description !== undefined) menuItem.description = description.trim();
    if (variants !== undefined) {
      const parsedVariants = parseVariantsInput(variants, menuItem.variants || []);
      menuItem.variants = parsedVariants;
      if (parsedVariants.length > 0) {
        menuItem.price = Number(parsedVariants[0].price);
      } else if (price !== undefined) {
        menuItem.price = Number(price);
      }
    } else if (price !== undefined) {
      menuItem.price = Number(price);
    }
    menuItem.image = imageData;
    if (emoji !== undefined) menuItem.emoji = emoji;
    if (backgroundColor !== undefined) menuItem.backgroundColor = backgroundColor;
    if (available !== undefined) menuItem.available = available === 'true' || available === true;
    if (featured !== undefined) menuItem.featured = featured === 'true' || featured === true;
    if (preparationTime !== undefined) menuItem.preparationTime = Number(preparationTime);
    if (adminReviewNote !== undefined) menuItem.adminReviewNote = String(adminReviewNote).trim();

    try {
      await menuItem.save();
    } catch (saveError) {
      // If DB update fails, delete the new image from Cloudinary so we don't leave an orphan
      if (newUploadedPublicId) {
        await deleteCloudinaryAsset(newUploadedPublicId);
      }
      throw saveError;
    }

    // CRITICAL: Only after database update succeeds, delete previous Cloudinary asset
    if (newUploadedPublicId && oldPublicId && oldPublicId !== newUploadedPublicId) {
      await deleteCloudinaryAsset(oldPublicId);
    } else if ((removeImage === 'true' || removeImage === true) && oldPublicId) {
      await deleteCloudinaryAsset(oldPublicId);
    }

    const populatedItem = await MenuItem.findById(menuItem._id)
      .populate('category', 'name active parcelEligible')
      .populate('categories', 'name active parcelEligible');
    const normalizedItem = normalizeMenuItemImage(populatedItem);

    // Broadcast real-time event via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:updated', normalizedItem);
    }

    cache.clearPrefix('menu');
    cache.clearPrefix('categories');

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: normalizedItem,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
// @access  Private/Admin
const deleteMenuItem = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const publicId = menuItem.image?.publicId;

    // Delete item from MongoDB first
    await menuItem.deleteOne();

    // Safely delete image from Cloudinary if publicId exists
    if (publicId) {
      try {
        await deleteCloudinaryAsset(publicId);
      } catch (cloudErr) {
        console.error(`[CLOUDINARY] Failed to clean up asset for deleted item ${req.params.id}:`, cloudErr);
      }
    }

    // Broadcast real-time event via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:deleted', { id: req.params.id });
    }

    cache.clearPrefix('menu');
    cache.clearPrefix('categories');

    res.json({ success: true, message: 'Menu item removed successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle availability status of menu item
// @route   PATCH /api/menu/:id/availability
// @access  Private/Admin
const toggleAvailability = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    menuItem.available = !menuItem.available;
    await menuItem.save();

    const populatedItem = await MenuItem.findById(menuItem._id)
      .populate('category', 'name active parcelEligible')
      .populate('categories', 'name active parcelEligible')
      .lean();
    const normalizedItem = normalizeMenuItemImage(populatedItem, false);

    // Broadcast real-time event via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:availabilityChanged', {
        id: menuItem._id,
        available: menuItem.available,
      });
      io.emit('menu:updated', normalizedItem);
    }

    cache.clearPrefix('menu');

    res.json({
      success: true,
      message: `Menu item marked as ${menuItem.available ? 'available' : 'sold out'}`,
      data: normalizedItem,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Upload or replace image for specific menu item
// @route   POST /api/menu/:id/image
// @access  Private/Admin
const uploadMenuImage = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please provide an image file' });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary is not configured. Please configure CLOUDINARY credentials in environment variables.',
      });
    }

    const menuItem = await MenuItem.findById(req.params.id)
      .populate('category', 'name active parcelEligible')
      .populate('categories', 'name active parcelEligible');
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const folderName = menuItem.category?.name ? menuItem.category.name.toLowerCase().trim() : 'general';
    const oldPublicId = menuItem.image?.publicId;

    // Upload new image first
    const uploadResult = await uploadToCloudinary(req.file.buffer, { folder: folderName });
    const newImageData = {
      url: uploadResult.url,
      publicId: uploadResult.publicId,
    };

    menuItem.image = newImageData;
    await menuItem.save();

    // After DB update succeeds, delete previous asset from Cloudinary
    if (oldPublicId && oldPublicId !== uploadResult.publicId) {
      await deleteCloudinaryAsset(oldPublicId);
    }

    const normalizedItem = normalizeMenuItemImage(menuItem);

    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:updated', normalizedItem);
    }

    cache.clearPrefix('menu');

    res.json({
      success: true,
      message: 'Food image updated successfully',
      data: normalizedItem,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Delete image from menu item
// @route   DELETE /api/menu/:id/image
// @access  Private/Admin
const deleteMenuImage = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const menuItem = await MenuItem.findById(req.params.id)
      .populate('category', 'name active parcelEligible')
      .populate('categories', 'name active parcelEligible');
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const oldPublicId = menuItem.image?.publicId;

    menuItem.image = { url: '', publicId: '' };
    await menuItem.save();

    if (oldPublicId) {
      await deleteCloudinaryAsset(oldPublicId);
    }

    const normalizedItem = normalizeMenuItemImage(menuItem);

    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:updated', normalizedItem);
    }

    cache.clearPrefix('menu');

    res.json({
      success: true,
      message: 'Food image removed successfully',
      data: normalizedItem,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export {
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
};
