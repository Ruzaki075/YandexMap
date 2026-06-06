import React, { useState, useContext } from "react";
import { Link, useHistory } from "react-router-dom";
import { AuthContext } from "../Auth/AuthContext";
import KpLogo from "../KpLogo.jsx";
import "./Auth.css";

export default function Login() {
  const { login } = useContext(AuthContext);
  const history = useHistory();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Заполните все поля");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      history.push("/");
    } catch (err) {
      setError(err.message || "Ошибка входа");
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="auth-page auth-page--standalone auth-page--karta page-aurora page-aurora--karta">
      <div className="auth-box">
        <div className="auth-logo-wrap">
          <KpLogo to="/" />
        </div>
        <header className="auth-header">
          <h1 className="auth-title">Вход</h1>
          <p className="auth-subtitle">Войдите, чтобы добавлять обращения на карту</p>
        </header>

        {error ? <div className="auth-error">{error}</div> : null}

        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
        >
          <div className="auth-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKeyDown}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">Пароль</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKeyDown}
              className="auth-input"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? "Вход…" : "Войти"}
          </button>
        </form>

        <p className="auth-switch">
          Нет аккаунта?{" "}
          <Link className="auth-link" to="/register">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
