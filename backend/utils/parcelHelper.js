import CanteenSettings from '../models/CanteenSettings.js';

/**
 * Fetches or initializes the singleton CanteenSettings document and resolves
 * validated parcel configuration (parcelEnabled + non-negative parcelChargePerItem).
 */
export const getOrCreateParcelSettings = async () => {
  let settings = await CanteenSettings.findOne({ key: 'default' });
  if (!settings) {
    settings = await CanteenSettings.create({ key: 'default' });
  }

  const parcelEnabled = settings.parcelEnabled !== false;
  const rawCharge = settings.parcelChargePerItem;
  const parsedCharge = Number(rawCharge);
  const parcelChargePerItem =
    rawCharge !== undefined && rawCharge !== null && Number.isFinite(parsedCharge) && parsedCharge >= 0
      ? parsedCharge
      : 5;

  return {
    settings,
    parcelEnabled,
    parcelChargePerItem,
  };
};

/**
 * Category-based parcel eligibility rule:
 * Snacks are strictly Normal-only (ineligible even when global parcel service is ON).
 */
export const isCategoryParcelEligible = (cat) => {
  if (!cat) return true;
  const catName = typeof cat === 'object' ? String(cat.name || '').trim().toLowerCase() : '';
  if (catName === 'snacks') return false;
  if (typeof cat === 'object' && cat.parcelEligible === false) return false;
  return true;
};

/**
 * Determines whether a menu item can be ordered as PARCEL based on its assigned categories.
 */
export const isItemParcelEligible = (menuItem) => {
  if (!menuItem) return false;
  const assignedCats = [
    menuItem.category,
    ...(Array.isArray(menuItem.categories) ? menuItem.categories : []),
  ].filter(Boolean);
  if (assignedCats.length === 0) return true;
  return assignedCats.every((cat) => isCategoryParcelEligible(cat));
};

/**
 * Computes authoritative server-side parcel and item totals for a single order line item.
 */
export const resolveItemParcelPricing = ({
  rawServiceType,
  quantity,
  unitFoodPrice,
  parcelEnabled,
  parcelChargePerItem,
  itemParcelEligible = true,
  itemName = '',
}) => {
  const normalizedType =
    rawServiceType === undefined || rawServiceType === null || rawServiceType === ''
      ? 'NORMAL'
      : String(rawServiceType).trim().toUpperCase();

  if (normalizedType !== 'NORMAL' && normalizedType !== 'PARCEL') {
    const err = new Error('Invalid serviceType. Must be NORMAL or PARCEL.');
    err.statusCode = 400;
    throw err;
  }

  if (normalizedType === 'PARCEL' && !parcelEnabled) {
    const err = new Error('Parcel option is currently disabled by the canteen admin.');
    err.statusCode = 400;
    throw err;
  }

  if (normalizedType === 'PARCEL' && !itemParcelEligible) {
    const label = itemName ? `"${itemName}"` : 'this item';
    const err = new Error(`Parcel option is not available for ${label} (Snacks are Normal-only).`);
    err.statusCode = 400;
    throw err;
  }

  const unitParcel = normalizedType === 'PARCEL' ? Number(parcelChargePerItem) : 0;
  const itemParcelTotal = Number((unitParcel * quantity).toFixed(2));
  const itemFoodTotal = Number((Number(unitFoodPrice) * quantity).toFixed(2));
  const itemSubtotal = Number((itemFoodTotal + itemParcelTotal).toFixed(2));

  return {
    serviceType: normalizedType,
    parcelChargePerUnit: unitParcel,
    parcelChargeTotal: itemParcelTotal,
    itemFoodTotal,
    itemSubtotal,
  };
};

