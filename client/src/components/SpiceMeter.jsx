import { spiceMeta } from '../lib/constants.js';

export default function SpiceMeter({ level, size = 'sm', showLabel = false }) {
  const meta = spiceMeta(level);
  const dim = size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-sm';
  return (
    <span className="inline-flex items-center gap-1" title={`${meta.label} (${meta.th})`}>
      <span className={dim} aria-hidden>
        {meta.peppers === 0 ? '🚫' : '🌶️'.repeat(meta.peppers)}
      </span>
      {showLabel && (
        <span className="text-xs font-semibold" style={{ color: meta.color }}>
          {meta.label}
        </span>
      )}
    </span>
  );
}
