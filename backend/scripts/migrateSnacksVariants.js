import dns from 'node:dns';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Ignore if DNS servers cannot be overridden
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const buildImageData = (item) => {
  if (!item?.image) return { url: '', publicId: '' };
  if (typeof item.image === 'string') return { url: item.image, publicId: '' };
  return {
    url: item.image.url || '',
    publicId: item.image.publicId || '',
  };
};

async function groupBrandPair(MenuItem, config) {
  const {
    parentNames,
    secondaryNames,
    parentDisplayName,
    parentDescription,
    primaryVariantLabel,
    secondaryVariantLabel,
  } = config;

  const findByNames = async (names) => {
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const doc = await MenuItem.findOne({ name: { $regex: new RegExp(`^${escaped}$`, 'i') } });
      if (doc) return doc;
    }
    return null;
  };

  const parentDoc = await findByNames(parentNames);
  const secondaryDoc = await findByNames(secondaryNames);

  if (!parentDoc) {
    throw new Error(`Parent product not found for "${parentDisplayName}" (${parentNames.join(', ')})`);
  }
  if (!secondaryDoc) {
    throw new Error(`Secondary product not found for "${parentDisplayName}" (${secondaryNames.join(', ')})`);
  }

  const existingPrimary = (parentDoc.variants || []).find(
    (v) => String(v.legacyMenuItemId || v._id) === String(parentDoc._id)
  );
  const existingSecondary = (parentDoc.variants || []).find(
    (v) => String(v.legacyMenuItemId || v._id) === String(secondaryDoc._id)
  );

  const primaryVariant = {
    _id: parentDoc._id,
    label: primaryVariantLabel,
    price: Number(existingPrimary?.price ?? parentDoc.price),
    available: existingPrimary ? existingPrimary.available !== false : parentDoc.available !== false,
    preparationTime: Number(parentDoc.preparationTime || 1),
    image: buildImageData(parentDoc),
    legacyMenuItemId: parentDoc._id,
  };

  const secondaryVariant = {
    _id: secondaryDoc._id,
    label: secondaryVariantLabel,
    price: Number(existingSecondary?.price ?? secondaryDoc.price),
    available: existingSecondary ? existingSecondary.available !== false : secondaryDoc.available !== false,
    preparationTime: Number(secondaryDoc.preparationTime || 1),
    image: buildImageData(secondaryDoc),
    legacyMenuItemId: secondaryDoc._id,
  };

  parentDoc.name = parentDisplayName;
  if (parentDescription) {
    parentDoc.description = parentDescription;
  }
  parentDoc.price = primaryVariant.price;
  parentDoc.variantParent = null;
  parentDoc.variants = [primaryVariant, secondaryVariant];
  await parentDoc.save();

  // Preserve secondary record intact in DB as linked historical child (no deletion)
  if (String(secondaryDoc.variantParent || '') !== String(parentDoc._id)) {
    secondaryDoc.variantParent = parentDoc._id;
    await secondaryDoc.save();
  }

  console.log(
    `Grouped "${parentDisplayName}" (${parentDoc._id}) with variants:`,
    parentDoc.variants.map((v) => `${v.label} (₹${v.price}) [${v._id}]`).join(' | ')
  );
}

async function main() {
  const { default: MenuItem } = await import('../models/MenuItem.js');
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI missing in backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000, family: 4 });
  console.log('Connected to MongoDB');

  // 1. Dairy Milk (20 g -> ₹20, 200 g -> ₹314)
  await groupBrandPair(MenuItem, {
    parentNames: ['Dairy Milk', 'Dairy Milk (20 g)'],
    secondaryNames: ['Dairy Milk (200 g)'],
    parentDisplayName: 'Dairy Milk',
    parentDescription: 'Smooth Cadbury Dairy Milk chocolate bar available in 20 g and 200 g packs.',
    primaryVariantLabel: '20 g',
    secondaryVariantLabel: '200 g',
  });

  // 2. 5 Star (existing ₹5 smaller pack -> Small Pack without inventing weight, 40 g -> ₹30)
  await groupBrandPair(MenuItem, {
    parentNames: ['5 Star'],
    secondaryNames: ['5 Star (40 g)'],
    parentDisplayName: '5 Star',
    parentDescription: 'Caramel and nougat filled Cadbury 5 Star chocolate bar.',
    primaryVariantLabel: 'Small Pack',
    secondaryVariantLabel: '40 g',
  });

  const visibleCount = await MenuItem.countDocuments({
    $or: [{ variantParent: null }, { variantParent: { $exists: false } }],
  });
  const totalDocs = await MenuItem.countDocuments({});
  console.log('Migration complete:', { visibleMenuCards: visibleCount, preservedTotalDocs: totalDocs });
}

main()
  .catch((err) => {
    console.error('Variant migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  });

