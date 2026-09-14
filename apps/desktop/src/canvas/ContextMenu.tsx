/**
 * The menu a right-click opens on the canvas.
 *
 * Without one, right-clicking a step opened the WebView's own menu — Back, Reload, Print — which
 * belongs to a browser and not to this application, and which offers nothing a person building a
 * workflow could want. Deleting a step was already possible from the keyboard, but a capability
 * with no visible affordance is a capability most people never find.
 *
 * This is presentation only: it renders the items it is handed and reports which one was chosen.
 * What those items do lives with the canvas that opened the menu.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { clampToViewport } from './menu';

export type MenuItem = {
  id: string;
  label: string;
  /** Draws the item as the destructive one. Deleting a step is the only such item today. */
  danger?: boolean;
  run: () => void;
};

export type MenuRequest = {
  /** Viewport coordinates of the click that opened it. */
  x: number;
  y: number;
  items: MenuItem[];
};

export function ContextMenu({
  request,
  onClose,
  label,
}: {
  request: MenuRequest;
  onClose: () => void;
  /** Accessible name for the menu itself, translated by the caller. */
  label: string;
}) {
  const menu = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState<{ x: number; y: number }>({ x: request.x, y: request.y });
  const [active, setActive] = useState(0);

  // Measured after it is in the DOM but before the browser paints, so a menu opened near the
  // bottom of the window is never seen in the wrong place first and corrected afterwards.
  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    setAt(
      clampToViewport(
        { x: request.x, y: request.y },
        { width: box.width, height: box.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [request.x, request.y]);

  // Focus moves into the menu, so the keyboard can drive it and so closing can hand focus back.
  useEffect(() => {
    menu.current?.focus();
  }, []);

  useEffect(() => {
    // A scroll or a resize moves whatever the menu was opened against; leaving it floating over
    // a canvas that has since moved would point at the wrong step.
    const dismiss = () => onClose();
    window.addEventListener('resize', dismiss);
    window.addEventListener('blur', dismiss);
    return () => {
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('blur', dismiss);
    };
  }, [onClose]);

  const choose = useCallback(
    (item: MenuItem) => {
      onClose();
      item.run();
    },
    [onClose],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const last = request.items.length - 1;
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActive((index) => (index >= last ? 0 : index + 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActive((index) => (index <= 0 ? last : index - 1));
          break;
        case 'Home':
          event.preventDefault();
          setActive(0);
          break;
        case 'End':
          event.preventDefault();
          setActive(last);
          break;
        case 'Enter':
        case ' ': {
          event.preventDefault();
          const item = request.items[active];
          if (item) choose(item);
          break;
        }
        case 'Escape':
        case 'Tab':
          event.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    },
    [active, choose, onClose, request.items],
  );

  return (
    <>
      {/* Catches the click that dismisses the menu before it reaches the canvas underneath,
          so dismissing a menu never also deselects the step it was opened on. */}
      <button
        type="button"
        className="canvas-menu__scrim"
        aria-label={label}
        tabIndex={-1}
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        ref={menu}
        className="canvas-menu"
        role="menu"
        aria-label={label}
        aria-activedescendant={`canvas-menu-${request.items[active]?.id}`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{ left: `${at.x}px`, top: `${at.y}px` }}
      >
        {request.items.map((item, index) => (
          <button
            key={item.id}
            id={`canvas-menu-${item.id}`}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`canvas-menu__item${item.danger ? ' canvas-menu__item--danger' : ''}${
              index === active ? ' is-active' : ''
            }`}
            onMouseEnter={() => setActive(index)}
            onClick={() => choose(item)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
