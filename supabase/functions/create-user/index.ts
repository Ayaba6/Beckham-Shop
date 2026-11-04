// Edge Function : création d'un utilisateur par un administrateur.
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
  let body: { email?: string; password?: string; full_name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Requête invalide' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const fullName = (body.full_name || '').trim();
  const role = body.role === 'admin' ? 'admin' : 'seller';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Email invalide' }, 400);
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
    return json({ error: duplicate ? 'Un compte existe déjà avec cet email' : message }, duplicate ? 409 : 400);
  }

  // 5. Le profil est créé par le déclencheur handle_new_user : on fixe le nom et le rôle
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: created.user.id,
      email,
      full_name: fullName || email.split('@')[0],
      role,
    })
    .select()
    .single();

  if (profileError) {
    return json({ error: `Compte créé, mais le rôle n'a pas pu être enregistré : ${profileError.message}` }, 500);
  }

  return json({ profile });
});
