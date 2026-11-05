/** Design primitives. Small on purpose: type, space and the route line do most of the work. */
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Link } from '../lib/router.tsx';
import type { ApiError } from '../lib/api.ts';
import { SOURCES, type SourceId } from '../../shared/data/sources.ts';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; size?: 'sm' | 'md' | 'lg' }>(function Button(
  { variant = 'primary', busy, size = 'md', className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={`btn btn-${variant} btn-${size}${className ? ` ${className}` : ''}`} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <span className="spinner" aria-hidden /> : null}
      <span>{children}</span>
    </button>
  );
});

export function ButtonLink({ to, variant = 'primary', size = 'md', children }: { to: string; variant?: Variant; size?: 'sm' | 'md' | 'lg'; children: ReactNode }) {
  return (
    <Link to={to} className={`btn btn-${variant} btn-${size}`}>
      <span>{children}</span>
    </Link>
  );
}

const fieldId = (label: string, id?: string) => id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: ReactNode }>(function TextField({ label, error, hint, id, className, ...rest }, ref) {
  const fid = fieldId(label, id);
  return (
    <div className={`field${error ? ' has-error' : ''}${className ? ` ${className}` : ''}`}>
      <label htmlFor={fid}>{label}</label>
      <input ref={ref} id={fid} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined} {...rest} />
      {hint && !error ? (
        <p className="field-hint" id={`${fid}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={`${fid}-err`}>
          {error}
        </p>
      ) : null}
    </div>
  );
});

export function SelectField({ label, error, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string | null }) {
  const fid = fieldId(label, id);
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={fid}>{label}</label>
      <select id={fid} aria-invalid={error ? true : undefined} {...rest}>
        {children}
      </select>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Status always pairs a colour with a symbol and words, so it never depends on colour alone. */
export type Tone = 'open' | 'risk' | 'closed' | 'neutral';
const SYMBOL: Record<Tone, string> = { open: '✓', risk: '!', closed: '✗', neutral: '•' };
export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`status status-${tone}`}>
      <span className="status-symbol" aria-hidden>
        {SYMBOL[tone]}
      </span>
      {children}
    </span>
  );
}

/** Where a fact comes from. Secondary sources are marked so nobody mistakes them for the official word. */
export function SourceNote({ id, prefix = 'Source' }: { id: SourceId; prefix?: string }) {
  const s = SOURCES[id];
  return (
    <span className="source">
      {prefix}:{' '}
      <a href={s.url} target="_blank" rel="noreferrer">
        {s.publisher}
      </a>
      {s.kind === 'secondary' ? <span className="source-flag"> (third-party summary: check the official document)</span> : null}
    </span>
  );
}

export function Notice({ tone = 'neutral', title, children }: { tone?: Tone; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'closed' ? 'alert' : undefined}>
      {title ? <p className="notice-title">{title}</p> : null}
      {children}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden /> {label}…
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry?: () => void }) {
  const offline = 'offline' in error && (error as ApiError).offline;
  return (
    <div className="state state-error" role="alert">
      <h2>{offline ? "You're offline" : "This didn't load"}</h2>
      <p>{error.message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** The wordmark: a route line with a station, then the name. */
export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 40 24" width="40" height="24" aria-hidden focusable="false">
        <path d="M3 18 H15 Q20 18 22 13 L24 9 Q26 5 31 5 H37" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="31" cy="5" r="3.6" fill="var(--sheet)" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="9" cy="18" r="3.6" fill="var(--here)" stroke="currentColor" strokeWidth="2.4" />
      </svg>
      <span className="logo-word">Umzila</span>
    </span>
  );
}

export function PageHeader({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {lead ? <p className="lead">{lead}</p> : null}
      {children}
    </header>
  );
}
