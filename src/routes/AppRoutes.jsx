import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';

// Imports des pages réelles
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import PosPage from '../pages/pos/PosPage';
import ProductListPage from '../pages/inventory/ProductListPage';
import ImeiManagerPage from '../pages/inventory/ImeiManagerPage';
import StockEntriesPage from '../pages/inventory/StockEntriesPage';
import RepairsPage from '../pages/sav/RepairsPage';
import SalesHistoryPage from '../pages/sales/SalesHistoryPage';
import ClientsPage from '../pages/clients/ClientsPage';
import CreditsPage from '../pages/credits/CreditsPage';
import StatsPage from '../pages/stats/StatsPage';
import UsersPage from '../pages/users/UsersPage';

// Redirige vers /login si aucun utilisateur n'est connecté
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Chargement...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

// Réservé aux administrateurs : les vendeurs sont renvoyés au tableau de bord
function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/dashboard" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/inventory" element={<ProductListPage />} />
        <Route path="/restocks" element={<AdminRoute><StockEntriesPage /></AdminRoute>} />
        <Route path="/phones" element={<AdminRoute><ImeiManagerPage /></AdminRoute>} />
        <Route path="/sav" element={<RepairsPage />} />
        <Route path="/sales" element={<SalesHistoryPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/stats" element={<AdminRoute><StatsPage /></AdminRoute>} />
        <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
