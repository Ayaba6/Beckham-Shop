import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Phone,
  User,
  Smartphone,
  ShieldCheck
} from 'lucide-react';
import { generateWarrantyPdf } from '../../components/pdf/WarrantyPdf';
import { useRepairs } from '../../hooks/useRepairs';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { REPAIR_STATUSES } from '../../utils/constants';
import { supabase } from '../../config/supabaseClient';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

export default function RepairsPage() {
  const { repairs, loading, fetchRepairs, addRepair, updateRepairStatus } = useRepairs();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Formulaire de prise en charge SAV
  const [newRepair, setNewRepair] = useState({
    customer_name: '',
    customer_phone: '',
    device_name: '',
    imei_or_serial: '',
    issue_description: '',
    estimated_cost: '',
  });

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  // Enregistrer une nouvelle prise en charge
  const handleSubmitRepair = async (e) => {
    e.preventDefault();

    try {
      // 1. Vérifier ou créer le client rapidement
      let customerId = null;
      if (newRepair.customer_phone) {
        const { data: existingCust } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', newRepair.customer_phone)
          .single();

        if (existingCust) {
          customerId = existingCust.id;
        } else {
          const { data: newCust, error: custError } = await supabase
            .from('customers')
            .insert([{ full_name: newRepair.customer_name, phone: newRepair.customer_phone }])
            .select()
            .single();

          if (!custError && newCust) customerId = newCust.id;
        }
      }

      // 2. Créer l'entrée SAV
      const result = await addRepair({
        customer_id: customerId,
        device_name: newRepair.device_name,
        imei_or_serial: newRepair.imei_or_serial,
        issue_description: newRepair.issue_description,
        estimated_cost: Number(newRepair.estimated_cost) || 0,
        status: 'received',
      });

      if (result.success) {
        setSuccessMsg('Fiche SAV créée avec succès !');
        setIsAddModalOpen(false);
        setNewRepair({
          customer_name: '',
          customer_phone: '',
          device_name: '',
          imei_or_serial: '',
          issue_description: '',
          estimated_cost: '',
        });
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        alert('Erreur lors de la création du SAV : ' + result.error);
      }
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  // Changer le statut d'une réparation
  const handleStatusChange = async (repairId, newStatus) => {
    const res = await updateRepairStatus(repairId, { status: newStatus });
    if (!res.success) {
      alert('Erreur lors de la mise à jour du statut.');
    }
  };

  // Certificat de garantie d'une réparation terminée
  const handleWarranty = (repair) =>
    generateWarrantyPdf({
      type: 'repair',
      reference: `SAV-${repair.id.slice(0, 8).toUpperCase()}`,
      date: repair.repaired_at || repair.received_at,
      customerName: repair.customers?.full_name,
      customerPhone: repair.customers?.phone,
      deviceName: repair.device_name,
      imei: repair.imei_or_serial,
      description: repair.issue_description,
      amount: repair.estimated_cost,
    });

  const canIssueWarranty = (repair) => repair.status === 'repaired' || repair.status === 'delivered';

  // Obtenir la couleur et le libellé du badge selon le statut
  const getStatusBadge = (status) => {
    switch (status) {
      case 'received':
        return <Badge colorClass="bg-blue-100 text-blue-800">Reçu / Déposé</Badge>;
      case 'in_progress':
        return <Badge colorClass="bg-indigo-100 text-indigo-800">En cours</Badge>;
      case 'waiting_parts':
        return <Badge colorClass="bg-amber-100 text-amber-800">Attente pièces</Badge>;
      case 'repaired':
        return <Badge colorClass="bg-emerald-100 text-emerald-800">Réparé</Badge>;
      case 'delivered':
        return <Badge colorClass="bg-gray-100 text-gray-800">Restitué</Badge>;
      default:
        return <Badge colorClass="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  // Filtrer les réparations
  const filteredRepairs = repairs.filter(
    (r) =>
      r.device_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.customers?.full_name && r.customers.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.imei_or_serial && r.imei_or_serial.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      {/* MESSAGE DE SUCCÈS */}
      {successMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* EN-TÊTE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Après-Vente (SAV)</h1>
          <p className="text-sm text-gray-500">Suivi des téléphones et appareils déposés en réparation.</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouvelle Réparation
        </Button>
      </div>

      {/* RECHERCHE */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par appareil, client ou IMEI..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none text-sm focus:outline-none text-gray-800 placeholder-gray-400"
        />
      </div>

      {/* LISTE DES RÉPARATIONS */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Mobile : une carte par réparation */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">Chargement des fiches SAV...</p>
          ) : filteredRepairs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">Aucune fiche SAV enregistrée.</p>
          ) : (
            filteredRepairs.map((repair) => (
              <div key={repair.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{repair.device_name}</p>
                    {repair.imei_or_serial && (
                      <p className="text-xs font-mono text-indigo-600 break-all">IMEI : {repair.imei_or_serial}</p>
                    )}
                  </div>
                  {getStatusBadge(repair.status)}
                </div>
                <p className="text-sm text-gray-600">{repair.issue_description}</p>
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>
                    {repair.customers?.full_name || 'Client comptoir'}
                    {repair.customers?.phone ? ` · ${repair.customers.phone}` : ''}
                  </span>
                  <span>{formatDate(repair.received_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 mr-auto">{formatCurrency(repair.estimated_cost)}</span>
                  {canIssueWarranty(repair) && (
                    <button
                      onClick={() => handleWarranty(repair)}
                      className="p-2 text-emerald-700 bg-emerald-50 rounded-lg"
                      aria-label="Certificat de garantie"
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </button>
                  )}
                  <select
                    value={repair.status}
                    onChange={(e) => handleStatusChange(repair.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {REPAIR_STATUSES.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Appareil / IMEI</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Panne constatée</th>
                <th className="px-6 py-3">Coût estimé</th>
                <th className="px-6 py-3">Date de dépôt</th>
                <th className="px-6 py-3">Statut actuel</th>
                <th className="px-6 py-3 text-right">Actions / Modifier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    Chargement des fiches SAV...
                  </td>
                </tr>
              ) : filteredRepairs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    Aucune fiche SAV enregistrée.
                  </td>
                </tr>
              ) : (
                filteredRepairs.map((repair) => (
                  <tr key={repair.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{repair.device_name}</div>
                      {repair.imei_or_serial && (
                        <div className="text-xs font-mono text-indigo-600">IMEI: {repair.imei_or_serial}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800">{repair.customers?.full_name || 'Client comptoir'}</div>
                      <div className="text-xs text-gray-400">{repair.customers?.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                      {repair.issue_description}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {formatCurrency(repair.estimated_cost)}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {formatDate(repair.received_at)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(repair.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {canIssueWarranty(repair) && (
                          <button
                            onClick={() => handleWarranty(repair)}
                            title="Certificat de garantie"
                            className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}
                        <select
                          value={repair.status}
                          onChange={(e) => handleStatusChange(repair.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {REPAIR_STATUSES.map((status) => (
                            <option key={status.id} value={status.id}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL : NOUVELLE PRISE EN CHARGE SAV */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Nouvelle prise en charge SAV"
      >
        <form onSubmit={handleSubmitRepair} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du client</label>
              <input
                type="text"
                required
                placeholder="Ex: Jean Ouédraogo"
                value={newRepair.customer_name}
                onChange={(e) => setNewRepair({ ...newRepair, customer_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone du client</label>
              <input
                type="text"
                required
                placeholder="Ex: 70000000"
                value={newRepair.customer_phone}
                onChange={(e) => setNewRepair({ ...newRepair, customer_phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modèle de l'appareil</label>
              <input
                type="text"
                required
                placeholder="Ex: Samsung Galaxy A32"
                value={newRepair.device_name}
                onChange={(e) => setNewRepair({ ...newRepair, device_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro IMEI ou Série</label>
              <input
                type="text"
                placeholder="Optionnel"
                value={newRepair.imei_or_serial}
                onChange={(e) => setNewRepair({ ...newRepair, imei_or_serial: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description de la panne</label>
            <textarea
              rows="3"
              required
              placeholder="Ex: Écran cassé, ne s'allume plus..."
              value={newRepair.issue_description}
              onChange={(e) => setNewRepair({ ...newRepair, issue_description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coût estimé (FCFA)</label>
            <input
              type="number"
              placeholder="Ex: 25000"
              value={newRepair.estimated_cost}
              onChange={(e) => setNewRepair({ ...newRepair, estimated_cost: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <Button type="submit" className="w-full py-2.5">
            Enregistrer la fiche de dépôt
          </Button>
        </form>
      </Modal>
    </div>
  );
}