import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';

// Imports des pages réelles
import DashboardPage from '../pages/dashboard/DashboardPage';
import PosPage from '../pages/pos/PosPage';
import ProductListPage from '../pages/inventory/ProductListPage';
import RepairsPage from '../pages/sav/RepairsPage';
import SalesHistoryPage from '../pages/sales/SalesHistoryPage'; // Import de la vraie page

// Page secondaire temporaire pour les clients (en attendant sa création)
const Clients = () => (
  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
    <h1 className="text-2xl font-bold text-gray-800 mb-2">Gestion des Clients</h1>
    <p className="text-gray-500">Ici s'affichera le répertoire des clients et leur historique d'achats.</p>
  </div>
);

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/inventory" element={<ProductListPage />} />
        <Route path="/sav" element={<RepairsPage />} />
        <Route path="/sales" element={<SalesHistoryPage />} /> {/* Route pointant vers la vraie page */}
        <Route path="/clients" element={<Clients />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}