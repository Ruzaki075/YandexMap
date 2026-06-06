import React, { useEffect, useState } from "react";
import { MARKER_PRESET_OPTIONS } from "../../utils/markerColors.js";
import ClassificationColorPicker from "./ClassificationColorPicker.jsx";
import { SLA_PRESETS } from "./classificationConstants.js";

const emptyCreate = () => ({
  key: "",
  label_ru: "",
  marker_icon: MARKER_PRESET_OPTIONS[0].value,
  resolution_days: 14,
  training_phrases: "",
});

function ClassificationEditor({
  mode,
  initial,
  others,
  busy,
  onSave,
  onClose,
}) {
  const isCreate = mode === "create";
  const [form, setForm] = useState(isCreate ? emptyCreate() : {
    label_ru: initial?.label_ru || "",
    marker_icon: initial?.marker_icon || MARKER_PRESET_OPTIONS[0].value,
    resolution_days: initial?.resolution_days ?? 14,
    training_phrases: (initial?.training_phrases_ru || []).join("\n"),
  });

  useEffect(() => {
    if (!isCreate && initial) {
      setForm({
        label_ru: initial.label_ru || "",
        marker_icon: initial.marker_icon,
        resolution_days: initial.resolution_days ?? 14,
        training_phrases: (initial.training_phrases_ru || []).join("\n"),
      });
    }
  }, [initial, isCreate]);

  const submit = (e) => {
    e.preventDefault();
    const phrases = form.training_phrases
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (isCreate) {
      onSave({
        key: form.key.trim().toLowerCase(),
        label_ru: form.label_ru.trim(),
        marker_icon: form.marker_icon,
        resolution_days: Number(form.resolution_days) || 14,
        training_phrases_ru: phrases,
      });
    } else {
      onSave({
        label_ru: form.label_ru.trim(),
        marker_icon: form.marker_icon,
        resolution_days: Number(form.resolution_days) || 14,
        training_phrases_ru: phrases,
      });
    }
  };

  const setSla = (days) => {
    setForm((f) => ({ ...f, resolution_days: days }));
  };

  return (
    <div className="tax-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="tax-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tax-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tax-modal__head">
          <h3 id="tax-modal-title">
            {isCreate ? "Новая классификация" : `Редактирование: ${initial?.label_ru}`}
          </h3>
          <button
            type="button"
            className="tax-modal__close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <form className="tax-modal__form" onSubmit={submit}>
          {isCreate ? (
            <label className="tax-field">
              <span>Ключ (латиница)</span>
              <input
                type="text"
                value={form.key}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    key: e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase(),
                  }))
                }
                placeholder="parks"
                required
                pattern="[a-z][a-z0-9_]*"
              />
            </label>
          ) : (
            <p className="tax-field-hint">
              Ключ: <code>{initial?.key}</code> (не изменяется)
            </p>
          )}
          <label className="tax-field">
            <span>Название</span>
            <input
              type="text"
              value={form.label_ru}
              onChange={(e) =>
                setForm((f) => ({ ...f, label_ru: e.target.value }))
              }
              required
            />
          </label>
          <fieldset className="tax-field">
            <legend>
              Срок устранения (SLA)
              <span
                className="tax-tip"
                title="Максимальный срок решения обращения после одобрения модератором"
              >
                ?
              </span>
            </legend>
            <div className="tax-sla-presets">
              {SLA_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`tax-sla-preset${
                    Number(form.resolution_days) === d ? " tax-sla-preset--on" : ""
                  }`}
                  onClick={() => setSla(d)}
                >
                  {d} дн.
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={365}
              value={form.resolution_days}
              onChange={(e) =>
                setForm((f) => ({ ...f, resolution_days: e.target.value }))
              }
            />
          </fieldset>
          <fieldset className="tax-field">
            <legend>Цвет метки на карте</legend>
            <ClassificationColorPicker
              value={form.marker_icon}
              onChange={(v) => setForm((f) => ({ ...f, marker_icon: v }))}
              others={others}
              currentKey={isCreate ? form.key : initial?.key}
              disabled={busy}
            />
          </fieldset>
          <label className="tax-field">
            <span>Фразы для классификатора (по одной на строку)</span>
            <textarea
              rows={4}
              value={form.training_phrases}
              onChange={(e) =>
                setForm((f) => ({ ...f, training_phrases: e.target.value }))
              }
              placeholder="нет скамеек в парке"
            />
          </label>
          <footer className="tax-modal__foot">
            <button
              type="button"
              className="mod-action mod-action--muted"
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="mod-action mod-action--ok"
              disabled={busy}
            >
              {busy ? "Сохранение…" : isCreate ? "Создать" : "Сохранить"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default ClassificationEditor;
