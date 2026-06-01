import React, { useEffect, useState } from "react";

import { IconAlertCircle, IconCheck, IconX } from "./Icons.jsx";
import "./ToastHost.css";

const TOAST_ICONS = {
  success: IconCheck,
  error: IconX,
  info: IconAlertCircle,
};



export function showToast(message, type = "info") {

  window.dispatchEvent(

    new CustomEvent("app:toast", { detail: { message, type } })

  );

}



export default function ToastHost() {

  const [toast, setToast] = useState(null);



  useEffect(() => {

    const onToast = (e) => {

      const { message, type } = e.detail || {};

      setToast({ message, type, id: Date.now() });

    };

    window.addEventListener("app:toast", onToast);

    return () => window.removeEventListener("app:toast", onToast);

  }, []);



  useEffect(() => {

    if (!toast) return undefined;

    const ms = toast.type === "error" ? 6000 : 4500;

    const t = setTimeout(() => setToast(null), ms);

    return () => clearTimeout(t);

  }, [toast]);



  if (!toast) return null;



  const type = toast.type || "info";



  return (

    <div

      className={`app-toast app-toast--${type}`}

      role="status"

      aria-live="polite"

      onClick={() => setToast(null)}

    >

      <span className="app-toast__icon" aria-hidden="true">
        {(() => {
          const Icon = TOAST_ICONS[type] || TOAST_ICONS.info;
          return <Icon size={20} />;
        })()}
      </span>

      <span className="app-toast__text">{toast.message}</span>

      <button

        type="button"

        className="app-toast__close"

        aria-label="Закрыть"

        onClick={(e) => {

          e.stopPropagation();

          setToast(null);

        }}

      >

        <IconX size={16} />
      </button>

    </div>

  );

}

