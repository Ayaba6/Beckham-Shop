import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';

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

      // Récupérer les produits avec leur catégorie
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (prodError) throw prodError;
      setProducts(prodData || []);
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
        .select(`
          *,
          categories (
            id,
            name
          )
        `);

      if (error) throw error;
      
      if (data && data[0]) {
        setProducts((prev) => [data[0], ...prev]);
      }
      
      return { success: true, data: data[0] };
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
        .select(`
          *,
          categories (
            id,
            name
          )
        `);

      if (error) throw error;

      if (data && data[0]) {
        setProducts((prev) => prev.map((p) => (p.id === id ? data[0] : p)));
      }

      return { success: true, data: data[0] };
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