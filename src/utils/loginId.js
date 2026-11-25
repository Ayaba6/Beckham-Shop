// Connexion par numéro de téléphone : Supabase identifie les comptes par email, donc un compte
// créé avec un téléphone reçoit un identifiant interne « 70123456@tel.btnt-services.app ».
// Aucun email n'est jamais envoyé à cette adresse (compte confirmé à la création).
// Même règle dans supabase/functions/create-user/index.ts : les garder identiques.
export const PHONE_LOGIN_DOMAIN = 'tel.btnt-services.app';

// « +226 70 12 34 56 », « 0022670123456 », « 70-12-34-56 » → « 70123456 »
export function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('226') && digits.length === 11) digits = digits.slice(3);
  return digits;
}

// Ce que l'utilisateur tape (téléphone ou email) → identifiant Supabase
export const loginIdOf = (identifier) =>
  identifier.includes('@')
    ? identifier.trim().toLowerCase()
    : `${normalizePhone(identifier)}@${PHONE_LOGIN_DOMAIN}`;

// Identifiant Supabase → ce qu'on affiche (le téléphone pour un compte créé par téléphone)
export const displayLoginId = (email) =>
  email?.endsWith(`@${PHONE_LOGIN_DOMAIN}`) ? email.split('@')[0] : email || '';
