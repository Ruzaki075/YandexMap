import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { register } from "../../services/api";
import { showToast } from "../ToastHost.jsx";
import "./Auth.css";

export default function Register() {
  const history = useHistory();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Заполните все поля");
      return;
    }

    if (password !== repeatPassword) {
      setError("Пароли не совпадают");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Введите корректный email");
      return;
    }

    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const result = await register(email, password);
      if (result && result.status === "success") {
        showToast("Регистрация успешна! Теперь войдите в систему.", "success");
        history.push("/login");
      } else {
        setError("Неизвестная ошибка при регистрации");
      }
    } catch (err) {
      setError(err.message || "Ошибка регистрации");
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleRegister();
  };

  return (
    <div className="auth-page auth-page--standalone page-aurora">
      <div className="auth-box auth-box--wide">
        <header className="auth-header">
          <h1 className="auth-title">Регистрация</h1>
          <p className="auth-subtitle">Создайте аккаунт, чтобы отмечать проблемы на карте</p>
        </header>

        {error ? <div className="auth-error">{error}</div> : null}

        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleRegister();
          }}
        >
          <div className="auth-field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
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
            <label htmlFor="reg-password">Пароль</label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              placeholder="Минимум 6 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKeyDown}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="reg-repeat">Повторите пароль</label>
            <input
              id="reg-repeat"
              type="password"
              autoComplete="new-password"
              placeholder="Ещё раз"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              onKeyDown={onKeyDown}
              className="auth-input"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? "Регистрация…" : "Зарегистрироваться"}
          </button>
        </form>

        <p className="auth-switch">
          Уже есть аккаунт?{" "}
          <Link className="auth-link" to="/login">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
