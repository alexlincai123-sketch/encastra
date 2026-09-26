/**
 * The component library.
 *
 * A catalogue that explains itself: what a component is for, what data it takes and gives back,
 * and what it can reach outside the graph — in the same words the permission dialog uses when
 * you actually wire it up, so nothing you learn here contradicts what you are asked to allow
 * later. The other half of a permission statement is what it does *not* reach; for most
 * components in this build, that is everything, and saying so plainly is the more trustworthy
 * half of the sentence.
 */

import { namedTypesIn, tryParseType, typeDef } from '@encastra/protocol';
import { useMemo, useState } from 'react';
import '../components-view.css';
import { useComponentText } from '../component-text';
import { selectPlural, useTranslation } from '../i18n';
import { useEditor } from '../store';
import type { Capability, ComponentManifest } from '../types';

/** The `components.reach.verb.*` key for a capability this component actually declares —
 * capitalised, third-person: "Reads files". */
const REACH_VERB_KEYS: Record<string, string> = {
  'fs.read': 'components.reach.verb.fsRead',
  'fs.write': 'components.reach.verb.fsWrite',
  'net.http': 'components.reach.verb.netHttp',
  'system.clipboard': 'components.reach.verb.systemClipboard',
  'system.notify': 'components.reach.verb.systemNotify',
};

/**
 * Every kind of authority the broker knows about, in the order worth reading them.
 *
 * Fixed rather than derived from the manifests present, for the same reason the inspector's
 * permission panel fixes it: the point of the list is to say what a component *cannot* do, and
 * a list built only from what components happen to ask for could never contain the one thing
 * none of them asked for.
 */
const REACH_ORDER = ['fs.read', 'fs.write', 'net.http', 'system.clipboard', 'system.notify'];

/** The same `components.reach.cannot.*` keys the inspector's permission panel reads for "it
 * cannot" — see Inspector.tsx. */
const REACH_CANNOT_KEYS: Record<string, string> = {
  'fs.read': 'components.reach.cannot.fsRead',
  'fs.write': 'components.reach.cannot.fsWrite',
  'net.http': 'components.reach.cannot.netHttp',
  'system.clipboard': 'components.reach.cannot.systemClipboard',
  'system.notify': 'components.reach.cannot.systemNotify',
};

/** A type's colour always comes from the shared type table, never from a palette of its own. */
function tint(type: string): string {
  const parsed = tryParseType(type);
  const named = parsed ? namedTypesIn(parsed)[0] : undefined;
  const colour = named ? typeDef(named)?.color : undefined;
  return colour ? `var(--type-${colour})` : 'var(--type-slate)';
}

function PortList({
  title,
  ports,
}: {
  title: string;
  ports: [string, { type: string; label?: string }][];
}) {
  if (ports.length === 0) return null;
  return (
    <div className="catalogue__port-group">
      <span className="catalogue__port-label">{title}</span>
      <ul className="catalogue__port-list">
        {ports.map(([name, port]) => (
          <li className="chip" key={name} style={{ borderColor: tint(port.type) }}>
            {port.label ?? name}
            <span className="chip__type">{port.type}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What this component can reach, and — the more trustworthy half — what it cannot. */
function Reach({ capabilities }: { capabilities: Capability[] }) {
  const { t } = useTranslation();
  const reach = capabilities.filter((c) => c.scope !== 'input-handles');

  if (reach.length === 0) {
    return (
      <p className="catalogue__safe">
        <span className="catalogue__safe-mark" aria-hidden="true" />
        {t('components.reach.none')}
      </p>
    );
  }

  const declared = new Set(reach.map((c) => c.kind));
  const cannot = REACH_ORDER.filter((kind) => !declared.has(kind));

  return (
    <div className="catalogue__reach">
      <span className="catalogue__reach-label">{t('components.reach.label')}</span>
      <ul className="catalogue__reach-list">
        {reach.map((capability) => {
          const key = REACH_VERB_KEYS[capability.kind];
          return (
            <li key={capability.kind}>
              <span className="catalogue__reach-kind">{key ? t(key) : capability.kind}</span>
              <span className="catalogue__reach-reason">{capability.reason}</span>
            </li>
          );
        })}
      </ul>

      {cannot.length > 0 ? (
        <div className="cannot">
          <span className="cannot__label">{t('common.itCannot')}</span>
          <ul className="cannot__list">
            {cannot.map((kind) => {
              const key = REACH_CANNOT_KEYS[kind];
              return <li key={kind}>{key ? t(key) : kind}</li>;
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Card({ manifest }: { manifest: ComponentManifest }) {
  const addNode = useEditor((s) => s.addNode);
  const setView = useEditor((s) => s.setView);
  const { t } = useTranslation();
  const text = useComponentText();
  const reference = `${manifest.id}@${manifest.version}`;
  const inputs = Object.entries(manifest.ports.inputs);
  const outputs = Object.entries(manifest.ports.outputs);

  return (
    <article className="catalogue__card">
      <header className="catalogue__card-header">
        <h2 className="catalogue__name">{text.name(manifest)}</h2>
        <span className="catalogue__version">{manifest.version}</span>
      </header>

      {manifest.trigger ? (
        <p className="catalogue__trigger-note">
          <span className="badge">{t('components.card.triggerBadge')}</span>{' '}
          {t('components.card.triggerNote')}
        </p>
      ) : null}

      <p className="catalogue__description">
        {text.description(manifest) ?? t('components.card.noDescription')}
      </p>

      {inputs.length > 0 || outputs.length > 0 ? (
        <div className="catalogue__ports">
          <PortList title={t('components.card.takes')} ports={inputs} />
          <PortList title={t('components.card.gives')} ports={outputs} />
        </div>
      ) : null}

      <Reach capabilities={manifest.capabilities} />

      <footer className="catalogue__footer">
        <code className="catalogue__id">{manifest.id}</code>
        <button
          type="button"
          className="btn"
          onClick={() => {
            addNode(reference, { x: 220, y: 160 });
            setView('builder');
          }}
        >
          {t('components.card.addToCanvas')}
        </button>
      </footer>
    </article>
  );
}

export function Components() {
  const manifests = useEditor((s) => s.manifests);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const { t, locale } = useTranslation();
  const text = useComponentText();

  const all = useMemo(() => Object.values(manifests), [manifests]);
  // Derived from what is actually installed, never stated as a fixed number: the count is a
  // fact about this build, and a build that adds a component should not need this file edited
  // to keep saying the truth.
  const triggerCount = useMemo(() => all.filter((m) => m.trigger).length, [all]);
  const categories = useMemo(
    () => ['all', ...new Set(all.map((m) => m.category ?? 'other'))].sort(),
    [all],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((m) => category === 'all' || (m.category ?? 'other') === category)
      .filter(
        (m) =>
          !needle ||
          // Both the words on the card and the manifest's own: somebody reading Spanish searches
          // for what they see, and somebody following an English guide for what it says.
          text.name(m).toLowerCase().includes(needle) ||
          m.name.toLowerCase().includes(needle) ||
          m.id.toLowerCase().includes(needle) ||
          (text.description(m) ?? '').toLowerCase().includes(needle) ||
          (m.description ?? '').toLowerCase().includes(needle),
      )
      .sort((a, b) => text.name(a).localeCompare(text.name(b), locale));
  }, [all, category, query, text, locale]);

  return (
    <main className="view view--library">
      <header className="view__header">
        <h1>{t('components.header.title')}</h1>
        <p>
          {triggerCount > 0
            ? // Chosen by the trigger count: that is the number the verb agrees with ("1 of them
              // starts", "2 of them start").
              t(`components.header.summaryWithTriggers.${selectPlural(locale, triggerCount)}`, {
                count: all.length,
                triggerCount,
              })
            : t(`components.header.summary.${selectPlural(locale, all.length)}`, {
                count: all.length,
              })}{' '}
          {t('components.header.note')}
        </p>
      </header>

      <div className="catalogue__filters">
        <input
          className="input"
          type="search"
          placeholder={t('components.search.placeholder')}
          value={query}
          aria-label={t('components.search.ariaLabel')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <fieldset className="catalogue__categories">
          <legend className="visually-hidden">{t('components.filters.categoryLegend')}</legend>
          {categories.map((name) => (
            <button
              type="button"
              key={name}
              className="pill"
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
            >
              {text.category(name)}
            </button>
          ))}
        </fieldset>
      </div>

      {shown.length === 0 ? (
        <p className="empty">{t('components.empty')}</p>
      ) : (
        <div className="catalogue__grid">
          {shown.map((manifest) => (
            <Card manifest={manifest} key={`${manifest.id}@${manifest.version}`} />
          ))}
        </div>
      )}
    </main>
  );
}
