// Constantes globales de l'application ShopManager

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Espèces' },
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'moov_money', label: 'Moov Money' },
  { id: 'wave', label: 'Wave' },
  { id: 'bank_card', label: 'Carte Bancaire' },
  { id: 'credit', label: 'Crédit / Échelonné' },
];

// Modes de paiement proposés par la caisse (valeurs enregistrées dans sales.payment_method)
export const POS_PAYMENT_METHODS = [
  { id: 'cash', label: 'Espèces' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'card', label: 'Carte Bancaire' },
  { id: 'credit', label: 'Crédit / Échelonné' },
];

// Modes acceptés pour un acompte ou un remboursement de crédit
export const REPAYMENT_METHODS = POS_PAYMENT_METHODS.filter((m) => m.id !== 'credit');

export const IMEI_STATUS = {
  IN_STOCK: 'in_stock',
  SOLD: 'sold',
  SAV: 'sav',
  DEFECTIVE: 'defective',
};

export const IMEI_STATUS_LABELS = {
  in_stock: { label: 'En stock', color: 'bg-green-100 text-green-800' },
  sold: { label: 'Vendu', color: 'bg-blue-100 text-blue-800' },
  sav: { label: 'En SAV', color: 'bg-orange-100 text-orange-800' },
  defective: { label: 'Défectueux', color: 'bg-red-100 text-red-800' },
};

export const CONDITION_TYPES = [
  { id: 'new', label: 'Neuf' },
  { id: 'refurbished', label: 'Reconditionné' },
  { id: 'used', label: 'Occasion' },
];

export const REPAIR_STATUSES = [
  { id: 'received', label: 'Reçu / Déposé' },
  { id: 'in_progress', label: 'En cours de réparation' },
  { id: 'waiting_parts', label: 'En attente de pièces' },
  { id: 'repaired', label: 'Réparé' },
  { id: 'delivered', label: 'Restitué au client' },
  { id: 'cancelled', label: 'Annulé' },
];