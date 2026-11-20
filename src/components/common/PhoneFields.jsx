import React, { useState } from 'react';
import { PHONE_CATALOG, seriesOf } from '../../utils/phoneCatalog';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';
const OTHER = '__autre';

// Liste déroulante avec un choix « Autre… » qui ouvre un champ libre (téléphone absent du catalogue)
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

/**
 * Téléphone en 4 champs : Marque → Modèle → Série → Code (ex. Tecno → Camon → 11 → CF7).
 * `value` contient phone_brand, phone_model, phone_series, phone_code ; `onChange` reçoit les champs modifiés.
 * Choisir une série du catalogue remplit son code.
 */
export default function PhoneFields({ value, onChange, required = false }) {
  const brand = value.phone_brand || '';
  const model = value.phone_model || '';
  const models = Object.keys(PHONE_CATALOG[brand] || {});
  const series = seriesOf(brand, model);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Choice
        label="Marque"
        required={required}
        placeholder="Nom de la marque"
        options={Object.keys(PHONE_CATALOG)}
        value={brand}
        onChange={(v) => onChange({ phone_brand: v, phone_model: '', phone_series: '', phone_code: '' })}
      />
      <Choice
        key={`model-${brand}`}
        label="Modèle"
        required={required}
        placeholder="Ex: Camon"
        disabled={!brand}
        options={models}
        value={model}
        onChange={(v) => onChange({ phone_model: v, phone_series: '', phone_code: '' })}
      />
      <Choice
        key={`series-${brand}-${model}`}
        label="Série"
        placeholder="Ex: 11, 10 Play"
        disabled={!model}
        options={series.map((s) => s.series)}
        value={value.phone_series || ''}
        onChange={(v) => onChange({ phone_series: v, phone_code: series.find((s) => s.series === v)?.code || '' })}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
        <input
          type="text"
          placeholder="Ex: CF7, X688"
          value={value.phone_code || ''}
          onChange={(e) => onChange({ phone_code: e.target.value })}
          className={inputClass}
        />
      </div>
    </div>
  );
}
