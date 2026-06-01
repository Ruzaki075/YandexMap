export function filterClassifications(list, query) {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (c) =>
      (c.label_ru || "").toLowerCase().includes(q) ||
      (c.key || "").toLowerCase().includes(q)
  );
}

export function sortClassifications(list, sortKey) {
  const arr = [...list];
  switch (sortKey) {
    case "name":
      arr.sort((a, b) => (a.label_ru || "").localeCompare(b.label_ru || "", "ru"));
      break;
    case "markers":
      arr.sort((a, b) => (b.markers_count ?? 0) - (a.markers_count ?? 0));
      break;
    case "sla":
      arr.sort(
        (a, b) => (b.resolution_days ?? 0) - (a.resolution_days ?? 0)
      );
      break;
    case "newest":
      arr.sort((a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0));
      break;
    case "oldest":
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      break;
    case "order":
    default:
      arr.sort((a, b) => {
        const d = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        return d !== 0 ? d : (a.key || "").localeCompare(b.key || "");
      });
  }
  return arr;
}

export function formatAvgDays(days) {
  if (days == null || Number.isNaN(days)) return "—";
  if (days < 1) return "< 1 дн.";
  return `${days.toFixed(1)} дн.`;
}
