import { useMemo } from 'react';

// Проверяет, подходит ли строка данных под заданный набор фильтров.
// Любой фильтр, который не передан (undefined), просто не проверяется.
export function matchesFilters(row, { branch, contractor, section, date, dateField = "Дата отчета" } = {}) {
  if (!row) return false;
  if (date !== undefined && row[dateField] !== date) return false;
  if (branch !== undefined && branch !== 'Все' && row["Ветка"] !== branch) return false;
  if (contractor !== undefined && contractor !== 'Все' && row["Подрядчик"] !== contractor) return false;
  if (section !== undefined && section !== 'Все' && row["Участок"] !== section) return false;
  return true;
}

// Фильтрует массив строк тем же набором правил
export function filterRows(rows, filters) {
  return (rows || []).filter(r => matchesFilters(r, filters));
}

// Хук-обёртка: мемоизированная отфильтрованная выборка
export function useDatasetView(rows, filters) {
  const { branch, contractor, section, date, dateField } = filters || {};
  return useMemo(
    () => filterRows(rows, { branch, contractor, section, date, dateField }),
    [rows, branch, contractor, section, date, dateField]
  );
}
