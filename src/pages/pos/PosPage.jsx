import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  CheckCircle2, 
  Lock, 
  Unlock,
  PlusCircle,
  Tag,
  History,
  Calendar,
  ArrowLeft,
  FileDown
} from 'lucide-react';
import { recordSale } from '../../hooks/useSales';
import { useProfiles } from '../../hooks/useProfiles';
import { POS_PAYMENT_METHODS, REPAYMENT_METHODS } from '../../utils/constants';
import { generateInvoicePdf } from '../../components/pdf/InvoicePdf';
import { useProducts } from '../../hooks/useProducts';
import { useCashRegister } from '../../hooks/useCashRegister';
import { formatCurrency, formatPaymentMethod } from '../../utils/formatters';
import { supabase } from '../../config/supabaseClient';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

const emptySessionSummary = {
  totalSales: 0,
  salesByMethod: {},
  creditCashReceived: 0,
  creditOtherReceived: 0,
};

export default function PosPage() {
  const { products, loading: productsLoading, refreshProducts } = useProducts();
  const { currentSession, loading: sessionLoading, openRegister, closeRegister } = useCashRegister();
  const { nameOf } = useProfiles();

  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountAmount, setDiscountAmount] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [creditDeposit, setCreditDeposit] = useState('');
  const [creditDepositMethod, setCreditDepositMethod] = useState('cash');

  // États pour les modales
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [closingBalanceInput, setClosingBalanceInput] = useState('');
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(emptySessionSummary);

  // Historique des caisses fermées et filtres
  const [closedSessions, setClosedSessions] = useState([]);
  const [selectedClosedSession, setSelectedClosedSession] = useState(null);
  const [sessionSalesDetails, setSessionSalesDetails] = useState([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Charger l'historique des caisses fermées au montage ou au changement de session
  React.useEffect(() => {
    const fetchClosedSessions = async () => {
      try {
        const { data, error } = await supabase
          .from('cash_registers')
          .select('*')
          .eq('status', 'closed')
          .order('closed_at', { ascending: false });

        if (error) throw error;
        setClosedSessions(data || []);
      } catch (err) {
        console.error('Erreur chargement historique caisses:', err.message);
      }
    };
    fetchClosedSessions();
  }, [currentSession]);

  // Filtrer les sessions de caisse fermées
  const filteredClosedSessions = closedSessions.filter((session) => {
    const openedDateStr = new Date(session.opened_at).toLocaleDateString('fr-FR');
    const query = historySearchQuery.toLowerCase();
    
    const matchesSearch = openedDateStr.includes(query) || session.id.toLowerCase().includes(query);

    const sessionDate = new Date(session.opened_at);
    sessionDate.setHours(0, 0, 0, 0);

    let matchesDate = true;
    if (startDateFilter) {
      const start = new Date(startDateFilter);
      start.setHours(0, 0, 0, 0);
      if (sessionDate < start) matchesDate = false;
    }
    if (endDateFilter) {
      const end = new Date(endDateFilter);
      end.setHours(23, 59, 59, 999);
      if (sessionDate > end) matchesDate = false;
    }

    return matchesSearch && matchesDate;
  });

  // Filtrer uniquement les accessoires non sérialisés en stock
  const accessories = products.filter((p) => !p.is_serialized && p.stock_quantity > 0);
  const filteredAccessories = accessories.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Ajouter au panier
  const handleAddToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          alert('Stock insuffisant pour cet accessoire.');
          return prevCart;
        }
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  // Modifier la quantité dans le panier
  const handleUpdateQuantity = (productId, delta) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.stock_quantity) {
            alert('Stock maximum atteint.');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  // Calculs financiers
  const subtotalCart = cart.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);
  const discountVal = Number(discountAmount) || 0;
  const totalCartAmount = Math.max(0, subtotalCart - discountVal);

  // Ouvrir la caisse (Soumission)
  const handleOpenRegisterSubmit = async (e) => {
    e.preventDefault();
    const res = await openRegister(openingBalanceInput);
    if (!res.success) {
      alert('Erreur lors de l\'ouverture de la caisse : ' + res.error);
    } else {
      setOpeningBalanceInput('');
      setIsOpeningModalOpen(false);
    }
  };

  // Calculer le récapitulatif de la session en cours lors de la fermeture.
  // Seuls les encaissements en espèces doivent se retrouver dans le tiroir :
  // ventes payées en espèces + acomptes et remboursements de crédit reçus en espèces.
  const handleOpenCloseModal = async () => {
    if (!currentSession) return;
    try {
      const [salesRes, paymentsRes] = await Promise.all([
        supabase
          .from('sales')
          .select('total_amount, payment_method')
          .gte('created_at', currentSession.opened_at),
        supabase
          .from('credit_payments')
          .select('amount, payment_method')
          .gte('created_at', currentSession.opened_at),
      ]);

      if (salesRes.error) throw salesRes.error;
      // Table credit_payments absente : on ignore simplement les paiements de crédit
      if (paymentsRes.error) console.warn('Paiements de crédit non chargés:', paymentsRes.error.message);

      const salesByMethod = {};
      let totalSales = 0;
      (salesRes.data || []).forEach((s) => {
        const amount = Number(s.total_amount) || 0;
        salesByMethod[s.payment_method] = (salesByMethod[s.payment_method] || 0) + amount;
        totalSales += amount;
      });

      let creditCashReceived = 0;
      let creditOtherReceived = 0;
      (paymentsRes.data || []).forEach((p) => {
        if (p.payment_method === 'cash') creditCashReceived += Number(p.amount) || 0;
        else creditOtherReceived += Number(p.amount) || 0;
      });

      setSessionSummary({ totalSales, salesByMethod, creditCashReceived, creditOtherReceived });
    } catch (err) {
      console.error('Erreur calcul clôture de caisse:', err.message);
      setSessionSummary(emptySessionSummary);
    }
    setIsCloseModalOpen(true);
  };

  const expectedCash =
    Number(currentSession?.opening_balance || 0) +
    (sessionSummary.salesByMethod.cash || 0) +
    sessionSummary.creditCashReceived;

  // Fermer la caisse
  const handleCloseRegisterSubmit = async (e) => {
    e.preventDefault();
    const res = await closeRegister(
      currentSession.id,
      closingBalanceInput,
      expectedCash,
      sessionSummary.totalSales
    );

    if (res.success) {
      setIsCloseModalOpen(false);
      setClosingBalanceInput('');
      setSuccessMsg('Caisse fermée avec succès !');
      setSelectedClosedSession(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      alert('Erreur lors de la fermeture de caisse : ' + res.error);
    }
  };

  // Voir le détail des ventes et des articles d'une session fermée
  const handleSelectClosedSession = async (session) => {
    setSelectedClosedSession(session);
    try {
      // Récupérer les ventes avec les clients et les sale_items associés ainsi que les produits
      const { data: salesData, error } = await supabase
        .from('sales')
        .select(`
          *,
          customers (full_name, phone),
          sale_items (
            id,
            quantity,
            unit_price,
            subtotal,
            products (name, brand)
          )
        `)
        .gte('created_at', session.opened_at)
        .lte('created_at', session.closed_at || new Date().toISOString());

      if (!error) {
        setSessionSalesDetails(salesData || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Valider la vente (Checkout)
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!currentSession) {
      alert('Veuillez ouvrir la caisse avant d\'effectuer des ventes.');
      return;
    }

    if (discountVal > subtotalCart) {
      alert('La réduction ne peut pas dépasser le sous-total.');
      return;
    }

    const isCredit = paymentMethod === 'credit';
    const depositVal = isCredit ? Number(creditDeposit) || 0 : 0;
    if (isCredit) {
      if (!customerPhone.trim()) {
        alert('Une vente à crédit nécessite le téléphone du client.');
        return;
      }
      if (depositVal < 0 || depositVal >= totalCartAmount) {
        alert('L\'acompte doit être inférieur au total. Pour un paiement complet, choisissez un autre mode de paiement.');
        return;
      }
    }

    setLoadingCheckout(true);
    try {
      const result = await recordSale({
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          brand: item.brand,
          quantity: item.quantity,
          unitPrice: item.selling_price,
        })),
        customerPhone,
        customerName,
        paymentMethod,
        discountAmount: discountVal,
        deposit: depositVal,
        depositMethod: creditDepositMethod,
      });

      if (!result.success) {
        alert(result.error);
        if (result.shortages) refreshProducts();
        return;
      }
      result.warnings.forEach((warning) => alert(warning));

      // Garder la vente pour proposer la facture
      setLastSale({ ...result.sale, remaining: result.remaining });

      setCart([]);
      setCustomerPhone('');
      setCustomerName('');
      setDiscountAmount('');
      setCreditDeposit('');
      setPaymentMethod('cash');
      refreshProducts();
    } catch (err) {
      console.error('Erreur lors de l\'encaissement:', err.message);
      alert('Erreur lors de l\'encaissement : ' + err.message);
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (sessionLoading) {
    return <div className="p-8 text-center text-gray-500">Chargement de la caisse...</div>;
  }

  // ==========================================
  // VUE 1 : SI AUCUNE CAISSE N'EST OUVERTE (HISTORIQUE GÉNÉRAL ET BOUTON OUVRIR)
  // ==========================================
  if (!currentSession) {
    return (
      <div className="space-y-6">
        {successMsg && (
          <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-bounce">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* EN-TÊTE AVEC BOUTON OUVRIR CAISSE À DROITE */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Historique Général des Caisses</h1>
            <p className="text-xs text-gray-500">La caisse est actuellement fermée. Ouvrez une caisse pour lancer les ventes.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge colorClass="bg-red-100 text-red-800 flex items-center gap-1.5 px-3 py-2">
              <Lock className="w-4 h-4" /> Caisse Fermée
            </Badge>
            <Button onClick={() => setIsOpeningModalOpen(true)} className="text-xs py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2">
              <Unlock className="w-4 h-4" /> Ouvrir la Caisse
            </Button>
          </div>
        </div>

        {/* MODALE D'OUVERTURE DE CAISSE */}
        <Modal isOpen={isOpeningModalOpen} onClose={() => setIsOpeningModalOpen(false)} title="Ouverture de Caisse Journalière">
          <form onSubmit={handleOpenRegisterSubmit} className="space-y-4">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-sm text-indigo-900">
              <p className="font-semibold mb-1">Démarrage de la journée</p>
              <p className="text-xs text-indigo-700">Veuillez saisir le montant du fond de caisse initial présent dans le tiroir-caisse avant de commencer les ventes.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fond de caisse initial (FCFA)</label>
              <input
                type="number"
                required
                placeholder="Ex: 10000"
                value={openingBalanceInput}
                onChange={(e) => setOpeningBalanceInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpeningModalOpen(false)} className="w-1/2">
                Annuler
              </Button>
              <Button type="submit" className="w-1/2">
                Confirmer l'ouverture
              </Button>
            </div>
          </form>
        </Modal>

        {/* CONTENU DE L'HISTORIQUE ÉTENDU AVEC RECHERCHE ET DATES */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          {selectedClosedSession ? (
            <div className="space-y-4">
              <button 
                onClick={() => setSelectedClosedSession(null)}
                className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Retour à la liste des journées
              </button>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-1.5 text-gray-700">
                <p className="font-bold text-sm text-gray-900 mb-2">Résumé de la journée du {new Date(selectedClosedSession.opened_at).toLocaleDateString('fr-FR')}</p>
                <div className="flex justify-between"><span>Ouverture :</span> <span className="font-medium">{new Date(selectedClosedSession.opened_at).toLocaleTimeString('fr-FR')}</span></div>
                <div className="flex justify-between"><span>Fermeture :</span> <span className="font-medium">{selectedClosedSession.closed_at ? new Date(selectedClosedSession.closed_at).toLocaleTimeString('fr-FR') : '-'}</span></div>
                {(selectedClosedSession.opened_by || selectedClosedSession.closed_by) && (
                  <>
                    <div className="flex justify-between"><span>Ouverte par :</span> <span className="font-medium">{nameOf(selectedClosedSession.opened_by) || '-'}</span></div>
                    <div className="flex justify-between"><span>Fermée par :</span> <span className="font-medium">{nameOf(selectedClosedSession.closed_by) || '-'}</span></div>
                  </>
                )}
                <div className="flex justify-between"><span>Fond initial :</span> <span className="font-medium">{formatCurrency(selectedClosedSession.opening_balance)}</span></div>
                <div className="flex justify-between"><span>Ventes totales :</span> <span className="font-medium text-emerald-600">{formatCurrency(selectedClosedSession.total_sales_amount)}</span></div>
                <div className="flex justify-between"><span>Attendu en caisse :</span> <span className="font-medium">{formatCurrency(selectedClosedSession.expected_balance)}</span></div>
                <div className="flex justify-between"><span>Réel compté :</span> <span className="font-medium">{formatCurrency(selectedClosedSession.closing_balance)}</span></div>
              </div>

              <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider">Détails des ventes et articles ({sessionSalesDetails.length})</h4>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {sessionSalesDetails.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Aucune vente enregistrée sur cette session.</p>
                ) : (
                  sessionSalesDetails.map((sale) => (
                    <div key={sale.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <div>
                          <span className="font-semibold text-gray-900">{sale.customers?.full_name || 'Client de passage'}</span>
                          {sale.customers?.phone && <span className="text-gray-500 ml-2">({sale.customers.phone})</span>}
                          <div className="text-[11px] text-gray-400">
                            {new Date(sale.created_at).toLocaleTimeString('fr-FR')} - Paiement : <span className="font-medium">{formatPaymentMethod(sale.payment_method)}</span>
                            {nameOf(sale.seller_id) && <> - Vendeur : <span className="font-medium">{nameOf(sale.seller_id)}</span></>}
                          </div>
                        </div>
                        <span className="font-bold text-indigo-600 text-sm">{formatCurrency(sale.total_amount)}</span>
                      </div>

                      {/* Liste des articles de la vente */}
                      <div className="space-y-1 pl-2">
                        {sale.sale_items?.map((item) => (
                          <div key={item.id} className="flex justify-between text-gray-700">
                            <span>• {item.products?.name || 'Accessoire'} <span className="text-gray-400">({item.quantity} x {formatCurrency(item.unit_price)})</span></span>
                            <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                          </div>
                        ))}
                      </div>

                      {sale.discount_amount > 0 && (
                        <div className="text-right text-[11px] text-amber-600 font-medium">
                          Réduction appliquée : -{formatCurrency(sale.discount_amount)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* BARRES DE RECHERCHE ET FILTRES DE DATES */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Rechercher par date (ex: 24/10/2026)..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">Du :</span>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">Au :</span>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {(startDateFilter || endDateFilter || historySearchQuery) && (
                <button
                  onClick={() => { setHistorySearchQuery(''); setStartDateFilter(''); setEndDateFilter(''); }}
                  className="text-xs text-indigo-600 font-medium hover:underline block"
                >
                  Réinitialiser les filtres
                </button>
              )}

              {/* LISTE DES JOURNÉES DE CAISSE FERMÉES */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredClosedSessions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-12">Aucune journée de caisse fermée trouvée pour ces critères.</p>
                ) : (
                  filteredClosedSessions.map((session) => (
                    <div 
                      key={session.id} 
                      onClick={() => handleSelectClosedSession(session)}
                      className="p-4 bg-white border border-gray-200 hover:border-indigo-500 rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div>
                        <p className="font-bold text-sm text-gray-900 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-600" />
                          {new Date(session.opened_at).toLocaleDateString('fr-FR', { dateStyle: 'full' })}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Fermée à {session.closed_at ? new Date(session.closed_at).toLocaleTimeString('fr-FR', { timeStyle: 'short' }) : '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(session.total_sales_amount)}</p>
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded font-medium">Voir détails →</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VUE 2 : SI LA CAISSE EST OUVERTE (INTERFACE DE VENTE DE LA JOURNÉE)
  // ==========================================
  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* EN-TÊTE ET STATUT DE CAISSE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Caisse (POS) - Accessoires</h1>
          <p className="text-xs text-gray-500">Session de caisse active. Encaissement des ventes en cours.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Badge colorClass="bg-emerald-100 text-emerald-800 flex items-center gap-1.5 px-3 py-1.5">
            <Unlock className="w-3.5 h-3.5" /> Ouverte (Fond: {formatCurrency(currentSession.opening_balance)})
          </Badge>
          <Button onClick={handleOpenCloseModal} variant="outline" className="text-xs py-1.5 border-red-200 text-red-600 hover:bg-red-50">
            Fermer la Caisse
          </Button>
        </div>
      </div>

      {/* MODALE DE FERMETURE DE CAISSE */}
      <Modal isOpen={isCloseModalOpen} onClose={() => setIsCloseModalOpen(false)} title="Clôture de Caisse">
        <form onSubmit={handleCloseRegisterSubmit} className="space-y-4">
          {/* Ventes de la session par mode de paiement (informatif) */}
          <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-1.5 text-xs text-gray-600">
            <p className="font-semibold text-gray-800 text-sm mb-1">
              Ventes de la session : {formatCurrency(sessionSummary.totalSales)}
            </p>
            {Object.entries(sessionSummary.salesByMethod).map(([method, amount]) => (
              <div key={method} className="flex justify-between">
                <span>{formatPaymentMethod(method)}{method === 'credit' ? ' (non encaissé)' : ''}</span>
                <span>{formatCurrency(amount)}</span>
              </div>
            ))}
            {sessionSummary.creditOtherReceived > 0 && (
              <div className="flex justify-between">
                <span>Crédits remboursés hors espèces</span>
                <span>{formatCurrency(sessionSummary.creditOtherReceived)}</span>
              </div>
            )}
          </div>

          {/* Espèces attendues dans le tiroir */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>Fond initial :</span>
              <span className="font-semibold">{formatCurrency(currentSession?.opening_balance || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ventes en espèces :</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(sessionSummary.salesByMethod.cash || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Acomptes et remboursements en espèces :</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(sessionSummary.creditCashReceived)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
              <span>Espèces attendues en caisse :</span>
              <span>{formatCurrency(expectedCash)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant réel compté en caisse (FCFA)</label>
            <input
              type="number"
              required
              placeholder="Ex: 45000"
              value={closingBalanceInput}
              onChange={(e) => setClosingBalanceInput(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {closingBalanceInput !== '' && (() => {
              const gap = Number(closingBalanceInput) - expectedCash;
              return (
                <p className={`mt-1.5 text-xs font-semibold ${gap === 0 ? 'text-emerald-600' : gap > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                  {gap === 0
                    ? 'Caisse juste'
                    : `Écart : ${gap > 0 ? '+' : '-'}${formatCurrency(Math.abs(gap))} (${gap > 0 ? 'excédent' : 'manquant'})`}
                </p>
              );
            })()}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsCloseModalOpen(false)} className="w-1/2">
              Annuler
            </Button>
            <Button type="submit" className="w-1/2">
              Confirmer la Clôture
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODALE DE VENTE ENREGISTRÉE */}
      <Modal isOpen={!!lastSale} onClose={() => setLastSale(null)} title="Vente enregistrée">
        {lastSale && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <div>
              <p className="text-sm text-gray-500">Vente #{lastSale.id.slice(0, 8)}</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(lastSale.total_amount)}</p>
              {lastSale.customers?.full_name && (
                <p className="text-sm text-gray-500">{lastSale.customers.full_name}</p>
              )}
              {lastSale.remaining > 0 && (
                <p className="mt-2 text-sm font-semibold text-orange-700">
                  Crédit : reste dû {formatCurrency(lastSale.remaining)}
                </p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setLastSale(null)} className="w-1/2">
                Nouvelle vente
              </Button>
              <Button onClick={() => generateInvoicePdf(lastSale)} className="w-1/2">
                <FileDown className="w-4 h-4" />
                Facture PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* INTERFACE PRINCIPALE DE CAISSE (2 COLONNES) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLONNE GAUCHE : CATALOGUE EN LISTE (TABLEAU) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un accessoire par nom ou marque..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-sm focus:outline-none text-gray-800 placeholder-gray-400"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="max-h-[550px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 border-b border-gray-200">
                    <th className="px-4 py-3">Accessoire</th>
                    <th className="px-4 py-3">Catégorie</th>
                    <th className="px-4 py-3">Prix de Vente</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {productsLoading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                        Chargement des accessoires...
                      </td>
                    </tr>
                  ) : filteredAccessories.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                        Aucun accessoire trouvé en stock.
                      </td>
                    </tr>
                  ) : (
                    filteredAccessories.map((product) => (
                      <tr 
                        key={product.id} 
                        className="transition-colors hover:bg-indigo-50/50 cursor-pointer"
                        onClick={() => handleAddToCart(product)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{product.name}</div>
                          {product.brand && <div className="text-xs text-gray-400">{product.brand}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {product.categories?.name || 'Accessoires'}
                        </td>
                        <td className="px-4 py-3 font-bold text-indigo-600">
                          {formatCurrency(product.selling_price)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-800 rounded-md">
                            {product.stock_quantity} unités
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(product);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Ajouter
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : PANIER, RÉDUCTION ET PAIEMENT */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-fit">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
              Panier en cours
            </h2>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Le panier est vide.</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg text-sm">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-indigo-600">{formatCurrency(item.selling_price)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, -1)}
                        className="w-6 h-6 bg-white border border-gray-200 rounded flex items-center justify-center text-gray-600 hover:bg-gray-100"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, 1)}
                        className="w-6 h-6 bg-white border border-gray-200 rounded flex items-center justify-center text-gray-600 hover:bg-gray-100"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* SECTION CLIENT ET RÉDUCTION */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <input
                type="text"
                placeholder="Téléphone client (Optionnel)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Nom du client (Optionnel)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <input
                  type="number"
                  placeholder="Montant de la réduction (FCFA)"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-amber-50/40 text-amber-900 placeholder-gray-400 font-medium"
                />
              </div>

              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {POS_PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>

              {paymentMethod === 'credit' && (
                <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
                  <p className="text-xs text-orange-800">
                    Vente à crédit : le téléphone du client est obligatoire (et son nom s'il est nouveau).
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Acompte (FCFA)"
                      value={creditDeposit}
                      onChange={(e) => setCreditDeposit(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                    <select
                      value={creditDepositMethod}
                      onChange={(e) => setCreditDepositMethod(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    >
                      {REPAYMENT_METHODS.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-orange-900">
                    <span>Reste dû après acompte :</span>
                    <span>{formatCurrency(Math.max(0, totalCartAmount - (Number(creditDeposit) || 0)))}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TOTAUX ET VALIDATION */}
          <div className="pt-4 border-t border-gray-100 space-y-2 mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Sous-total :</span>
              <span>{formatCurrency(subtotalCart)}</span>
            </div>
            {discountVal > 0 && (
              <div className="flex items-center justify-between text-xs text-amber-600 font-medium">
                <span>Réduction accordée :</span>
                <span>- {formatCurrency(discountVal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-100">
              <span>Total à payer :</span>
              <span className="text-indigo-600">{formatCurrency(totalCartAmount)}</span>
            </div>

            <Button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              isLoading={loadingCheckout}
              className="w-full py-3 mt-2"
            >
              Encaisser la vente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}