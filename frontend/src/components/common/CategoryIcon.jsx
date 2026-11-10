import React, { useMemo } from 'react';
import { getCategoryIconSvg, validateAndCleanSvgClient, DEFAULT_CATEGORY_SVG } from '../../utils/categoryIcons';

/**
 * Renders a category's SVG icon safely and uniformly across all UI views.
 */
const CategoryIcon = ({ category, svg, className = 'w-5 h-5' }) => {
  const safeSvg = useMemo(() => {
    const raw = svg !== undefined ? svg : getCategoryIconSvg(category);
    if (!raw) return DEFAULT_CATEGORY_SVG;
    const checked = validateAndCleanSvgClient(raw);
    return checked.valid ? checked.svg : DEFAULT_CATEGORY_SVG;
  }, [category, svg]);

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full [&>svg]:block ${className}`}
      dangerouslySetInnerHTML={{ __html: safeSvg }}
    />
  );
};

export default CategoryIcon;
