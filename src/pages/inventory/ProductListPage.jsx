import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertTriangle,
  Edit2
} from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { formatCurrency } from '../../utils/formatters';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

export default function ProductListPage() {
  const { products, categories, loading, refreshProducts, addProduct, updateProduct } = useProducts();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null = Ajout, objet = Modification
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    model: '',
    category_id: '',
    purchase_price: '',
    selling_price: '',
    stock_quantity: 0,
    min_stock_alert: 5,
  });

  // Ouvrir la modale en mode Ajout
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      brand: '',
      model: '',
      category_id: '',
      purchase_price: '',
      selling_price: '',
      stock_quantity: 0,
      min_stock_alert: 5,
    });
    setIsModalOpen(true);
  };

  // Ouvrir la modale en mode Édition
  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      brand: product.brand || '',
      model: product.model || '',
      category_id: product.category_id || '',
      purchase_price: product.purchase_price || '',
      selling_price: product.selling_price || '',
      stock_quantity: product.stock_quantity || 0,
      min_stock_alert: product.min_stock_alert || 5,
    });
    setIsModalOpen(true);
  };

  // Soumission du formulaire (Ajout ou Modification)
  const handleSubmit = async (e) => {
    e.preventDefault();
    let result;

    if (editingProduct) {
      // Modification
      result = await updateProduct(editingProduct.id, formData);
      if (result.success) {
        setSuccessMsg('Accessoire modifié avec succès !');
      }
    } else {
      // Ajout
      result = await addProduct({ ...formData, is_serialized: false });
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
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
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
          placeholder="Rechercher un accessoire par nom ou marque..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none text-sm focus:outline-none text-gray-800 placeholder-gray-400"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Désignation</th>
                <th className="px-6 py-3">Catégorie</th>
                <th className="px-6 py-3">Prix d'Achat</th>
                <th className="px-6 py-3">Prix de Vente</th>
                <th className="px-6 py-3">Quantité en Stock</th>
                <th className="px-6 py-3 text-center">Statut</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    Chargement des accessoires...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
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
                        {product.brand && <div className="text-xs text-gray-400">{product.brand}</div>}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {product.categories?.name || 'Accessoires'}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{formatCurrency(product.purchase_price)}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(product.selling_price)}</td>
                      <td className="px-6 py-4 font-bold text-gray-800">
                        {product.stock_quantity} unités
                      </td>
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
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(product)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Modifier
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL : AJOUTER OU MODIFIER UN ACCESSOIRE */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? "Modifier l'accessoire" : "Ajouter un nouvel accessoire"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'accessoire</label>
            <input
              type="text"
              required
              placeholder="Ex: Chargeur Rapide Type-C 20W"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marque (Optionnel)</label>
              <input
                type="text"
                placeholder="Ex: Samsung, Remax"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Sélectionner une catégorie</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente unitaire (FCFA)</label>
              <input
                type="number"
                required
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

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