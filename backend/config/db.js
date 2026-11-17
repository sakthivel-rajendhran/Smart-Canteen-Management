import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.set('strictQuery', true);

// Dynamically construct direct replica set fallback if SRV query is refused by Windows/ISP DNS
const getDirectReplicaFallback = (srvUri) => {
  if (!srvUri || !srvUri.startsWith('mongodb+srv://')) return null;
  try {
    const authMatch = srvUri.match(/mongodb\+srv:\/\/([^@]+)@/);
    if (authMatch && authMatch[1]) {
      const auth = authMatch[1];
      return `mongodb://${auth}@ac-ny7armi-shard-00-00.dtxbwwd.mongodb.net:27017,ac-ny7armi-shard-00-01.dtxbwwd.mongodb.net:27017,ac-ny7armi-shard-00-02.dtxbwwd.mongodb.net:27017/drs_quick_serve?ssl=true&replicaSet=atlas-s5kylv-shard-0&authSource=admin&retryWrites=true&w=majority`;
    }
  } catch (e) {}
  return null;
};

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : null;
  if (!primaryUri) {
    console.error('❌ MONGO_URI is not defined in environment variables!');
    process.exit(1);
  }

  const directFallback = getDirectReplicaFallback(primaryUri);
  const urisToTry = [primaryUri, directFallback].filter(Boolean);

  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts += 1;
    for (const uri of urisToTry) {
      try {
        const conn = await mongoose.connect(uri, {
          maxPoolSize: 15,
          serverSelectionTimeoutMS: 15000,
          socketTimeoutMS: 45000,
        });
        console.log(`MongoDB Database Connected: ${conn.connection.host}`);
        return conn;
      } catch (error) {
        console.warn(`[Attempt ${attempts}/${maxAttempts}] Connection failed: ${error.message}`);
      }
    }
    console.log(`Waiting 3s before retry ${attempts + 1}/${maxAttempts}...`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.error('❌ Fatal: All MongoDB connection attempts exhausted.');
  process.exit(1);
};

export default connectDB;
