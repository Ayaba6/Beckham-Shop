import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  User, 
  CreditCard, 
  Eye, 
  Tag,
  RefreshCw,
  Phone,
  FileDown,
  ShieldCheck
} from 'lucide-react';
import { generateInvoicePdf } from '../../components/pdf/InvoicePdf';
import { generateWarrantyPdf } from '../../components/pdf/WarrantyPdf';
import Button from '../../components/common/Button';
import { supabase } from '../../config/supabaseClient';
import { formatCurrency, formatPaymentMethod } from '../../utils/formatters';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export default function SalesHistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);

  // Charger les ventes et les données associées de façon robuste
  const fetchSales = async () => {
    try {
      setLoading(true);

      // 1. Récupérer toutes les ventes
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      if (!salesData || salesData.length === 0) {
        setSales([]);
        setLoading(false);
        return;
      }

      // 2. Pour chaque vente, récupérer le client et les items associés avec leurs produits
      const enrichedSales = await Promise.all(
        salesData.map(async (sale) => {
          let customer = null;
          if (sale.customer_id) {
            const { data: custData } = await supabase
              .from('customers')
              .select('*')
              .eq('id', sale.customer_id)
              .maybeSingle();
            customer = custData;
          }

          // Récupérer les lignes de vente
          const { data: itemsData } = await supabase
            .from('sale_items')
            .select('*')
            .eq('sale_id', sale.id);

          // Pour chaque item, récupérer manuellement le nom et la marque du produit
          let itemsWithProducts = [];
          if (itemsData) {
            itemsWithProducts = await Promise.all(
              itemsData.map(async (item) => {
                let productInfo = null;
                if (item.product_id) {
                  const { data: prodData } = await supabase
                    .from('products')
                    .select('name, brand')
                    .eq('id', item.product_id)
                    .maybeSingle();
                  productInfo = prodData;
                }
                let imeiInfo = null;
                if (item.imei_id) {
                  const { data: imeiData } = await supabase
                    .from('product_imeis')
                    .select('imei_number')
                    .eq('id', item.imei_id)
                    .maybeSingle();
                  imeiInfo = imeiData;
                }
                return {
                  ...item,
                  products: productInfo,
                  product_imeis: imeiInfo
                };
              })
            );
          }

          return {
            ...sale,
            customers: customer,
            sale_items: itemsWithProducts
          };
        })
      );

      setSales(enrichedSales);
    } catch (err) {
      console.error('Erreur chargement historique ventes:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // Filtrer les ventes par nom/téléphone du client ou ID de vente
  const filteredSales = sales.filter((sale) => {
    const customerName = sale.customers?.full_name?.toLowerCase() || '';
    const customerPhone = sale.customers?.phone || '';
    const saleId = sale.id.toLowerCase();
    const query = searchQuery.toLowerCase();

    return customerName.includes(query) || customerPhone.includes(query) || saleId.includes(query);
  });

  return (
    <div className="space-y-6">
      {/* EN-TÊTE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historique des Ventes</h1>
          <p className="text-sm text-gray-500">Consultez et vérifiez toutes les transactions enregistrées.</p>
        </div>
        <button
          onClick={fetchSales}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* BARRE DE RECHERCHE */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par client, téléphone ou numéro de vente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none text-sm focus:outline-none text-gray-800 placeholder-gray-400"
        />
      </div>

      {/* TABLEAU HISTORIQUE */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-3">Réf Vente</th>
                <th className="px-6 py-3">Date & Heure</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Paiement</th>
                <th className="px-6 py-3">Réduction</th>
                <th className="px-6 py-3">Montant Total</th>
                <th className="px-6 py-3 text-right">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    Chargement de l'historique...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    Aucune vente enregistrée pour le moment.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-gray-700">
                      #{sale.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {new Date(sale.created_at).toLocaleString('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      {sale.customers ? (
                        <div>
                          <div className="font-semibold text-gray-900">{sale.customers.full_name || 'Client de passage'}</div>
                          {sale.customers.phone && <div className="text-xs text-gray-400">{sale.customers.phone}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Client anonyme</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge colorClass="bg-gray-100 text-gray-800 capitalize">
                        {formatPaymentMethod(sale.payment_method)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-amber-600">
                      {sale.discount_amount > 0 ? (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" /> -{formatCurrency(sale.discount_amount)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-indigo-600">
                      {formatCurrency(sale.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Voir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALE DE DÉTAIL D'UNE VENTE */}
      <Modal
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        title={`Détail de la vente #${selectedSale?.id.slice(0, 8)}`}
      >
        {selectedSale && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1.5 text-gray-600">
              <p><strong>Date :</strong> {new Date(selectedSale.created_at).toLocaleString('fr-FR')}</p>
              <p><strong>Client :</strong> {selectedSale.customers?.full_name || 'Client anonyme'}</p>
              <p className="flex items-center gap-1">
                <strong>Téléphone :</strong> 
                <span className="text-indigo-600 font-medium">
                  {selectedSale.customers?.phone || 'Non renseigné'}
                </span>
              </p>
              <p><strong>Mode de paiement :</strong> <span>{formatPaymentMethod(selectedSale.payment_method)}</span></p>
            </div>

            <h4 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">Articles achetés</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedSale.sale_items?.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {item.products?.name || 'Accessoire'} {item.products?.brand ? `(${item.products.brand})` : ''}
                    </p>
                    <p className="text-xs text-gray-500">{item.quantity} x {formatCurrency(item.unit_price)}</p>
                    {item.product_imeis?.imei_number && (
                      <p className="text-xs font-mono text-indigo-600">IMEI : {item.product_imeis.imei_number}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.product_imeis?.imei_number && (
                      <button
                        onClick={() =>
                          generateWarrantyPdf({
                            type: 'sale',
                            reference: `${selectedSale.id.slice(0, 8).toUpperCase()}-${item.product_imeis.imei_number.slice(-4)}`,
                            date: selectedSale.created_at,
                            customerName: selectedSale.customers?.full_name,
                            customerPhone: selectedSale.customers?.phone,
                            deviceName: [item.products?.name, item.products?.brand].filter(Boolean).join(' - '),
                            imei: item.product_imeis.imei_number,
                            amount: item.unit_price,
                          })
                        }
                        title="Certificat de garantie"
                        className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    )}
                    <span className="font-bold text-gray-900">{formatCurrency(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-200 space-y-1 text-sm">
              {selectedSale.discount_amount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Réduction :</span>
                  <span>-{formatCurrency(selectedSale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-gray-900">
                <span>Total Payé :</span>
                <span className="text-indigo-600">{formatCurrency(selectedSale.total_amount)}</span>
              </div>
            </div>

            <Button onClick={() => generateInvoicePdf(selectedSale)} className="w-full py-2.5">
              <FileDown className="w-4 h-4" />
              Télécharger la facture (PDF)
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}