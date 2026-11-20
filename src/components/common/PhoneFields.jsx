import React from 'react';
import { PHONE_MODELS } from '../../utils/constants';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500';

/**
 * Téléphone en 4 champs : Marque → Modèle → Série → Code (ex. Tecno → Camon → 11 → CF7).
 * `value` contient phone_brand, phone_model, phone_series, phone_code ; `onChange` reçoit l'objet modifié.
 */
export default function PhoneFields({ value, onChange, required = false, idPrefix = 'phone' }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const brandKey = Object.keys(PHONE_MODELS).find((b) => b.toLowerCase() === (value.phone_brand || '').trim().toLowerCase());
  const models = brandKey ? PHONE_MODELS[brandKey] : [];

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Marque</label>
        <input type="text" list={`${idPrefix}-brands`} required={required} placeholder="Ex: Tecno"
          value={value.phone_brand || ''} onChange={set('phone_brand')} className={inputClass} />
        <datalist id={`${idPrefix}-brands`}>
          {Object.keys(PHONE_MODELS).map((b) => <option key={b} value={b} />)}
        </datalist>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Modèle</label>
        <input type="text" list={`${idPrefix}-models`} required={required} placeholder="Ex: Camon"
          value={value.phone_model || ''} onChange={set('phone_model')} className={inputClass} />
        <datalist id={`${idPrefix}-models`}>
          {models.map((m) => <option key={m} value={m} />)}
        </datalist>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Série</label>
        <input type="text" placeholder="Ex: 11, 10 Play"
          value={value.phone_series || ''} onChange={set('phone_series')} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
        <input type="text" placeholder="Ex: CF7, X688"
          value={value.phone_code || ''} onChange={set('phone_code')} className={inputClass} />
      </div>
    </div>
  );
}
