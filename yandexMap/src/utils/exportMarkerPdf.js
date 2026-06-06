/** Простой экспорт обращения в PDF через печать браузера (без зависимостей). */
export function exportMarkerPdf(marker, timeline = []) {
  const w = window.open("", "_blank");
  if (!w) return;
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const hist = timeline
    .map(
      (e) =>
        `<li><b>${esc(e.created_at)}</b> — ${esc(e.kind === "status" ? `${e.old_status} → ${e.new_status}` : `${e.field_name}: ${e.old_value} → ${e.new_value}`)} (${esc(e.actor_email)})</li>`
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Обращение #${marker.id}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{font-size:18px}img{max-width:100%;margin:8px 0}</style></head><body>
<h1>Обращение #${esc(marker.id)}</h1>
<p><b>Статус:</b> ${esc(marker.status)}</p>
<p><b>Координаты:</b> ${esc(marker.latitude)}, ${esc(marker.longitude)}</p>
<p><b>Описание:</b></p><p>${esc(marker.text)}</p>
${marker.image_url ? `<p><b>Фото до:</b></p><img src="${esc(marker.image_url)}" alt="" />` : ""}
${marker.image_after_url ? `<p><b>Фото после:</b></p><img src="${esc(marker.image_after_url)}" alt="" />` : ""}
<h2>История</h2><ul>${hist || "<li>—</li>"}</ul>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
  w.document.close();
}
