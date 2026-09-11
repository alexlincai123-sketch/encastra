/**
 * The handful of control shapes the Settings screen needs that nothing else in the app has.
 *
 * Not a general component library — reach for what already exists (`.btn`, `.pill`, `.input`,
 * `.table`, `.kv` from `styles.css`) wherever it already fits, which is most places. What is
 * here is new because nothing today renders a labelled switch, a status that reads as fact
 * rather than control, a row layout with a label, an explanatory sentence and a control aligned
 * to the right of both, or a block of text — a raw preferences dump, a diagnostics report —
 * meant to be read verbatim rather than styled as prose.
 */

import type { ReactNode } from 'react';

// --- Layout ---------------------------------------------------------------------------------

interface SettingCardProps {
  title: string;
  children: ReactNode;
}

/** One grouped block of related settings within a category. */
export function SettingCard({ title, children }: SettingCardProps) {
  return (
    <section className="s-card">
      <h2 className="s-card__title">{title}</h2>
      {children}
    </section>
  );
}

interface SettingRowProps {
  label: string;
  hint: string;
  /** Set only when `children` is a single control that supports label association (a button, an
   * input) — a `<fieldset>` of segmented options is not, so those rows omit it and rely on the
   * fieldset's own legend instead. */
  htmlFor?: string;
  children: ReactNode;
}

/** One setting: a label and a sentence on the left, its control aligned on the right. */
export function SettingRow({ label, hint, htmlFor, children }: SettingRowProps) {
  return (
    <div className="s-row">
      <div className="s-row__text">
        {htmlFor ? (
          <label className="s-row__label" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className="s-row__label">{label}</span>
        )}
        <p className="s-row__hint">{hint}</p>
      </div>
      <div className="s-row__control">{children}</div>
    </div>
  );
}

// --- Controls --------------------------------------------------------------------------------

interface ToggleProps {
  id: string;
  /** Not shown — it becomes the control's accessible name via `aria-label`, since the row's own
   * `<label for>` already handles click-to-toggle and would otherwise repeat it. */
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ id, label, checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="s-toggle"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="s-toggle__thumb" aria-hidden="true" />
    </button>
  );
}

interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
}

interface SegmentedProps<Value extends string> {
  /** Visually hidden; the row already shows the label. Screen readers need it on the fieldset,
   * since a `<label for>` cannot target one. */
  legend: string;
  value: Value;
  options: readonly SegmentedOption<Value>[];
  onChange: (value: Value) => void;
  /** For a choice mid-flight — a language still loading its file, say — where letting a second
   * click land part way through would race the first. */
  disabled?: boolean;
}

export function Segmented<Value extends string>({
  legend,
  value,
  options,
  onChange,
  disabled = false,
}: SegmentedProps<Value>) {
  return (
    <fieldset className="s-segmented" disabled={disabled}>
      <legend className="visually-hidden">{legend}</legend>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className="pill"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

interface FolderFieldProps {
  id: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onBrowse: () => void;
  browseDisabled: boolean;
  browseTitle?: string | undefined;
}

/** A path you can type, with a real folder picker next to it when the runtime can show one. */
export function FolderField({
  id,
  value,
  placeholder,
  onChange,
  onBrowse,
  browseDisabled,
  browseTitle,
}: FolderFieldProps) {
  return (
    <div className="s-folder">
      <input
        id={id}
        className="input s-folder__input"
        type="text"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <button
        type="button"
        className="btn"
        onClick={onBrowse}
        disabled={browseDisabled}
        title={browseTitle}
      >
        Browse…
      </button>
    </div>
  );
}

export function Button({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="btn" onClick={onClick}>
      {children}
    </button>
  );
}

export function DangerButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="btn s-btn--danger" onClick={onClick}>
      {children}
    </button>
  );
}

type StatusTone = 'ok' | 'warn' | 'muted';

/** A fact, not a control. Used everywhere Settings has to say "none" or "not built yet" rather
 * than offer a switch for something that does not exist. */
export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`s-status s-status--${tone}`}>{children}</span>;
}

/** A block of text meant to be read, copied or exported verbatim — a diagnostics report, a raw
 * preferences dump — never edited in place, so a `<pre>` rather than a `<textarea>`. */
export function Pre({ children }: { children: ReactNode }) {
  return <pre className="s-pre">{children}</pre>;
}
