import React from "react";
import { Link } from "react-router-dom";
import "./MapHeader.css";

export default function MapHeader() {
  return (
    <header className="top-header">
      <div className="header-inner">

        <div className="logo">
          Карта<span>Проблем</span>
        </div>

        <nav className="nav-links">
          <Link to="/">Карта</Link>
          <Link to="/login">Войти</Link>
          <Link to="/register" className="btn-register">Регистрация</Link>
        </nav>

      </div>
    </header>
  );
}
