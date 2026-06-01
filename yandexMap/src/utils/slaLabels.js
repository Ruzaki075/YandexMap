export function formatDueLine(marker) {
  if (!marker) return null;
  const st = marker.status || "pending";
  if (st === "resolved" && marker.resolved_at) {
    return `Решено ${new Date(marker.resolved_at).toLocaleDateString("ru-RU")}`;
  }
  if (st === "pending" && marker.response_due_at) {
    const d = new Date(marker.response_due_at);
    const overdue = marker.is_overdue;
    return overdue
      ? `Просрочена модерация (срок ${d.toLocaleDateString("ru-RU")})`
      : `Модерация до ${d.toLocaleDateString("ru-RU")}`;
  }
  if ((st === "approved" || st === "in_progress") && marker.resolution_due_at) {
    const d = new Date(marker.resolution_due_at);
    const overdue = marker.is_overdue;
    const prefix = st === "in_progress" ? "Устранить до" : "Срок устранения";
    return overdue
      ? `Просрочено: ${prefix.toLowerCase()} ${d.toLocaleDateString("ru-RU")}`
      : `${prefix} ${d.toLocaleDateString("ru-RU")}`;
  }
  return null;
}

export const STATUS_LABELS = {
  pending: "На проверке",
  approved: "Активно",
  in_progress: "В работе",
  rejected: "Отклонено",
  resolved: "Решено",
};

/** Подписи статуса в карточке обращения (как в «Активном гражданине»). */
export const AG_STATUS_LABELS = {
  pending: "На модерации",
  approved: "Принято к рассмотрению",
  in_progress: "Проблема в работе",
  rejected: "Обращение отклонено",
  resolved: "Проблема решена",
};
