import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";
import MapHeader from "../Map/MapHeader";
import { register } from "../../services/api";
import "./Auth.css";

export default function Register() {
  const history = useHistory();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");

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
    
    try {
      console.log("Пытаемся зарегистрировать:", email);
      const result = await register(email, password);
      console.log("Регистрация успешна, результат:", result);
      
      if (result && result.status === "success") {
        alert("Регистрация успешна! Теперь войдите в систему.");
        history.push("/login");
      } else {
        setError("Неизвестная ошибка при регистрации");
      }
    } catch (err) {
      console.error("Ошибка регистрации:", err);
      setError(err.message || "Ошибка регистрации");
    }
  };

  return (
    <>
      <MapHeader />

      <div className="auth-page">
        <div className="auth-box">
          <h2 className="auth-title">Регистрация</h2>
          
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="Введите email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label>Пароль</label>
            <input
              type="password"
              placeholder="Введите пароль (минимум 6 символов)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label>Повторите пароль</label>
            <input
              type="password"
              placeholder="Введите пароль ещё раз"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              className="auth-input"
            />
          </div>

          <button className="auth-btn" onClick={handleRegister}>
            Зарегистрироваться
          </button>

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