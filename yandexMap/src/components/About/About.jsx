import React from "react";
import { Link } from "react-router-dom";
import MapHeader from "../Map/MapHeader.jsx";
import "../Profile/Profile.css";
import "./About.css";

export default function About() {
  return (
    <>
      <MapHeader />
      <div className="profile-page page-aurora about-page">
        <div className="profile-container">
          <div className="section-header">
            <h2>Как подать обращение</h2>
          </div>
          <ol className="about-steps">
            <li>
              <Link to="/login">Войдите</Link> или зарегистрируйтесь.
            </li>
            <li>На карте нажмите «+ Обращение» или кликните в месте проблемы.</li>
            <li>Опишите ситуацию, при необходимости прикрепите фото.</li>
            <li>Выберите категорию (или доверьтесь подсказке ИИ).</li>
            <li>Дождитесь проверки модератором — статус виден в профиле.</li>
          </ol>

          <div className="about-actions">
            <Link to="/" className="action-btn primary">
              Открыть карту
            </Link>
            <Link to="/stats" className="action-btn secondary">
              Статистика
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
