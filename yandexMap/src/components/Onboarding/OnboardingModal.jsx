import React, { useEffect } from "react";
import "./OnboardingModal.css";

const STORAGE_KEY = "yandexmap_onboarding_v1";

export function isOnboardingDone() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function markOnboardingDone() {
  localStorage.setItem(STORAGE_KEY, "1");
}

export default function OnboardingModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="onboard-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-title"
    >
      <div className="onboard-panel">
        <h2 id="onboard-title">Добро пожаловать</h2>
        <ul>
          <li>Кликните по карте или «+ Обращение», чтобы сообщить о проблеме.</li>
          <li>Следите за статусом в разделе «Мои» (профиль).</li>
          <li>Включите геоподписку в профиле — уведомления о событиях рядом.</li>
          <li>Модераторы проверяют заявки; решённые отображаются серым.</li>
        </ul>
        <button
          type="button"
          className="action-btn primary"
          onClick={() => {
            markOnboardingDone();
            onClose();
          }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
