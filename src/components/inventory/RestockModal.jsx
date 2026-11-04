import React, { useState, useEffect } from 'react';
import { PackagePlus } from 'lucide-react';
import { supabase } from '../../config/supabaseClient';
import { restockProduct } from '../../hooks/useStockEntries';
import { formatCurrency } from '../../utils/formatters';
import Button from '../common/Button';
import Modal from '../common/Modal';

/**
 * Formulaire de réapprovisionnement.
 * - `product` : produit présélectionné (depuis la liste des accessoires)
 * - `products` : liste proposée quand aucun produit n'est présélectionné
 */
export default function RestockModal({ isOpen, onClose, product = null, products = [], onSuccess }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [updatePrice, setUpdatePrice] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selected = product || products.find((p) => p.id === productId) || null;

  // Réinitialiser le formulaire et charger les fournisseurs déjà utilisés
  useEffect(() => {
    if (!isOpen) return;
    setProductId(product?.id || '');
    setQuantity('');
    setUnitCost(product?.purchase_price ?? '');
    setSupplier('');
    setNotes('');
    setUpdatePrice(true);
    setErrorMsg('');

    supabase
      .from('stock_entries')
      .select('supplier')
      .not('supplier', 'is', null)
      .then(({ data }) => {
        setSuppliers([...new Set((data || []).map((e) => e.supplier))].sort());
      });
  }, [isOpen, product]);

  const handleSelectProduct = (id) => {
    setProductId(id);
    const p = products.find((item) => item.id === id);
    setUnitCost(p?.purchase_price ?? '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selected) {
      setErrorMsg('Choisissez un accessoire.');
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      setErrorMsg('La quantité doit être un nombre entier positif.');
      return;
    }

    setSaving(true);
    const result = await restockProduct({
      productId: selected.id,
      quantity: qty,
      unitCost,
      supplier,
      notes,
      updatePrice,
    });
    setSaving(false);

    if (result.success) {
      onSuccess?.(`${qty} unité(s) ajoutée(s) à « ${selected.name} »`);
      onClose();
    } else {
      setErrorMsg(result.error);
    }
  };

  const totalCost = (Number(quantity) || 0) * (Number(unitCost) || 0);
  const priceChanged = selected && Number(unitCost) !== Number(selected.purchase_price);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Réapprovisionner le stock">
      <form onSubmit={handleSubmit} className="space-y-4">
        {product ? (
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <p className="font-semibold text-gray-900">{product.name}</p>
            <p className="text-xs text-gray-500">
              Stock actuel : {product.stock_quantity} unité(s) · Prix d'achat actuel : {formatCurrency(product.purchase_price)}
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accessoire</label>
            <select
              required
              value={productId}
              onChange={(e) => handleSelectProduct(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Sélectionner un accessoire</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.brand ? ` (${p.brand})` : ''} · stock {p.stock_quantity}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantité reçue</label>
            <input
              type="number"
              required
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix d'achat unitaire (FCFA)</label>
            <input
              type="number"
              required
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur (optionnel)</label>
          <input
            type="text"
            list="restock-suppliers"
            placeholder="Ex: Grossiste Ouaga Centre"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <datalist id="restock-suppliers">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <input
          type="text"
          placeholder="Note (optionnel) : n° de bon, facture fournisseur..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {priceChanged && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={updatePrice}
              onChange={(e) => setUpdatePrice(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Mettre à jour le prix d'achat de l'accessoire ({formatCurrency(selected.purchase_price)} → {formatCurrency(unitCost)})
          </label>
        )}

        <div className="flex justify-between text-sm font-semibold text-gray-900 pt-2 border-t border-gray-100">
          <span>Coût total de l'entrée :</span>
          <span className="text-indigo-600">{formatCurrency(totalCost)}</span>
        </div>

        {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}

        <Button type="submit" isLoading={saving} className="w-full py-2.5">
          <PackagePlus className="w-4 h-4" />
          Ajouter au stock
        </Button>
      </form>
    </Modal>
  );
}
