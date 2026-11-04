import React, { useState, useRef, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatters';

const BAR_COLOR = '#4f46e5'; // indigo-600, couleur principale de l'application
const GRID_COLOR = '#e5e7eb'; // gray-200
const AXIS_TEXT = '#6b7280'; // gray-500
const HEIGHT = 240;
const MARGIN = { top: 24, right: 8, bottom: 28, left: 52 };

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

// Graduations "rondes" de l'axe vertical (1, 2 ou 5 x 10^n)
function niceTicks(max, count = 4) {
  if (max <= 0) return [0];
  const rough = max / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough);
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

// Barre avec extrémité arrondie (4px) et base carrée
function barPath(x, y, w, h) {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export default function RevenueChart({ buckets, monthly }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(600);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const maxRevenue = Math.max(0, ...buckets.map((b) => b.revenue));
  const ticks = niceTicks(maxRevenue);
  const yMax = ticks[ticks.length - 1] || 1;

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = buckets.length ? plotWidth / buckets.length : plotWidth;
  const barWidth = Math.max(2, Math.min(24, band - 2)); // 2px d'air entre les barres
  const y = (v) => MARGIN.top + plotHeight - (v / yMax) * plotHeight;

  const labelOf = (b) =>
    monthly
      ? b.date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      : b.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

  // N'afficher qu'une partie des dates sous l'axe pour éviter les chevauchements
  const labelEvery = Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(plotWidth / 56))));
  const maxIndex = buckets.findIndex((b) => b.revenue === maxRevenue && maxRevenue > 0);

  const hoveredBucket = hovered !== null ? buckets[hovered] : null;
  const tooltipLeft = hovered !== null ? MARGIN.left + band * hovered + band / 2 : 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <svg width={width} height={HEIGHT} role="img" aria-label="Chiffre d'affaires par période">
        {/* Grille et axe vertical */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke={GRID_COLOR} strokeWidth="1" />
            <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={AXIS_TEXT}>
              {compact.format(t)}
            </text>
          </g>
        ))}

        {buckets.map((b, i) => {
          const x = MARGIN.left + band * i + (band - barWidth) / 2;
          const h = MARGIN.top + plotHeight - y(b.revenue);
          return (
            <g key={b.key}>
              {b.revenue > 0 && (
                <path
                  d={barPath(x, y(b.revenue), barWidth, h)}
                  fill={BAR_COLOR}
                  opacity={hovered === null || hovered === i ? 1 : 0.45}
                />
              )}
              {/* Valeur affichée uniquement sur la meilleure période */}
              {i === maxIndex && (
                <text x={x + barWidth / 2} y={y(b.revenue) - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#111827">
                  {compact.format(b.revenue)}
                </text>
              )}
              {i % labelEvery === 0 && (
                <text x={MARGIN.left + band * i + band / 2} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill={AXIS_TEXT}>
                  {labelOf(b)}
                </text>
              )}
              {/* Zone de survol plus large que la barre */}
              <rect
                x={MARGIN.left + band * i}
                y={MARGIN.top}
                width={band}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}
      </svg>

      {hoveredBucket && (
        <div
          className="absolute pointer-events-none bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs whitespace-nowrap"
          style={{
            left: Math.min(Math.max(tooltipLeft, 70), width - 70),
            top: 0,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="font-semibold text-gray-900">
            {monthly
              ? hoveredBucket.date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
              : hoveredBucket.date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
          </p>
          <p className="text-gray-700">{formatCurrency(hoveredBucket.revenue)}</p>
          <p className="text-gray-500">{hoveredBucket.count} vente(s)</p>
        </div>
      )}
    </div>
  );
}
