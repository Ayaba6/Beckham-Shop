import { useState, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';

/**
 * Charge les ventes d'une période avec leurs lignes, puis calcule les indicateurs
 * des accessoires à partir de la liste des produits (prix d'achat, stock).
 * La marge utilise le prix d'achat actuel de chaque accessoire.
 */
export function useAccessoryStats() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSales = useCallback(async (startDate, endDate) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('sales')
        .select('id, created_at, total_amount, discount_amount, sale_items (product_id, quantity, unit_price, subtotal)')
        .order('created_at', { ascending: true });
      if (startDate) query = query.gte('created_at', startDate.toISOString());
      if (endDate) query = query.lte('created_at', endDate.toISOString());

      const { data, error: salesError } = await query;
      if (salesError) throw salesError;
      setSales(data || []);
    } catch (err) {
      setError(err.message);
      console.error('Erreur chargement statistiques:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { sales, loading, error, fetchSales };
}

/**
 * Agrège les ventes : indicateurs globaux, classement des accessoires et stock dormant.
 */
export function computeAccessoryStats(sales, products) {
  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
  const perProduct = {};
  let revenue = 0;
  let discounts = 0;
  let itemsMargin = 0;
  let unitsSold = 0;

  sales.forEach((sale) => {
    revenue += Number(sale.total_amount) || 0;
    discounts += Number(sale.discount_amount) || 0;

    (sale.sale_items || []).forEach((item) => {
      const product = productsById[item.product_id];
      if (product?.is_serialized) return; // téléphones exclus des statistiques accessoires

      const qty = Number(item.quantity) || 0;
      const itemRevenue = Number(item.subtotal ?? item.unit_price * qty) || 0;
      const cost = qty * (Number(product?.purchase_price) || 0);

      if (!perProduct[item.product_id]) {
        perProduct[item.product_id] = {
          id: item.product_id,
          name: product?.name || 'Produit supprimé',
          brand: product?.brand || null,
          stock: product?.stock_quantity ?? null,
          quantity: 0,
          revenue: 0,
          margin: 0,
        };
      }
      perProduct[item.product_id].quantity += qty;
      perProduct[item.product_id].revenue += itemRevenue;
      perProduct[item.product_id].margin += itemRevenue - cost;

      unitsSold += qty;
      itemsMargin += itemRevenue - cost;
    });
  });

  // Les réductions sont accordées sur la vente entière : on les retire de la marge globale
  const grossMargin = itemsMargin - discounts;

  const ranking = Object.values(perProduct).map((p) => ({
    ...p,
    marginRate: p.revenue > 0 ? p.margin / p.revenue : 0,
  }));

  // Accessoires en stock sans aucune vente sur la période, triés par valeur immobilisée
  const idleStock = products
    .filter((p) => !p.is_serialized && p.stock_quantity > 0 && !perProduct[p.id])
    .map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      stock: p.stock_quantity,
      value: p.stock_quantity * (Number(p.purchase_price) || 0),
    }))
    .sort((a, b) => b.value - a.value);

  return {
    revenue,
    discounts,
    grossMargin,
    marginRate: revenue > 0 ? grossMargin / revenue : 0,
    unitsSold,
    salesCount: sales.length,
    averageBasket: sales.length > 0 ? revenue / sales.length : 0,
    ranking,
    idleStock,
    idleValue: idleStock.reduce((sum, p) => sum + p.value, 0),
  };
}

/**
 * Regroupe le chiffre d'affaires par jour (ou par mois au-delà de 62 jours).
 */
export function bucketRevenue(sales, startDate, endDate) {
  const first = startDate || (sales[0] ? new Date(sales[0].created_at) : new Date());
  const start = new Date(first);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate || new Date());

  const days = Math.round((end - start) / 86400000) + 1;
  const monthly = days > 62;

  const keyOf = (d) =>
    monthly
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Créer toutes les cases de la période, même vides, pour un axe continu
  const buckets = [];
  const cursor = new Date(start);
  if (monthly) cursor.setDate(1);
  while (cursor <= end) {
    buckets.push({
      key: keyOf(cursor),
      date: new Date(cursor),
      revenue: 0,
      count: 0,
    });
    if (monthly) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }

  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  sales.forEach((sale) => {
    const bucket = byKey[keyOf(new Date(sale.created_at))];
    if (bucket) {
      bucket.revenue += Number(sale.total_amount) || 0;
      bucket.count += 1;
    }
  });

  return { buckets, monthly };
}
