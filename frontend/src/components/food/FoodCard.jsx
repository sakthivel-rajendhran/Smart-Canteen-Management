import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Minus, Sparkles, Clock, AlertCircle } from 'lucide-react';
import {
  getItemCategories,
  isItemParcelEligible,
  getItemVariants,
  getDefaultVariant,
} from '../../utils/categoryHelpers';

const FoodCard = ({
  item,
  quantity = 0,
  normalQty = 0,
  parcelQty = 0,
  getVariantQty = null,
  cartSummary = null,
  parcelEnabled = true,
  parcelChargePerItem = 5,
  onAdd,
  onChangeQty,
  onOpenDetail,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [serviceType, setServiceType] = useState('NORMAL');

  const variants = useMemo(() => getItemVariants(item), [item]);
  const hasVariants = variants.length > 0;
  const defaultVariant = useMemo(() => getDefaultVariant(item), [item]);
  const [selectedVariantId, setSelectedVariantId] = useState(() =>
    defaultVariant?._id ? String(defaultVariant._id) : null
  );

  useEffect(() => {
    if (!hasVariants) {
      setSelectedVariantId(null);
      return;
    }
    const stillExists = variants.some((v) => String(v._id) === String(selectedVariantId));
    if (!stillExists) {
      setSelectedVariantId(defaultVariant?._id ? String(defaultVariant._id) : null);
    }
  }, [item?._id, hasVariants, variants, defaultVariant, selectedVariantId]);

  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    return (
      variants.find((v) => String(v._id) === String(selectedVariantId)) ||
      defaultVariant ||
      variants[0]
    );
  }, [hasVariants, variants, selectedVariantId, defaultVariant]);

  const itemParcelEligible = isItemParcelEligible(item);
  const canSelectParcel = parcelEnabled && itemParcelEligible;
  const effectiveServiceType = canSelectParcel ? serviceType : 'NORMAL';

  const variantIdArg = hasVariants ? String(selectedVariant?._id || '') : null;
  const activeNormalQty = getVariantQty
    ? getVariantQty('NORMAL', variantIdArg)
    : normalQty;
  const activeParcelQty = getVariantQty
    ? getVariantQty('PARCEL', variantIdArg)
    : parcelQty;
  const activeQty =
    effectiveServiceType === 'PARCEL'
      ? activeParcelQty
      : canSelectParcel
        ? activeNormalQty
        : activeNormalQty || (hasVariants ? 0 : quantity);

  const rawVariantUrl =
    selectedVariant?.image && typeof selectedVariant.image === 'object'
      ? selectedVariant.image.url
      : typeof selectedVariant?.image === 'string'
        ? selectedVariant.image
        : '';
  const rawParentUrl =
    item?.image?.url || (typeof item?.image === 'string' ? item.image : '') || '';
  const rawImageUrl = rawVariantUrl || rawParentUrl;

  // Cloudinary image delivery optimization (WebP/AVIF, auto quality, scaled to 400px)
  const imageUrl = useMemo(() => {
    if (!rawImageUrl || typeof rawImageUrl !== 'string') return '';
    if (rawImageUrl.includes('res.cloudinary.com') && rawImageUrl.includes('/upload/') && !rawImageUrl.includes('/upload/f_')) {
      return rawImageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_400,c_limit/');
    }
    return rawImageUrl;
  }, [rawImageUrl]);

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  const parentAvailable = item?.available !== false;
  const variantAvailable = selectedVariant ? selectedVariant.available !== false : true;
  const isAvailable = parentAvailable && variantAvailable;
  const displayPrice = selectedVariant ? Number(selectedVariant.price) : Number(item.price);
  const displayPrepTime =
    (selectedVariant?.preparationTime && Number(selectedVariant.preparationTime)) ||
    item.preparationTime ||
    10;
  const isFeatured = Boolean(item?.featured);

  return (
    <div
      className={`group relative bg-white border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col w-full min-w-0 ${
        !isAvailable ? 'opacity-75' : ''
      }`}
    >
      {/* 4:3 Image Container with Hover Zoom */}
      <div 
        onClick={() => onOpenDetail && onOpenDetail(item, selectedVariant?._id || null)}
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
            alt={selectedVariant ? `${item.name} ${selectedVariant.label}` : item.name}
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
            {getItemCategories(item)
              .map((c) => c.name)
              .filter(Boolean)
              .join(' · ') || item.category?.name || 'Canteen Special'}
          </span>
        </div>
      </div>

      {/* Card Body Details */}
      <div className="p-4 md:p-5 flex flex-col flex-1 min-w-0">
        {/* Title */}
        <h3 
          onClick={() => onOpenDetail && onOpenDetail(item, selectedVariant?._id || null)}
          className="font-outfit font-black text-sm md:text-base text-primary-dark hover:text-primary mb-1 leading-snug break-words cursor-pointer transition-colors"
          title={item.name}
        >
          {item.name}
        </h3>

        {/* Description */}
        <p className="text-muted text-[11px] md:text-xs leading-relaxed break-words mb-3 flex-1">
          {item.description || 'Authentic traditional recipe prepared fresh everyday at DRS College Canteen.'}
        </p>

        {/* Pack Size / Variant Selector (Clean text buttons, no emojis) */}
        {hasVariants && (
          <div onClick={(e) => e.stopPropagation()} className="mb-2.5">
            <div className="flex flex-wrap gap-1.5">
              {variants.map((variant) => {
                const isSelected = String(variant._id) === String(selectedVariant?._id);
                const variantSoldOut = variant.available === false;
                return (
                  <button
                    key={variant._id}
                    type="button"
                    data-testid={`food-variant-${item._id}-${variant._id}`}
                    onClick={() => setSelectedVariantId(String(variant._id))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-primary-dark text-white border-primary-dark shadow-xs'
                        : variantSoldOut
                          ? 'bg-gray-50 text-gray-400 border-gray-200 line-through'
                          : 'bg-cream text-primary-dark border-border hover:border-primary/40 hover:bg-primary-light/40'
                    }`}
                  >
                    {variant.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Per-Item Normal / Parcel Option Selector (Shown ONLY for parcel-eligible items when enabled) */}
        {canSelectParcel && isAvailable && (
          <div onClick={(e) => e.stopPropagation()} className="mb-2.5">
            <div className="grid grid-cols-2 gap-1 bg-cream p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setServiceType('NORMAL')}
                data-testid={`food-service-normal-${item._id}`}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all text-center whitespace-nowrap ${
                  effectiveServiceType === 'NORMAL'
                    ? 'bg-primary-dark text-white shadow-xs'
                    : 'text-primary-dark/75 hover:text-primary-dark'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setServiceType('PARCEL')}
                data-testid={`food-service-parcel-${item._id}`}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all text-center whitespace-nowrap ${
                  effectiveServiceType === 'PARCEL'
                    ? 'bg-amber text-primary-darker shadow-xs font-black'
                    : 'text-primary-dark/75 hover:text-primary-dark'
                }`}
              >
                Parcel +₹{parcelChargePerItem}
              </button>
            </div>
            {(activeNormalQty > 0 || activeParcelQty > 0) && ((activeNormalQty > 0 && activeParcelQty > 0) || (effectiveServiceType === 'NORMAL' && activeParcelQty > 0) || (effectiveServiceType === 'PARCEL' && activeNormalQty > 0)) && (
              <div className="text-[10px] font-semibold text-primary-dark/80 mt-1 px-1 truncate">
                In tray: {activeNormalQty > 0 ? `${activeNormalQty} Normal` : ''}
                {activeNormalQty > 0 && activeParcelQty > 0 ? ' · ' : ''}
                {activeParcelQty > 0 ? `${activeParcelQty} Parcel` : ''}
              </div>
            )}
          </div>
        )}

        {hasVariants && cartSummary && (
          <div className="text-[10px] font-semibold text-primary-dark/80 mb-2 px-0.5 truncate">
            {cartSummary}
          </div>
        )}

        {/* Price & Prep Time Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/60 mt-auto min-w-0">
          <div className="min-w-0 shrink-0">
            <div className="flex items-center gap-1 text-[10px] text-muted font-bold mb-0.5">
              <Clock className="w-3 h-3 text-primary shrink-0" />
              <span>{displayPrepTime} mins</span>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span
                data-testid={`food-price-${item._id}`}
                className="font-outfit font-black text-lg md:text-xl text-primary-dark tracking-tight"
              >
                ₹{displayPrice}
              </span>
              {canSelectParcel && effectiveServiceType === 'PARCEL' && isAvailable && (
                <span className="text-[10px] font-bold text-amber-dark whitespace-nowrap">
                  +₹{parcelChargePerItem} parcel
                </span>
              )}
            </div>
          </div>

          {/* Action Button: Add or Quantity Incrementer */}
          <div className="shrink-0 ml-auto">
            {!isAvailable ? (
              <button
                disabled
                className="bg-gray-100 text-gray-400 cursor-not-allowed font-bold text-[11px] px-3.5 py-2 min-h-[36px] rounded-xl border border-gray-200 whitespace-nowrap"
              >
                Sold Out
              </button>
            ) : activeQty > 0 ? (
              <div className="inline-flex items-center bg-primary-light rounded-xl p-1 border border-primary/20 shadow-sm">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeQty(item._id, -1, effectiveServiceType, variantIdArg);
                  }}
                  className="w-7 h-7 bg-white hover:bg-primary hover:text-white text-primary-dark rounded-lg font-bold flex items-center justify-center transition-all shadow-sm active:scale-95"
                  title="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-outfit font-black text-xs px-2.5 text-primary-dark select-none">
                  {activeQty}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeQty(item._id, 1, effectiveServiceType, variantIdArg);
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
                  onAdd(item, effectiveServiceType, selectedVariant);
                }}
                data-testid={`food-add-${item._id}`}
                className="group-hover:bg-primary bg-primary-dark text-white font-bold text-xs px-4 py-2 min-h-[36px] rounded-xl transition-all duration-200 shadow-md hover:shadow-lg inline-flex items-center justify-center gap-1 active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodCard;
