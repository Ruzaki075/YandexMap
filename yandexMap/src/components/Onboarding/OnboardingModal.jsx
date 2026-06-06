import React, { useEffect } from "react";
import { IconX } from "../Icons.jsx";
import "./OnboardingModal.css";

const STORAGE_KEY = "yandexmap_onboarding_v1";

export function isOnboardingDone() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function markOnboardingDone() {
  localStorage.setItem(STORAGE_KEY, "1");
}

function finish(onClose) {
  markOnboardingDone();
  onClose();
}

export default function OnboardingModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") finish(onClose);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="onboard-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-title"
    >
      <button
        type="button"
        className="onboard-backdrop"
        aria-label="Закрыть"
        onClick={() => finish(onClose)}
      />
      <div className="onboard-panel">
        <div className="onboard-panel__head">
          <h2 id="onboard-title">Добро пожаловать</h2>
          <button
            type="button"
            className="onboard-close"
            aria-label="Закрыть"
            onClick={() => finish(onClose)}
          >
            <IconX size={20} />
          </button>
        </div>
        <p className="onboard-lead">
          КартаПроблем — сообщайте о проблемах города и следите за их решением.
        </p>
        <ul className="onboard-list">
          <li>
            <strong>Сообщить</strong> — кнопка внизу экрана или «+» на карте (ПК).
          </li>
          <li>
            <strong>Фильтры</strong> — категории, поиск и даты в боковой панели.
          </li>
          <li>
            <strong>Сообщения</strong> — список обращений открывается снизу.
          </li>
          <li>Статус заявок — в профиле, раздел «Мои обращения».</li>
          <li>Геоподписку можно включить в профиле.</li>
        </ul>
        <div className="onboard-actions">
          <button
            type="button"
            className="onboard-btn action-btn primary"
            onClick={() => finish(onClose)}
          >
            Понятно, начать
          </button>
        </div>
      </div>
    </div>
  );
}
