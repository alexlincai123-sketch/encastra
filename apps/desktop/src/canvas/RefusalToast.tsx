/**
 * Why a connection was refused, shown where the drag ended.
 *
 * Its own component so the one thing about it that is easy to get wrong — what its close button
 * is called — can be tested by rendering it, rather than by producing a refused pointer drag,
 * which a test document cannot do.
 */

import { splitOnPlaceholder, useTranslation } from '../i18n';
import type { RefusalNo } from './refusal';

export function RefusalToast({ refusal, onClose }: { refusal: RefusalNo; onClose: () => void }) {
  const { t } = useTranslation();

  // Rendered once as `{bridge}` intact — see `splitOnPlaceholder` — so the `<code>` element can
  // be dropped in wherever the translated sentence actually puts the placeholder, rather than
  // the two halves being separately-translated fragments whose order silently assumes English.
  const bridge = refusal.bridge ?? null;
  const [bridgeBefore, bridgeAfter] = bridge
    ? splitOnPlaceholder(t('canvas.refusal.bridge'), 'bridge')
    : ['', ''];

  return (
    <div className="refusal" role="status" aria-live="polite">
      <div className="refusal__body">
        <strong className="refusal__headline">{refusal.headline}</strong>
        <span className="refusal__detail">{refusal.detail}</span>
        {bridge ? (
          <span className="refusal__bridge">
            {bridgeBefore}
            <code>{bridge}</code>
            {bridgeAfter}
          </span>
        ) : null}
      </div>
      {/* No `aria-label`: the visible word is the accessible name. A label that differed from it
          ("Dismiss" on a button reading "Close") breaks speech control, where somebody says the
          word they can see. */}
      <button type="button" className="btn" onClick={onClose}>
        {t('common.close')}
      </button>
    </div>
  );
}
