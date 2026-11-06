import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Check if Cloudinary credentials are valid and not placeholder values
 */
export const isCloudinaryConfigured = () => {
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;

  return Boolean(
    name &&
    key &&
    secret &&
    !name.includes('your_') &&
    !key.includes('your_') &&
    !secret.includes('your_')
  );
};

/**
 * Upload a buffer or stream to Cloudinary
 * @param {Buffer} buffer - File buffer from multer memory storage
 * @param {Object} options - Upload options like folder, tags, etc.
 * @returns {Promise<{ url: string, publicId: string, format: string }>}
 */
export const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error('Cloudinary is not configured. Please set valid CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment.'));
    }

    const categoryFolder = options.folder ? options.folder.toLowerCase().replace(/[^a-z0-9]/g, '') : 'general';
    const uploadFolder = `drs-quick-serve/food-items/${categoryFolder}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: uploadFolder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
        ...options,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve({
          url: result.secure_url || result.url,
          publicId: result.public_id,
          format: result.format || 'webp',
        });
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Delete an image asset from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<any>}
 */
export const deleteCloudinaryAsset = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) return null;
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error(`[CLOUDINARY] Failed to delete asset with publicId "${publicId}":`, error.message);
    return null;
  }
};

/**
 * Generate an optimized transformation URL from Cloudinary
 * @param {string} publicIdOrUrl - Cloudinary publicId or URL
 * @param {Object} transform - { width, height, quality, format }
 */
export const getOptimizedImageUrl = (publicIdOrUrl, transform = {}) => {
  if (!publicIdOrUrl) return '';
  if (!publicIdOrUrl.includes('cloudinary.com') && !isCloudinaryConfigured()) {
    return publicIdOrUrl;
  }

  // If already a Cloudinary URL, inject auto format and auto quality if not already present
  if (publicIdOrUrl.includes('/upload/')) {
    return publicIdOrUrl.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_800,h_600/');
  }

  return cloudinary.url(publicIdOrUrl, {
    transformation: [
      { width: transform.width || 800, height: transform.height || 600, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
    secure: true,
  });
};

export default cloudinary;
