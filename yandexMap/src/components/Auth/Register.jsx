import React, { useState } from "react";
import { Link } from "react-router-dom";
import MapHeader from "../Map/MapHeader";
import "./Auth.css";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  return (
    <>
      <MapHeader />

      <div className="auth-page">
        <div className="auth-box">
          <h2 className="auth-title">Регистрация</h2>

          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="Введите email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label>Пароль</label>
            <input
              type="password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label>Повторите пароль</label>
            <input
              type="password"
              placeholder="Введите пароль ещё раз"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
            />
          </div>

          <button className="auth-btn">Зарегистрироваться</button>

          <p className="auth-switch">
            Уже есть аккаунт?{" "}
            <Link className="auth-link" to="/login">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
