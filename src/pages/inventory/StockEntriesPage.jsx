import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  PackagePlus,
  AlertTriangle
} from 'lucide-react';
import { useStockEntries } from '../../hooks/useStockEntries';
import { useProducts } from '../../hooks/useProducts';
import { formatCurrency, formatDate } from '../../utils/formatters';
import Button from '../../components/common/Button';
import RestockModal from '../../components/inventory/RestockModal';

export default function StockEntriesPage() {
  const { entries, loading, error, fetchEntries } = useStockEntries();
  const { products, refreshProducts } = useProducts();

  const [searchQuery, setSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleRestockSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
    fetchEntries();
    refreshProducts();
  };

  const query = searchQuery.toLowerCase();
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      (entry.products?.name || '').toLowerCase().includes(query) ||
      (entry.products?.brand || '').toLowerCase().includes(query) ||
      (entry.supplier || '').toLowerCase().includes(query) ||
      (entry.notes || '').toLowerCase().includes(query);

    const entryDate = new Date(entry.created_at);
    let matchesDate = true;
    if (startDateFilter) {
      const start = new Date(startDateFilter);
      start.setHours(0, 0, 0, 0);
      if (entryDate < start) matchesDate = false;
    }
    if (endDateFilter) {
      const end = new Date(endDateFilter);
      end.setHours(23, 59, 59, 999);
      if (entryDate > end) matchesDate = false;
    }

    return matchesSearch && matchesDate;
  });

  const totalUnits = filteredEntries.reduce((sum, e) => sum + Number(e.quantity), 0);
  const totalCost = filteredEntries.reduce((sum, e) => sum + Number(e.quantity) * Number(e.unit_cost), 0);
  const accessories = products.filter((p) => !p.is_serialized);

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* EN-TÊTE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Réapprovisionnements</h1>
          <p className="text-sm text-gray-500">Historique des entrées de stock et coûts d'achat.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchEntries()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <Button onClick={() => setIsRestockOpen(true)}>
            <PackagePlus className="w-4 h-4" />
            Nouvelle entrée
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Impossible de charger l'historique ({error}). Vérifiez que la table stock_entries a bien été créée
            (fichier supabase/stock_entries.sql).
          </span>
        </div>
      )}

      {/* RÉSUMÉ DE LA PÉRIODE FILTRÉE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500">Entrées</p>
          <p className="text-2xl font-bold text-gray-900">{filteredEntries.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500">Unités reçues</p>
          <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500">Coût total des achats</p>
          <p className="text-2xl font-bold text-indigo-600">{formatCurrency(totalCost)}</p>
        </div>
      </div>

      {/* FILTRES */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par accessoire, fournisseur ou note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-sm focus:outline-none text-gray-800 placeholder-gray-400"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Du</span>
          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span>au</span>
          <input
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* TABLEAU */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Accessoire</th>
                <th className="px-6 py-3">Fournisseur</th>
                <th className="px-6 py-3">Quantité</th>
                <th className="px-6 py-3">Prix unitaire</th>
                <th className="px-6 py-3">Coût total</th>
                <th className="px-6 py-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    Chargement de l'historique...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    Aucune entrée de stock.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600 text-xs">{formatDate(entry.created_at)}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{entry.products?.name || 'Produit supprimé'}</div>
                      {entry.products?.brand && <div className="text-xs text-gray-400">{entry.products.brand}</div>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{entry.supplier || '-'}</td>
                    <td className="px-6 py-4 font-bold text-emerald-700">+{entry.quantity}</td>
                    <td className="px-6 py-4 text-gray-600">{formatCurrency(entry.unit_cost)}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(entry.quantity * entry.unit_cost)}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs max-w-xs truncate">{entry.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RestockModal
        isOpen={isRestockOpen}
        onClose={() => setIsRestockOpen(false)}
        products={accessories}
        onSuccess={handleRestockSuccess}
      />
    </div>
  );
}
