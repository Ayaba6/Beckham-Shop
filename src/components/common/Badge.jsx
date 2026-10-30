import React from 'react';

export default function Badge({ children, colorClass = 'bg-gray-100 text-gray-800' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {children}
    </span>
  );
}