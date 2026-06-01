import React from "react";
import { Link } from "react-router-dom";

/** Логотип «КАРТА / ПРОБЛЕМ» с красной вертикальной чертой. */
export default function KpLogo({ to = "/", className = "kp-logo" }) {
  const inner = (
    <>
      <span className="kp-logo-bar" aria-hidden="true" />
      <span className="kp-logo-text">
        <span className="kp-logo-line1">КАРТА</span>
        <span className="kp-logo-line2">ПРОБЛЕМ</span>
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} aria-label="КартаПроблем — на главную">
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
