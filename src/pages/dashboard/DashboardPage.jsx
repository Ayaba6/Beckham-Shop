import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Smartphone, 
  Package, 
  Wrench, 
  TrendingUp, 
  AlertTriangle,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../config/supabaseClient';
import { formatCurrency, formatDate } from '../../utils/formatters';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalSalesToday: 0,
    phonesInStock: 0,
    accessoriesLowStock: 0,
    pendingRepairs: 0,
  });
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Charger les données du tableau de bord depuis Supabase
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Récupérer les ventes récentes avec les infos clients
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          customers (full_name, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (salesError) throw salesError;

      // 2. Pour chaque vente, récupérer les items et les noms des produits
      let enrichedSales = [];
      if (salesData) {
        enrichedSales = await Promise.all(
          salesData.map(async (sale) => {
            const { data: itemsData } = await supabase
              .from('sale_items')
              .select('*')
              .eq('sale_id', sale.id);

            let itemsWithProducts = [];
            if (itemsData) {
              itemsWithProducts = await Promise.all(
                itemsData.map(async (item) => {
                  let productInfo = null;
                  if (item.product_id) {
                    const { data: prodData } = await supabase
                      .from('products')
                      .select('name, brand')
                      .eq('id', item.product_id)
                      .maybeSingle();
                    productInfo = prodData;
                  }
                  return {
                    ...item,
                    products: productInfo
                  };
                })
              );
            }

            return {
              ...sale,
              sale_items: itemsWithProducts
            };
          })
        );
      }

      setRecentSales(enrichedSales);

      // 3. Compter les téléphones en stock (table product_imeis)
      const { count: phoneCount, error: phoneError } = await supabase
        .from('product_imeis')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_stock');

      if (phoneError) throw phoneError;

      // 4. Compter les réparations en cours (table repairs)
      const { count: repairCount, error: repairError } = await supabase
        .from('repairs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['received', 'in_progress', 'waiting_parts']);

      if (repairError) throw repairError;

      // 5. Calculer le CA du jour
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todaySales = salesData?.filter(
        (sale) => new Date(sale.created_at) >= todayStart && sale.sale_type !== 'debt'
      ) || [];
      
      const revenueToday = todaySales.reduce((acc, sale) => acc + Number(sale.total_amount), 0);

      setStats({
        totalSalesToday: revenueToday,
        phonesInStock: phoneCount || 0,
        accessoriesLowStock: 3, // Valeur indicative ou requête dynamique selon vos seuils
        pendingRepairs: repairCount || 0,
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
          <p className="text-sm text-gray-500">Bienvenue sur ShopManager. Voici l'état de votre boutique.</p>
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

        {/* Téléphones en stock */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphones en Stock</p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.phonesInStock} unités</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Smartphone className="w-6 h-6" />
          </div>
        </div>

        {/* Accessoires stock bas */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Alertes Stock Accessoires</p>
            <h3 className="text-xl font-bold text-amber-600 mt-1">{stats.accessoriesLowStock} articles</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

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
          <span className="text-xs text-indigo-600 font-medium hover:underline cursor-pointer">
            Voir tout l'historique
          </span>
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
                  const productBrand = firstItem?.products?.brand ? `(${firstItem.products.brand})` : '';
                  const extraCount = sale.sale_items?.length > 1 ? ` +${sale.sale_items.length - 1}` : '';

                  return (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {productName} {productBrand}
                        <span className="text-indigo-600 font-bold ml-1 text-xs">{extraCount}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {sale.customers ? sale.customers.full_name : 'Client comptoir'}
                      </td>
                      <td className="px-6 py-4 text-gray-600 capitalize">
                        {sale.payment_method.replace('_', ' ')}
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