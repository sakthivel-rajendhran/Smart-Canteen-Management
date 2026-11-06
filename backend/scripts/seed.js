import mongoose from 'mongoose';
import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}
import dotenv from 'dotenv';
import User from '../models/User.js';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';
import Coupon from '../models/Coupon.js';

dotenv.config();

const categoriesData = [
  { name: 'Meals' },
  { name: 'Snacks' },
  { name: 'Juices' }
];

const couponsData = [
  {
    code: 'DRS10',
    discountType: 'flat',
    discountValue: 10,
    minimumOrder: 30,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    active: true
  },
  {
    code: 'DRS20',
    discountType: 'flat',
    discountValue: 20,
    minimumOrder: 50,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    active: true
  },
  {
    code: 'WELCOME',
    discountType: 'flat',
    discountValue: 15,
    minimumOrder: 40,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    active: true
  }
];

const menuItemsData = [
  // Meals
  { categoryName: 'Meals', name: 'Full Meals (Saapadu)', description: 'Rice, Sambar, Rasam, Kootu, Papad & Pickle', price: 60, emoji: '🍛', backgroundColor: '#fff8eb', featured: true },
  { categoryName: 'Meals', name: 'Sambar Rice', description: 'Hot rice with thick homestyle Sambar', price: 30, emoji: '🍲', backgroundColor: '#fff0e8', featured: false },
  { categoryName: 'Meals', name: 'Curd Rice (Thayir Sadam)', description: 'Creamy curd rice with mango pickle', price: 25, emoji: '🍚', backgroundColor: '#f0fff4', featured: false },
  { categoryName: 'Meals', name: 'Lemon Rice (Elumichai Sadam)', description: 'Tangy lemon rice with peanuts', price: 30, emoji: '🥗', backgroundColor: '#fffbf0', featured: false },
  { categoryName: 'Meals', name: 'Fried Rice', description: 'Spicy stir-fried rice with vegetables', price: 30, emoji: '🥘', backgroundColor: '#fff0f0', featured: false },
  { categoryName: 'Meals', name: 'Rasam Rice', description: 'Light peppery Rasam with soft white rice', price: 25, emoji: '🥣', backgroundColor: '#f0f0ff', featured: false },
  { categoryName: 'Meals', name: 'Veg Biryani', description: 'Fragrant Basmati rice with fresh vegetables', price: 70, emoji: '🍱', backgroundColor: '#fff8e8', featured: true },
  
  // Snacks
  { categoryName: 'Snacks', name: 'Idli (2 pcs)', description: 'Soft steamed rice cakes with Sambar & chutney', price: 20, emoji: '⚪️', backgroundColor: '#fff8f0', featured: false },
  { categoryName: 'Snacks', name: 'Masala Dosa', description: 'Crispy rice crepe with spiced potato filling', price: 35, emoji: '🫓', backgroundColor: '#fff0e8', featured: true },
  { categoryName: 'Snacks', name: 'Medhu Vadai', description: 'Crispy urad dal fritters with coconut chutney', price: 15, emoji: '🍩', backgroundColor: '#f0fff4', featured: false },
  { categoryName: 'Snacks', name: 'Masala Vadai', description: 'Spiced chana dal fritters — crispy outside', price: 15, emoji: '🍩', backgroundColor: '#fffbf0', featured: false },
  { categoryName: 'Snacks', name: 'Pongal', description: 'Creamy rice & dal with ghee, pepper & cashews', price: 25, emoji: '🍵', backgroundColor: '#f0f0ff', featured: true },
  { categoryName: 'Snacks', name: 'Bonda', description: 'Deep fried crispy potato balls with mint chutney', price: 15, emoji: '🧆', backgroundColor: '#fff0f8', featured: false },
  { categoryName: 'Snacks', name: 'Bajji (Plate)', description: 'Battered & fried vegetables — hot & crispy', price: 20, emoji: '🫔', backgroundColor: '#f8fff0', featured: false },
  { categoryName: 'Snacks', name: 'Murukku (Pack)', description: 'Crunchy spiral rice flour snack', price: 10, emoji: '🥨', backgroundColor: '#fff8f8', featured: false },

  // Juices
  { categoryName: 'Juices', name: 'Nannari Sherbet', description: 'Traditional cooling herbal root drink', price: 20, emoji: '🥤', backgroundColor: '#f0fff4', featured: false },
  { categoryName: 'Juices', name: 'Sugarcane Juice', description: 'Fresh pressed sweet sugarcane with lemon', price: 25, emoji: '🍹', backgroundColor: '#fff8f0', featured: true },
  { categoryName: 'Juices', name: 'Tender Coconut (Elaneer)', description: 'Fresh tender coconut water — cool & natural', price: 40, emoji: '🥥', backgroundColor: '#f0f8ff', featured: false },
  { categoryName: 'Juices', name: 'Buttermilk (Mor)', description: 'Spiced yogurt cooling drink with curry leaves', price: 15, emoji: '🥛', backgroundColor: '#f8fff8', featured: false },
  { categoryName: 'Juices', name: 'Rose Milk', description: 'Sweet chilled rose flavoured milk', price: 20, emoji: '🍷', backgroundColor: '#fff0f8', featured: false },
  { categoryName: 'Juices', name: 'Filter Coffee / Tea', description: 'Traditional South Indian decoction coffee', price: 20, emoji: '☕', backgroundColor: '#fff8e8', featured: false }
];

const seedDB = async () => {
  try {
    if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
      console.error('❌ Refusing to seed database in production without --force flag.');
      process.exit(1);
    }

    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/drs_quick_serve';
    console.log(`Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB connection active.');

    // Clear existing menu and coupon collections (preserve user accounts and order integrity)
    console.log('Clearing old categories, menu items, and coupons...');
    await Category.deleteMany({});
    await MenuItem.deleteMany({});
    await Coupon.deleteMany({});
    console.log('Menu, categories, and coupons cleared.');

    // Seed/Upsert default users from environment variables
    console.log('Ensuring seed users exist...');
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@drsquickserve.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
    const normalEmail = process.env.SEED_USER_EMAIL || 'student@drsquickserve.com';
    const normalPassword = process.env.SEED_USER_PASSWORD || 'Student@12345';

    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      adminUser = new User({
        name: 'DRSCE Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        phone: '9876543210'
      });
      await adminUser.save();
      console.log(`Created seed admin user: ${adminEmail}`);
    } else {
      console.log(`Seed admin user already exists: ${adminEmail}`);
    }

    let normalUser = await User.findOne({ email: normalEmail });
    if (!normalUser) {
      normalUser = new User({
        name: 'Student User',
        email: normalEmail,
        password: normalPassword,
        role: 'user',
        phone: '9876543211'
      });
      await normalUser.save();
      console.log(`Created seed student user: ${normalEmail}`);
    } else {
      console.log(`Seed student user already exists: ${normalEmail}`);
    }

    // Seed Categories
    console.log('Seeding categories...');
    const createdCategories = await Category.insertMany(categoriesData);
    console.log('Categories seeded.');

    // Seed Coupons
    console.log('Seeding coupons...');
    await Coupon.insertMany(couponsData);
    console.log('Coupons seeded.');

    // Seed Menu Items
    console.log('Seeding menu items...');
    const menuToSave = menuItemsData.map(item => {
      const dbCat = createdCategories.find(c => c.name === item.categoryName);
      if (!dbCat) throw new Error(`Category ${item.categoryName} not found!`);
      const { categoryName, ...rest } = item;
      return {
        ...rest,
        category: dbCat._id
      };
    });
    await MenuItem.insertMany(menuToSave);
    console.log('Menu items seeded successfully.');

    console.log('Database seeding process completed! ✨');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDB();
