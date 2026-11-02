import { useState, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';

/**
 * Enregistre un paiement (acompte ou remboursement) sur une vente à crédit.
 */
export async function addCreditPayment({ saleId, customerId, amount, paymentMethod = 'cash', notes = '' }) {
  try {
    const { data, error } = await supabase
      .from('credit_payments')
      .insert([{
        sale_id: saleId,
        customer_id: customerId || null,
        amount: Number(amount),
        payment_method: paymentMethod,
        notes: notes || null,
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Erreur enregistrement paiement crédit:', err.message);
    return { success: false, error: err.message };
  }
}

export function useCredits() {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Charger les ventes à crédit avec leur client, leurs paiements et le reste dû
  const fetchCredits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('payment_method', 'credit')
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;
      if (!salesData || salesData.length === 0) {
        setCredits([]);
        return;
      }

      const saleIds = salesData.map((s) => s.id);
      const customerIds = [...new Set(salesData.map((s) => s.customer_id).filter(Boolean))];

      const [paymentsRes, customersRes] = await Promise.all([
        supabase
          .from('credit_payments')
          .select('*')
          .in('sale_id', saleIds)
          .order('created_at', { ascending: true }),
        customerIds.length
          ? supabase.from('customers').select('*').in('id', customerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      if (customersRes.error) throw customersRes.error;

      setCredits(
        salesData.map((sale) => {
          const payments = paymentsRes.data.filter((p) => p.sale_id === sale.id);
          const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
          return {
            ...sale,
            customers: customersRes.data.find((c) => c.id === sale.customer_id) || null,
            payments,
            paid,
            remaining: Math.max(0, Number(sale.total_amount) - paid),
          };
        })
      );
    } catch (err) {
      setError(err.message);
      console.error('Erreur chargement crédits:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    credits,
    loading,
    error,
    fetchCredits,
  };
}
