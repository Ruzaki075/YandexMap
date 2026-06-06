/** Таксономия v2: только направления (один уровень). */

export function findCategoryLabels(taxonomy, domainKey) {
  if (!taxonomy?.domains || !domainKey) {
    return null;
  }
  const d = taxonomy.domains.find((x) => x.key === domainKey);
  if (!d) return null;
  return { domain: d.label_ru, key: d.key };
}

/** Совместимость со старыми метками в БД: хватает domain_key. */
export function findCategoryLabelsLegacy(taxonomy, domainKey, _groupKey, _issueKey) {
  return findCategoryLabels(taxonomy, domainKey);
}

export function formatCategoryLine(labels) {
  if (!labels) return "";
  return labels.domain || "";
}
