import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Plus,
  Search,
  CheckCircle2,
  ScanLine,
  Edit2
} from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useImei } from '../../hooks/useImei';
import { supabase } from '../../config/supabaseClient';
import { formatCurrency, formatDate, isValidImei } from '../../utils/formatters';
import { IMEI_STATUS_LABELS, CONDITION_TYPES } from '../../utils/constants';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

const emptyPhoneForm = {
  name: '',
  brand: '',
  model: '',
  category_id: '',
  purchase_price: '',
  selling_price: '',
  min_stock_alert: 2,
};

export default function ImeiManagerPage() {
  const { products, categories, loading, refreshProducts, addProduct, updateProduct } = useProducts();
  const { loading: imeiLoading, fetchImeisByProduct, addImeis, updateImeiStatus } = useImei();

  const [allImeis, setAllImeis] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modèle de téléphone (ajout / modification)
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState(null);
  const [phoneForm, setPhoneForm] = useState(emptyPhoneForm);

  // Gestion des IMEI d'un modèle
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [phoneImeis, setPhoneImeis] = useState([]);
  const [imeiInput, setImeiInput] = useState('');
  const [conditionType, setConditionType] = useState('new');
  const [imeiNotes, setImeiNotes] = useState('');
  const [imeiErrors, setImeiErrors] = useState([]);

  // Charger tous les IMEI pour les compteurs et la recherche globale
  const fetchAllImeis = useCallback(async () => {
    const { data, error } = await supabase
      .from('product_imeis')
      .select('id, product_id, imei_number, status');

    if (error) {
      console.error('Erreur chargement IMEI:', error.message);
      return;
    }
    setAllImeis(data || []);
  }, []);

  useEffect(() => {
    fetchAllImeis();
  }, [fetchAllImeis]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // ---------- Modèles de téléphones ----------
  const handleOpenAddPhone = () => {
    setEditingPhone(null);
    setPhoneForm(emptyPhoneForm);
    setIsPhoneModalOpen(true);
  };

  const handleOpenEditPhone = (phone) => {
    setEditingPhone(phone);
    setPhoneForm({
      name: phone.name || '',
      brand: phone.brand || '',
      model: phone.model || '',
      category_id: phone.category_id || '',
      purchase_price: phone.purchase_price || '',
      selling_price: phone.selling_price || '',
      min_stock_alert: phone.min_stock_alert || 2,
    });
    setIsPhoneModalOpen(true);
  };

  const handleSubmitPhone = async (e) => {
    e.preventDefault();
    // Le stock d'un téléphone est le nombre d'IMEI en stock, pas une quantité saisie
    const payload = { ...phoneForm, stock_quantity: editingPhone ? editingPhone.stock_quantity : 0 };

    const result = editingPhone
      ? await updateProduct(editingPhone.id, payload)
      : await addProduct({ ...payload, is_serialized: true });

    if (result.success) {
      setIsPhoneModalOpen(false);
      showSuccess(editingPhone ? 'Modèle modifié avec succès !' : 'Modèle ajouté avec succès !');
      refreshProducts();
    } else {
      alert('Erreur : ' + result.error);
    }
  };

  // ---------- IMEI ----------
  const handleOpenImeis = async (phone) => {
    setSelectedPhone(phone);
    setImeiInput('');
    setImeiNotes('');
    setImeiErrors([]);
    setConditionType('new');
    const result = await fetchImeisByProduct(phone.id);
    setPhoneImeis(result.success ? result.data : []);
  };

  // Garder products.stock_quantity aligné sur le nombre d'IMEI en stock
  const syncPhoneStock = async (productId, imeis) => {
    const inStock = imeis.filter((i) => i.status === 'in_stock').length;
    await supabase.from('products').update({ stock_quantity: inStock }).eq('id', productId);
  };

  const handleAddImeis = async (e) => {
    e.preventDefault();
    const lines = [...new Set(imeiInput.split(/[\s,;]+/).map((l) => l.trim()).filter(Boolean))];

    const invalid = lines.filter((l) => !isValidImei(l));
    const existing = new Set(allImeis.map((i) => i.imei_number));
    const duplicates = lines.filter((l) => existing.has(l));

    const errors = [];
    if (invalid.length) errors.push(`IMEI invalide(s) (15 chiffres attendus) : ${invalid.join(', ')}`);
    if (duplicates.length) errors.push(`Déjà enregistré(s) : ${duplicates.join(', ')}`);
    setImeiErrors(errors);
    if (errors.length || lines.length === 0) return;

    const result = await addImeis(selectedPhone.id, lines, conditionType, imeiNotes);
    if (result.success) {
      const updated = [...result.data, ...phoneImeis];
      setPhoneImeis(updated);
      setImeiInput('');
      setImeiNotes('');
      await syncPhoneStock(selectedPhone.id, updated);
      showSuccess(`${lines.length} IMEI ajouté(s) au stock !`);
      fetchAllImeis();
      refreshProducts();
    } else {
      setImeiErrors([result.error]);
    }
  };

  const handleImeiStatusChange = async (imeiId, status) => {
    const result = await updateImeiStatus(imeiId, status);
    if (!result.success) {
      alert('Erreur lors de la mise à jour du statut.');
      return;
    }
    const updated = phoneImeis.map((i) => (i.id === imeiId ? { ...i, status } : i));
    setPhoneImeis(updated);
    await syncPhoneStock(selectedPhone.id, updated);
    fetchAllImeis();
    refreshProducts();
  };

  // ---------- Filtrage ----------
  const phones = products.filter((p) => p.is_serialized);
  const query = searchQuery.trim().toLowerCase();

  // Une recherche par chiffres retrouve aussi le modèle qui porte cet IMEI
  const productIdsMatchingImei = new Set(
    query.length >= 4
      ? allImeis.filter((i) => i.imei_number.includes(query)).map((i) => i.product_id)
      : []
  );

  const filteredPhones = phones.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      (p.brand && p.brand.toLowerCase().includes(query)) ||
      (p.model && p.model.toLowerCase().includes(query)) ||
      productIdsMatchingImei.has(p.id)
  );

  const countByStatus = (productId, status) =>
    allImeis.filter((i) => i.product_id === productId && i.status === status).length;

  const conditionLabel = (id) => CONDITION_TYPES.find((c) => c.id === id)?.label || id;

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
          <h1 className="text-2xl font-bold text-gray-900">Téléphones & IMEI</h1>
          <p className="text-sm text-gray-500">Suivi unitaire des téléphones par numéro IMEI.</p>
        </div>
        <Button onClick={handleOpenAddPhone}>
          <Plus className="w-4 h-4" />
          Nouveau Modèle
        </Button>
      </div>

      {/* BARRE DE RECHERCHE */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par modèle, marque ou numéro IMEI..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none text-sm focus:outline-none text-gray-800 placeholder-gray-400"
        />
      </div>

      {/* TABLEAU DES MODÈLES */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Modèle</th>
                <th className="px-6 py-3">Prix d'Achat</th>
                <th className="px-6 py-3">Prix de Vente</th>
                <th className="px-6 py-3">En stock</th>
                <th className="px-6 py-3">Vendus</th>
                <th className="px-6 py-3">SAV / Défectueux</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    Chargement des téléphones...
                  </td>
                </tr>
              ) : filteredPhones.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    Aucun téléphone trouvé.
                  </td>
                </tr>
              ) : (
                filteredPhones.map((phone) => {
                  const inStock = countByStatus(phone.id, 'in_stock');
                  const isLowStock = inStock <= (phone.min_stock_alert || 0);
                  return (
                    <tr key={phone.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{phone.name}</div>
                        <div className="text-xs text-gray-400">
                          {[phone.brand, phone.model].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{formatCurrency(phone.purchase_price)}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(phone.selling_price)}</td>
                      <td className="px-6 py-4">
                        <Badge colorClass={isLowStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}>
                          {inStock} unité(s)
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{countByStatus(phone.id, 'sold')}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {countByStatus(phone.id, 'sav') + countByStatus(phone.id, 'defective')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenImeis(phone)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            <ScanLine className="w-3.5 h-3.5" />
                            IMEI
                          </button>
                          <button
                            onClick={() => handleOpenEditPhone(phone)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Modifier
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL : AJOUTER OU MODIFIER UN MODÈLE */}
      <Modal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        title={editingPhone ? 'Modifier le modèle' : 'Ajouter un modèle de téléphone'}
      >
        <form onSubmit={handleSubmitPhone} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Désignation</label>
            <input
              type="text"
              required
              placeholder="Ex: Galaxy A15 128 Go"
              value={phoneForm.name}
              onChange={(e) => setPhoneForm({ ...phoneForm, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marque</label>
              <input
                type="text"
                placeholder="Ex: Samsung"
                value={phoneForm.brand}
                onChange={(e) => setPhoneForm({ ...phoneForm, brand: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modèle / Référence</label>
              <input
                type="text"
                placeholder="Ex: SM-A155F"
                value={phoneForm.model}
                onChange={(e) => setPhoneForm({ ...phoneForm, model: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
            <select
              value={phoneForm.category_id}
              onChange={(e) => setPhoneForm({ ...phoneForm, category_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Sélectionner une catégorie</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix d'achat (FCFA)</label>
              <input
                type="number"
                required
                value={phoneForm.purchase_price}
                onChange={(e) => setPhoneForm({ ...phoneForm, purchase_price: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (FCFA)</label>
              <input
                type="number"
                required
                value={phoneForm.selling_price}
                onChange={(e) => setPhoneForm({ ...phoneForm, selling_price: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seuil d'alerte stock bas</label>
            <input
              type="number"
              value={phoneForm.min_stock_alert}
              onChange={(e) => setPhoneForm({ ...phoneForm, min_stock_alert: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <Button type="submit" className="w-full py-2.5 mt-2">
            {editingPhone ? 'Mettre à jour le modèle' : 'Enregistrer le modèle'}
          </Button>
        </form>
      </Modal>

      {/* MODAL : IMEI D'UN MODÈLE */}
      <Modal
        isOpen={!!selectedPhone}
        onClose={() => setSelectedPhone(null)}
        title={`IMEI : ${selectedPhone?.name || ''}`}
      >
        {selectedPhone && (
          <div className="space-y-5">
            <form onSubmit={handleAddImeis} className="space-y-3 p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700">
                Ajouter des IMEI (un par ligne, ou scannés à la suite)
              </label>
              <textarea
                rows={3}
                placeholder={'356789012345678\n356789012345679'}
                value={imeiInput}
                onChange={(e) => setImeiInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={conditionType}
                  onChange={(e) => setConditionType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {CONDITION_TYPES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Note (optionnel)"
                  value={imeiNotes}
                  onChange={(e) => setImeiNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              {imeiErrors.map((err) => (
                <p key={err} className="text-xs text-red-600">{err}</p>
              ))}
              <Button type="submit" isLoading={imeiLoading} className="w-full">
                <Plus className="w-4 h-4" />
                Ajouter au stock
              </Button>
            </form>

            <div>
              <h4 className="flex items-center gap-2 font-bold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-2">
                <Smartphone className="w-4 h-4 text-indigo-600" /> Unités enregistrées ({phoneImeis.length})
              </h4>
              {phoneImeis.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun IMEI enregistré pour ce modèle.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {phoneImeis.map((imei) => (
                    <div key={imei.id} className="flex items-center justify-between gap-2 text-sm p-2 bg-gray-50 rounded-lg">
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-gray-800">{imei.imei_number}</p>
                        <p className="text-xs text-gray-500">
                          {conditionLabel(imei.condition_type)} · {formatDate(imei.created_at)}
                          {imei.notes ? ` · ${imei.notes}` : ''}
                        </p>
                      </div>
                      <select
                        value={imei.status}
                        onChange={(e) => handleImeiStatusChange(imei.id, e.target.value)}
                        className={`text-xs rounded-lg px-2 py-1.5 border-0 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 ${IMEI_STATUS_LABELS[imei.status]?.color || 'bg-white'}`}
                      >
                        {Object.entries(IMEI_STATUS_LABELS).map(([id, s]) => (
                          <option key={id} value={id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
