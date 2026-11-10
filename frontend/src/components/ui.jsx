import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldCheck,
  HeartPulse,
  Mountain,
  Store,
  Truck,
  X,
} from 'lucide-react';

export const SECTOR_ICONS = {
  shield: ShieldCheck,
  heart: HeartPulse,
  mountain: Mountain,
  store: Store,
  truck: Truck,
};

export const SEVERITY = {
  error: { label: 'Error', tone: 'danger', icon: AlertTriangle },
  warning: { label: 'Advertencia', tone: 'warn', icon: AlertTriangle },
  info: { label: 'Información', tone: 'info', icon: Info },
};

export function SectorIcon({ sector, meta, size = 20 }) {
  const Icon = SECTOR_ICONS[meta?.icon] || ShieldCheck;
  return (
    <span className="sector-icon" style={{ '--sector-color': meta?.accent || '#0f766e', '--sector-tint': meta?.tint || '#e7f8f0' }}>
      <Icon size={size} strokeWidth={2.1} />
    </span>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button type={type} className={`btn btn-${variant} btn-${size} ${className}`.trim()} {...props}>
      {Icon ? <Icon size={size === 'sm' ? 15 : 17} strokeWidth={2.2} /> : null}
      <span>{children}</span>
      {IconRight ? <IconRight size={size === 'sm' ? 15 : 17} strokeWidth={2.2} /> : null}
    </button>
  );
}

export function Card({ title, subtitle, actions, children, className = '', bodyClassName = '', noPadding = false }) {
  return (
    <section className={`card ${className}`.trim()}>
      {title || actions ? (
        <header className="card-head">
          <div>
            {title ? <h2 className="card-title">{title}</h2> : null}
            {subtitle ? <p className="card-sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="card-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`${noPadding ? '' : 'card-body'} ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = 'default', action }) {
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon ? (
          <span className="stat-icon">
            <Icon size={18} strokeWidth={2.1} />
          </span>
        ) : null}
      </div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
      {action ? <div className="stat-action">{action}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`badge badge-${tone} ${className}`.trim()}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  );
}

export function Ring({ value, label, tone = '#0f766e', size = 128 }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className="ring"
      style={{
        '--ring-value': `${safe}%`,
        '--ring-tone': tone,
        width: size,
        height: size,
      }}
    >
      <div className="ring-inner">
        <strong>{Math.round(safe)}</strong>
        <span>{label || 'de 100'}</span>
      </div>
    </div>
  );
}

export function Progress({ value, tone = 'ok', label }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress-wrap">
      {label ? <div className="progress-label">{label}</div> : null}
      <div className="progress">
        <span className={`progress-fill progress-${tone}`} style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

export function Modal({ open, title, subtitle, onClose, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`field ${className}`.trim()}>
      {label ? <span className="field-label">{label}</span> : null}
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, description, disabled = false }) {
  return (
    <label className={`toggle ${disabled ? 'is-disabled' : ''}`.trim()}>
      <span className="toggle-copy">
        <span className="toggle-label">{label}</span>
        {description ? <span className="toggle-description">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange?.(event.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}

export function EmptyState({ icon: Icon = CheckCircle2, title, description, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={26} strokeWidth={1.8} />
      </span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function SeverityBadge({ severity }) {
  const meta = SEVERITY[severity] || SEVERITY.info;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function FindingItem({ finding, compact = false }) {
  const meta = SEVERITY[finding.severity] || SEVERITY.info;
  const Icon = meta.icon;
  return (
    <div className={`finding finding-${finding.severity} ${compact ? 'finding-compact' : ''}`.trim()}>
      <span className="finding-icon">
        <Icon size={18} strokeWidth={2.1} />
      </span>
      <div className="finding-body">
        <div className="finding-title-row">
          <strong>{finding.title}</strong>
          <SeverityBadge severity={finding.severity} />
        </div>
        <p>{finding.detail}</p>
        {finding.date ? <span className="finding-meta">{finding.date}</span> : null}
      </div>
    </div>
  );
}

export function Avatar({ name, color, size = 34 }) {
  const initials = String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: color || '#0f766e', fontSize: size * 0.34 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
