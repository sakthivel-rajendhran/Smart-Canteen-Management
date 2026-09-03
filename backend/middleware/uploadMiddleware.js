import multer from 'multer';

// Memory storage keeps file in buffer for streaming directly to Cloudinary
const storage = multer.memoryStorage();

// File filter for image formats: JPG, JPEG, PNG, WEBP
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Please upload a JPG, JPEG, PNG, or WEBP image.'), false);
  }
};

// Multer upload instance with 5MB file limit
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB maximum size
  },
  fileFilter,
});

export default upload;
