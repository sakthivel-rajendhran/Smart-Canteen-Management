// Default crisp folder/tag SVG used when a category has no custom SVG icon saved yet
export const DEFAULT_CATEGORY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;

// Curated food & beverage SVG icon presets selectable in Admin Category Management
export const CATEGORY_ICON_PRESETS = [
  {
    id: 'bowl',
    label: 'Meals / Bowl',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m8 3 1 3"/><path d="m16 3-1 3"/><path d="M4 11h16a1 1 0 0 1 1 1 8 8 0 0 1-16 0 1 1 0 0 1 1-1Z"/><path d="M8 21h8"/><path d="M12 19v2"/></svg>`,
  },
  {
    id: 'utensils',
    label: 'Dining / Food',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  },
  {
    id: 'cup',
    label: 'Cool Drinks / Juice',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8"/><path d="M5 8h14"/><path d="M12 2v6"/><path d="m15 2-3 1"/></svg>`,
  },
  {
    id: 'coffee',
    label: 'Tea & Coffee',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg>`,
  },
  {
    id: 'snack',
    label: 'Fast Bites / Snacks',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/></svg>`,
  },
  {
    id: 'breakfast',
    label: 'Morning Specials',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  },
  {
    id: 'leaf',
    label: 'Veg & Healthy',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  },
  {
    id: 'flame',
    label: 'Hot & Spicy',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  },
  {
    id: 'sparkles',
    label: 'Chef Specials',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>`,
  },
  {
    id: 'folder',
    label: 'Default Folder',
    svg: DEFAULT_CATEGORY_SVG,
  },
];

/**
 * Validate and sanitize raw SVG markup on the client before previewing or sending to API.
 */
export const validateAndCleanSvgClient = (rawText) => {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return { valid: false, message: 'SVG content is empty.' };
  }

  if (rawText.length > 60000) {
    return { valid: false, message: 'SVG file is too large (max 60 KB).' };
  }

  let cleaned = rawText
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  const match = cleaned.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) {
    return { valid: false, message: 'Invalid SVG file: missing <svg>...</svg> markup.' };
  }

  cleaned = match[0];

  if (/<script[\s>]/i.test(cleaned) || /javascript\s*:/i.test(cleaned) || /data\s*:\s*text\/html/i.test(cleaned)) {
    return { valid: false, message: 'Security check failed: SVG cannot contain scripts.' };
  }

  cleaned = cleaned
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?(?:\/>|<\/embed>)/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  const openTagMatch = cleaned.match(/^<svg([^>]*)>/i);
  if (openTagMatch && !/\bviewBox\s*=/i.test(openTagMatch[1])) {
    const wMatch = openTagMatch[1].match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i);
    const hMatch = openTagMatch[1].match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i);
    if (wMatch && hMatch) {
      cleaned = cleaned.replace(/^<svg/i, `<svg viewBox="0 0 ${wMatch[1]} ${hMatch[1]}"`);
    }
  }

  return { valid: true, svg: cleaned };
};

export const getCategoryIconSvg = (categoryOrSvg) => {
  const raw = typeof categoryOrSvg === 'string' ? categoryOrSvg : categoryOrSvg?.icon;
  if (typeof raw === 'string' && raw.trim().toLowerCase().includes('<svg')) {
    return raw.trim();
  }
  return DEFAULT_CATEGORY_SVG;
};
