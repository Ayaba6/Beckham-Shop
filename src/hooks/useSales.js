import { useState } from 'react';
import { supabase } from '../config/supabaseClient';

export function useSales() {
  const [loading, setLoading] = useState(false);

  // Enregistrer une nouvelle vente complète
  const createSale = async (saleData, cartItems, customerId = null) => {
    try {
      setLoading(true);

      // 1. Insérer la vente principale
      const { data: saleResult, error: saleError } = await supabase
        .from('sales')
        .insert([
          {
            customer_id: customerId,
            total_amount: saleData.totalAmount,
            discount_amount: saleData.discountAmount || 0,
            payment_method: saleData.paymentMethod,
            status: 'completed',
          },
        ])
        .select()
        .single();

      if (saleError) throw saleError;
      const saleId = saleResult.id;

      // 2. Préparer et insérer les lignes de vente
      for (const item of cartItems) {
        // Insérer dans sale_items
        const { error: itemError } = await supabase.from('sale_items').insert([
          {
            sale_id: saleId,
            product_id: item.productId,
            imei_id: item.imeiId || null,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            subtotal: item.unitPrice * item.quantity,
          },
        ]);

        if (itemError) throw itemError;

        // 3. Mettre à jour le stock selon le type de produit
        if (item.imeiId) {
          // Si c'est un téléphone avec IMEI, on le marque comme vendu
          const { error: imeiError } = await supabase
            .from('product_imeis')
            .update({ status: 'sold' })
            .eq('id', item.imeiId);

          if (imeiError) throw imeiError;
        } else {
          // Si c'est un accessoire, on décrémente la quantité en stock
          const { error: stockError } = await supabase.rpc('decrement_stock', {
            row_id: item.productId,
            qty: item.quantity,
          });

          // Si la fonction RPC n'existe pas encore, on fait un update classique :
          if (stockError) {
            const { data: currentProd } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.productId)
              .single();

            if (currentProd) {
              await supabase
                .from('products')
                .update({ stock_quantity: Math.max(0, currentProd.stock_quantity - item.quantity) })
                .eq('id', item.productId);
            }
          }
        }
      }

      return { success: true, saleId, sale: saleResult };
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement de la vente:', err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Récupérer l'historique des ventes
  const fetchSalesHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customers (full_name, phone),
          sale_items (
            *,
            products (name, brand, model),
            product_imeis (imei_number)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('Erreur récupération historique:', err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    createSale,
    fetchSalesHistory,
  };
}