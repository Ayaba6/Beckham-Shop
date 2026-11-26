import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import { displayLoginId } from '../utils/loginId';

/**
 * Liste des profils utilisateurs (nom, rôle). Sert à afficher le vendeur d'une vente
 * et à gérer les utilisateurs. Renvoie une liste vide si la table n'existe pas encore.
 */
export function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at');

      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
      console.warn('Profils non chargés:', err.message);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Mettre à jour le nom ou le rôle d'un utilisateur (administrateurs uniquement)
  const updateProfile = async (id, changes) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(changes)
        .eq('id', id)
        .select();

      if (error) throw error;
      // Sans ligne renvoyée, la règle d'accès a bloqué la modification
      if (!data || data.length === 0) throw new Error('Modification refusée (réservée aux administrateurs).');

      setProfiles((prev) => prev.map((p) => (p.id === id ? data[0] : p)));
      return { success: true, data: data[0] };
    } catch (err) {
      console.error('Erreur mise à jour profil:', err.message);
      return { success: false, error: err.message };
    }
  };

  // Appel de l'Edge Function create-user (administrateurs uniquement)
  const callUserFunction = async (body) => {
    const { data, error } = await supabase.functions.invoke('create-user', { body });
    if (!error) return data;

    // Lire le message renvoyé par la fonction (ex : numéro déjà utilisé)
    let message = error.message;
    try {
      const details = await error.context?.json();
      if (details?.error) message = details.error;
    } catch {
      // Pas de corps JSON : la fonction n'est probablement pas déployée
      message = 'La fonction create-user est introuvable ou inaccessible. Déployez-la dans Supabase (Edge Functions).';
    }
    throw new Error(message);
  };

  // Définir un nouveau mot de passe pour un compte
  const setUserPassword = async (id, password) => {
    try {
      await callUserFunction({ action: 'set_password', user_id: id, password });
      return { success: true };
    } catch (err) {
      console.error('Erreur mot de passe:', err.message);
      return { success: false, error: err.message };
    }
  };

  // Supprimer un compte : il est bloqué et masqué, son nom reste dans l'historique
  const deleteUser = async (id) => {
    try {
      await callUserFunction({ action: 'delete', user_id: id });
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, disabled: true } : p)));
      return { success: true };
    } catch (err) {
      console.error('Erreur suppression utilisateur:', err.message);
      return { success: false, error: err.message };
    }
  };

  // Créer un compte
  const createUser = async ({ phone, password, fullName, role }) => {
    try {
      const data = await callUserFunction({ phone, password, full_name: fullName, role });
      setProfiles((prev) => [...prev, data.profile]);
      return { success: true, data: data.profile };
    } catch (err) {
      console.error('Erreur création utilisateur:', err.message);
      return { success: false, error: err.message };
    }
  };

  const nameOf = (id) => {
    if (!id) return null;
    const profile = profiles.find((p) => p.id === id);
    return profile ? profile.full_name || displayLoginId(profile.email) : null;
  };

  return { profiles, loading, fetchProfiles, updateProfile, createUser, deleteUser, setUserPassword, nameOf };
}
