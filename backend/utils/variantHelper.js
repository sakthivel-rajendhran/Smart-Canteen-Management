import mongoose from 'mongoose';

const buildHttpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

/**
 * Parse and validate an incoming variants array (JSON string or JS array) for MenuItem mutations.
 */
export const parseVariantsInput = (rawVariants, existingVariants = []) => {
  if (rawVariants === undefined || rawVariants === null) return undefined;

  let list = rawVariants;
  if (typeof rawVariants === 'string') {
    const trimmed = rawVariants.trim();
    if (!trimmed) return [];
    try {
      list = JSON.parse(trimmed);
    } catch {
      throw buildHttpError(400, 'Invalid variants format');
    }
  }

  if (!Array.isArray(list)) {
    throw buildHttpError(400, 'Variants must be an array');
  }

  const existingMap = new Map(
    (Array.isArray(existingVariants) ? existingVariants : []).map((v) => [String(v._id), v])
  );

  const normalized = [];
  const seenLabels = new Set();

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const label = String(entry.label || '').trim();
    if (!label) {
      throw buildHttpError(400, 'Each variant must have a package size or label');
    }

    const labelKey = label.toLowerCase();
    if (seenLabels.has(labelKey)) {
      throw buildHttpError(400, `Duplicate variant label "${label}" is not allowed`);
    }
    seenLabels.add(labelKey);

    const price = Number(entry.price);
    if (!Number.isFinite(price) || price < 0) {
      throw buildHttpError(400, `Variant "${label}" must have a valid non-negative price`);
    }

    const idCandidate = entry._id && mongoose.Types.ObjectId.isValid(String(entry._id))
      ? new mongoose.Types.ObjectId(String(entry._id))
      : new mongoose.Types.ObjectId();

    const prevVariant = existingMap.get(String(idCandidate));
    const rawImage = entry.image && typeof entry.image === 'object' ? entry.image : prevVariant?.image;
    const imageUrl =
      typeof entry.image === 'string'
        ? entry.image
        : rawImage?.url || prevVariant?.image?.url || '';
    const imagePublicId = rawImage?.publicId || prevVariant?.image?.publicId || '';

    const legacyMenuItemId =
      entry.legacyMenuItemId && mongoose.Types.ObjectId.isValid(String(entry.legacyMenuItemId))
        ? new mongoose.Types.ObjectId(String(entry.legacyMenuItemId))
        : prevVariant?.legacyMenuItemId || null;

    const prep = Number(entry.preparationTime);

    normalized.push({
      _id: idCandidate,
      label,
      price: Number(price.toFixed(2)),
      available: entry.available !== undefined ? Boolean(entry.available === true || entry.available === 'true') : true,
      preparationTime: Number.isFinite(prep) && prep >= 0 ? prep : (prevVariant?.preparationTime || 5),
      image: {
        url: imageUrl,
        publicId: imagePublicId,
      },
      legacyMenuItemId,
    });
  }

  return normalized;
};

/**
 * Resolve and validate variant selection + server-authoritative unit price for an order item.
 * Never trusts client-submitted prices or variant labels.
 */
export const resolveOrderVariantSelection = (
  dbItem,
  requestedVariantId = null,
  parentDoc = null
) => {
  const effectiveItem = dbItem?.variantParent && parentDoc ? parentDoc : dbItem;
  const effectiveRequestedVariantId =
    dbItem?.variantParent && !requestedVariantId ? dbItem._id : requestedVariantId;

  const variants = Array.isArray(effectiveItem?.variants) ? effectiveItem.variants : [];

  if (variants.length === 0) {
    return {
      parentItem: effectiveItem,
      variantId: null,
      variantLabel: '',
      unitFoodPrice: Number(effectiveItem.price),
      imageUrl:
        (effectiveItem.image && typeof effectiveItem.image === 'object'
          ? effectiveItem.image.url
          : effectiveItem.image) || '',
      displayName: effectiveItem.name,
    };
  }

  if (!effectiveRequestedVariantId) {
    throw buildHttpError(
      400,
      `Please select a pack size variant for "${effectiveItem.name}".`
    );
  }

  const reqStr = String(effectiveRequestedVariantId).trim();
  const matched = variants.find(
    (v) =>
      String(v._id) === reqStr ||
      (v.legacyMenuItemId && String(v.legacyMenuItemId) === reqStr)
  );

  if (!matched) {
    throw buildHttpError(
      400,
      `Selected variant is invalid for "${effectiveItem.name}". Please refresh the menu.`
    );
  }

  if (effectiveItem.available === false || matched.available === false) {
    throw buildHttpError(
      400,
      `"${effectiveItem.name} (${matched.label})" is currently sold out.`
    );
  }

  const fallbackImg =
    (effectiveItem.image && typeof effectiveItem.image === 'object'
      ? effectiveItem.image.url
      : effectiveItem.image) || '';

  return {
    parentItem: effectiveItem,
    variantId: matched._id,
    variantLabel: matched.label,
    unitFoodPrice: Number(matched.price),
    imageUrl: matched.image?.url || fallbackImg,
    displayName: effectiveItem.name,
  };
};

