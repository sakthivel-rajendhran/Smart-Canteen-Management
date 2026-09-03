import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteCloudinaryAsset,
} from '../config/cloudinary.js';

// Helper to normalize image structure for backward compatibility
const normalizeMenuItemImage = (item) => {
  const plain = item.toObject ? item.toObject() : { ...item };
  if (!plain.image || typeof plain.image === 'string') {
    plain.image = {
      url: plain.image || '',
      publicId: '',
    };
  }
  return plain;
};

// @desc    Get all menu items
// @route   GET /api/menu
// @access  Public
const getMenuItems = async (req, res) => {
  try {
    const { category, search, availableOnly, featuredOnly, needsImage } = req.query;
    let query = {};

    if (category && category !== 'all') {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        const catDoc = await Category.findOne({ name: { $regex: new RegExp(`^${category}$`, 'i') } });
        if (catDoc) {
          query.category = catDoc._id;
        } else {
          return res.json({ success: true, count: 0, data: [] });
        }
      }
    }

    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    if (availableOnly === 'true') {
      query.available = true;
    }

    if (featuredOnly === 'true') {
      query.featured = true;
    }

    if (needsImage === 'true') {
      query.$or = [
        { 'image.url': { $in: ['', null] } },
        { image: { $in: ['', null] } },
      ];
    }

    const menuItems = await MenuItem.find(query).populate('category').sort({ createdAt: -1 });
    const normalized = menuItems.map(normalizeMenuItemImage);

    res.json({ success: true, count: normalized.length, data: normalized });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    const menuItem = await MenuItem.findById(req.params.id).populate('category');
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.json({ success: true, data: normalizeMenuItemImage(menuItem) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a menu item
// @route   POST /api/menu
// @access  Private/Admin
const createMenuItem = async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      price,
      emoji,
      backgroundColor,
      available,
      featured,
      preparationTime,
      imageUrl,
    } = req.body;

    if (!name || !category || !price) {
      return res.status(400).json({ success: false, message: 'Please provide name, category, and price' });
    }

    // Determine category name for organized Cloudinary folder hierarchy
    let folderName = 'general';
    try {
      const catDoc = await Category.findById(category);
      if (catDoc && catDoc.name) {
        folderName = catDoc.name.toLowerCase().trim();
      }
    } catch {
      // Ignore category lookup error and use default folder
    }

    let imageData = {
      url: imageUrl || '',
      publicId: '',
    };

    if (req.file) {
      if (isCloudinaryConfigured()) {
        const uploadResult = await uploadToCloudinary(req.file.buffer, { folder: folderName });
        imageData = {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
        };
      } else {
        // Fallback to data URI if Cloudinary credentials not yet set in .env
        const base64 = req.file.buffer.toString('base64');
        imageData = {
          url: `data:${req.file.mimetype};base64,${base64}`,
          publicId: '',
        };
      }
    }

    const menuItem = await MenuItem.create({
      name: name.trim(),
      category,
      description: description ? description.trim() : '',
      price: Number(price),
      image: imageData,
      emoji: emoji || '🍛',
      backgroundColor: backgroundColor || '#fff',
      available: available !== undefined ? (available === 'true' || available === true) : true,
      featured: featured === 'true' || featured === true,
      preparationTime: preparationTime ? Number(preparationTime) : 10,
    });

    const populatedItem = await MenuItem.findById(menuItem._id).populate('category');
    const normalizedItem = normalizeMenuItemImage(populatedItem);

    // Broadcast real-time event via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:created', normalizedItem);
    }

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: normalizedItem,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update menu item
// @route   PUT /api/menu/:id
// @access  Private/Admin
const updateMenuItem = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const {
      name,
      category,
      description,
      price,
      emoji,
      backgroundColor,
      available,
      featured,
      preparationTime,
      imageUrl,
    } = req.body;

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    let imageData = menuItem.image || { url: '', publicId: '' };
    if (typeof imageData === 'string') {
      imageData = { url: imageData, publicId: '' };
    }

    if (imageUrl !== undefined && imageUrl !== '') {
      imageData.url = imageUrl;
    }

    // If new image file is uploaded, replace existing Cloudinary asset
    if (req.file) {
      let folderName = 'general';
      const targetCatId = category || menuItem.category;
      try {
        const catDoc = await Category.findById(targetCatId);
        if (catDoc && catDoc.name) {
          folderName = catDoc.name.toLowerCase().trim();
        }
      } catch {
        // use default folder
      }

      // Delete old Cloudinary asset if one exists
      if (imageData.publicId) {
        await deleteCloudinaryAsset(imageData.publicId);
      }

      if (isCloudinaryConfigured()) {
        const uploadResult = await uploadToCloudinary(req.file.buffer, { folder: folderName });
        imageData = {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
        };
      } else {
        const base64 = req.file.buffer.toString('base64');
        imageData = {
          url: `data:${req.file.mimetype};base64,${base64}`,
          publicId: '',
        };
      }
    }

    if (name !== undefined) menuItem.name = name.trim();
    if (category !== undefined) menuItem.category = category;
    if (description !== undefined) menuItem.description = description.trim();
    if (price !== undefined) menuItem.price = Number(price);
    menuItem.image = imageData;
    if (emoji !== undefined) menuItem.emoji = emoji;
    if (backgroundColor !== undefined) menuItem.backgroundColor = backgroundColor;
    if (available !== undefined) menuItem.available = available === 'true' || available === true;
    if (featured !== undefined) menuItem.featured = featured === 'true' || featured === true;
    if (preparationTime !== undefined) menuItem.preparationTime = Number(preparationTime);

    await menuItem.save();

    const populatedItem = await MenuItem.findById(menuItem._id).populate('category');
    const normalizedItem = normalizeMenuItemImage(populatedItem);

    // Broadcast real-time event via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:updated', normalizedItem);
    }

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: normalizedItem,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    // Delete image from Cloudinary if publicId exists
    const publicId = menuItem.image?.publicId;
    if (publicId) {
      await deleteCloudinaryAsset(publicId);
    }

    await menuItem.deleteOne();

    // Broadcast real-time event via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:deleted', { id: req.params.id });
    }

    res.json({ success: true, message: 'Menu item removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    const populatedItem = await MenuItem.findById(menuItem._id).populate('category');
    const normalizedItem = normalizeMenuItemImage(populatedItem);

    // Broadcast real-time event via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:availabilityChanged', {
        id: menuItem._id,
        available: menuItem.available,
      });
      io.emit('menu:updated', normalizedItem);
    }

    res.json({
      success: true,
      message: `Menu item marked as ${menuItem.available ? 'available' : 'sold out'}`,
      data: normalizedItem,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    const menuItem = await MenuItem.findById(req.params.id).populate('category');
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const folderName = menuItem.category?.name ? menuItem.category.name.toLowerCase().trim() : 'general';

    // Delete old Cloudinary asset if present
    if (menuItem.image?.publicId) {
      await deleteCloudinaryAsset(menuItem.image.publicId);
    }

    let imageData = { url: '', publicId: '' };
    if (isCloudinaryConfigured()) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, { folder: folderName });
      imageData = {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
      };
    } else {
      const base64 = req.file.buffer.toString('base64');
      imageData = {
        url: `data:${req.file.mimetype};base64,${base64}`,
        publicId: '',
      };
    }

    menuItem.image = imageData;
    await menuItem.save();

    const normalizedItem = normalizeMenuItemImage(menuItem);

    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:updated', normalizedItem);
    }

    res.json({
      success: true,
      message: 'Food image updated successfully',
      data: normalizedItem,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    const menuItem = await MenuItem.findById(req.params.id).populate('category');
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    if (menuItem.image?.publicId) {
      await deleteCloudinaryAsset(menuItem.image.publicId);
    }

    menuItem.image = { url: '', publicId: '' };
    await menuItem.save();

    const normalizedItem = normalizeMenuItemImage(menuItem);

    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:updated', normalizedItem);
    }

    res.json({
      success: true,
      message: 'Food image removed successfully',
      data: normalizedItem,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
  uploadMenuImage,
  deleteMenuImage,
};
