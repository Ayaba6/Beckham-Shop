import { useState, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';

export function useImei() {
  const [loading, setLoading] = useState(false);

  // Récupérer les IMEI d'un produit spécifique
  const fetchImeisByProduct = async (productId) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_imeis')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('Erreur récupération IMEI:', err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Ajouter un ou plusieurs numéros IMEI pour un téléphone
  const addImeis = async (productId, imeiList, conditionType = 'new', notes = '') => {
    try {
      setLoading(true);
      const rowsToInsert = imeiList.map((imei) => ({
        product_id: productId,
        imei_number: imei.trim(),
        status: 'in_stock',
        condition_type: conditionType,
        notes: notes,
      }));

      const { data, error } = await supabase
        .from('product_imeis')
        .insert(rowsToInsert)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error("Erreur lors de l'ajout des IMEI:", err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Rechercher un IMEI précis lors de la vente (POS)
  const searchImei = async (imeiNumber) => {
    try {
      const { data, error } = await supabase
        .from('product_imeis')
        .select(`
          *,
          products (
            id,
            name,
            selling_price,
            brand,
            model
          )
        `)
        .eq('imei_number', imeiNumber.trim())
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: 'IMEI introuvable ou déjà vendu' };
    }
  };

  return {
    loading,
    fetchImeisByProduct,
    addImeis,
    searchImei,
  };
}