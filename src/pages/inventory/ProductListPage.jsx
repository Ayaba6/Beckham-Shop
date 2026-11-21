import React, { useEffect, useState } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertTriangle,
  Edit2,
  PackagePlus
} from 'lucide-react';
import RestockModal from '../../components/inventory/RestockModal';
import { useAuth } from '../../context/AuthContext';
import { useProducts } from '../../hooks/useProducts';
import { supabase } from '../../config/supabaseClient';
import { formatCurrency } from '../../utils/formatters';
import { phoneLabel } from '../../utils/constants';
import PhoneFields, { Choice } from '../../components/common/PhoneFields';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

// Même liste que supabase/types_accessoires.sql
const ACCESSORY_TYPES = ['Circuit de charge', 'Écran', 'Chargeur', 'Couverture', 'Vitre de photo', "Vitre d'écran", 'Bouton allumage', 'Tactile'];

export default function ProductListPage() {
  const { products, categories, findOrCreateCategory, loading, refreshProducts, addProduct, updateProduct } = useProducts();
  // Types proposés : la liste de la boutique + ceux de la base (table categories, dont les « Autre… »)
  const typeOptions = [...new Set([...ACCESSORY_TYPES, ...categories.map((c) => c.name)])];
  const { isAdmin } = useAuth();
  const columnCount = isAdmin ? 9 : 8;
  // Un accessoire ajouté par un vendeur attend que le patron fixe son prix de vente
  const hasPrice = (product) => Number(product.selling_price) > 0;

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null = Ajout, objet = Modification
  const [successMsg, setSuccessMsg] = useState('');
  const [restockingProduct, setRestockingProduct] = useState(null);

  // Quantités vendues par produit (total calculé par la base)
  const [soldById, setSoldById] = useState({});
  useEffect(() => {
    supabase.rpc('get_sold_quantities').then(({ data, error }) => {
      if (error) console.error('Erreur quantités vendues:', error.message);
      setSoldById(Object.fromEntries((data || []).map((r) => [r.product_id, Number(r.sold)])));
    });
  }, []);
  const soldOf = (product) => soldById[product.id] || 0;

  const handleRestockSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
    refreshProducts();
  };

  const [formData, setFormData] = useState({
    type: '',

    name: '',
    brand: '',
    model: '',
    category_id: '',
    purchase_price: '',
    selling_price: '',
    wholesale_price: '',
    stock_quantity: 0,
    min_stock_alert: 5,
  });

  // Ouvrir la modale en mode Ajout
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      type: '',

      name: '',
      brand: '',
      model: '',
      category_id: '',
      purchase_price: '',
      selling_price: '',
      wholesale_price: '',
    wholesale_price: '',
      stock_quantity: 0,
      min_stock_alert: 5,
      phone_brand: '',
      phone_model: '',
      phone_series: '',
      phone_code: '',
    });
    setIsModalOpen(true);
  };

  // Ouvrir la modale en mode Édition
  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      type: product.categories?.name || '',

      name: product.name || '',
      brand: product.brand || '',
      model: product.model || '',
      category_id: product.category_id || '',
      purchase_price: product.purchase_price || '',
      selling_price: product.selling_price || '',
      wholesale_price: product.wholesale_price || '',
      stock_quantity: product.stock_quantity || 0,
      min_stock_alert: product.min_stock_alert || 5,
      phone_brand: product.phone_brand || '',
      phone_model: product.phone_model || '',
      phone_series: product.phone_series || '',
      phone_code: product.phone_code || '',
    });
    setIsModalOpen(true);
  };

  // Soumission du formulaire (Ajout ou Modification)
  const handleSubmit = async (e) => {
    e.preventDefault();
    let result;

    // Le type choisi (ou saisi via « Autre… ») est enregistré en base et donne le nom :
    // « Écran Infinix Hot 10 Play (X688) »
    let category;
    try {
      category = await findOrCreateCategory(formData.type);
    } catch (err) {
      alert(err.message);
      return;
    }
    const payload = {
      ...formData,
      category_id: category.id,
      name: [category.name, phoneLabel(formData)].filter(Boolean).join(' '),
    };

    if (editingProduct) {
      // Modification
      result = await updateProduct(editingProduct.id, payload);
      if (result.success) {
        setSuccessMsg('Accessoire modifié avec succès !');
      }
    } else {
      // Ajout
      result = await addProduct({ ...payload, is_serialized: false });
      if (result.success) {
        setSuccessMsg('Accessoire ajouté avec succès !');
      }
    }

    if (result && result.success) {
      setIsModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 3000);
      refreshProducts();
    } else {
      alert('Erreur : ' + (result?.error || 'Une erreur est survenue'));
    }
  };

  const accessoriesList = products.filter((p) => !p.is_serialized);
  const filteredProducts = accessoriesList.filter((p) =>
    [p.name, p.brand, phoneLabel(p)].some((v) => v && v.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Stocks d'Accessoires</h1>
          <p className="text-sm text-gray-500">Suivi des quantités globales, coques, chargeurs et autres articles.</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="w-4 h-4" />
          Nouvel Accessoire
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un accessoire, un téléphone (ex: Hot 10, X688)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none text-sm focus:outline-none text-gray-800 placeholder-gray-400"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Mobile : une carte par accessoire */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">Chargement des accessoires...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">Aucun accessoire trouvé.</p>
          ) : (
            filteredProducts.map((product) => {
              const isLowStock = product.stock_quantity <= product.min_stock_alert;
              return (
                <div key={product.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-400">
                        {product.categories?.name || 'Accessoire'}
                      </p>
                      {phoneLabel(product) && <p className="text-xs text-indigo-600">Pour {phoneLabel(product)}</p>}
                    </div>
                    {hasPrice(product) ? (
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900">{formatCurrency(product.selling_price)}</p>
                        <p className="text-xs text-gray-500">Gros : {formatCurrency(product.wholesale_price)}</p>
                      </div>
                    ) : (
                      <Badge colorClass="bg-amber-100 text-amber-800 shrink-0">Prix à fixer</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-gray-50 rounded-lg py-1.5"><p className="text-gray-500">Stock</p><p className="font-semibold text-gray-800">{product.stock_quantity + soldOf(product)}</p></div>
                    <div className="bg-gray-50 rounded-lg py-1.5"><p className="text-gray-500">Vendu</p><p className="font-semibold text-gray-800">{soldOf(product)}</p></div>
                    <div className="bg-gray-50 rounded-lg py-1.5"><p className="text-gray-500">Restant</p><p className="font-semibold text-gray-800">{product.stock_quantity}</p></div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      {isLowStock ? (
                        <Badge colorClass="bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Stock faible
                        </Badge>
                      ) : (
                        <Badge colorClass="bg-emerald-100 text-emerald-800">En stock</Badge>
                      )}
                    </div>
                    {isAdmin && <span className="text-gray-500">Achat : {formatCurrency(product.purchase_price)}</span>}
                  </div>
                  <div className={`grid gap-2 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <button
                      type="button"
                      onClick={() => setRestockingProduct(product)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      Réappro.
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(product)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        {hasPrice(product) ? 'Modifier' : 'Fixer le prix'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Désignation</th>
                {isAdmin && <th className="px-6 py-3">Prix d'achat</th>}
                <th className="px-6 py-3">Prix détail</th>
                <th className="px-6 py-3">Prix grossiste</th>
                <th className="px-6 py-3 text-center">Stock</th>
                <th className="px-6 py-3 text-center">Vendu</th>
                <th className="px-6 py-3 text-center">Restant</th>
                <th className="px-6 py-3 text-center">Statut</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={columnCount} className="px-6 py-8 text-center text-gray-400">
                    Chargement des accessoires...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-6 py-8 text-center text-gray-400">
                    Aucun accessoire trouvé.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isLowStock = product.stock_quantity <= product.min_stock_alert;
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{product.name}</div>
                        {phoneLabel(product) && <div className="text-xs text-indigo-600">Pour {phoneLabel(product)}</div>}
                      </td>
                      {isAdmin && <td className="px-6 py-4 text-gray-500">{formatCurrency(product.purchase_price)}</td>}
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {hasPrice(product) ? (
                          formatCurrency(product.selling_price)
                        ) : (
                          <Badge colorClass="bg-amber-100 text-amber-800">Prix à fixer</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {Number(product.wholesale_price) > 0 ? formatCurrency(product.wholesale_price) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-700">{product.stock_quantity + soldOf(product)}</td>
                      <td className="px-6 py-4 text-center text-gray-700">{soldOf(product)}</td>
                      <td className="px-6 py-4 text-center font-bold text-gray-900">{product.stock_quantity}</td>
                      <td className="px-6 py-4 text-center">
                        {isLowStock ? (
                          <Badge colorClass="bg-red-100 text-red-700 flex items-center gap-1 w-fit mx-auto">
                            <AlertTriangle className="w-3 h-3" /> Stock Faible
                          </Badge>
                        ) : (
                          <Badge colorClass="bg-emerald-100 text-emerald-800 w-fit mx-auto">
                            En stock
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setRestockingProduct(product)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            Réappro.
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(product)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              {hasPrice(product) ? 'Modifier' : 'Fixer le prix'}
                            </button>
                          )}
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

      {/* MODAL : RÉAPPROVISIONNEMENT */}
      <RestockModal
        isOpen={!!restockingProduct}
        onClose={() => setRestockingProduct(null)}
        product={restockingProduct}
        onSuccess={handleRestockSuccess}
      />

      {/* MODAL : AJOUTER OU MODIFIER UN ACCESSOIRE */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? "Modifier l'accessoire" : "Ajouter un nouvel accessoire"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Choice
            key={editingProduct?.id || 'new'}
            label="Type de l'accessoire"
            required
            placeholder="Ex: Batterie, Vitre arrière"
            options={typeOptions}
            value={formData.type}
            onChange={(type) => setFormData({ ...formData, type })}
          />

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-gray-800">Téléphone compatible (optionnel)</legend>
            <PhoneFields
              value={formData}
              onChange={(v) => setFormData({ ...formData, ...v })}
            />
          </fieldset>

          {!isAdmin && (
            <p className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
              Les prix (achat, détail, grossiste) seront fixés par le patron. L'accessoire n'apparaîtra en caisse qu'une fois son prix fixé.
            </p>
          )}

          {isAdmin && <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix d'achat unitaire (FCFA)</label>
              <input
                type="number"
                required
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix détail (FCFA)</label>
              <input
                type="number"
                required
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix grossiste (FCFA)</label>
              <input
                type="number"
                min="0"
                placeholder="Optionnel"
                value={formData.wholesale_price}
                onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantité en stock</label>
              <input
                type="number"
                required
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seuil d'alerte stock bas</label>
              <input
                type="number"
                value={formData.min_stock_alert}
                onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <Button type="submit" className="w-full py-2.5 mt-2">
            {editingProduct ? "Mettre à jour l'accessoire" : "Enregistrer l'accessoire"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}