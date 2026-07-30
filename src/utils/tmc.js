// Достаёт название участка из строки ТМЦ (учитывает опечатку "Участок " с пробелом)
export const getTmcUch = (row) => String(row["Участок "] || row["Участок"] || '').trim();

// Динамически детектирует пары [План]/[Факт] колонок из данных
export const detectMaterials = (data) => {
  if (!data?.length) return [];
  const sample = data.find(r => r && Object.keys(r).length > 1);
  if (!sample) return [];
  const materials = [];
  Object.keys(sample).forEach(key => {
    const trimKey = key.trim();
    if (trimKey.includes('[') && (trimKey.endsWith('[План]') || trimKey.endsWith('[ План]') || trimKey.endsWith('[план]'))) {
      const name = trimKey.replace(/\s*\[[\s]*[Пп]лан[\s]*\]$/, '').trim();
      const factKey = Object.keys(sample).find(k => {
        const t = k.trim();
        return t.startsWith(name) && (t.endsWith('[Факт]') || t.endsWith('[ Факт]') || t.endsWith('[факт]'));
      });
      if (factKey) {
        materials.push({ name, planKey: key, factKey });
      }
    }
  });
  return materials;
};