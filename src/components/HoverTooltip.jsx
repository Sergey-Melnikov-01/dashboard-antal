import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

// Универсальная подсказка при наведении: рендерится через портал в document.body,
// поэтому НИКОГДА не обрезается родительскими контейнерами с overflow:hidden/auto
// (в отличие от position:absolute внутри прокручиваемых карточек).
// Позиция считается от реального положения элемента на экране и прижимается к границам окна.
export const HoverTooltip = ({ content, children, tooltipWidth = 220 }) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  const handleEnter = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const margin = 10;
    let left = rect.left + rect.width / 2;
    left = Math.max(tooltipWidth / 2 + margin, Math.min(left, window.innerWidth - tooltipWidth / 2 - margin));
    let top = rect.top - 10;
    let placement = 'above';
    // Если сверху не хватает места (элемент у верхнего края экрана) — показываем подсказку снизу
    if (top < 90) {
      top = rect.bottom + 10;
      placement = 'below';
    }
    setPos({ top, left, placement });
    setVisible(true);
  };
  const handleLeave = () => setVisible(false);

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        {children}
      </div>
      {visible && createPortal(
        <div style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: pos.placement === 'below' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
          background: '#0f1724',
          color: '#e2e8f0',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 24px rgba(2,6,23,0.6)',
          fontSize: 12,
          maxWidth: tooltipWidth,
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {content}
        </div>,
        document.body
      )}
    </>
  );
};
