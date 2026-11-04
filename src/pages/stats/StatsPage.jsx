import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useAccessoryStats, computeAccessoryStats, bucketRevenue } from '../../hooks/useAccessoryStats';
import { formatCurrency } from '../../utils/formatters';
import RevenueChart from '../../components/stats/RevenueChart';

const PERIODS = [
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: 'month', label: 'Ce mois' },
  { id: '90d', label: '90 jours' },
  { id: 'all', label: 'Tout' },
];

const SORTS = [
  { id: 'quantity', label: 'Quantité' },
  { id: 'revenue', label: "Chiffre d'affaires" },
  { id: 'margin', label: 'Marge' },
];

function periodStart(periodId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  switch (periodId) {
    case '7d':
      start.setDate(start.getDate() - 6);
      return start;
    case '30d':
      start.setDate(start.getDate() - 29);
      return start;
    case 'month':
      start.setDate(1);
      return start;
    case '90d':
      start.setDate(start.getDate() - 89);
      return start;
    default:
      return null;
  }
}

const percent = (rate) => `${Math.round(rate * 100)} %`;

function StatTile({ label, value, detail }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {detail && <p className="text-xs text-gray-500 mt-1">{detail}</p>}
    </div>
  );
}

export default function StatsPage() {
  const { products, loading: productsLoading, refreshProducts } = useProducts();
  const { sales, loading: salesLoading, error, fetchSales } = useAccessoryStats();

  const [period, setPeriod] = useState('30d');
  const [sortBy, setSortBy] = useState('quantity');
  const [showAllRanking, setShowAllRanking] = useState(false);

  // La date de début est figée au changement de période, la fin vaut "maintenant"
  const startDate = useMemo(() => periodStart(period), [period]);

  useEffect(() => {
    fetchSales(startDate, null);
  }, [fetchSales, startDate]);

  const handleRefresh = () => {
    fetchSales(startDate, null);
    refreshProducts();
  };

  const stats = useMemo(() => computeAccessoryStats(sales, products), [sales, products]);
  const { buckets, monthly } = useMemo(() => bucketRevenue(sales, startDate, null), [sales, startDate]);

  const ranking = [...stats.ranking].sort((a, b) => b[sortBy] - a[sortBy]);
  const visibleRanking = showAllRanking ? ranking : ranking.slice(0, 10);
  const loading = salesLoading || productsLoading;

  return (
    <div className="space-y-6">
      {/* EN-TÊTE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistiques Accessoires</h1>
          <p className="text-sm text-gray-500">Ventes, marges et stock qui ne tourne pas.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* FILTRE DE PÉRIODE */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Impossible de charger les ventes : {error}</span>
        </div>
      )}

      {/* INDICATEURS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Chiffre d'affaires"
          value={formatCurrency(stats.revenue)}
          detail={stats.discounts > 0 ? `dont ${formatCurrency(stats.discounts)} de réductions accordées` : null}
        />
        <StatTile
          label="Marge brute"
          value={formatCurrency(stats.grossMargin)}
          detail={`Taux de marge : ${percent(stats.marginRate)}`}
        />
        <StatTile label="Articles vendus" value={stats.unitsSold} detail={`${stats.salesCount} vente(s)`} />
        <StatTile label="Panier moyen" value={formatCurrency(stats.averageBasket)} />
      </div>

      {/* GRAPHIQUE */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Chiffre d'affaires par {monthly ? 'mois' : 'jour'}
        </h2>
        <p className="text-xs text-gray-500 mb-3">Survolez une barre pour voir le détail.</p>
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-16">Chargement...</p>
        ) : stats.salesCount === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16">Aucune vente sur cette période.</p>
        ) : (
          <RevenueChart buckets={buckets} monthly={monthly} />
        )}
      </div>

      {/* CLASSEMENT DES ACCESSOIRES */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Accessoires les plus vendus</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Trier par</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">#</th>
                <th className="px-6 py-3">Accessoire</th>
                <th className="px-6 py-3 text-right">Quantité</th>
                <th className="px-6 py-3 text-right">Chiffre d'affaires</th>
                <th className="px-6 py-3 text-right">Marge</th>
                <th className="px-6 py-3 text-right">Taux</th>
                <th className="px-6 py-3 text-right">Stock restant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {visibleRanking.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    {loading ? 'Chargement...' : 'Aucun accessoire vendu sur cette période.'}
                  </td>
                </tr>
              ) : (
                visibleRanking.map((p, index) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-gray-400">{index + 1}</td>
                    <td className="px-6 py-3">
                      <div className="font-semibold text-gray-900">{p.name}</div>
                      {p.brand && <div className="text-xs text-gray-400">{p.brand}</div>}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">{p.quantity}</td>
                    <td className="px-6 py-3 text-right text-gray-700">{formatCurrency(p.revenue)}</td>
                    <td className="px-6 py-3 text-right text-gray-700">{formatCurrency(p.margin)}</td>
                    <td className="px-6 py-3 text-right text-gray-500">{percent(p.marginRate)}</td>
                    <td className="px-6 py-3 text-right text-gray-500">{p.stock ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {ranking.length > 10 && (
          <div className="p-3 text-center border-t border-gray-100">
            <button
              onClick={() => setShowAllRanking(!showAllRanking)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              {showAllRanking ? 'Afficher le top 10' : `Afficher les ${ranking.length} accessoires`}
            </button>
          </div>
        )}
      </div>

      {/* STOCK DORMANT */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Accessoires sans vente sur la période</h2>
          <p className="text-xs text-gray-500">
            {stats.idleStock.length} accessoire(s) en stock, soit {formatCurrency(stats.idleValue)} d'achats immobilisés.
          </p>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Accessoire</th>
                <th className="px-6 py-3 text-right">En stock</th>
                <th className="px-6 py-3 text-right">Valeur d'achat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {stats.idleStock.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-gray-400">
                    {loading ? 'Chargement...' : 'Tous les accessoires en stock se sont vendus sur cette période.'}
                  </td>
                </tr>
              ) : (
                stats.idleStock.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="font-semibold text-gray-900">{p.name}</div>
                      {p.brand && <div className="text-xs text-gray-400">{p.brand}</div>}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-700">{p.stock}</td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatCurrency(p.value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-gray-500">
        <Info className="w-4 h-4 shrink-0" />
        La marge est calculée avec le prix d'achat actuel de chaque accessoire. Les ventes à crédit sont comptées
        pour leur montant total, même si elles ne sont pas encore entièrement payées.
      </p>
    </div>
  );
}
