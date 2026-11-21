import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Wrench,
  Receipt,
  Users,
  LogOut,
  HandCoins,
  PackagePlus,
  BarChart3,
  UserCog,
  X
} from 'lucide-react';
import { useAuth, ROLE_LABELS } from '../../context/AuthContext';

// adminOnly : visible uniquement par les administrateurs ; forSeller : visible aussi par le vendeur
const navigation = [
  { name: 'Tableau de bord', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Caisse (POS)', to: '/pos', icon: ShoppingCart },
  { name: 'Stock Accessoires', to: '/inventory', icon: Package, forSeller: true },
  { name: 'Réapprovisionnements', to: '/restocks', icon: PackagePlus, adminOnly: true },
  // Vente de téléphones masquée : la boutique se concentre sur les accessoires (page /phones conservée)
  { name: 'S.A.V & Réparations', to: '/sav', icon: Wrench, forSeller: true },
  { name: 'Historique Ventes', to: '/sales', icon: Receipt },
  { name: 'Statistiques', to: '/stats', icon: BarChart3, adminOnly: true },
  { name: 'Clients', to: '/clients', icon: Users },
  { name: 'Crédits Clients', to: '/credits', icon: HandCoins },
  { name: 'Utilisateurs', to: '/users', icon: UserCog, adminOnly: true },
];

export default function Sidebar({ isOpen = false, onClose }) {
  const { displayName, role, isAdmin, isSeller, signOut } = useAuth();
  const visibleNavigation = navigation.filter((item) =>
    isSeller ? item.forSeller : !item.adminOnly || isAdmin
  );

  return (
    <>
      {/* Fond sombre derrière le tiroir (mobile) */}
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col h-screen border-r border-slate-800 transform transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-800">
        <img src="/logo.png" alt="" className="w-12 h-10 object-contain bg-white rounded-lg p-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          {/* Menu mobile : le logo suffit, le nom reste lu par les lecteurs d'écran */}
          <h1 className="font-bold text-lg leading-tight sr-only lg:not-sr-only">BTNT Services</h1>
          <p className="text-xs text-slate-400">La passion de communiquer</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg lg:hidden"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleNavigation.map((item) => {
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
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{displayName}</p>
            <p className="text-xs text-slate-400 truncate">{ROLE_LABELS[role] || role}</p>
          </div>
          <button
            onClick={signOut}
            title="Se déconnecter"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
