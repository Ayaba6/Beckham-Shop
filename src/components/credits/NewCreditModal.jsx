import React, { useState, useEffect } from 'react';
import { Plus, Minus, Trash2, ShoppingBag, FileText, CheckCircle2, FileDown } from 'lucide-react';
import { supabase } from '../../config/supabaseClient';
import { useProducts } from '../../hooks/useProducts';
import { recordSale } from '../../hooks/useSales';
import { formatCurrency } from '../../utils/formatters';
import { REPAYMENT_METHODS } from '../../utils/constants';
import { generateInvoicePdf } from '../pdf/InvoicePdf';
import Button from '../common/Button';
import Modal from '../common/Modal';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

// Date au format AAAA-MM-JJ, n jours après aujourd'hui
function inDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}

const emptyForm = {
  phone: '',
  name: '',
  amount: '',
  reason: '',
  discount: '',
  deposit: '',
  depositMethod: 'cash',
  dueDate: inDays(30),
};

/**
 * Nouveau crédit : vente d'accessoires à crédit (le stock baisse) ou dette libre
 * sans article (ex : reprise d'un crédit noté dans un cahier).
 */
export default function NewCreditModal({ isOpen, onClose, onSuccess }) {
  const { products, refreshProducts } = useProducts();

  const [mode, setMode] = useState('sale');
  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState([]);
  const [productToAdd, setProductToAdd] = useState('');
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdSale, setCreatedSale] = useState(null);

  // Réinitialiser à chaque ouverture et charger les clients pour l'auto-complétion
  useEffect(() => {
    if (!isOpen) return;
    setMode('sale');
    setForm({ ...emptyForm, dueDate: inDays(30) });
    setLines([]);
    setProductToAdd('');
    setErrorMsg('');
    setCreatedSale(null);
    refreshProducts();
    supabase
      .from('customers')
      .select('id, full_name, phone')
      .not('phone', 'is', null)
      .order('full_name')
      .then(({ data }) => setCustomers(data || []));
  }, [isOpen, refreshProducts]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  // Client existant reconnu par son téléphone
  const existingCustomer = customers.find((c) => c.phone === form.phone.trim());

  const handlePhoneChange = (e) => {
    const phone = e.target.value;
    const match = customers.find((c) => c.phone === phone.trim());
    setForm({ ...form, phone, name: match ? match.full_name || '' : form.name });
  };

  // ---------- Articles ----------
  const accessories = products.filter((p) => !p.is_serialized && p.stock_quantity > 0);

  const handleAddLine = () => {
    const product = accessories.find((p) => p.id === productToAdd);
    if (!product) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: Math.min(l.quantity + 1, product.stock_quantity) } : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          brand: product.brand,
          unitPrice: Number(product.selling_price),
          quantity: 1,
          stock: product.stock_quantity,
        },
      ];
    });
    setProductToAdd('');
  };

  const handleQuantity = (productId, delta) => {
    setLines((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
        .map((l) => ({ ...l, quantity: Math.min(l.quantity, l.stock) }))
    );
  };

  // ---------- Montants ----------
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const discount = Number(form.discount) || 0;
  const total = mode === 'sale' ? Math.max(0, subtotal - discount) : Number(form.amount) || 0;
  const deposit = Number(form.deposit) || 0;
  const remaining = Math.max(0, total - deposit);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.phone.trim()) return setErrorMsg('Le téléphone du client est obligatoire.');
    if (!existingCustomer && !form.name.trim()) return setErrorMsg('Nouveau client : saisissez aussi son nom.');
    if (mode === 'sale' && lines.length === 0) return setErrorMsg('Ajoutez au moins un article.');
    if (mode === 'sale' && discount > subtotal) return setErrorMsg('La réduction ne peut pas dépasser le sous-total.');
    if (mode === 'debt' && !form.reason.trim()) return setErrorMsg('Indiquez le motif de la dette.');
    if (total <= 0) return setErrorMsg('Le montant du crédit doit être supérieur à 0.');
    if (deposit < 0 || deposit >= total) return setErrorMsg('L\'acompte doit être inférieur au montant total.');

    setSaving(true);
    const result = await recordSale({
      items: mode === 'sale' ? lines : [],
      customerPhone: form.phone,
      customerName: form.name,
      paymentMethod: 'credit',
      discountAmount: mode === 'sale' ? discount : 0,
      deposit,
      depositMethod: form.depositMethod,
      dueDate: form.dueDate || null,
      notes: mode === 'debt' ? form.reason.trim() : null,
      saleType: mode === 'debt' ? 'debt' : 'sale',
      totalAmount: mode === 'debt' ? total : null,
    });
    setSaving(false);

    if (!result.success) {
      setErrorMsg(result.error);
      if (result.shortages) refreshProducts();
      return;
    }
    result.warnings.forEach((warning) => alert(warning));
    setCreatedSale({ ...result.sale, remaining: result.remaining, isDebt: mode === 'debt' });
    onSuccess?.();
  };

  // ---------- Vue après enregistrement ----------
  if (createdSale) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Crédit enregistré">
        <div className="space-y-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <div>
            <p className="text-sm text-gray-500">{createdSale.customers?.full_name || form.name}</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(createdSale.total_amount)}</p>
            <p className="mt-1 text-sm font-semibold text-orange-700">Reste dû : {formatCurrency(createdSale.remaining)}</p>
            {createdSale.due_date && (
              <p className="text-xs text-gray-500">
                À payer avant le {new Date(createdSale.due_date).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            {!createdSale.isDebt && (
              <Button variant="secondary" onClick={() => generateInvoicePdf(createdSale)} className="w-1/2">
                <FileDown className="w-4 h-4" />
                Facture PDF
              </Button>
            )}
            <Button onClick={onClose} className={createdSale.isDebt ? 'w-full' : 'w-1/2'}>
              Terminé
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // ---------- Formulaire ----------
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau crédit">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Type de crédit */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
          {[
            { id: 'sale', label: "Vente d'articles", icon: ShoppingBag },
            { id: 'debt', label: 'Dette libre', icon: FileText },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 -mt-3">
          {mode === 'sale'
            ? 'Les articles sortent du stock, comme une vente en caisse.'
            : 'Montant dû sans article (ex : reprise d\'un crédit noté dans le cahier). Aucun mouvement de stock.'}
        </p>

        {/* Client */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900">Client</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="tel"
                required
                list="credit-customers"
                placeholder="Téléphone"
                value={form.phone}
                onChange={handlePhoneChange}
                className={inputClass}
              />
              <datalist id="credit-customers">
                {customers.map((c) => (
                  <option key={c.id} value={c.phone}>{c.full_name}</option>
                ))}
              </datalist>
            </div>
            <input
              type="text"
              placeholder="Nom"
              value={form.name}
              onChange={set('name')}
              disabled={!!existingCustomer}
              className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-600`}
            />
          </div>
          {form.phone.trim() && (
            <p className={`text-xs ${existingCustomer ? 'text-emerald-700' : 'text-gray-500'}`}>
              {existingCustomer ? `Client existant : ${existingCustomer.full_name}` : 'Nouveau client : il sera enregistré.'}
            </p>
          )}
        </div>

        {/* Articles ou montant */}
        {mode === 'sale' ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900">Articles</h4>
            <div className="flex gap-2">
              <select value={productToAdd} onChange={(e) => setProductToAdd(e.target.value)} className={inputClass}>
                <option value="">Choisir un accessoire</option>
                {accessories.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.brand ? ` (${p.brand})` : ''} · {formatCurrency(p.selling_price)} · stock {p.stock_quantity}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={handleAddLine} disabled={!productToAdd}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {lines.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {lines.map((l) => (
                  <div key={l.productId} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{l.name}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(l.unitPrice)} × {l.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => handleQuantity(l.productId, -1)} className="w-6 h-6 bg-white border border-gray-200 rounded flex items-center justify-center hover:bg-gray-100">
                        {l.quantity === 1 ? <Trash2 className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3" />}
                      </button>
                      <span className="text-xs font-bold w-5 text-center">{l.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleQuantity(l.productId, 1)}
                        disabled={l.quantity >= l.stock}
                        className="w-6 h-6 bg-white border border-gray-200 rounded flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="w-24 text-right font-semibold text-gray-900">{formatCurrency(l.unitPrice * l.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <input
              type="number"
              min="0"
              placeholder="Réduction (FCFA, optionnel)"
              value={form.discount}
              onChange={set('discount')}
              className={inputClass}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900">Dette</h4>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="1"
                required
                placeholder="Montant dû (FCFA)"
                value={form.amount}
                onChange={set('amount')}
                className={inputClass}
              />
              <input
                type="text"
                required
                placeholder="Motif (ex : reprise cahier)"
                value={form.reason}
                onChange={set('reason')}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Acompte et échéance */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900">Paiement</h4>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min="0"
              placeholder="Acompte versé (optionnel)"
              value={form.deposit}
              onChange={set('deposit')}
              className={inputClass}
            />
            <select value={form.depositMethod} onChange={set('depositMethod')} className={inputClass}>
              {REPAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date limite de paiement (optionnelle)</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={form.dueDate}
                onChange={set('dueDate')}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              {[7, 15, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, dueDate: inDays(n) })}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {n} jours
                </button>
              ))}
              {form.dueDate && (
                <button type="button" onClick={() => setForm({ ...form, dueDate: '' })} className="text-xs text-gray-400 hover:text-gray-600">
                  Aucune
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Récapitulatif */}
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-1 text-sm">
          <div className="flex justify-between text-gray-700">
            <span>Total du crédit</span>
            <span className="font-semibold">{formatCurrency(total)}</span>
          </div>
          {deposit > 0 && (
            <div className="flex justify-between text-gray-700">
              <span>Acompte</span>
              <span>- {formatCurrency(deposit)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-orange-900 pt-1 border-t border-orange-200">
            <span>Reste dû</span>
            <span>{formatCurrency(remaining)}</span>
          </div>
        </div>

        {errorMsg && <p className="text-xs text-red-600 whitespace-pre-line">{errorMsg}</p>}

        <Button type="submit" isLoading={saving} className="w-full py-2.5">
          Enregistrer le crédit
        </Button>
      </form>
    </Modal>
  );
}
