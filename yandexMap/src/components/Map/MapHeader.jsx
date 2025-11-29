import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../Auth/AuthContext";
import "./MapHeader.css";

export default function MapHeader() {
  const { user, logout } = useContext(AuthContext);

  return (
    <header className="top-header">
      <div className="header-inner">

        <div className="logo">
          Карта<span>Проблем</span>
        </div>

        <nav className="nav-links">

          {!user ? (
            <>
              <Link to="/">Карта</Link>
              <Link to="/login">Войти</Link>
              <Link to="/register" className="btn-register">Регистрация</Link>
            </>
          ) : (
            <>
              <Link to="/">Карта</Link>
              <Link to="/profile">Профиль</Link>

              <button
                onClick={logout}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ff4444",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                Выйти
              </button>
            </>
          )}

        </nav>

      </div>
    </header>
  );
}
