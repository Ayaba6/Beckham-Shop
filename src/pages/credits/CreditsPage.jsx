import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  HandCoins,
  Wallet,
  AlertTriangle,
  Plus,
  CalendarClock
} from 'lucide-react';
import { useCredits, addCreditPayment } from '../../hooks/useCredits';
import { useAuth } from '../../context/AuthContext';
import NewCreditModal from '../../components/credits/NewCreditModal';
import { formatCurrency, formatDate, formatPaymentMethod } from '../../utils/formatters';
import { REPAYMENT_METHODS } from '../../utils/constants';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

export default function CreditsPage() {
  const { credits, loading, error, fetchCredits, updateDueDate } = useCredits();
  const { isAdmin } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSettled, setShowSettled] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isNewCreditOpen, setIsNewCreditOpen] = useState(false);
  const [dueDateInput, setDueDateInput] = useState('');

  // Remboursement
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Garder la modale à jour après un rechargement
  useEffect(() => {
    if (selectedCredit) {
      const fresh = credits.find((c) => c.id === selectedCredit.id);
      if (fresh && fresh !== selectedCredit) setSelectedCredit(fresh);
    }
  }, [credits, selectedCredit]);

  const handleOpenCredit = (credit) => {
    setSelectedCredit(credit);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentNotes('');
    setDueDateInput(credit.due_date || '');
  };

  const handleSaveDueDate = async () => {
    const result = await updateDueDate(selectedCredit.id, dueDateInput);
    if (result.success) {
      setSuccessMsg('Échéance mise à jour !');
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      alert('Erreur : ' + result.error);
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      alert('Saisissez un montant valide.');
      return;
    }
    if (amount > selectedCredit.remaining) {
      alert(`Le montant dépasse le reste dû (${formatCurrency(selectedCredit.remaining)}).`);
      return;
    }

    setSaving(true);
    const result = await addCreditPayment({
      saleId: selectedCredit.id,
      customerId: selectedCredit.customer_id,
      amount,
      paymentMethod,
      notes: paymentNotes,
    });
    setSaving(false);

    if (result.success) {
      setPaymentAmount('');
      setPaymentNotes('');
      setSuccessMsg(
        amount === selectedCredit.remaining ? 'Crédit soldé !' : 'Remboursement enregistré !'
      );
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchCredits();
    } else {
      alert('Erreur : ' + result.error);
    }
  };

  const query = searchQuery.toLowerCase();
  const visibleCredits = credits
    .filter((c) => {
      if (!showSettled && c.remaining <= 0) return false;
      if (onlyOverdue && !c.isOverdue) return false;
      return (
        (c.customers?.full_name || '').toLowerCase().includes(query) ||
        (c.customers?.phone || '').includes(query) ||
        (c.notes || '').toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query)
      );
    })
    // Les retards d'abord (les plus anciens en tête), puis les échéances les plus proches
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      if (a.isOverdue) return b.daysOverdue - a.daysOverdue;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date || b.due_date) return a.due_date ? -1 : 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const totalOutstanding = credits.reduce((sum, c) => sum + c.remaining, 0);
  const openCount = credits.filter((c) => c.remaining > 0).length;
  const debtorCount = new Set(credits.filter((c) => c.remaining > 0).map((c) => c.customer_id)).size;
  const overdueCredits = credits.filter((c) => c.isOverdue);
  const overdueTotal = overdueCredits.reduce((sum, c) => sum + c.remaining, 0);

  const formatDueDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR');

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
          <h1 className="text-2xl font-bold text-gray-900">Crédits Clients</h1>
          <p className="text-sm text-gray-500">Ventes à crédit, remboursements et impayés.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCredits}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <Button onClick={() => setIsNewCreditOpen(true)}>
            <Plus className="w-4 h-4" />
            Nouveau crédit
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Impossible de charger les crédits ({error}). Vérifiez que la table credit_payments a bien été créée
            (fichier supabase/credit_payments.sql).
          </span>
        </div>
      )}

      {/* RÉSUMÉ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500">Total restant dû</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalOutstanding)}</p>
        </div>
        <button
          type="button"
          onClick={() => setOnlyOverdue(!onlyOverdue)}
          className={`text-left p-4 rounded-xl border shadow-sm transition-colors ${
            onlyOverdue ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:border-red-200'
          }`}
        >
          <p className="flex items-center gap-1 text-xs text-gray-500">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> En retard ({overdueCredits.length})
          </p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(overdueTotal)}</p>
          <p className="text-xs text-gray-400">{onlyOverdue ? 'Cliquer pour tout afficher' : 'Cliquer pour filtrer'}</p>
        </button>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500">Crédits en cours</p>
          <p className="text-2xl font-bold text-gray-900">{openCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500">Clients débiteurs</p>
          <p className="text-2xl font-bold text-gray-900">{debtorCount}</p>
        </div>
      </div>

      {/* RECHERCHE ET FILTRE */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par client, téléphone ou numéro de vente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-sm focus:outline-none text-gray-800 placeholder-gray-400"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 shrink-0">
          <input
            type="checkbox"
            checked={showSettled}
            onChange={(e) => setShowSettled(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Afficher les crédits soldés
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 shrink-0">
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => setOnlyOverdue(e.target.checked)}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          Uniquement en retard
        </label>
      </div>

      {/* TABLEAU */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-3">Réf Vente</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Payé</th>
                <th className="px-6 py-3">Reste dû</th>
                <th className="px-6 py-3">Échéance</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-400">
                    Chargement des crédits...
                  </td>
                </tr>
              ) : visibleCredits.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-400">
                    {onlyOverdue ? 'Aucun crédit en retard.' : showSettled ? 'Aucune vente à crédit.' : 'Aucun crédit en cours.'}
                  </td>
                </tr>
              ) : (
                visibleCredits.map((credit) => (
                  <tr
                    key={credit.id}
                    className={`transition-colors ${credit.isOverdue ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-gray-700">
                      #{credit.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">{formatDate(credit.created_at)}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{credit.customers?.full_name || 'Client inconnu'}</div>
                      {credit.customers?.phone && <div className="text-xs text-gray-400">{credit.customers.phone}</div>}
                      {credit.sale_type === 'debt' && (
                        <div className="text-xs text-gray-500 italic">Dette : {credit.notes || 'sans motif'}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{formatCurrency(credit.total_amount)}</td>
                    <td className="px-6 py-4 text-emerald-700">{formatCurrency(credit.paid)}</td>
                    <td className="px-6 py-4">
                      {credit.remaining > 0 ? (
                        <span className="font-bold text-orange-600">{formatCurrency(credit.remaining)}</span>
                      ) : (
                        <Badge colorClass="bg-emerald-100 text-emerald-800">Soldé</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {credit.due_date ? (
                        <div>
                          <div className={credit.isOverdue ? 'font-semibold text-red-700' : 'text-gray-600'}>
                            {formatDueDate(credit.due_date)}
                          </div>
                          {credit.isOverdue && (
                            <Badge colorClass="bg-red-100 text-red-700 mt-1">
                              <AlertTriangle className="w-3 h-3 mr-1" /> {credit.daysOverdue} j de retard
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenCredit(credit)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <HandCoins className="w-3.5 h-3.5" />
                        {credit.remaining > 0 ? 'Encaisser' : 'Détail'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALE : DÉTAIL ET REMBOURSEMENT */}
      <Modal
        isOpen={!!selectedCredit}
        onClose={() => setSelectedCredit(null)}
        title={`Crédit #${selectedCredit?.id.slice(0, 8) || ''}`}
      >
        {selectedCredit && (
          <div className="space-y-5">
            <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1.5 text-gray-600">
              <p><strong>Client :</strong> {selectedCredit.customers?.full_name || 'Client inconnu'}</p>
              <p><strong>Téléphone :</strong> {selectedCredit.customers?.phone || 'Non renseigné'}</p>
              <p><strong>{selectedCredit.sale_type === 'debt' ? 'Date de la dette' : 'Date de la vente'} :</strong> {formatDate(selectedCredit.created_at)}</p>
              {selectedCredit.sale_type === 'debt' && (
                <p><strong>Motif :</strong> {selectedCredit.notes || 'Non renseigné'}</p>
              )}
              <p className={selectedCredit.isOverdue ? 'text-red-700 font-semibold' : ''}>
                <strong>Échéance :</strong>{' '}
                {selectedCredit.due_date ? formatDueDate(selectedCredit.due_date) : 'Aucune'}
                {selectedCredit.isOverdue && ` (${selectedCredit.daysOverdue} jour(s) de retard)`}
              </p>
              <div className="flex justify-between pt-1.5 border-t border-gray-200 text-sm">
                <span>Total : <strong>{formatCurrency(selectedCredit.total_amount)}</strong></span>
                <span className="text-orange-700">Reste dû : <strong>{formatCurrency(selectedCredit.remaining)}</strong></span>
              </div>
            </div>

            {isAdmin && selectedCredit.remaining > 0 && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                    <CalendarClock className="w-3.5 h-3.5" /> Modifier l'échéance
                  </label>
                  <input
                    type="date"
                    value={dueDateInput}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSaveDueDate}
                  disabled={dueDateInput === (selectedCredit.due_date || '')}
                >
                  Enregistrer
                </Button>
              </div>
            )}

            {selectedCredit.remaining > 0 && (
              <form onSubmit={handleSubmitPayment} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Montant reçu (FCFA)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={selectedCredit.remaining}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      {REPAYMENT_METHODS.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Note (optionnel)"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setPaymentAmount(String(selectedCredit.remaining))}
                    className="w-1/2"
                  >
                    Tout solder
                  </Button>
                  <Button type="submit" isLoading={saving} className="w-1/2">
                    <Wallet className="w-4 h-4" />
                    Enregistrer
                  </Button>
                </div>
              </form>
            )}

            <div>
              <h4 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-2">
                Paiements reçus ({selectedCredit.payments.length})
              </h4>
              {selectedCredit.payments.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun paiement pour le moment.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedCredit.payments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-500">{formatDate(p.created_at)} · {formatPaymentMethod(p.payment_method)}</p>
                        {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
                      </div>
                      <span className="font-bold text-emerald-700">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <NewCreditModal
        isOpen={isNewCreditOpen}
        onClose={() => setIsNewCreditOpen(false)}
        onSuccess={fetchCredits}
      />
    </div>
  );
}
