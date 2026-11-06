import React, { useState } from 'react';
import { Plus, Minus, Sparkles, Clock, AlertCircle } from 'lucide-react';

const FoodCard = ({ item, quantity = 0, onAdd, onChangeQty, onOpenDetail }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const rawImageUrl = item?.image?.url || (typeof item?.image === 'string' ? item.image : '') || '';

  // Cloudinary image delivery optimization (WebP/AVIF, auto quality, scaled to 400px)
  const imageUrl = React.useMemo(() => {
    if (!rawImageUrl || typeof rawImageUrl !== 'string') return '';
    if (rawImageUrl.includes('res.cloudinary.com') && rawImageUrl.includes('/upload/') && !rawImageUrl.includes('/upload/f_')) {
      return rawImageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_400,c_limit/');
    }
    return rawImageUrl;
  }, [rawImageUrl]);

  const isAvailable = item?.available !== false;
  const isFeatured = Boolean(item?.featured);

  return (
    <div
      className={`group relative bg-white border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col ${
        !isAvailable ? 'opacity-75' : ''
      }`}
    >
      {/* 4:3 Image Container with Hover Zoom */}
      <div 
        onClick={() => onOpenDetail && onOpenDetail(item)}
        className="relative w-full aspect-[4/3] bg-cream overflow-hidden cursor-pointer select-none"
      >
        {/* Skeleton loader while image is loading */}
        {!imageLoaded && !imageError && imageUrl && (
          <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
        )}

        {/* Real Food Photography Image */}
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={item.name}
            width="400"
            height="300"
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-108 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          /* Graceful Fallback Container */
          <div 
            className="w-full h-full flex flex-col items-center justify-center p-4 text-center transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundColor: item.backgroundColor || '#fff8eb' }}
          >
            <span className="text-5xl md:text-6xl mb-1 drop-shadow-sm">{item.emoji || '🍛'}</span>
            <span className="text-[10px] uppercase font-bold text-muted tracking-wider">
              {imageError ? '🍽️ Image Unavailable' : '🍛 Fresh Canteen Prep'}
            </span>
          </div>
        )}

        {/* Gradient Overlay for Top Badges Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none opacity-80 group-hover:opacity-90 transition-opacity" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
          {/* Featured Badge */}
          {isFeatured ? (
            <span className="inline-flex items-center gap-1 bg-amber text-primary-darker px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur-sm">
              <Sparkles className="w-3 h-3 fill-primary-darker" /> Featured
            </span>
          ) : (
            <span />
          )}

          {/* Availability Status Badge */}
          {isAvailable ? (
            <span className="inline-flex items-center gap-1 bg-green-500/90 text-white px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-md backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Available
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-red-600 text-white px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-md">
              <AlertCircle className="w-3 h-3" /> Sold Out
            </span>
          )}
        </div>

        {/* Category Pill Over Image Bottom */}
        <div className="absolute bottom-2.5 left-2.5 pointer-events-none">
          <span className="bg-white/95 text-primary-dark font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm backdrop-blur-md">
            {item.category?.name || 'Canteen Special'}
          </span>
        </div>
      </div>

      {/* Card Body Details */}
      <div className="p-4 md:p-5 flex flex-col flex-1">
        {/* Title */}
        <h3 
          onClick={() => onOpenDetail && onOpenDetail(item)}
          className="font-outfit font-black text-sm md:text-base text-primary-dark hover:text-primary mb-1 leading-snug cursor-pointer transition-colors line-clamp-1"
          title={item.name}
        >
          {item.name}
        </h3>

        {/* Description */}
        <p className="text-muted text-[11px] md:text-xs leading-relaxed mb-4 flex-1 line-clamp-2">
          {item.description || 'Authentic traditional recipe prepared fresh everyday at DRS College Canteen.'}
        </p>

        {/* Price & Prep Time Row */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60 mt-auto">
          <div>
            <div className="flex items-center gap-1 text-[10px] text-muted font-bold mb-0.5">
              <Clock className="w-3 h-3 text-primary" />
              <span>{item.preparationTime || 10} mins</span>
            </div>
            <span className="font-outfit font-black text-lg md:text-xl text-primary-dark tracking-tight">
              ₹{item.price}
            </span>
          </div>

          {/* Action Button: Add or Quantity Incrementer */}
          {!isAvailable ? (
            <button
              disabled
              className="bg-gray-100 text-gray-400 cursor-not-allowed font-bold text-[11px] px-3.5 py-2 rounded-xl border border-gray-200"
            >
              Sold Out
            </button>
          ) : quantity > 0 ? (
            <div className="flex items-center bg-primary-light rounded-xl p-1 border border-primary/20 shadow-sm">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeQty(item._id, -1);
                }}
                className="w-7 h-7 bg-white hover:bg-primary hover:text-white text-primary-dark rounded-lg font-bold flex items-center justify-center transition-all shadow-sm active:scale-95"
                title="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-outfit font-black text-xs px-2.5 text-primary-dark select-none">
                {quantity}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeQty(item._id, 1);
                }}
                className="w-7 h-7 bg-white hover:bg-primary hover:text-white text-primary-dark rounded-lg font-bold flex items-center justify-center transition-all shadow-sm active:scale-95"
                title="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdd(item);
              }}
              className="group-hover:bg-primary bg-primary-dark text-white font-bold text-xs px-4 py-2 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-1 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodCard;
