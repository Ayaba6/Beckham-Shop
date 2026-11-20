import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../config/supabaseClient';
import { buildCatalog } from '../../utils/phoneCatalog';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';
const OTHER = '__autre';
const PHONE_COLUMNS = 'phone_brand, phone_model, phone_series, phone_code';

// Liste déroulante avec un choix « Autre… » qui ouvre un champ libre
export function Choice({ label, options, value, onChange, required, placeholder, disabled }) {
  const [other, setOther] = useState(false);
  const isOther = other || (!!value && !options.includes(value));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        required={required && !isOther}
        disabled={disabled}
        value={isOther ? OTHER : value || ''}
        onChange={(e) => {
          const picked = e.target.value;
          setOther(picked === OTHER);
          onChange(picked === OTHER ? '' : picked);
        }}
        className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
      >
        <option value="">{disabled ? '—' : 'Choisir'}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={OTHER}>Autre…</option>
      </select>
      {isOther && (
        <input
          type="text"
          autoFocus
          required={required}
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} mt-2`}
        />
      )}
    </div>
  );
}

// Téléphones déjà enregistrés (accessoires et réparations) : ce qui a été saisi via « Autre… »
// revient ainsi dans les listes
function useSavedPhones() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    Promise.all(
      ['products', 'repairs'].map((table) =>
        supabase.from(table).select(PHONE_COLUMNS).not('phone_brand', 'is', null)
      )
    ).then((results) => setRows(results.flatMap((r) => r.data || [])));
  }, []);
  return rows;
}

/**
 * Téléphone en 4 listes : Marque → Modèle → Série → Code (ex. Tecno → Camon → 11 → CF7).
 * `value` contient phone_brand, phone_model, phone_series, phone_code ; `onChange` reçoit les champs modifiés.
 */
export default function PhoneFields({ value, onChange, required = false }) {
  const savedPhones = useSavedPhones();
  const catalog = useMemo(() => buildCatalog(savedPhones), [savedPhones]);

  const brand = value.phone_brand || '';
  const model = value.phone_model || '';
  const series = value.phone_series || '';
  // Sans tenir compte des majuscules : « tecno » saisi à la main retrouve les modèles Tecno
  const pick = (obj, name) => obj[Object.keys(obj).find((k) => k.toLowerCase() === name.trim().toLowerCase())];
  const models = pick(catalog, brand) || {};
  const allSeries = pick(models, model) || {};
  const codes = pick(allSeries, series) || [];

  return (
    <div className="grid grid-cols-2 gap-3">
      <Choice
        label="Marque"
        required={required}
        placeholder="Nom de la marque"
        options={Object.keys(catalog)}
        value={brand}
        onChange={(v) => onChange({ phone_brand: v, phone_model: '', phone_series: '', phone_code: '' })}
      />
      <Choice
        key={`model-${brand}`}
        label="Modèle"
        required={required}
        placeholder="Ex: Camon"
        disabled={!brand}
        options={Object.keys(models)}
        value={model}
        onChange={(v) => onChange({ phone_model: v, phone_series: '', phone_code: '' })}
      />
      <Choice
        key={`series-${brand}-${model}`}
        label="Série"
        placeholder="Ex: 11, 10 Play"
        disabled={!model}
        options={Object.keys(allSeries)}
        value={series}
        onChange={(v) => onChange({ phone_series: v, phone_code: allSeries[v]?.[0] || '' })}
      />
      <Choice
        key={`code-${brand}-${model}-${series}`}
        label="Code"
        placeholder="Ex: CF7, X688"
        disabled={!series}
        options={codes}
        value={value.phone_code || ''}
        onChange={(v) => onChange({ phone_code: v })}
      />
    </div>
  );
}
