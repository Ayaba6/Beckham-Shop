import React, { useState } from 'react';
import {
  CheckCircle2,
  Edit2,
  RefreshCw,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useProfiles } from '../../hooks/useProfiles';
import { useAuth, ROLE_LABELS } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

const ROLE_COLORS = {
  admin: 'bg-indigo-100 text-indigo-800',
  seller: 'bg-gray-100 text-gray-800',
};

export default function UsersPage() {
  const { profiles, loading, fetchProfiles, updateProfile } = useProfiles();
  const { user, profilesMissing, refreshProfile } = useAuth();

  const [editingProfile, setEditingProfile] = useState(null);
  const [formData, setFormData] = useState({ full_name: '', role: 'seller' });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleOpenEdit = (profile) => {
    setEditingProfile(profile);
    setFormData({ full_name: profile.full_name || '', role: profile.role });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isSelf = editingProfile.id === user?.id;
    if (isSelf && editingProfile.role === 'admin' && formData.role !== 'admin') {
      const confirmed = window.confirm(
        'Vous allez retirer vos propres droits administrateur. Vous ne pourrez plus accéder à cette page. Continuer ?'
      );
      if (!confirmed) return;
    }

    setSaving(true);
    const result = await updateProfile(editingProfile.id, {
      full_name: formData.full_name.trim() || null,
      role: formData.role,
    });
    setSaving(false);

    if (result.success) {
      setEditingProfile(null);
      setSuccessMsg('Utilisateur mis à jour !');
      setTimeout(() => setSuccessMsg(''), 3000);
      if (isSelf) refreshProfile();
    } else {
      alert(
        result.error.includes('au moins un administrateur')
          ? 'Impossible : il doit rester au moins un administrateur.'
          : 'Erreur : ' + result.error
      );
    }
  };

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* EN-TÊTE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="text-sm text-gray-500">Noms et rôles des personnes qui utilisent la boutique.</p>
        </div>
        <button
          onClick={fetchProfiles}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {profilesMissing && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            La gestion des rôles n'est pas encore activée : exécutez le fichier supabase/profiles.sql dans Supabase.
            En attendant, tous les utilisateurs ont les droits administrateur.
          </span>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 text-indigo-900 text-sm rounded-lg">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Pour ajouter un utilisateur : Supabase → Authentication → Users → Add user (email et mot de passe).
          Il apparaîtra ici comme vendeur, et vous pourrez changer son nom et son rôle.
        </span>
      </div>

      {/* TABLEAU */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-3">Nom</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Rôle</th>
                <th className="px-6 py-3">Ajouté le</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                    Chargement des utilisateurs...
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {(profile.full_name || profile.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-900">
                          {profile.full_name || 'Sans nom'}
                          {profile.id === user?.id && <span className="ml-2 text-xs font-normal text-gray-400">(vous)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{profile.email || '-'}</td>
                    <td className="px-6 py-4">
                      <Badge colorClass={ROLE_COLORS[profile.role] || ROLE_COLORS.seller}>
                        {ROLE_LABELS[profile.role] || profile.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(profile.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(profile)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALE : MODIFIER UN UTILISATEUR */}
      <Modal
        isOpen={!!editingProfile}
        onClose={() => setEditingProfile(null)}
        title={`Modifier : ${editingProfile?.email || ''}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom affiché</label>
            <input
              type="text"
              placeholder="Ex: Moussa"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="seller">{ROLE_LABELS.seller}</option>
              <option value="admin">{ROLE_LABELS.admin}</option>
            </select>
            <p className="mt-1.5 text-xs text-gray-500">
              {formData.role === 'admin'
                ? 'Accès complet : statistiques, prix d\'achat, réapprovisionnements, gestion du stock et des utilisateurs.'
                : 'Caisse, clients, crédits, SAV et historique des ventes. Pas d\'accès aux prix d\'achat ni aux statistiques.'}
            </p>
          </div>
          <Button type="submit" isLoading={saving} className="w-full py-2.5">
            Enregistrer
          </Button>
        </form>
      </Modal>
    </div>
  );
}
