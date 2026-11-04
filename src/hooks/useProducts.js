import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';

// Colonnes lisibles par tous. Le prix d'achat est exclu : avec les règles d'accès
// (supabase/rls_policies.sql), seuls les administrateurs le lisent, via get_product_costs().
const PRODUCT_COLUMNS = `
  id,
  name,
  brand,
  model,
  category_id,
  selling_price,
  stock_quantity,
  min_stock_alert,
  is_serialized,
  created_at,
  categories (
    id,
    name
  )
`;

// Prix d'achat par produit : fonction réservée aux administrateurs, avec repli
// sur une lecture directe tant que les règles d'accès ne sont pas installées.
async function fetchProductCosts() {
  const { data, error } = await supabase.rpc('get_product_costs');
  if (!error) return data || [];

  const missing = error.code === 'PGRST202' || error.code === '42883';
  if (!missing) {
    console.error('Erreur chargement prix d\'achat:', error.message);
    return [];
  }

  const { data: direct, error: directError } = await supabase
    .from('products')
    .select('id, purchase_price');
  if (directError) return [];
  return direct || [];
}

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger les catégories et les produits
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);

      // Récupérer les catégories
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (catError) throw catError;
      setCategories(catData || []);

      // Récupérer les produits avec leur catégorie, puis les prix d'achat si autorisé
      const [{ data: prodData, error: prodError }, costs] = await Promise.all([
        supabase
          .from('products')
          .select(PRODUCT_COLUMNS)
          .order('created_at', { ascending: false }),
        fetchProductCosts(),
      ]);

      if (prodError) throw prodError;

      const costById = Object.fromEntries(costs.map((c) => [c.id, c.purchase_price]));
      setProducts(
        (prodData || []).map((p) => ({
          ...p,
          purchase_price: costById[p.id] ?? null,
        }))
      );
    } catch (err) {
      setError(err.message);
      console.error('Erreur lors du chargement des produits:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Ajouter un nouveau produit rattaché à la base de données
  const addProduct = async (productData) => {
    try {
      const payload = {
        name: productData.name,
        brand: productData.brand || null,
        model: productData.model || null,
        category_id: productData.category_id || null,
        purchase_price: Number(productData.purchase_price) || 0,
        selling_price: Number(productData.selling_price) || 0,
        stock_quantity: Number(productData.stock_quantity) || 0,
        min_stock_alert: Number(productData.min_stock_alert) || 5,
        is_serialized: Boolean(productData.is_serialized),
      };

      const { data, error } = await supabase
        .from('products')
        .insert([payload])
        .select(PRODUCT_COLUMNS);

      if (error) throw error;

      const created = data && data[0] ? { ...data[0], purchase_price: payload.purchase_price } : null;
      if (created) {
        setProducts((prev) => [created, ...prev]);
      }

      return { success: true, data: created };
    } catch (err) {
      console.error('Erreur ajout produit base de données:', err.message);
      return { success: false, error: err.message };
    }
  };

  // Mettre à jour un produit existant
  const updateProduct = async (id, productData) => {
    try {
      const payload = {
        name: productData.name,
        brand: productData.brand || null,
        model: productData.model || null,
        category_id: productData.category_id || null,
        purchase_price: Number(productData.purchase_price) || 0,
        selling_price: Number(productData.selling_price) || 0,
        stock_quantity: Number(productData.stock_quantity) || 0,
        min_stock_alert: Number(productData.min_stock_alert) || 5,
      };

      const { data, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', id)
        .select(PRODUCT_COLUMNS);

      if (error) throw error;
      // Sans ligne renvoyée, la règle d'accès a bloqué la modification
      if (!data || data.length === 0) throw new Error('Modification refusée (réservée aux administrateurs).');

      const updated = { ...data[0], purchase_price: payload.purchase_price };
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));

      return { success: true, data: updated };
    } catch (err) {
      console.error('Erreur modification produit:', err.message);
      return { success: false, error: err.message };
    }
  };

  return {
    products,
    categories,
    loading,
    error,
    refreshProducts: fetchProducts,
    addProduct,
    updateProduct,
  };
}
