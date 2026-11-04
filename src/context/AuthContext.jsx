import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';

const AuthContext = createContext();

export const ROLE_LABELS = {
  admin: 'Administrateur',
  seller: 'Vendeur',
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profilesMissing, setProfilesMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Charger le profil (nom, rôle) de l'utilisateur connecté
  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      // Table absente (supabase/profiles.sql pas encore exécuté) : on garde l'accès complet
      const missing = error.code === '42P01' || error.code === 'PGRST205';
      setProfilesMissing(missing);
      if (!missing) console.error('Erreur chargement profil:', error.message);
      setProfile(null);
      return;
    }
    setProfilesMissing(false);
    setProfile(data);
  }, []);

  useEffect(() => {
    // Récupérer la session existante (stockée par Supabase dans le navigateur)
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user ?? null);
      setLoading(false);
    });

    // Suivre les connexions / déconnexions
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      // Différé pour ne pas appeler Supabase à l'intérieur du callback d'authentification
      setTimeout(() => loadProfile(newSession?.user ?? null), 0);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Connexion par email et mot de passe
  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Erreur de connexion:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  // Déconnexion
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Erreur de déconnexion:', error.message);
  };

  const user = session?.user ?? null;
  const role = profilesMissing ? 'admin' : profile?.role || 'seller';

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        isAdmin: role === 'admin',
        profilesMissing,
        displayName: profile?.full_name || user?.email || 'Utilisateur',
        loading,
        signIn,
        signOut,
        refreshProfile: () => loadProfile(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
