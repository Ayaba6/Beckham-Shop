import React from 'react';
import { Search, Bell, ShoppingCart, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Navbar({ onMenuClick }) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        {/* Bouton menu (mobile et tablette) */}
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-bold text-gray-900 sm:hidden">ShopManager</span>

        <div className="relative hidden sm:block w-64 md:w-80 lg:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher IMEI, téléphone, client, produit..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <Link
          to="/pos"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Caisse</span>
        </Link>

        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
      </div>
    </header>
  );
}
