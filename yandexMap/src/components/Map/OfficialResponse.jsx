import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../Auth/AuthContext.jsx";
import {
  getOfficialResponse,
  getDepartments,
  postOfficialResponse,
  putOfficialResponse,
} from "../../services/api.js";
import { showToast } from "../ToastHost.jsx";
import { IconMap } from "../Icons.jsx";
import "./OfficialResponse.css";

const TYPE_LABELS = {
  accepted: "Принято",
  in_progress: "В работе",
  completed: "Выполнено",
  rejected: "Отклонено",
  info_requested: "Запрошена информация",
};

export default function OfficialResponse({ markerId }) {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    department_id: "",
    response_text: "",
    response_type: "in_progress",
    planned_date: "",
  });

  const canEdit =
    user &&
    (user.is_moderator || user.is_admin || user.is_department_rep);

  const reload = () => {
    if (!markerId) return;
    setLoading(true);
    getOfficialResponse(markerId)
      .then((d) => setData(d.response || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [markerId]);

  useEffect(() => {
    if (!canEdit) return;
    getDepartments()
      .then((d) => setDepartments(d.departments || []))
      .catch(() => setDepartments([]));
  }, [canEdit]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.department_id || !form.response_text.trim()) {
      showToast("Укажите ведомство и текст ответа", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        department_id: Number(form.department_id),
        response_text: form.response_text.trim(),
        response_type: form.response_type,
        planned_date: form.planned_date || "",
      };
      if (data?.id) {
        await putOfficialResponse(markerId, payload);
        showToast("Ответ обновлён", "success");
      } else {
        await postOfficialResponse(markerId, payload);
        showToast("Официальный ответ опубликован", "success");
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      showToast(err.message || "Ошибка", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="modal-section official-response">
        <p className="modal-reviews-muted">Загрузка ответа ведомства…</p>
      </section>
    );
  }

  return (
    <section className="modal-section official-response">
      <h3 className="modal-section-title">Официальный ответ</h3>

      {data ? (
        <div className="official-response-card">
          <div className="official-response-head">
            <span className="official-response-icon" aria-hidden="true">
              {data.department_icon ? (
                data.department_icon
              ) : (
                <IconMap size={20} />
              )}
            </span>
            <div>
              <strong>{data.department_name}</strong>
              {data.department_short ? (
                <span className="official-response-short">
                  {" "}
                  ({data.department_short})
                </span>
              ) : null}
            </div>
            <span
              className={`official-response-badge official-response-badge--${data.response_type || "info"}`}
            >
              {TYPE_LABELS[data.response_type] || data.response_type}
            </span>
          </div>
          <p className="official-response-text">{data.response_text}</p>
          {data.planned_date ? (
            <p className="official-response-date">
              Плановая дата:{" "}
              {new Date(data.planned_date).toLocaleDateString("ru-RU")}
            </p>
          ) : null}
          {data.actual_date ? (
            <p className="official-response-date">
              Фактически:{" "}
              {new Date(data.actual_date).toLocaleDateString("ru-RU")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="modal-reviews-muted">Официальный ответ пока не поступил.</p>
      )}

      {canEdit ? (
        <>
          <button
            type="button"
            className="official-response-edit-btn"
            onClick={() => setFormOpen((v) => !v)}
          >
            {data ? "Изменить ответ" : "Добавить ответ ведомства"}
          </button>
          {formOpen ? (
            <form className="official-response-form" onSubmit={submit}>
              <label>
                Ведомство
                <select
                  value={form.department_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, department_id: e.target.value }))
                  }
                  required
                >
                  <option value="">Выберите…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.icon} {d.name_ru}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Тип ответа
                <select
                  value={form.response_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, response_type: e.target.value }))
                  }
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Текст ответа
                <textarea
                  value={form.response_text}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, response_text: e.target.value }))
                  }
                  rows={4}
                  required
                />
              </label>
              <label>
                Плановая дата
                <input
                  type="date"
                  value={form.planned_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, planned_date: e.target.value }))
                  }
                />
              </label>
              <button type="submit" className="modal-review-submit" disabled={busy}>
                {busy ? "Сохранение…" : "Сохранить"}
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
