import React, { useEffect, useState } from "react";

import "./ToastHost.css";



const ICONS = {

  success: "✓",

  error: "✕",

  info: "ℹ",

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

        {ICONS[type] || ICONS.info}

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

        ×

      </button>

    </div>

  );

}

