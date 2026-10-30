import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Wrench, 
  Receipt, 
  Users, 
  Smartphone
} from 'lucide-react';

const navigation = [
  { name: 'Tableau de bord', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Caisse (POS)', to: '/pos', icon: ShoppingCart },
  { name: 'Stock Accessoires', to: '/inventory', icon: Package },
  { name: 'S.A.V & Réparations', to: '/sav', icon: Wrench },
  { name: 'Historique Ventes', to: '/sales', icon: Receipt },
  { name: 'Clients', to: '/clients', icon: Users },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen sticky top-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-indigo-600 p-2 rounded-lg text-white">
          <Smartphone className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">ShopManager</h1>
          <p className="text-xs text-slate-400">Accessoires & Caisse</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Info / Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-200">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Admin Boutique</p>
            <p className="text-xs text-slate-400 truncate">Vendeur Principal</p>
          </div>
        </div>
      </div>
    </aside>
  );
}