import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';

export function useCashRegister() {
  const [currentSession, setCurrentSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveSession = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentSession(data || null);
    } catch (err) {
      console.error('Erreur récupération session de caisse:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  // Ouvrir la caisse
  const openRegister = async (openingBalance, notes = '') => {
    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .insert([{
          opening_balance: Number(openingBalance) || 0,
          status: 'open',
          notes
        }])
        .select()
        .single();

      if (error) throw error;
      setCurrentSession(data);
      return { success: true, data };
    } catch (err) {
      console.error('Erreur ouverture de caisse:', err.message);
      return { success: false, error: err.message };
    }
  };

  // Fermer la caisse
  const closeRegister = async (sessionId, closingBalance, expectedBalance, totalSales) => {
    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .update({
          closed_at: new Date().toISOString(),
          closing_balance: Number(closingBalance) || 0,
          expected_balance: Number(expectedBalance) || 0,
          total_sales_amount: Number(totalSales) || 0,
          status: 'closed'
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      setCurrentSession(null);
      return { success: true, data };
    } catch (err) {
      console.error('Erreur fermeture de caisse:', err.message);
      return { success: false, error: err.message };
    }
  };

  return {
    currentSession,
    loading,
    refreshSession: fetchActiveSession,
    openRegister,
    closeRegister
  };
}