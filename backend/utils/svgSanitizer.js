/**
 * Validate and sanitize an SVG icon string before persisting in database.
 * Ensures safe rendering without XSS vectors (scripts, event handlers, foreignObjects, etc.).
 */
export const validateAndSanitizeSvg = (rawSvg) => {
  if (typeof rawSvg !== 'string') {
    return { valid: false, message: 'Category icon must be valid SVG markup.' };
  }

  const trimmed = rawSvg.trim();
  if (!trimmed) {
    return { valid: true, svg: '' };
  }

  if (trimmed.length > 60000) {
    return { valid: false, message: 'SVG icon is too large (maximum 60 KB allowed).' };
  }

  // Strip XML declaration, DOCTYPE, and HTML/XML comments before extracting <svg>...</svg>
  let cleaned = trimmed
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  const svgMatch = cleaned.match(/<svg[\s\S]*<\/svg>/i);
  if (!svgMatch) {
    return { valid: false, message: 'Invalid SVG file. Root <svg>...</svg> element is required.' };
  }

  cleaned = svgMatch[0];

  // Block dangerous script execution vectors explicitly
  if (/<script[\s>]/i.test(cleaned) || /javascript\s*:/i.test(cleaned) || /data\s*:\s*text\/html/i.test(cleaned)) {
    return { valid: false, message: 'SVG contains forbidden script or executable content.' };
  }

  // Remove unsafe container elements and inline event handlers
  cleaned = cleaned
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?(?:\/>|<\/embed>)/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Ensure viewBox exists if numeric width & height are provided so icon scales properly
  const openTagMatch = cleaned.match(/^<svg([^>]*)>/i);
  if (openTagMatch) {
    const attrs = openTagMatch[1];
    const hasViewBox = /\bviewBox\s*=/i.test(attrs);
    if (!hasViewBox) {
      const wMatch = attrs.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i);
      const hMatch = attrs.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i);
      if (wMatch && hMatch) {
        cleaned = cleaned.replace(/^<svg/i, `<svg viewBox="0 0 ${wMatch[1]} ${hMatch[1]}"`);
      }
    }
  }

  return { valid: true, svg: cleaned };
};

export const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
