import React from 'react';

export const OrderSkeleton = ({ count = 3 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white border border-border rounded-2xl p-6 shadow-sm animate-pulse space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
            <div className="h-7 bg-gray-200 rounded-full w-20" />
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>

          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-8 bg-gray-200 rounded-lg w-28" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrderSkeleton;
