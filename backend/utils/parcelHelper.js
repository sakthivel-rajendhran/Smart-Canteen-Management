import CanteenSettings from '../models/CanteenSettings.js';
import { cache } from './cache.js';

/**
 * Fetches or initializes the singleton CanteenSettings document and resolves
 * validated parcel configuration (parcelEnabled + non-negative parcelChargePerItem).
 */
export const getOrCreateParcelSettings = async () => {
  const cached = cache.get('settings:parcel');
  if (cached) {
    return cached;
  }

  let settings = await CanteenSettings.findOne({ key: 'default' }).lean();
  if (!settings) {
    settings = await CanteenSettings.create({ key: 'default' });
    if (settings.toObject) settings = settings.toObject();
  }

  const parcelEnabled = settings.parcelEnabled !== false;
  const rawCharge = settings.parcelChargePerItem;
  const parsedCharge = Number(rawCharge);
  const parcelChargePerItem =
    rawCharge !== undefined && rawCharge !== null && Number.isFinite(parsedCharge) && parsedCharge >= 0
      ? parsedCharge
      : 5;

  const result = {
    settings,
    parcelEnabled,
    parcelChargePerItem,
  };

  cache.set('settings:parcel', result, 45);
  return result;
};

/**
 * Category-based parcel eligibility rule:
 * Snacks are strictly Normal-only (ineligible even when global parcel service is ON).
 */
export const isCategoryParcelEligible = (cat) => {
  if (!cat) return true;
  const catName = typeof cat === 'object' ? String(cat.name || '').trim().toLowerCase() : String(cat).trim().toLowerCase();
  if (catName === 'snacks') return false;
  if (typeof cat === 'object' && cat.parcelEligible === false) return false;
  return true;
};

/**
 * Determines whether a menu item can be ordered as PARCEL:
 * 1. Admin switch: parcelEligible or parcelEnabled must be explicitly true.
 * 2. Category rule: Snacks are strictly Normal-only (never parcel eligible).
 */
export const isItemParcelEligible = (menuItem) => {
  if (!menuItem) return false;

  // Individual item parcel switch must be explicitly enabled
  const isEnabled = menuItem.parcelEligible === true || menuItem.parcelEnabled === true;
  if (!isEnabled) return false;

  // Category restriction: Snacks can NEVER be parcel eligible
  const assignedCats = [
    menuItem.category,
    ...(Array.isArray(menuItem.categories) ? menuItem.categories : []),
  ].filter(Boolean);

  const hasSnacks = assignedCats.some((cat) => !isCategoryParcelEligible(cat));
  if (hasSnacks) return false;

  return true;
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
    const err = new Error(`Parcel service is not available for ${label}.`);
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

