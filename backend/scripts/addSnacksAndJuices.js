import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Windows DNS SRV fix for mongodb+srv URIs
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Ignore if DNS servers cannot be overridden
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env BEFORE importing modules that read process.env (e.g. Cloudinary)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ARTIFACT_DIR =
  'C:/Users/sakth/.gemini/antigravity/brain/ccc25843-80fc-44b1-bfed-e9887f244859';

const PRODUCT_CATALOG = [
  // ========================
  // SNACKS (20 items)
  // ========================
  {
    name: 'Filter Coffee',
    slug: 'filter-coffee',
    price: 20,
    preparationTime: 5,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description:
      'Traditional hot South Indian filter coffee served in a stainless steel tumbler and davara.',
    localImagePath: `${ARTIFACT_DIR}/south_indian_filter_coffee_traditional_1794326724457.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Tea',
    slug: 'tea',
    price: 15,
    preparationTime: 5,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Freshly brewed hot Indian milk tea prepared to order.',
    localImagePath: `${ARTIFACT_DIR}/test_tea_1794325991298.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Unibic Biscuit',
    slug: 'unibic-biscuit',
    price: 10,
    preparationTime: 1,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Crispy baked cookie pack from Unibic.',
    localImagePath: `${ARTIFACT_DIR}/scratch/candidates/unibic_2.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Nabaty Wafer Biscuit',
    slug: 'nabaty-wafer-biscuit',
    price: 10,
    preparationTime: 1,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Light crispy layered wafer biscuit pack.',
    localImagePath: `${ARTIFACT_DIR}/nabati_richeese_wafer_clean_1794364865286.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Cream Bun',
    slug: 'cream-bun',
    price: 15,
    preparationTime: 2,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Soft bakery bun filled with smooth sweet vanilla cream.',
    localImagePath: `${ARTIFACT_DIR}/cream_bun_1794326691676.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Pomegranate (Fresh)',
    slug: 'pomegranate-fresh',
    price: 60,
    preparationTime: 5,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks', 'Juices'],
    description: 'Freshly prepared ruby pomegranate juice served chilled.',
    localImagePath: `${ARTIFACT_DIR}/scratch/juices_final/pomegranate.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Apple (Fresh)',
    slug: 'apple-fresh',
    price: 50,
    preparationTime: 5,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks', 'Juices'],
    description: 'Freshly blended chilled red apple juice.',
    localImagePath: `${ARTIFACT_DIR}/scratch/juices_final/apple_fresh.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Watermelon (Fresh)',
    slug: 'watermelon-fresh',
    price: 40,
    preparationTime: 5,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks', 'Juices'],
    description: 'Refreshing freshly pressed chilled watermelon juice.',
    localImagePath: `${ARTIFACT_DIR}/scratch/juices_final/watermelon.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Lemon (Fresh)',
    slug: 'lemon-fresh',
    price: 30,
    preparationTime: 5,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks', 'Juices'],
    description: 'Chilled freshly squeezed lemon cooler.',
    localImagePath: `${ARTIFACT_DIR}/scratch/juices_final/lemon.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Rava Cake',
    slug: 'rava-cake',
    price: 10,
    preparationTime: 2,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Soft golden baked semolina rava cake slice.',
    localImagePath: `${ARTIFACT_DIR}/rava_cake_bakery_1794326697137.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Samosa',
    slug: 'samosa',
    price: 20,
    preparationTime: 5,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Crispy fried pastry filled with spiced potato and peas.',
    localImagePath: `${ARTIFACT_DIR}/crispy_samosas_menu_1794326700973.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Egg Puff (1 pc)',
    slug: 'egg-puff-1-pc',
    price: 20,
    preparationTime: 5,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Flaky golden baked puff pastry stuffed with spiced masala and egg (1 piece).',
    localImagePath: `${ARTIFACT_DIR}/egg_puff_pastry_1794326702777.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Veg Puff (1 pc)',
    slug: 'veg-puff-1-pc',
    price: 15,
    preparationTime: 5,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Flaky baked puff pastry filled with spiced mixed vegetables (1 piece).',
    localImagePath: `${ARTIFACT_DIR}/indian_bakery_veg_puff_1794326719083.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Chicken Puff (1 pc)',
    slug: 'chicken-puff-1-pc',
    price: 30,
    preparationTime: 5,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Flaky baked puff pastry stuffed with seasoned chicken masala (1 piece).',
    localImagePath: `${ARTIFACT_DIR}/chicken_puff_pastry_png_1794326750099.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Sting',
    slug: 'sting',
    price: 20,
    preparationTime: 1,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Chilled Sting berry-flavored carbonated energy beverage.',
    localImagePath: `${ARTIFACT_DIR}/sting_energy_drink_bottle_1794364845557.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Dairy Milk (20 g)',
    slug: 'dairy-milk-20-g',
    price: 20,
    preparationTime: 1,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Smooth Cadbury Dairy Milk chocolate bar (20 g).',
    localImagePath: `${ARTIFACT_DIR}/cadbury_dairy_milk_bar_cubes_1794364881493.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Dairy Milk (200 g)',
    slug: 'dairy-milk-200-g',
    price: 314,
    preparationTime: 1,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Large Cadbury Dairy Milk chocolate family pack (200 g).',
    localImagePath: `${ARTIFACT_DIR}/cadbury_dairy_milk_family_pack_1794364886312.jpg`,
    available: true,
    featured: false,
  },
  {
    name: '5 Star',
    slug: '5-star',
    price: 5,
    preparationTime: 1,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Caramel and nougat filled Cadbury 5 Star chocolate bar.',
    localImagePath: `${ARTIFACT_DIR}/cadbury_5_star_product_shot_1794364888796.jpg`,
    available: true,
    featured: false,
  },
  {
    name: '5 Star (40 g)',
    slug: '5-star-40-g',
    price: 30,
    preparationTime: 1,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Cadbury 5 Star caramel and nougat chocolate bar (40 g).',
    localImagePath: `${ARTIFACT_DIR}/cadbury_5_star_40g_studio_1794364892843.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'KitKat',
    slug: 'kitkat',
    price: 50,
    preparationTime: 1,
    primaryCategory: 'Snacks',
    categoryNames: ['Snacks'],
    description: 'Crisp chocolate-covered wafer fingers by Nestle KitKat.',
    localImagePath: `${ARTIFACT_DIR}/test_kitkat_1794326045496.jpg`,
    available: true,
    featured: false,
  },

  // ========================
  // ADDITIONAL JUICES (6 items + 4 shared fresh fruits above = 10 total in Juices)
  // ========================
  {
    name: 'Tata Glucose',
    slug: 'tata-glucose',
    price: 10,
    preparationTime: 1,
    primaryCategory: 'Juices',
    categoryNames: ['Juices'],
    description: 'Chilled ready-to-drink Tata Gluco+ energy beverage cup.',
    localImagePath: `${ARTIFACT_DIR}/scratch/juices_final/tata_glucose.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Apple Fizz',
    slug: 'apple-fizz',
    price: 20,
    preparationTime: 2,
    primaryCategory: 'Juices',
    categoryNames: ['Juices'],
    description: 'Chilled Appy Fizz sparkling apple drink.',
    localImagePath: `${ARTIFACT_DIR}/scratch/juices_final/apple_fizz.jpg`,
    available: true,
    featured: false,
  },
  {
    name: '7UP',
    slug: '7up',
    price: 20,
    preparationTime: 1,
    primaryCategory: 'Juices',
    categoryNames: ['Juices'],
    description: 'Chilled 7UP lemon-lime carbonated soft drink.',
    localImagePath: `${ARTIFACT_DIR}/scratch/juices_final/sevenup.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Smoothy',
    slug: 'smoothy',
    price: 30,
    preparationTime: 5,
    primaryCategory: 'Juices',
    categoryNames: ['Juices'],
    description: 'Thick chilled blended fruit smoothy.',
    localImagePath: `${ARTIFACT_DIR}/scratch/juices_final/smoothy.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Soda',
    slug: 'soda',
    price: 30,
    preparationTime: 2,
    primaryCategory: 'Juices',
    categoryNames: ['Juices'],
    description: 'Chilled sparkling soda water served over ice with lemon.',
    localImagePath: `${ARTIFACT_DIR}/scratch/juices_final/soda.jpg`,
    available: true,
    featured: false,
  },
  {
    name: 'Sun Menlo',
    slug: 'sun-menlo',
    price: 40,
    preparationTime: 5,
    primaryCategory: 'Juices',
    categoryNames: ['Juices'],
    description: 'Chilled beverage (pending Admin verification of product identity and photo).',
    localImagePath: null,
    adminReviewNote:
      "Flagged for Admin Review: Exact product/brand spelling 'Sun Menlo' could not be verified (possibly Sun Melon juice / regional brand). Image left unset pending Admin verification.",
    available: true,
    featured: false,
  },
];

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function withRetry(fn, label, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const code = err?.code || err?.http_code || err?.message;
      console.warn(`Attempt ${attempt}/${maxAttempts} failed for ${label}: ${code}`);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw lastError;
}

async function ensureCategory(Category, { name, description, parcelEligible }) {
  let category = await Category.findOne({
    name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
  });

  if (!category) {
    category = await Category.create({
      name,
      description,
      active: true,
      parcelEligible,
    });
    console.log(`Created missing category: ${category.name} (${category._id})`);
    return category;
  }

  let changed = false;
  if (category.parcelEligible !== parcelEligible) {
    category.parcelEligible = parcelEligible;
    changed = true;
  }
  if (!category.active) {
    category.active = true;
    changed = true;
  }
  if (changed) {
    await category.save();
  }
  return category;
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is missing in backend/.env');
  }

  // Verify local image paths before connecting/uploading
  for (const item of PRODUCT_CATALOG) {
    if (item.localImagePath && !fs.existsSync(item.localImagePath)) {
      throw new Error(`Missing local image for "${item.name}": ${item.localImagePath}`);
    }
  }

  const [{ default: MenuItem }, { default: Category }, cloudinaryLib] = await Promise.all([
    import('../models/MenuItem.js'),
    import('../models/Category.js'),
    import('../config/cloudinary.js'),
  ]);

  const { uploadToCloudinary, deleteCloudinaryAsset, isCloudinaryConfigured } = cloudinaryLib;

  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured in backend/.env');
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000, family: 4 });
  console.log('Connected to MongoDB');

  const snacksCat = await withRetry(
    () =>
      ensureCategory(Category, {
        name: 'Snacks',
        description: 'Crispy snacks, bakery items, beverages, and chocolates',
        parcelEligible: false,
      }),
    'ensure Snacks category'
  );

  const juicesCat = await withRetry(
    () =>
      ensureCategory(Category, {
        name: 'Juices',
        description: 'Fresh fruit juices and cold beverages',
        parcelEligible: true,
      }),
    'ensure Juices category'
  );

  console.log(`Categories ready: Snacks=${snacksCat._id}, Juices=${juicesCat._id}`);

  const catMap = {
    Snacks: snacksCat._id,
    Juices: juicesCat._id,
  };

  let createdCount = 0;
  let updatedCount = 0;
  let uploadedCount = 0;

  for (const item of PRODUCT_CATALOG) {
    const primaryCatId = catMap[item.primaryCategory];
    const assignedCatIds = item.categoryNames.map((n) => catMap[n]).filter(Boolean);

    const existing = await MenuItem.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(item.name)}$`, 'i') },
    });

    let imageData = existing?.image?.url
      ? { url: existing.image.url, publicId: existing.image.publicId || '' }
      : { url: '', publicId: '' };

    if (item.localImagePath) {
      const folderSegment = item.primaryCategory.toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetFolder = `drs-quick-serve/food-items/${folderSegment}`;
      const targetPublicId = `${targetFolder}/${item.slug}`;

      const forceAllImages = process.argv.includes('--force-images');
      const forceJuices = process.argv.includes('--force-juices');
      const shouldForceJuice = forceJuices && item.categoryNames.includes('Juices');

      // Upload if no Cloudinary image yet, still using an older different publicId, or explicitly forced.
      const needsUpload =
        forceAllImages ||
        shouldForceJuice ||
        !imageData.url ||
        imageData.publicId !== targetPublicId;

      if (needsUpload) {
        const buffer = fs.readFileSync(item.localImagePath);
        const result = await withRetry(
          () =>
            uploadToCloudinary(buffer, {
              folder: targetFolder,
              public_id: item.slug,
              overwrite: true,
              invalidate: true,
              transformation: [
                { width: 1200, height: 900, crop: 'fill', gravity: 'auto' },
                { quality: 'auto', fetch_format: 'auto' },
              ],
            }),
          `Cloudinary upload "${item.name}"`
        );

        const uploadedUrl = result?.url || result?.secure_url || '';
        const uploadedPublicId = result?.publicId || result?.public_id || '';
        if (!uploadedUrl || !uploadedPublicId) {
          throw new Error(
            `Cloudinary upload for "${item.name}" returned incomplete metadata: ${JSON.stringify(result)}`
          );
        }

        const previousPublicId = existing?.image?.publicId || '';
        imageData = {
          url: uploadedUrl,
          publicId: uploadedPublicId,
        };
        uploadedCount += 1;

        if (previousPublicId && previousPublicId !== uploadedPublicId) {
          try {
            await deleteCloudinaryAsset(previousPublicId);
            console.log(`Deleted superseded Cloudinary image for "${item.name}": ${previousPublicId}`);
          } catch (cleanupErr) {
            console.warn(
              `Warning: failed to delete previous Cloudinary asset ${previousPublicId}: ${cleanupErr.message}`
            );
          }
        }
      }
    } else {
      imageData = { url: '', publicId: '' };
    }

    if (existing) {
      existing.name = item.name;
      existing.price = item.price;
      existing.preparationTime = item.preparationTime;
      existing.category = primaryCatId;
      existing.categories = assignedCatIds;
      existing.description = item.description;
      existing.image = imageData;
      existing.available = item.available;
      existing.featured = item.featured;
      existing.adminReviewNote = item.adminReviewNote || '';
      await existing.save();
      updatedCount += 1;
      console.log(
        `Updated [${item.categoryNames.join(', ')}] "${item.name}" — ₹${item.price} (${existing._id})`
      );
    } else {
      const created = await MenuItem.create({
        name: item.name,
        price: item.price,
        preparationTime: item.preparationTime,
        category: primaryCatId,
        categories: assignedCatIds,
        description: item.description,
        image: imageData,
        available: item.available,
        featured: item.featured,
        adminReviewNote: item.adminReviewNote || '',
      });
      createdCount += 1;
      console.log(
        `Created [${item.categoryNames.join(', ')}] "${item.name}" — ₹${item.price} (${created._id})`
      );
    }
  }

  // Summary counts
  const snacksCount = await MenuItem.countDocuments({
    $or: [{ category: snacksCat._id }, { categories: snacksCat._id }],
  });
  const juicesCount = await MenuItem.countDocuments({
    $or: [{ category: juicesCat._id }, { categories: juicesCat._id }],
  });
  const totalCount = await MenuItem.countDocuments({});

  console.log('\n--- Sync Complete ---');
  console.log({
    createdCount,
    updatedCount,
    uploadedCount,
    snacksCount,
    juicesCount,
    totalMenuItems: totalCount,
  });
}

main()
  .catch((err) => {
    console.error('Catalog sync failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  });
