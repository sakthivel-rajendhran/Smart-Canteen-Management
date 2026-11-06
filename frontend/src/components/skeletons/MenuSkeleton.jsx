import React from 'react';

export const MenuSkeleton = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white border border-border rounded-3xl overflow-hidden shadow-sm flex flex-col animate-pulse"
        >
          {/* Image placeholder */}
          <div className="w-full aspect-[4/3] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />

          {/* Card body */}
          <div className="p-4 md:p-5 flex flex-col flex-1 space-y-3">
            <div className="h-4 bg-gray-200 rounded-md w-3/4" />
            <div className="h-3 bg-gray-200 rounded-md w-full" />
            <div className="h-3 bg-gray-200 rounded-md w-2/3" />
            
            <div className="pt-3 flex items-center justify-between mt-auto">
              <div className="h-5 bg-gray-200 rounded-md w-16" />
              <div className="h-9 bg-gray-200 rounded-xl w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MenuSkeleton;

