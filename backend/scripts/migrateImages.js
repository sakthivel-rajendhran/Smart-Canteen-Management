import dotenv from 'dotenv';
import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

// Curated authentic food photography for all 21 Tamil canteen dishes
const FOOD_IMAGE_MAP = {
  'Full Meals (Saapadu)': {
    url: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
    description: 'Traditional Tamil Nadu thali meal served with steamed rice, piping hot sambar, rasam, kootu, poriyal, appalam, and pickle on banana leaf.',
  },
  'Sambar Rice': {
    url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
    description: 'Homestyle South Indian sambar rice cooked with aromatic spices, lentils, vegetables, and tempered with ghee.',
  },
  'Curd Rice (Thayir Sadam)': {
    url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=800&q=80',
    description: 'Creamy and soothing curd rice tempered with mustard seeds, curry leaves, green chillies, and ginger.',
  },
  'Lemon Rice (Elumichai Sadam)': {
    url: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=800&q=80',
    description: 'Tangy and aromatic yellow lemon rice tossed with crunchy roasted peanuts, mustard seeds, and turmeric.',
  },
  'Fried Rice': {
    url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
    description: 'Flavourful wok-tossed basmati rice with finely diced crisp garden vegetables and light Asian spices.',
  },
  'Rasam Rice': {
    url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
    description: 'Comforting crushed black pepper, garlic, and tomato rasam mixed with soft white rice.',
  },
  'Veg Biryani': {
    url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
    description: 'Fragrant long-grain basmati rice slow-cooked with fresh vegetables, mint leaves, and authentic Tamil spices.',
  },
  'Idli (2 pcs)': {
    url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
    description: 'Steaming soft, fluffy fermented rice and urad dal cakes served with coconut chutney and hot sambar.',
  },
  'Masala Dosa': {
    url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80',
    description: 'Crispy golden roasted rice and lentil crepe stuffed with spiced mashed potato masala, served with chutneys.',
  },
  'Medhu Vadai': {
    url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
    description: 'Crispy golden on the outside and soft inside urad dal doughnuts seasoned with peppercorns, ginger, and curry leaves.',
  },
  'Masala Vadai': {
    url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80',
    description: 'Crunchy deep-fried chana dal patties spiced with chopped onions, fennel seeds, and green chillies.',
  },
  'Pongal': {
    url: 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=800&q=80',
    description: 'Piping hot ven pongal made with rice, yellow moong dal, generous pure ghee, roasted cashews, cumin, and black pepper.',
  },
  'Bonda': {
    url: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=800&q=80',
    description: 'Crispy golden besan batter-coated spiced potato bondas fried to perfection, served with tangy mint chutney.',
  },
  'Bajji (Plate)': {
    url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80',
    description: 'Crispy, hot fritters of fresh plantain and onions dipped in spiced chickpea batter and fried golden.',
  },
  'Murukku (Pack)': {
    url: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=800&q=80',
    description: 'Traditional crunchy spiral Tamil savoury snack prepared from rice flour and sesame seeds.',
  },
  'Nannari Sherbet': {
    url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
    description: 'Ancient Ayurvedic cooling herbal beverage prepared from sarsaparilla root extract, fresh lime juice, and basil seeds.',
  },
  'Sugarcane Juice': {
    url: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=800&q=80',
    description: 'Freshly crushed sweet sugarcane juice infused with crushed ginger and tangy lemon, served chilled.',
  },
  'Tender Coconut (Elaneer)': {
    url: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=800&q=80',
    description: 'Pure, refreshing, and naturally electrolyte-packed tender coconut water directly from fresh green coconuts.',
  },
  'Buttermilk (Mor)': {
    url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80',
    description: 'Refreshing spiced churned yogurt drink flavoured with curry leaves, asafoetida, green chilli, and fresh ginger.',
  },
  'Rose Milk': {
    url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80',
    description: 'Delightfully chilled rich sweet milk infused with natural rose petal essence and sabja seeds.',
  },
  'Filter Coffee / Tea': {
    url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
    description: 'Authentic frothy South Indian degree filter coffee brewed from freshly roasted chicory beans and thick milk.',
  },
};

const runMigration = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/drs_quick_serve';
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected.`);

    const cloudinaryActive = isCloudinaryConfigured();
    console.log(`Cloudinary status: ${cloudinaryActive ? 'CONFIGURED (will upload to Cloudinary)' : 'FALLBACK MODE (using direct high-res CDN assets)'}`);

    const items = await MenuItem.find({}).populate('category');
    console.log(`Found ${items.length} existing menu items in database.`);

    let updatedCount = 0;

    for (const item of items) {
      const match = FOOD_IMAGE_MAP[item.name];
      if (!match) {
        console.log(`- Skipping "${item.name}": no mapped image found`);
        continue;
      }

      const catName = item.category?.name ? item.category.name.toLowerCase().trim() : 'general';
      let finalImageData = {
        url: match.url,
        publicId: '',
      };

      if (cloudinaryActive) {
        try {
          console.log(`Uploading "${item.name}" to Cloudinary folder drs-quick-serve/menu/${catName}...`);
          const uploadRes = await cloudinary.uploader.upload(match.url, {
            folder: `drs-quick-serve/menu/${catName}`,
            public_id: item.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            resource_type: 'image',
            overwrite: true,
            transformation: [
              { width: 800, height: 600, crop: 'fill', gravity: 'auto' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          });
          finalImageData = {
            url: uploadRes.secure_url || uploadRes.url,
            publicId: uploadRes.public_id,
          };
          console.log(`✓ Cloudinary upload success for "${item.name}": ${finalImageData.url}`);
        } catch (uploadErr) {
          console.warn(`! Cloudinary upload failed for "${item.name}", falling back to direct URL: ${uploadErr.message}`);
          finalImageData = {
            url: match.url,
            publicId: '',
          };
        }
      }

      // Preserve all existing item properties and assign image
      item.image = finalImageData;
      if (match.description && (!item.description || item.description.length < 15)) {
        item.description = match.description;
      }

      await item.save();
      updatedCount++;
      console.log(`✓ [${updatedCount}/${items.length}] Updated: "${item.name}" -> ${finalImageData.url}`);
    }

    console.log(`\n==============================================`);
    console.log(`Migration completed successfully!`);
    console.log(`Total items updated with attractive food images: ${updatedCount}/${items.length}`);
    console.log(`==============================================\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
};

runMigration();
