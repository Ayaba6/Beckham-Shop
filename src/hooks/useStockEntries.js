import { useState, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';

/**
 * Ajoute du stock à un produit et enregistre l'entrée (fonction SQL restock_product,
 * voir supabase/stock_entries.sql). Les deux opérations réussissent ou échouent ensemble.
 */
export async function restockProduct({ productId, quantity, unitCost, supplier = '', notes = '', updatePrice = true }) {
  try {
    const { data, error } = await supabase.rpc('restock_product', {
      p_product_id: productId,
      p_quantity: Number(quantity),
      p_unit_cost: Number(unitCost) || 0,
      p_supplier: supplier,
      p_notes: notes,
      p_update_price: updatePrice,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Erreur réapprovisionnement:', err.message);
    const missing = err.code === 'PGRST202' || err.code === '42883';
    return {
      success: false,
      error: missing
        ? 'La fonction restock_product est introuvable. Exécutez le fichier supabase/stock_entries.sql dans Supabase.'
        : err.message,
    };
  }
}

export function useStockEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Charger l'historique des entrées (optionnellement pour un seul produit)
  const fetchEntries = useCallback(async (productId = null) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('stock_entries')
        .select('*')
        .order('created_at', { ascending: false });
      if (productId) query = query.eq('product_id', productId);

      const { data: entriesData, error: entriesError } = await query;
      if (entriesError) throw entriesError;

      const productIds = [...new Set((entriesData || []).map((e) => e.product_id))];
      let productsData = [];
      if (productIds.length) {
        const { data, error: prodError } = await supabase
          .from('products')
          .select('id, name, brand')
          .in('id', productIds);
        if (prodError) throw prodError;
        productsData = data || [];
      }

      setEntries(
        (entriesData || []).map((e) => ({
          ...e,
          products: productsData.find((p) => p.id === e.product_id) || null,
        }))
      );
    } catch (err) {
      setError(err.message);
      console.error('Erreur chargement entrées de stock:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    entries,
    loading,
    error,
    fetchEntries,
  };
}
