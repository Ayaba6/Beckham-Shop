import { POS_PAYMENT_METHODS, PAYMENT_METHODS } from './constants';

/**
 * Libellé lisible d'un mode de paiement (ex: 'mobile_money' -> 'Mobile Money')
 */
export function formatPaymentMethod(method) {
  return (
    POS_PAYMENT_METHODS.find((m) => m.id === method)?.label ||
    PAYMENT_METHODS.find((m) => m.id === method)?.label ||
    method ||
    '-'
  );
}

/**
 * Formate un montant en devise (ex: FCFA)
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '0 FCFA';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF', // Code ISO pour le franc CFA BCEAO
    maximumFractionDigits: 0,
  }).format(amount).replace('XOF', 'FCFA');
}

/**
 * Formate une date au format lisible français (JJ/MM/AAAA à HH:MM)
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Valide sommairement un numéro IMEI (généralement 15 chiffres)
 */
export function isValidImei(imei) {
  const cleanImei = imei.trim();
  const regex = /^\d{15}$/;
  return regex.test(cleanImei);
}