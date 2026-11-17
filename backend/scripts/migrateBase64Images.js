import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';
import { isCloudinaryConfigured, uploadToCloudinary } from '../config/cloudinary.js';

dotenv.config({ path: './backend/.env' });

async function migrateBase64Images() {
  console.log('=== STARTING BASE64 IMAGE MIGRATION TO CLOUDINARY ===');

  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set in environment.');
    process.exit(1);
  }

  if (!isCloudinaryConfigured()) {
    console.error('❌ Cloudinary credentials not configured. Migration aborted.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas.');

  const items = await MenuItem.find({}).populate('category', 'name').lean();
  let migratedCount = 0;
  let alreadyCloudinaryCount = 0;
  let noImageCount = 0;

  for (const item of items) {
    const rawImg = typeof item.image === 'string' ? item.image : (item.image?.url || '');

    if (!rawImg) {
      noImageCount++;
      continue;
    }

    if (rawImg.startsWith('data:image')) {
      console.log(`Migrating item "${item.name}" (${item._id})...`);
      try {
        const matches = rawImg.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(rawImg.split(',')[1] || '', 'base64');
        const folderName = item.category?.name ? item.category.name.toLowerCase().trim() : 'general';

        const uploadResult = await uploadToCloudinary(buffer, { folder: folderName });

        await MenuItem.updateOne(
          { _id: item._id },
          {
            $set: {
              image: {
                url: uploadResult.url,
                publicId: uploadResult.publicId,
              },
            },
          }
        );

        console.log(`✓ Uploaded "${item.name}" -> ${uploadResult.url}`);
        migratedCount++;
      } catch (err) {
        console.error(`Failed to migrate "${item.name}":`, err.message);
      }
    } else if (rawImg.includes('cloudinary.com')) {
      alreadyCloudinaryCount++;
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total Items Scanned: ${items.length}`);
  console.log(`Base64 Images Migrated: ${migratedCount}`);
  console.log(`Already Cloudinary: ${alreadyCloudinaryCount}`);
  console.log(`No Image / Clean: ${noImageCount}`);

  await mongoose.disconnect();
  console.log('Done!');
}

migrateBase64Images().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
