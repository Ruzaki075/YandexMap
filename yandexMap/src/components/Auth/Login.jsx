import React, { useState, useContext } from "react";
import { Link, useHistory } from "react-router-dom";
import MapHeader from "../Map/MapHeader";
import { AuthContext } from "../Auth/AuthContext";
import "./Auth.css";

export default function Login() {
  const { login } = useContext(AuthContext);
  const history = useHistory();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Заполните все поля");
      return;
    }

    try {
      await login(email, password); // вызывает API + сохраняет user
      history.push("/");
    } catch (err) {
      setError(err.message || "Ошибка входа");
    }
  };

  return (
    <>
      <MapHeader />

      <div className="auth-page">
        <div className="auth-box">
          <h2 className="auth-title">Вход</h2>
          
          {error && <div className="auth-error">{error}</div>}

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

          <button className="auth-btn" onClick={handleLogin}>Войти</button>

          <p className="auth-switch">
            Нет аккаунта?{" "}
            <Link className="auth-link" to="/register">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
