import { useState } from 'react';
import { supabase } from '../config/supabaseClient';
import { addCreditPayment } from './useCredits';

/**
 * Décrémente le stock d'un accessoire sans risque d'écraser une vente simultanée.
 * Utilise la fonction SQL decrement_stock si elle existe (voir supabase/decrement_stock.sql),
 * sinon une mise à jour conditionnelle : elle n'est appliquée que si le stock n'a pas
 * changé depuis la lecture, et elle est relancée dans le cas contraire.
 */
export async function decrementStock(productId, qty) {
  const { error: rpcError } = await supabase.rpc('decrement_stock', {
    row_id: productId,
    qty,
  });

  if (!rpcError) return { success: true };

  // La fonction existe mais a refusé (stock insuffisant) : ne pas contourner
  if (rpcError.code !== 'PGRST202' && rpcError.code !== '42883') {
    return { success: false, error: rpcError.message };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: current, error: readError } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();

    if (readError) return { success: false, error: readError.message };
    if (current.stock_quantity < qty) return { success: false, error: 'Stock insuffisant' };

    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: current.stock_quantity - qty })
      .eq('id', productId)
      .eq('stock_quantity', current.stock_quantity)
      .select('id');

    if (updateError) return { success: false, error: updateError.message };
    if (updated && updated.length > 0) return { success: true };
  }

  return { success: false, error: 'Stock modifié simultanément, veuillez vérifier' };
}

/**
 * Retrouve un client par son téléphone, ou le crée si un nom est fourni.
 * Renvoie son id, ou null si aucun téléphone n'est saisi.
 */
export async function findOrCreateCustomer(phone, name) {
  const cleanPhone = (phone || '').trim();
  const cleanName = (name || '').trim();
  if (!cleanPhone) return null;

  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', cleanPhone)
    .maybeSingle();
  if (existing) return existing.id;
  if (!cleanName) return null;

  const { data: created, error } = await supabase
    .from('customers')
    .insert([{ full_name: cleanName, phone: cleanPhone }])
    .select('id')
    .single();
  return error ? null : created.id;
}

/**
 * Enregistre une vente complète, utilisée par la caisse et par la page Crédits.
 * - items : [{ productId, name, brand, quantity, unitPrice }] (vide pour une dette libre)
 * - saleType 'debt' + totalAmount : dette libre sans article
 * Étapes : revérification du stock, client, vente, lignes (vente annulée en cas d'échec),
 * baisse du stock, acompte éventuel.
 * Renvoie { success, sale, customerId, remaining, warnings } ou { success: false, error, shortages }.
 */
export async function recordSale({
  items = [],
  customerPhone = '',
  customerName = '',
  paymentMethod = 'cash',
  discountAmount = 0,
  deposit = 0,
  depositMethod = 'cash',
  dueDate = null,
  notes = null,
  saleType = 'sale',
  totalAmount = null,
}) {
  const warnings = [];
  const isCredit = paymentMethod === 'credit';
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = saleType === 'debt' ? Number(totalAmount) || 0 : Math.max(0, subtotal - discountAmount);

  try {
    // 1. Revérifier le stock réel en base (un autre poste a pu vendre entre-temps)
    if (items.length > 0) {
      const { data: freshStock, error: stockErr } = await supabase
        .from('products')
        .select('id, stock_quantity')
        .in('id', items.map((item) => item.productId));
      if (stockErr) throw stockErr;

      const shortages = items
        .map((item) => ({ item, available: freshStock.find((p) => p.id === item.productId)?.stock_quantity ?? 0 }))
        .filter(({ item, available }) => available < item.quantity);

      if (shortages.length > 0) {
        const details = shortages
          .map(({ item, available }) => `- ${item.name} : ${available} disponible(s), ${item.quantity} demandé(s)`)
          .join('\n');
        return { success: false, shortages, error: 'Stock insuffisant, la vente n\'a pas été enregistrée :\n' + details };
      }
    }

    // 2. Retrouver ou créer le client
    const customerId = await findOrCreateCustomer(customerPhone, customerName);
    if (isCredit && !customerId) {
      return {
        success: false,
        error: 'Client introuvable : saisissez son téléphone, et son nom s\'il est nouveau, pour un crédit.',
      };
    }

    // 3. Créer la vente (les champs de crédit ne sont envoyés que s'ils sont utilisés)
    const salePayload = {
      customer_id: customerId,
      total_amount: total,
      discount_amount: saleType === 'debt' ? 0 : discountAmount,
      payment_method: paymentMethod,
      status: 'completed',
    };
    if (saleType !== 'sale') salePayload.sale_type = saleType;
    if (dueDate) salePayload.due_date = dueDate;
    if (notes) salePayload.notes = notes;

    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .insert([salePayload])
      .select()
      .single();

    if (saleErr) {
      if (saleErr.code === 'PGRST204' || saleErr.code === '42703') {
        throw new Error('Colonnes de crédit absentes : exécutez le fichier supabase/credit_terms.sql dans Supabase.');
      }
      throw saleErr;
    }

    // 4. Enregistrer toutes les lignes en une seule requête ; en cas d'échec, annuler la vente
    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from('sale_items').insert(
        items.map((item) => ({
          sale_id: sale.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.unitPrice * item.quantity,
        }))
      );
      if (itemsErr) {
        await supabase.from('sales').delete().eq('id', sale.id);
        throw itemsErr;
      }

      // 5. Décrémenter le stock de façon sûre
      const stockFailures = [];
      for (const item of items) {
        const res = await decrementStock(item.productId, item.quantity);
        if (!res.success) stockFailures.push(`- ${item.name} : ${res.error}`);
      }
      if (stockFailures.length > 0) {
        warnings.push(
          'Vente enregistrée, mais le stock de certains articles n\'a pas pu être mis à jour. ' +
          'Corrigez-le depuis la page Stock :\n' + stockFailures.join('\n')
        );
      }
    }

    // 6. Enregistrer l'acompte d'un crédit
    let depositSaved = 0;
    if (isCredit && deposit > 0) {
      const res = await addCreditPayment({
        saleId: sale.id,
        customerId,
        amount: deposit,
        paymentMethod: depositMethod,
        notes: 'Acompte',
      });
      if (res.success) depositSaved = deposit;
      else warnings.push('Vente enregistrée, mais l\'acompte n\'a pas pu l\'être : ' + res.error + '\nAjoutez-le depuis la page Crédits.');
    }

    return {
      success: true,
      sale: {
        ...sale,
        customers: customerPhone || customerName
          ? { full_name: customerName || null, phone: customerPhone || null }
          : null,
        sale_items: items.map((item, index) => ({
          id: index,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.unitPrice * item.quantity,
          products: { name: item.name, brand: item.brand },
        })),
      },
      customerId,
      remaining: isCredit ? total - depositSaved : 0,
      warnings,
    };
  } catch (err) {
    console.error('Erreur lors de l\'enregistrement de la vente:', err.message);
    return { success: false, error: err.message };
  }
}

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
          const stockResult = await decrementStock(item.productId, item.quantity);
          if (!stockResult.success) throw new Error(stockResult.error);
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