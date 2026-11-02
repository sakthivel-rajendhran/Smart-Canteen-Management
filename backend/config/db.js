import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  // Ignore in environments where setting servers is restricted
}

const findMongoUri = () => {
  // 1. Direct standard keys
  if (process.env.MONGO_URI) return process.env.MONGO_URI.trim();
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI.trim();
  if (process.env.MONGO_URL) return process.env.MONGO_URL.trim();
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();

  // 2. Scan all environment variables for aliases, trimmed keys, or pasted connection strings
  for (const [key, val] of Object.entries(process.env)) {
    const cleanKey = key.trim().toUpperCase();
    if (cleanKey === 'MONGO_URI' || cleanKey === 'MONGODB_URI' || cleanKey === 'MONGO_URL') {
      if (val && typeof val === 'string') return val.trim();
    }
    // If user pasted "MONGO_URI=mongodb+srv://..." as the key name
    if (key.includes('mongodb+srv://') || key.includes('mongodb://')) {
      if (key.includes('=')) {
        return key.substring(key.indexOf('=') + 1).trim();
      }
      return key.trim();
    }
    // If any variable value contains a MongoDB URI
    if (typeof val === 'string' && (val.includes('mongodb+srv://') || val.includes('mongodb://'))) {
      return val.trim();
    }
  }

  return null;
};

const connectDB = async () => {
  try {
    const mongoUri = findMongoUri();
    if (!mongoUri) {
      const detectedKeys = Object.keys(process.env).filter(
        (k) => !k.startsWith('npm_') && !k.startsWith('PATH') && !k.startsWith('HOME') && !k.startsWith('HOSTNAME')
      );
      console.error('❌ MONGO_URI is not defined in environment variables!');
      console.error('Environment keys detected on Render:', detectedKeys);
      console.error('Please add MONGO_URI in your Render Dashboard -> Environment tab.');
      process.exit(1);
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Database Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
