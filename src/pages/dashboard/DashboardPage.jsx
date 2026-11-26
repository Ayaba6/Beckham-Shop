import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Package, 
  Wrench, 
  TrendingUp, 
  AlertTriangle,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../config/supabaseClient';
import { formatCurrency, formatDate, formatPaymentMethod } from '../../utils/formatters';
import { Link } from 'react-router-dom';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalSalesToday: 0,
    accessoriesLowStock: 0,
    accessoriesCount: 0,
    accessoriesUnits: 0,
    pendingRepairs: 0,
  });
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Charger les données du tableau de bord depuis Supabase
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [recent, today, stock, repairs] = await Promise.all([
        // 5 dernières ventes, avec leurs articles en une seule requête
        supabase
          .from('sales')
          .select('*, customers (full_name, phone), sale_items (product_id, products (name))')
          .order('created_at', { ascending: false })
          .limit(5),
        // Toutes les ventes du jour (et pas seulement les 5 dernières) ; les dettes ne sont pas du CA
        supabase
          .from('sales')
          .select('total_amount, sale_type')
          .gte('created_at', todayStart.toISOString()),
        // Accessoires en vente, pour compter ceux sous leur seuil d'alerte
        supabase
          .from('products')
          .select('stock_quantity, min_stock_alert')
          .eq('is_serialized', false)
          .eq('archived', false),
        supabase
          .from('repairs')
          .select('*', { count: 'exact', head: true })
          .in('status', ['received', 'in_progress', 'waiting_parts']),
      ]);

      const failed = [recent, today, stock, repairs].find((r) => r.error);
      if (failed) throw failed.error;

      setRecentSales(recent.data || []);
      setStats({
        totalSalesToday: (today.data || [])
          .filter((sale) => sale.sale_type !== 'debt')
          .reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0),
        accessoriesLowStock: (stock.data || []).filter((p) => p.stock_quantity <= p.min_stock_alert).length,
        accessoriesCount: (stock.data || []).length,
        accessoriesUnits: (stock.data || []).reduce((sum, p) => sum + Number(p.stock_quantity || 0), 0),
        pendingRepairs: repairs.count || 0,
      });
    } catch (err) {
      console.error('Erreur chargement dashboard:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500">Bienvenue chez BTNT Services. Voici l'état de votre boutique.</p>
        </div>
        <Button onClick={fetchDashboardData} variant="secondary" className="self-start">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Cartes de Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* CA du jour */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Chiffre d'affaires (Jour)</p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalSalesToday)}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total des accessoires */}
        <Link
          to="/inventory"
          className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:border-indigo-300 hover:shadow transition"
        >
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Accessoires</p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.accessoriesCount} articles</h3>
            <p className="text-xs text-gray-500">{stats.accessoriesUnits} unités en stock</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
        </Link>

        {/* Accessoires stock bas : ouvre le stock filtré sur les articles à réapprovisionner */}
        <Link
          to="/inventory?filtre=alerte"
          className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:border-amber-300 hover:shadow transition"
        >
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Alertes Stock Accessoires</p>
            <h3 className="text-xl font-bold text-amber-600 mt-1">{stats.accessoriesLowStock} articles</h3>
            <p className="text-xs text-amber-700">Voir les articles à réapprovisionner</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </Link>

        {/* Appareils en SAV */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Réparations en cours</p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.pendingRepairs} appareils</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Wrench className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Section des Ventes Récentes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Dernières Ventes Enregistrées</h3>
          <Link to="/sales" className="text-xs text-indigo-600 font-medium hover:underline">
            Voir tout l'historique
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Article(s) Vendu(s)</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Mode de Paiement</th>
                <th className="px-6 py-3">Montant Total</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                    Aucune vente enregistrée pour le moment.
                  </td>
                </tr>
              ) : (
                recentSales.map((sale) => {
                  const firstItem = sale.sale_items?.[0];
                  const productName = firstItem?.products?.name || 'Accessoire';
                  const extraCount = sale.sale_items?.length > 1 ? ` +${sale.sale_items.length - 1}` : '';

                  return (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {productName}
                        <span className="text-indigo-600 font-bold ml-1 text-xs">{extraCount}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {sale.customers ? sale.customers.full_name : 'Client comptoir'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatPaymentMethod(sale.payment_method)}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {formatCurrency(sale.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {formatDate(sale.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge colorClass="bg-green-100 text-green-800">
                          Validée
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}