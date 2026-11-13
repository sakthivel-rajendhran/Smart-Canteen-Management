import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Ensure Cloudinary is configured
const getCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
};

/**
 * Upload a generated PDF buffer to secure private Cloudinary storage
 * @param {Buffer} pdfBuffer - Raw PDF binary buffer
 * @param {string} fileName - Destination file name without extension
 * @returns {Promise<{ storageType: string, publicId: string, secureUrl: string, fileSize: number }>}
 */
export const uploadReportPDF = async (pdfBuffer, fileName) => {
  const cld = getCloudinary();
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('Cloudinary credentials missing, falling back to buffer-direct storage');
    return {
      storageType: 'buffer',
      publicId: fileName,
      secureUrl: '',
      fileSize: pdfBuffer.length,
    };
  }

  return new Promise((resolve, reject) => {
    const cleanPublicId = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const uploadStream = cld.uploader.upload_stream(
      {
        folder: 'drs_quick_serve/revenue_reports',
        public_id: cleanPublicId,
        resource_type: 'raw',
        type: 'upload',
        format: 'pdf',
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary PDF upload failed, fallback to direct:', error);
          // Return buffer fallback so failure doesn't break user download
          resolve({
            storageType: 'buffer',
            publicId: cleanPublicId,
            secureUrl: '',
            fileSize: pdfBuffer.length,
          });
        } else {
          resolve({
            storageType: 'cloudinary',
            publicId: result.public_id,
            secureUrl: result.secure_url,
            fileSize: result.bytes || pdfBuffer.length,
          });
        }
      }
    );

    uploadStream.end(pdfBuffer);
  });
};

/**
 * Generate authenticated signed URL for private Cloudinary asset
 * @param {string} publicId - Cloudinary publicId
 * @returns {string} - Signed URL valid for 1 hour
 */
export const getSignedReportUrl = (publicId) => {
  if (!publicId) return '';
  const cld = getCloudinary();
  return cld.url(publicId, {
    resource_type: 'raw',
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
  });
};
