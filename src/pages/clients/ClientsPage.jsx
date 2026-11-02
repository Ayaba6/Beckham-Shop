import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Eye,
  CheckCircle2,
  RefreshCw,
  Receipt,
  Wrench
} from 'lucide-react';
import { supabase } from '../../config/supabaseClient';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { REPAIR_STATUSES } from '../../utils/constants';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

const emptyForm = { full_name: '', phone: '' };

export default function ClientsPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Ajout / modification
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null); // null = Ajout, objet = Modification
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Fiche client (historique)
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSales, setCustomerSales] = useState([]);
  const [customerRepairs, setCustomerRepairs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Charger les clients avec le total de leurs achats
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('*')
        .order('full_name');

      if (custError) throw custError;

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('customer_id, total_amount')
        .not('customer_id', 'is', null);

      if (salesError) throw salesError;

      // Agréger le nombre et le montant des achats par client
      const stats = {};
      (salesData || []).forEach((sale) => {
        if (!stats[sale.customer_id]) stats[sale.customer_id] = { count: 0, total: 0 };
        stats[sale.customer_id].count += 1;
        stats[sale.customer_id].total += Number(sale.total_amount) || 0;
      });

      setCustomers(
        (custData || []).map((c) => ({
          ...c,
          salesCount: stats[c.id]?.count || 0,
          salesTotal: stats[c.id]?.total || 0,
        }))
      );
    } catch (err) {
      console.error('Erreur chargement clients:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({ full_name: customer.full_name || '', phone: customer.phone || '' });
    setIsFormOpen(true);
  };

  // Soumission du formulaire (Ajout ou Modification)
  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      full_name: formData.full_name.trim(),
      phone: formData.phone.trim() || null,
    };

    // Le téléphone sert d'identifiant client en caisse et au SAV : éviter les doublons
    if (payload.phone) {
      const duplicate = customers.find(
        (c) => c.phone === payload.phone && c.id !== editingCustomer?.id
      );
      if (duplicate) {
        alert(`Ce numéro est déjà attribué à ${duplicate.full_name || 'un autre client'}.`);
        return;
      }
    }

    setSaving(true);
    try {
      const query = editingCustomer
        ? supabase.from('customers').update(payload).eq('id', editingCustomer.id)
        : supabase.from('customers').insert([payload]);

      const { error } = await query;
      if (error) throw error;

      setIsFormOpen(false);
      showSuccess(editingCustomer ? 'Client modifié avec succès !' : 'Client ajouté avec succès !');
      fetchCustomers();
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Ouvrir la fiche client avec ses achats et ses réparations
  const handleOpenHistory = async (customer) => {
    setSelectedCustomer(customer);
    setCustomerSales([]);
    setCustomerRepairs([]);
    setHistoryLoading(true);
    try {
      const [salesRes, repairsRes] = await Promise.all([
        supabase
          .from('sales')
          .select('*')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('repairs')
          .select('*')
          .eq('customer_id', customer.id)
          .order('received_at', { ascending: false }),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (repairsRes.error) throw repairsRes.error;

      setCustomerSales(salesRes.data || []);
      setCustomerRepairs(repairsRes.data || []);
    } catch (err) {
      console.error('Erreur chargement historique client:', err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const query = searchQuery.toLowerCase();
  const filteredCustomers = customers.filter(
    (c) =>
      (c.full_name || '').toLowerCase().includes(query) ||
      (c.phone || '').includes(query)
  );

  const repairLabel = (status) =>
    REPAIR_STATUSES.find((s) => s.id === status)?.label || status;

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
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Clients</h1>
          <p className="text-sm text-gray-500">Répertoire des clients, historique d'achats et de réparations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCustomers}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <Button onClick={handleOpenAdd}>
            <Plus className="w-4 h-4" />
            Nouveau Client
          </Button>
        </div>
      </div>

      {/* BARRE DE RECHERCHE */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un client par nom ou téléphone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none text-sm focus:outline-none text-gray-800 placeholder-gray-400"
        />
      </div>

      {/* TABLEAU CLIENTS */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Téléphone</th>
                <th className="px-6 py-3">Achats</th>
                <th className="px-6 py-3">Total dépensé</th>
                <th className="px-6 py-3">Client depuis</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                    Chargement des clients...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                    Aucun client trouvé.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {(customer.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-900">{customer.full_name || 'Sans nom'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{customer.phone || '-'}</td>
                    <td className="px-6 py-4">
                      <Badge colorClass="bg-gray-100 text-gray-800">{customer.salesCount} vente(s)</Badge>
                    </td>
                    <td className="px-6 py-4 font-bold text-indigo-600">{formatCurrency(customer.salesTotal)}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {customer.created_at ? new Date(customer.created_at).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenHistory(customer)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Fiche
                        </button>
                        <button
                          onClick={() => handleOpenEdit(customer)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Modifier
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL : AJOUTER OU MODIFIER UN CLIENT */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingCustomer ? 'Modifier le client' : 'Ajouter un nouveau client'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
            <input
              type="text"
              required
              placeholder="Ex: Awa Ouédraogo"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              placeholder="Ex: 70 00 00 00"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button type="submit" isLoading={saving} className="w-full py-2.5 mt-2">
            {editingCustomer ? 'Mettre à jour le client' : 'Enregistrer le client'}
          </Button>
        </form>
      </Modal>

      {/* MODAL : FICHE CLIENT */}
      <Modal
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title={`Fiche client : ${selectedCustomer?.full_name || ''}`}
      >
        {selectedCustomer && (
          <div className="space-y-5">
            <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1.5 text-gray-600">
              <p><strong>Téléphone :</strong> {selectedCustomer.phone || 'Non renseigné'}</p>
              <p><strong>Nombre d'achats :</strong> {selectedCustomer.salesCount}</p>
              <p><strong>Total dépensé :</strong> <span className="text-indigo-600 font-semibold">{formatCurrency(selectedCustomer.salesTotal)}</span></p>
            </div>

            {historyLoading ? (
              <p className="text-center text-sm text-gray-400 py-4">Chargement de l'historique...</p>
            ) : (
              <>
                <div>
                  <h4 className="flex items-center gap-2 font-bold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-2">
                    <Receipt className="w-4 h-4 text-indigo-600" /> Achats ({customerSales.length})
                  </h4>
                  {customerSales.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucun achat enregistré.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {customerSales.map((sale) => (
                        <div key={sale.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-mono text-xs font-semibold text-gray-700">#{sale.id.slice(0, 8)}</p>
                            <p className="text-xs text-gray-500">{formatDate(sale.created_at)}</p>
                          </div>
                          <span className="font-bold text-gray-900">{formatCurrency(sale.total_amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="flex items-center gap-2 font-bold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-2">
                    <Wrench className="w-4 h-4 text-indigo-600" /> Réparations ({customerRepairs.length})
                  </h4>
                  {customerRepairs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucune réparation enregistrée.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {customerRepairs.map((repair) => (
                        <div key={repair.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{repair.device_name}</p>
                            <p className="text-xs text-gray-500">{formatDate(repair.received_at)} · {repairLabel(repair.status)}</p>
                          </div>
                          <span className="font-bold text-gray-900 shrink-0 ml-2">{formatCurrency(repair.estimated_cost)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
