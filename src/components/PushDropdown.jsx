import React from 'react';

export const PushDropdown = ({ name, label, value, options, onChange, onReset, openDropdown, setOpenDropdown, multi = false }) => {
  const isOpen = openDropdown === name;
  const wrapperRef = React.useRef(null);
  const [openLeft, setOpenLeft] = React.useState(false);

  const handleToggle = () => {
    if (!isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setOpenLeft(rect.left + 280 > window.innerWidth);
    }
    setOpenDropdown(prev => prev === name ? null : name);
  };

  const isActive = multi ? (Array.isArray(value) && value.length > 0) : (value && value !== 'Все' && value !== 'Нет');
  const buttonText = multi ? ((value && value.length) ? value.join(', ') : 'Нет') : (value || 'Все');

  const handleOptionClick = (opt) => {
    if (multi) {
      const current = Array.isArray(value) ? value : [];
      const next = current.includes(opt) ? current.filter(v => v !== opt) : [...current, opt];
      onChange(next);
      // В режиме мультивыбора меню остаётся открытым, чтобы можно было отметить сразу несколько пунктов
    } else {
      onChange(opt);
      setOpenDropdown(null);
    }
  };

  const handleResetClick = () => {
    if (multi) {
      onChange([]);
    } else {
      onChange(onReset !== undefined ? onReset : 'Все');
    }
    setOpenDropdown(null);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <style>{`
        .push-btn {
          border-radius: 10px;
          border: 2px outset #2de2a640;
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          color: #eee;
          text-transform: uppercase;
          letter-spacing: 2px;
          overflow: hidden;
          box-shadow: 0 0 8px rgba(0,0,0,0.8);
          font-family: verdana, sans-serif;
          font-size: 11px;
          font-weight: bold;
          cursor: pointer;
          background: linear-gradient(160deg, #2a2b38, #21222d);
          text-shadow: 0px 0px 2px rgba(0,0,0,.5);
          transition: 0.2s;
          white-space: nowrap;
          user-select: none;
        }
        .push-btn.active-filter {
          border-color: #2de2a6;
          color: #2de2a6;
          box-shadow: 0 0 8px #2de2a640, 0 0 20px #2de2a620;
        }
        .push-btn:active, .push-btn.open {
          border: 2px outset #2de2a6;
          color: #fff;
          background: linear-gradient(160deg, #2e3048, #21222d);
          text-shadow: 0px 0px 4px #2de2a6;
          box-shadow: 0 0 10px #2de2a6, 0 0 30px #2de2a640;
        }
        .push-btn span { position: absolute; display: block; }
        .push-btn span:nth-child(1) { top: 0; left: -100%; width: 100%; height: 1px; background: linear-gradient(90deg, transparent, #2de2a6); }
        .push-btn.open span:nth-child(1) { left: 100%; transition: 0.8s; }
        .push-btn span:nth-child(2) { top: -100%; right: 0; width: 1px; height: 100%; background: linear-gradient(180deg, transparent, #2de2a6); }
        .push-btn.open span:nth-child(2) { top: 100%; transition: 0.8s; transition-delay: 0.2s; }
        .push-btn span:nth-child(3) { bottom: 0; right: -100%; width: 100%; height: 1px; background: linear-gradient(270deg, transparent, #2de2a6); }
        .push-btn.open span:nth-child(3) { right: 100%; transition: 0.8s; transition-delay: 0.4s; }
        .push-btn span:nth-child(4) { bottom: -100%; left: 0; width: 1px; height: 100%; background: linear-gradient(360deg, transparent, #2de2a6); }
        .push-btn.open span:nth-child(4) { bottom: 100%; transition: 0.8s; transition-delay: 0.6s; }
        .push-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          z-index: 9999;
          background: #21222d;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          min-width: 200px;
          max-width: calc(100vw - 24px);
          max-height: 260px;
          overflow-y: auto;
          overflow-x: hidden;
          box-shadow: 0 0 20px rgba(45,226,166,0.15);
          padding: 4px 0;
        }
        .push-dropdown-item {
          padding: 9px 16px;
          font-size: 12px;
          color: #9ca3af;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .push-dropdown-item:hover { background: rgba(255,255,255,0.05); color: #2de2a6; }
        .push-dropdown-item.selected { color: #2de2a6; font-weight: bold; }
      `}</style>
      <button
        className={`push-btn ${isOpen ? 'open' : ''} ${isActive ? 'active-filter' : ''}`}
        onClick={handleToggle}
      >
        <span></span><span></span><span></span><span></span>
        {label}: {buttonText}
        <span style={{ position: 'static', marginLeft: '4px', fontSize: '9px' }}>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div
          className="push-dropdown-menu"
          style={openLeft ? { right: 0 } : { left: 0 }}
        >
          <div
            className={`push-dropdown-item ${multi ? (!value || value.length === 0 ? 'selected' : '') : (!value || value === 'Все' || value === '' || value === 'Нет' ? 'selected' : '')}`}
            onClick={handleResetClick}
          >
            {(() => {
              if (label === 'Участок') return 'Все участки';
              if (label === 'Ветка') return 'Все ветки';
              if (label === 'Подрядчик') return 'Все подрядчики';
              if (label === 'Дата') return 'Даты';
              if (label === 'Графики') return 'Скрыть все графики';
              return `Все ${label.toLowerCase()}`;
            })()}
          </div>
          {options.map(opt => (
            <div
              key={opt}
              className={`push-dropdown-item ${multi ? (Array.isArray(value) && value.includes(opt) ? 'selected' : '') : (value === opt ? 'selected' : '')}`}
              onClick={() => handleOptionClick(opt)}
            >
              {multi ? (Array.isArray(value) && value.includes(opt) ? '☑ ' : '☐ ') : ''}{opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

