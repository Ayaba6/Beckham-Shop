import { useState, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';

export function useRepairs() {
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Charger la liste des réparations
  const fetchRepairs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('repairs')
        .select(`
          *,
          customers (full_name, phone)
        `)
        .order('received_at', { ascending: false });

      if (error) throw error;
      setRepairs(data || []);
    } catch (err) {
      console.error('Erreur chargement SAV:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Créer une fiche de prise en charge SAV
  const addRepair = async (repairData) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('repairs')
        .insert([repairData])
        .select();

      if (error) throw error;
      setRepairs((prev) => [data[0], ...prev]);
      return { success: true, data: data[0] };
    } catch (err) {
      console.error('Erreur création SAV:', err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour le statut ou le coût d'une réparation
  const updateRepairStatus = async (repairId, updateData) => {
    try {
      setLoading(true);
      
      // Si le statut passe à 'delivered' ou 'repaired', on met à jour la date correspondante si besoin
      const payload = { ...updateData };
      if (payload.status === 'delivered' || payload.status === 'repaired') {
        payload.repaired_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('repairs')
        .update(payload)
        .eq('id', repairId)
        .select();

      if (error) throw error;

      setRepairs((prev) =>
        prev.map((r) => (r.id === repairId ? { ...r, ...data[0] } : r))
      );

      return { success: true, data: data[0] };
    } catch (err) {
      console.error('Erreur mise à jour SAV:', err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    repairs,
    loading,
    fetchRepairs,
    addRepair,
    updateRepairStatus,
  };
}