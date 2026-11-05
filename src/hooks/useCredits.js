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

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setCredits(
        salesData.map((sale) => {
          const payments = paymentsRes.data.filter((p) => p.sale_id === sale.id);
          const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
          const remaining = Math.max(0, Number(sale.total_amount) - paid);

          // Jours de retard : échéance dépassée et reste dû
          let daysOverdue = 0;
          if (sale.due_date && remaining > 0) {
            const due = new Date(`${sale.due_date}T00:00:00`);
            daysOverdue = Math.max(0, Math.round((today - due) / 86400000));
          }

          return {
            ...sale,
            customers: customersRes.data.find((c) => c.id === sale.customer_id) || null,
            payments,
            paid,
            remaining,
            daysOverdue,
            isOverdue: daysOverdue > 0,
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

  // Modifier la date limite de paiement d'un crédit (administrateurs, voir rls_policies.sql)
  const updateDueDate = async (saleId, dueDate) => {
    try {
      const { data, error: updateError } = await supabase
        .from('sales')
        .update({ due_date: dueDate || null })
        .eq('id', saleId)
        .select('id');

      if (updateError) throw updateError;
      if (!data || data.length === 0) throw new Error('Modification refusée (réservée aux administrateurs).');
      await fetchCredits();
      return { success: true };
    } catch (err) {
      console.error('Erreur mise à jour échéance:', err.message);
      return { success: false, error: err.message };
    }
  };

  return {
    credits,
    loading,
    error,
    fetchCredits,
    updateDueDate,
  };
}
