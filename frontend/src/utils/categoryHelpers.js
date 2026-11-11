/**
 * Shared helpers for food items supporting single primary category (`item.category`)
 * plus optional multi-category assignment (`item.categories`).
 */

export const getItemCategories = (item) => {
  if (!item) return [];
  const raw = [
    item.category,
    ...(Array.isArray(item.categories) ? item.categories : []),
  ].filter(Boolean);

  const seen = new Set();
  const result = [];
  for (const cat of raw) {
    const id = typeof cat === 'object' ? String(cat._id || '') : String(cat);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (typeof cat === 'object') {
      result.push(cat);
    } else {
      result.push({ _id: id, name: '', active: true });
    }
  }
  return result;
};

export const getItemActiveCategories = (item) =>
  getItemCategories(item).filter((cat) => cat.active !== false);

export const itemHasActiveCategory = (item) => getItemActiveCategories(item).length > 0;

export const itemMatchesCategory = (item, selectedCategoryId) => {
  if (!selectedCategoryId || selectedCategoryId === 'all' || selectedCategoryId === 'ALL') {
    return true;
  }
  return getItemCategories(item).some(
    (cat) => String(cat._id) === String(selectedCategoryId) || cat.name === selectedCategoryId
  );
};

export const itemMatchesCategorySearch = (item, queryLower) => {
  if (!queryLower) return false;
  return getItemCategories(item).some(
    (cat) => cat.name && cat.name.toLowerCase().includes(queryLower)
  );
};

export const isCategoryParcelEligible = (cat) => {
  if (!cat) return true;
  const name = typeof cat === 'object' ? String(cat.name || '').trim().toLowerCase() : '';
  if (name === 'snacks') return false;
  if (typeof cat === 'object' && cat.parcelEligible === false) return false;
  return true;
};

export const isItemParcelEligible = (item) => {
  if (!item) return false;
  const cats = getItemCategories(item);
  if (cats.length === 0) return true;
  return cats.every((cat) => isCategoryParcelEligible(cat));
};

export const syncItemCategoryUpdate = (item, updatedCat) => {
  if (!item || !updatedCat?._id) return item;
  const catId = String(updatedCat._id);
  const patchCat = (catObj) => {
    if (!catObj) return catObj;
    const objId = typeof catObj === 'object' ? String(catObj._id || '') : String(catObj);
    if (objId !== catId) return catObj;
    return {
      ...(typeof catObj === 'object' ? catObj : { _id: catObj }),
      name: updatedCat.name,
      active: updatedCat.active,
    };
  };

  return {
    ...item,
    category: patchCat(item.category),
    categories: Array.isArray(item.categories) ? item.categories.map(patchCat) : item.categories,
  };
};
