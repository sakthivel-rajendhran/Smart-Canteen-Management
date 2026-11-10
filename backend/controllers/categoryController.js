import mongoose from 'mongoose';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';
import { cache } from '../utils/cache.js';

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Helper to attach assigned menu item counts to category records
const attachItemCounts = async (categories) => {
  if (!Array.isArray(categories) || categories.length === 0) return [];
  const counts = await MenuItem.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(
    counts.map((entry) => [entry._id ? entry._id.toString() : '', entry.count])
  );

  return categories.map((cat) => {
    const plain = cat.toObject ? cat.toObject() : { ...cat };
    plain.itemCount = countMap.get(String(plain._id)) || 0;
    return plain;
  });
};

// @desc    Get categories (active by default, or all with ?all=true)
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const isAll = req.query.all === 'true';
    const cacheKey = `categories:${isAll ? 'all' : 'active'}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      return res.json(cached);
    }

    const filter = isAll ? {} : { active: { $ne: false } };
    const categories = await Category.find(filter)
      .select('name active createdAt updatedAt')
      .sort({ name: 1 })
      .lean();
    const enrichedCategories = await attachItemCounts(categories);
    const responsePayload = { success: true, data: enrichedCategories };

    cache.set(cacheKey, responsePayload, 60);

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a category
// @route   POST /api/categories
// @access  Private/Admin
const createCategory = async (req, res) => {
  try {
    const { name, active } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const cleanName = String(name).trim();
    const categoryExists = await Category.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') },
    });
    if (categoryExists) {
      return res.status(400).json({ success: false, message: `Category "${cleanName}" already exists` });
    }

    const isActive = active === undefined ? true : Boolean(active === true || active === 'true');

    const category = await Category.create({
      name: cleanName,
      active: isActive,
    });

    const payload = {
      _id: category._id,
      name: category.name,
      active: category.active,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      itemCount: 0,
    };

    cache.clearPrefix('categories');
    cache.clearPrefix('menu');

    const io = req.app.get('socketio');
    if (io) {
      io.emit('category:created', payload);
    }

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: payload,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update category (rename or activate/deactivate)
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const { name, active } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return res.status(400).json({ success: false, message: 'Category name cannot be empty' });
      }

      const duplicate = await Category.findOne({
        _id: { $ne: category._id },
        name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Category "${cleanName}" already exists`,
        });
      }

      category.name = cleanName;
    }

    if (active !== undefined) {
      category.active = Boolean(active === true || active === 'true');
    }

    await category.save();

    const itemCount = await MenuItem.countDocuments({ category: category._id });
    const payload = {
      _id: category._id,
      name: category.name,
      active: category.active,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      itemCount,
    };

    cache.clearPrefix('categories');
    cache.clearPrefix('menu');

    const io = req.app.get('socketio');
    if (io) {
      io.emit('category:updated', payload);
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: payload,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Category name already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete category (blocked if food items are still assigned to it)
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const assignedCount = await MenuItem.countDocuments({ category: category._id });
    if (assignedCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete "${category.name}" because ${assignedCount} food item${assignedCount === 1 ? ' is' : 's are'} still assigned to it. Please reassign those food items to another category first, or mark this category as inactive instead.`,
        assignedCount,
      });
    }

    await category.deleteOne();

    cache.clearPrefix('categories');
    cache.clearPrefix('menu');

    const io = req.app.get('socketio');
    if (io) {
      io.emit('category:deleted', { id: category._id.toString(), name: category.name });
    }

    res.json({
      success: true,
      message: `Category "${category.name}" deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export { getCategories, createCategory, updateCategory, deleteCategory };
