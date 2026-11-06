import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { cache } from '../utils/cache.js';

// @desc    Get all active categories
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
    const categories = await Category.find(filter).sort({ name: 1 }).lean();
    const responsePayload = { success: true, data: categories };

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
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const cleanName = name.trim();
    const categoryExists = await Category.findOne({
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') }
    });
    if (categoryExists) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    const category = await Category.create({ name: cleanName });

    cache.clearPrefix('categories');
    cache.clearPrefix('menu');

    res.status(201).json({ success: true, message: 'Category created successfully', data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update category
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

    category.name = name !== undefined ? name.trim() : category.name;
    category.active = active !== undefined ? active : category.active;

    await category.save();

    cache.clearPrefix('categories');
    cache.clearPrefix('menu');

    res.json({ success: true, message: 'Category updated successfully', data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete category
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

    await category.deleteOne();

    cache.clearPrefix('categories');
    cache.clearPrefix('menu');

    res.json({ success: true, message: 'Category removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export { getCategories, createCategory, updateCategory, deleteCategory };
