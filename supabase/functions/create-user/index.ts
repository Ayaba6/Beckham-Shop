// Edge Function : création, changement de mot de passe (action « set_password ») et suppression
// (action « delete ») d'un utilisateur par un administrateur.
// La clé service_role (fournie automatiquement par Supabase) reste côté serveur.
//
// Déploiement : Supabase > Edge Functions > Deploy a new function > Via Editor,
// nom « create-user », coller ce fichier, Deploy.
// (ou en ligne de commande : supabase functions deploy create-user)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Identifier l'appelant à partir de son jeton de connexion
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller?.user) return json({ error: 'Non connecté' }, 401);

  // 2. Vérifier qu'il est administrateur
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .maybeSingle();
  if (callerProfile?.role !== 'admin') {
    return json({ error: 'Réservé aux administrateurs' }, 403);
  }

  // 3. Valider la demande
  let body: {
    action?: string; user_id?: string;
    phone?: string; email?: string; password?: string; full_name?: string; role?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Requête invalide' }, 400);
  }

  // Nouveau mot de passe (action « set_password ») : l'admin le remet en main propre
  if (body.action === 'set_password') {
    const userId = body.user_id || '';
    if (!userId) return json({ error: 'Utilisateur manquant' }, 400);
    if ((body.password || '').length < 8) {
      return json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, 400);
    }
    const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password: body.password });
    if (passwordError) return json({ error: `Mot de passe non modifié : ${passwordError.message}` }, 400);
    return json({ updated: userId });
  }

  // Suppression (action « delete ») : le compte est bloqué et masqué, pas effacé,
  // pour garder son nom sur les ventes, caisses et crédits passés
  if (body.action === 'delete') {
    const userId = body.user_id || '';
    if (!userId) return json({ error: 'Utilisateur manquant' }, 400);
    if (userId === caller.user.id) return json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, 400);

    const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
    if (banError) return json({ error: `Blocage impossible : ${banError.message}` }, 400);

    const { error: disableError } = await admin.from('profiles').update({ disabled: true }).eq('id', userId);
    if (disableError) {
      return json({ error: `Compte bloqué, mais pas masqué de la liste : ${disableError.message}` }, 500);
    }
    return json({ deleted: userId });
  }

  // Connexion par téléphone : identifiant interne « 70123456@tel.btnt-services.app »
  // (même règle que src/utils/loginId.js : les garder identiques)
  let phone = (body.phone || '').replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('226') && phone.length === 11) phone = phone.slice(3);
  if (body.phone && (phone.length < 8 || phone.length > 15)) return json({ error: 'Numéro de téléphone invalide' }, 400);

  const email = phone ? `${phone}@tel.btnt-services.app` : (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const fullName = (body.full_name || '').trim();
  const role = ['admin', 'cashier', 'seller'].includes(body.role ?? '') ? body.role! : 'seller';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Téléphone ou email invalide' }, 400);
  if (password.length < 8) return json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, 400);

  // 4. Créer le compte (email confirmé d'office : l'admin remet le mot de passe en main propre)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created?.user) {
    const message = createError?.message || 'Création impossible';
    const duplicate = /already|registered|exists/i.test(message);
    const label = phone ? 'ce numéro' : 'cet email';
    return json({ error: duplicate ? `Un compte existe déjà avec ${label}` : message }, duplicate ? 409 : 400);
  }

  // 5. Le profil est créé par le déclencheur handle_new_user : on fixe le nom et le rôle
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: created.user.id,
      email,
      full_name: fullName || phone || email.split('@')[0],
      role,
    })
    .select()
    .single();

  if (profileError) {
    return json({ error: `Compte créé, mais le rôle n'a pas pu être enregistré : ${profileError.message}` }, 500);
  }

  return json({ profile });
});
