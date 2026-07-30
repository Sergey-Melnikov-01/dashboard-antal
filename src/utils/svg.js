// SVG path для прямоугольника с закруглёнными верхними углами
export const roundedTopRect = (x, y, w, h, r) => {
  if (h <= 0) return '';
  const actualR = Math.min(r, h / 2, w / 2);
  return `M ${x + actualR},${y} L ${x + w - actualR},${y} Q ${x + w},${y} ${x + w},${y + actualR} L ${x + w},${y + h} L ${x},${y + h} L ${x},${y + actualR} Q ${x},${y} ${x + actualR},${y} Z`;
};