import { STATUS_LABELS } from "../../utils/slaLabels.js";

export const PAGE_SIZE = 40;
export const ROW_HEIGHT = 92;

export const STATUS_OPTIONS = [
  { value: "pending", label: STATUS_LABELS.pending },
  { value: "approved", label: STATUS_LABELS.approved },
  { value: "in_progress", label: STATUS_LABELS.in_progress },
  { value: "resolved", label: STATUS_LABELS.resolved },
  { value: "rejected", label: STATUS_LABELS.rejected },
  { value: "all", label: "Все" },
];

export const SORT_OPTIONS = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
  { value: "overdue_first", label: "Просрочка" },
  { value: "sla_nearest", label: "Ближайший SLA" },
  { value: "most_supported", label: "Больше поддержек" },
  { value: "updated", label: "Недавно обновлены" },
];

export const MOD_TABS = [
  { value: "queue", label: "Очередь" },
  { value: "spam", label: "Спам" },
];

export const ABUSE_REASON_LABELS = {
  spam: "Спам",
  fake: "Фейковое обращение",
  offensive: "Оскорбления",
  other: "Другое",
};

export const ABUSE_STATUS_LABELS = {
  open: "Новая",
  dismissed: "Без нарушения",
  actioned: "Обработана",
};

export const ABUSE_STATUS_OPTIONS = [
  { value: "open", label: "Новые" },
  { value: "dismissed", label: "Без нарушения" },
  { value: "actioned", label: "Обработаны" },
  { value: "all", label: "Все" },
];

export function abuseStatusLabel(status) {
  return ABUSE_STATUS_LABELS[status] || status || "—";
}

export function abuseReasonLabel(reason) {
  return ABUSE_REASON_LABELS[reason] || reason || "—";
}

export const DEFAULT_FILTERS = {
  tab: "queue",
  status: "pending",
  category: "",
  q: "",
  sort: "newest",
  overdue: false,
  has_photo: false,
  many_supports: false,
  unresolved: false,
  my_checks: false,
  date_from: "",
  date_to: "",
  page: 1,
  spam_status: "open",
  spam_reason: "",
};

export function parseFiltersFromSearch(search) {
  const p = new URLSearchParams(search || "");
  const status = p.get("status") || DEFAULT_FILTERS.status;
  const tab = p.get("tab") === "spam" ? "spam" : "queue";
  return {
    tab,
    status: status === "overdue" ? "pending" : status,
    category: p.get("category") || "",
    q: p.get("q") || "",
    sort: p.get("sort") || DEFAULT_FILTERS.sort,
    overdue: p.get("overdue") === "1" || status === "overdue",
    has_photo: p.get("has_photo") === "1",
    many_supports: p.get("many_supports") === "1",
    unresolved: p.get("unresolved") === "1",
    my_checks: p.get("my_checks") === "1",
    date_from: p.get("date_from") || "",
    date_to: p.get("date_to") || "",
    page: Math.max(1, parseInt(p.get("page") || "1", 10) || 1),
    spam_status: p.get("spam_status") || DEFAULT_FILTERS.spam_status,
    spam_reason: p.get("spam_reason") || "",
  };
}

export function filtersToSearchParams(filters) {
  const p = new URLSearchParams();
  if (filters.tab === "spam") p.set("tab", "spam");
  if (filters.status && filters.status !== "pending") p.set("status", filters.status);
  else if (filters.status === "pending") p.set("status", "pending");
  if (filters.category) p.set("category", filters.category);
  if (filters.q?.trim()) p.set("q", filters.q.trim());
  if (filters.sort && filters.sort !== "newest") p.set("sort", filters.sort);
  if (filters.overdue) p.set("overdue", "1");
  if (filters.has_photo) p.set("has_photo", "1");
  if (filters.many_supports) p.set("many_supports", "1");
  if (filters.unresolved) p.set("unresolved", "1");
  if (filters.my_checks) p.set("my_checks", "1");
  if (filters.date_from) p.set("date_from", filters.date_from);
  if (filters.date_to) p.set("date_to", filters.date_to);
  if (filters.page > 1) p.set("page", String(filters.page));
  if (filters.spam_status && filters.spam_status !== "open") {
    p.set("spam_status", filters.spam_status);
  }
  if (filters.spam_reason) p.set("spam_reason", filters.spam_reason);
  return p;
}

export function apiParamsFromSpamFilters(filters) {
  return {
    page: filters.page,
    page_size: PAGE_SIZE,
    status: filters.spam_status || "open",
    reason: filters.spam_reason || undefined,
  };
}

export function apiParamsFromFilters(filters) {
  return {
    page: filters.page,
    page_size: PAGE_SIZE,
    status: filters.overdue ? "overdue" : filters.status,
    category: filters.category || undefined,
    overdue: filters.overdue,
    has_photo: filters.has_photo,
    many_supports: filters.many_supports,
    unresolved: filters.unresolved,
    my_checks: filters.my_checks,
    q: filters.q?.trim() || undefined,
    sort: filters.sort,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  };
}
