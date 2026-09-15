'use client';

import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n/locale';
import { t } from '@/lib/i18n/translate';
import type { Speed, TerminalLine } from '@/lib/terminal-script';
import { SPEEDS, TERMINAL_SESSION } from '@/lib/terminal-script';

import styles from './Terminal.module.css';

/**
 * Replays `TERMINAL_SESSION`, and does nothing else.
 *
 * **This is an animation, never an evaluator.** There is no `eval`, no `new Function`, no
 * server round-trip, and no input element anywhere in this file — the only state a visitor can
 * change is *how fast a fixed, reviewable transcript plays*, never *what it says*. See
 * `docs/TERMINAL-DEMO.md` for the constraint this file exists to satisfy, and
 * `lib/terminal-script.ts` for the transcript itself, which is the only thing this component
 * will ever print.
 *
 * Timing: a `command` line is revealed one character at a time (a shell types); every other
 * kind of line is revealed whole (a program's output does not type itself out one letter at a
 * time). Each line then holds for its own `pause` before the next one starts. `prefers-reduced-
 * motion` skips all of that — the finished transcript is shown at once, and the graph settles on
 * its final state — because the information is the point and the animation is packaging.
 *
 * Language: the chrome — the caption, the controls, the note under them — is this site's own
 * voice and follows the visitor's locale, which arrives as a prop from `Scene09Terminal.tsx`
 * (itself given it by `app/page.tsx`; a plain cookie read, see `lib/i18n/locale.ts`). The
 * transcript is **not** translated and must not be: `lib/terminal-script.ts` reproduces what the
 * real CLI prints, and a command or an output line rewritten in Spanish would be a line the
 * product never emits — a caption that says "recorded, not live" cannot sit above invented
 * output. The window title is the same fact: `encastra` is the binary's name in any language.
 */

const CHAR_MS = 24;
const DEFAULT_LINE_PAUSE = 90;
const LOOP_PAUSE = 1600;

const TOTAL_LINES = TERMINAL_SESSION.length;

/** What a screen reader is given: the whole transcript, at once, never character by character. */
const FULL_TRANSCRIPT = TERMINAL_SESSION.map((line) => line.text).join('\n');

/* -------------------------------------------------------------------------------------------
 * Playback
 *
 * `reduced` starts `true` unconditionally — the same value on the server and on the client's
 * first render — so hydration never has to reconcile two different answers to "does this
 * visitor want motion". `window.matchMedia` only exists on the client, so any check against it
 * would disagree with the server the instant a visitor's real preference is "no reduction".
 *
 * The real preference is read in a *layout* effect rather than a regular one, and it corrects
 * `revealCount`/`typedChars`/`playing` in the same pass that sets `reduced` — layout effects (and
 * any state update they make) commit before the browser paints, so a visitor who does allow
 * motion never sees the static fallback frame at all; they only ever see it if that turns out to
 * be the real answer. `useEffect` on the server render (`typeof window === 'undefined'`) avoids
 * the "useLayoutEffect does nothing on the server" warning.
 * ---------------------------------------------------------------------------------------- */

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function TerminalDemo({ locale }: { locale: Locale }): ReactNode {
  const [reduced, setReduced] = useState(true);
  const [revealCount, setRevealCount] = useState(TOTAL_LINES);
  const [typedChars, setTypedChars] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');

    function apply(matches: boolean): void {
      setReduced(matches);
      if (matches) {
        // Not a fast animation — no animation. The finished transcript, shown at once.
        setRevealCount(TOTAL_LINES);
        setTypedChars(0);
        setPlaying(false);
      } else {
        setRevealCount(0);
        setTypedChars(0);
        setPlaying(true);
      }
    }

    apply(query.matches);
    function onChange(): void {
      apply(query.matches);
    }
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced || !playing) return undefined;

    const line = TERMINAL_SESSION[revealCount];
    let delay: number;
    let apply: () => void;

    if (line === undefined) {
      // The transcript finished. Hold on the last frame, then loop — "somebody arriving
      // mid-cycle sees the refusal within one loop" (docs/TERMINAL-DEMO.md).
      delay = LOOP_PAUSE;
      apply = () => {
        setRevealCount(0);
        setTypedChars(0);
      };
    } else if (line.kind === 'command' && typedChars < line.text.length) {
      delay = CHAR_MS;
      apply = () => setTypedChars((count) => count + 1);
    } else {
      delay = line.pause ?? DEFAULT_LINE_PAUSE;
      apply = () => {
        setRevealCount((count) => count + 1);
        setTypedChars(0);
      };
    }

    const id = window.setTimeout(apply, Math.max(delay / speed, 1));
    return () => window.clearTimeout(id);
  }, [revealCount, typedChars, playing, speed, reduced]);

  // Autoscroll, the way a real terminal keeps the newest line in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: revealCount/typedChars are the trigger, not a value read here.
  useEffect(() => {
    const el = bodyRef.current;
    if (el === null) return;
    el.scrollTop = el.scrollHeight;
  }, [revealCount, typedChars]);

  const finished = revealCount >= TOTAL_LINES;

  const lines: Array<{ line: TerminalLine; text: string; typing: boolean }> = [];
  for (let i = 0; i < revealCount && i < TOTAL_LINES; i += 1) {
    const line = TERMINAL_SESSION[i];
    if (line !== undefined) lines.push({ line, text: line.text, typing: false });
  }
  if (!reduced && revealCount < TOTAL_LINES) {
    const current = TERMINAL_SESSION[revealCount];
    if (current !== undefined) {
      const typing = current.kind === 'command';
      lines.push({
        line: current,
        text: typing ? current.text.slice(0, typedChars) : current.text,
        typing,
      });
    }
  }

  function cycleSpeed(): void {
    setSpeed((current) => {
      const index = SPEEDS.indexOf(current);
      const next = SPEEDS[(index + 1) % SPEEDS.length];
      return next ?? 1;
    });
  }

  function restart(): void {
    setRevealCount(0);
    setTypedChars(0);
    setPlaying(true);
  }

  return (
    <div className={styles.demo}>
      <div className={styles.terminalCard}>
        <div className={styles.toolbar}>
          <span className={styles.dots} aria-hidden="true">
            <span data-tone="danger" />
            <span data-tone="warn" />
            <span data-tone="ok" />
          </span>
          <span className={styles.title}>encastra — Image Processor</span>
          <span className={styles.caption}>{t(locale, 'terminal.caption')}</span>
        </div>

        <div className={styles.body} ref={bodyRef} aria-hidden="true">
          {lines.map((entry, index) => (
            <TerminalLineView
              // The transcript is a fixed, ordered array — position is a stable identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed, append-only playback order.
              key={index}
              line={entry.line}
              text={entry.text}
              cursor={entry.typing || (index === lines.length - 1 && !finished)}
            />
          ))}
        </div>

        <div className="visually-hidden">
          <p>{t(locale, 'terminal.transcriptIntro')}</p>
          <pre>{FULL_TRANSCRIPT}</pre>
        </div>

        {!reduced ? (
          <fieldset className={styles.controls}>
            <legend className="visually-hidden">{t(locale, 'terminal.controlsLegend')}</legend>
            <button
              type="button"
              className={styles.controlButton}
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? t(locale, 'terminal.pause') : t(locale, 'terminal.play')}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              className={styles.controlButton}
              onClick={restart}
              aria-label={t(locale, 'terminal.restart')}
            >
              <RestartIcon />
            </button>
            <button
              type="button"
              className={styles.speedButton}
              onClick={cycleSpeed}
              aria-label={t(locale, 'terminal.speed', { speed })}
            >
              {speed}×
            </button>
          </fieldset>
        ) : (
          <p className={styles.reducedNote}>{t(locale, 'terminal.reducedNote')}</p>
        )}
      </div>
    </div>
  );
}

function TerminalLineView({
  line,
  text,
  cursor,
}: {
  line: TerminalLine;
  text: string;
  cursor: boolean;
}): ReactNode {
  if (line.kind === 'blank') {
    return <div className={styles.line} data-kind="blank" />;
  }
  return (
    <div className={styles.line} data-kind={line.kind}>
      {line.kind === 'command' ? <span className={styles.prompt}>$</span> : null}
      <span className={styles.lineText}>{text}</span>
      {cursor ? <span className={styles.cursor} aria-hidden="true" /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
 * Icons — small, inline, no icon font and no network request.
 * ---------------------------------------------------------------------------------------- */

function PlayIcon(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M4.5 3v10l8-5-8-5Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M4.5 3h2v10h-2V3ZM9.5 3h2v10h-2V3Z" fill="currentColor" />
    </svg>
  );
}

function RestartIcon(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M13 8A5 5 0 1 1 11.2 4.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M13 2.5v3.3h-3.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
