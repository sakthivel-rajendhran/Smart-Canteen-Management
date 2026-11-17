import React, { useState, useEffect } from 'react';
import { Wifi, Loader2 } from 'lucide-react';

const ColdStartBanner = () => {
  const [isWarming, setIsWarming] = useState(false);

  useEffect(() => {
    const handleWarming = (event) => {
      setIsWarming(Boolean(event.detail?.warming));
    };

    window.addEventListener('drs:server-warming', handleWarming);
    return () => {
      window.removeEventListener('drs:server-warming', handleWarming);
    };
  }, []);

  if (!isWarming) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-600 text-white text-xs font-semibold py-2 px-4 text-center sticky top-0 z-50 shadow-md flex items-center justify-center gap-2 transition-all duration-300 animate-fadeIn"
    >
      <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
      <span>Connecting to canteen server... (waking up, please wait a few seconds)</span>
    </div>
  );
};

export default ColdStartBanner;
