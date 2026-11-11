import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, Sparkles, Plus, Minus, ShoppingCart, CheckCircle, AlertCircle } from 'lucide-react';
import {
  getItemCategories,
  isItemParcelEligible,
  getItemVariants,
  getDefaultVariant,
} from '../../utils/categoryHelpers';

const FoodDetailModal = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
  initialQty = 1,
  initialVariantId = null,
  parcelEnabled = true,
  parcelChargePerItem = 5,
}) => {
  const [qty, setQty] = useState(initialQty > 0 ? initialQty : 1);
  const [serviceType, setServiceType] = useState('NORMAL');
  const [addedMessage, setAddedMessage] = useState(false);

  const variants = useMemo(() => getItemVariants(item), [item]);
  const hasVariants = variants.length > 0;
  const defaultVariant = useMemo(() => getDefaultVariant(item), [item]);
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  useEffect(() => {
    setQty(initialQty > 0 ? initialQty : 1);
    setServiceType('NORMAL');
    setAddedMessage(false);
    if (hasVariants) {
      const preferred =
        initialVariantId && variants.find((v) => String(v._id) === String(initialVariantId));
      const fallback = preferred || defaultVariant || variants[0];
      setSelectedVariantId(fallback?._id ? String(fallback._id) : null);
    } else {
      setSelectedVariantId(null);
    }
  }, [item?._id, isOpen, initialQty, initialVariantId, hasVariants, variants, defaultVariant]);

  if (!isOpen || !item) return null;

  const selectedVariant = hasVariants
    ? variants.find((v) => String(v._id) === String(selectedVariantId)) ||
      defaultVariant ||
      variants[0]
    : null;

  const variantImage =
    selectedVariant?.image && typeof selectedVariant.image === 'object'
      ? selectedVariant.image.url
      : typeof selectedVariant?.image === 'string'
        ? selectedVariant.image
        : '';
  const imageUrl =
    variantImage || item.image?.url || (typeof item.image === 'string' ? item.image : '') || '';
  const isAvailable =
    item.available !== false && (selectedVariant ? selectedVariant.available !== false : true);
  const unitPrice = selectedVariant ? Number(selectedVariant.price) : Number(item.price);
  const displayPrep =
    (selectedVariant?.preparationTime && Number(selectedVariant.preparationTime)) ||
    item.preparationTime ||
    10;
  const itemParcelEligible = isItemParcelEligible(item);
  const canSelectParcel = parcelEnabled && itemParcelEligible;
  const effectiveServiceType = canSelectParcel ? serviceType : 'NORMAL';
  const parcelPerUnit = effectiveServiceType === 'PARCEL' ? Number(parcelChargePerItem) : 0;
  const computedTotal = Number(((unitPrice + parcelPerUnit) * qty).toFixed(2));

  const handleAdd = () => {
    if (!isAvailable) return;
    onAddToCart(item, qty, effectiveServiceType, selectedVariant);
    setAddedMessage(true);
    setTimeout(() => {
      setAddedMessage(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-sm active:scale-95"
          title="Close details"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Image Container */}
        <div className="relative w-full aspect-[16/10] bg-cream overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div 
              className="w-full h-full flex flex-col items-center justify-center p-6"
              style={{ backgroundColor: item.backgroundColor || '#fff8eb' }}
            >
              <span className="text-7xl mb-2">{item.emoji || '🍛'}</span>
              <span className="text-xs font-bold text-muted uppercase">DRS Canteen Special</span>
            </div>
          )}

          {/* Badges Overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            {item.featured && (
              <span className="bg-amber text-primary-darker font-black text-[11px] px-3 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 fill-primary-darker" /> Featured
              </span>
            )}
            <span className="bg-white/90 backdrop-blur-md text-primary-dark font-bold text-[11px] px-3 py-1 rounded-full shadow-md">
              {getItemCategories(item)
                .map((c) => c.name)
                .filter(Boolean)
                .join(' · ') || item.category?.name || 'Canteen'}
            </span>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-md ${
              isAvailable ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {isAvailable ? '✓ In Stock & Fresh' : '✕ Currently Sold Out'}
            </span>
            <span className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber" /> Prep: {displayPrep} min
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h2 className="font-outfit font-black text-2xl text-primary-dark leading-snug">
                {item.name}{selectedVariant ? ` (${selectedVariant.label})` : ''}
              </h2>
              <span className="text-xs text-primary font-bold">
                Authentic DRS Canteen Recipe
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted font-extrabold uppercase tracking-wider block">Price</span>
              <span className="font-outfit font-black text-2xl text-primary-dark">
                ₹{unitPrice}
              </span>
            </div>
          </div>

          <p className="text-muted text-sm leading-relaxed mb-6 border-b border-border pb-4">
            {item.description || 'Prepared fresh daily with traditional South Indian spices and highest hygiene standards.'}
          </p>

          {/* Pack Size / Variant Selector */}
          {hasVariants && (
            <div className="mb-4">
              <span className="font-outfit font-bold text-xs uppercase tracking-wider text-muted block mb-2">
                Select Pack Size
              </span>
              <div className="flex flex-wrap gap-2">
                {variants.map((variant) => {
                  const isSelected = String(variant._id) === String(selectedVariant?._id);
                  const variantSoldOut = variant.available === false;
                  return (
                    <button
                      key={variant._id}
                      type="button"
                      onClick={() => setSelectedVariantId(String(variant._id))}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary-dark text-white border-primary-dark shadow-sm'
                          : variantSoldOut
                            ? 'bg-gray-50 text-gray-400 border-gray-200 line-through'
                            : 'bg-cream text-primary-dark border-border hover:border-primary/40'
                      }`}
                    >
                      {variant.label} · ₹{variant.price}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Service Type Selector (Shown ONLY for parcel-eligible categories when enabled) */}
          {isAvailable && canSelectParcel && (
            <div className="mb-4">
              <span className="font-outfit font-bold text-xs uppercase tracking-wider text-muted block mb-2">
                Serving Option
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setServiceType('NORMAL')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    effectiveServiceType === 'NORMAL'
                      ? 'bg-primary-dark text-white border-primary-dark shadow-md'
                      : 'bg-cream/60 text-primary-dark border-border hover:border-primary/40'
                  }`}
                >
                  <div className="font-outfit font-bold text-sm">Normal</div>
                  <div className={`text-[11px] ${effectiveServiceType === 'NORMAL' ? 'text-white/75' : 'text-muted'}`}>
                    Dine / Counter (₹0 extra)
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setServiceType('PARCEL')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    effectiveServiceType === 'PARCEL'
                      ? 'bg-amber text-primary-darker border-amber shadow-md'
                      : 'bg-cream/60 text-primary-dark border-border hover:border-amber/60'
                  }`}
                >
                  <div className="font-outfit font-black text-sm">
                    Parcel (+₹{parcelChargePerItem}/item)
                  </div>
                  <div className={`text-[11px] ${effectiveServiceType === 'PARCEL' ? 'text-primary-darker/80 font-semibold' : 'text-muted'}`}>
                    Packed to go (+₹{Number(parcelChargePerItem) * qty} total)
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          {isAvailable && (
            <div className="flex items-center justify-between py-3 mb-6 bg-cream/70 rounded-2xl px-4 border border-border/60">
              <span className="font-outfit font-bold text-sm text-primary-dark">Select Quantity:</span>
              <div className="flex items-center bg-white rounded-xl border border-border p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 hover:bg-primary hover:text-white rounded-lg font-bold flex items-center justify-center transition-all text-primary-dark"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-outfit font-black text-sm px-4 text-primary-dark min-w-[36px] text-center">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((prev) => prev + 1)}
                  className="w-8 h-8 hover:bg-primary hover:text-white rounded-lg font-bold flex items-center justify-center transition-all text-primary-dark"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="mt-auto">
            {addedMessage ? (
              <div className="w-full bg-green-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg">
                <CheckCircle className="w-5 h-5" /> Added to your Tray!
              </div>
            ) : !isAvailable ? (
              <button
                disabled
                className="w-full bg-gray-200 text-gray-400 font-bold py-3.5 rounded-2xl cursor-not-allowed flex items-center justify-center gap-2"
              >
                <AlertCircle className="w-5 h-5" /> Sold Out
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                className="w-full bg-primary-dark hover:bg-primary text-white font-outfit font-black text-base py-3.5 rounded-2xl transition-all shadow-xl shadow-primary-dark/20 flex items-center justify-center gap-2 active:scale-98"
              >
                <ShoppingCart className="w-5 h-5" /> Add {qty} ({effectiveServiceType === 'PARCEL' ? 'Parcel' : 'Normal'}) • ₹{computedTotal}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodDetailModal;
