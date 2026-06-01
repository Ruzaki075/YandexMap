import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import KpLogo from "../components/KpLogo.jsx";
import {
  IconActivity,
  IconAward,
  IconBell,
  IconCheck,
  IconChevronDown,
  IconMap,
  IconPin,
  IconSearch,
  IconSettings,
} from "../components/Icons.jsx";
import { getMapStats, getMarkers } from "../services/api.js";
import StatCounters from "./StatCounters.jsx";
import "./pages.css";
import "./About.css";

const STEPS = [
  {
    num: 1,
    Icon: IconPin,
    title: "Отметьте проблему на карте",
    text: "Заметили проблему? Нажмите на карту, укажите точку, опишите проблему и прикрепите фото. ИИ автоматически определит категорию обращения.",
  },
  {
    num: 2,
    Icon: IconSearch,
    title: "Модератор принимает обращение",
    text: "Модератор проверяет обращение и передаёт в профильное ведомство. Вы получите уведомление о принятии в работу.",
  },
  {
    num: 3,
    Icon: IconCheck,
    title: "Проблема решена! +50 баллов",
    text: "После устранения проблемы статус меняется на «Решено». Вы получаете баллы и достижения за активное участие.",
  },
];

const FEATURES = [
  {
    Icon: IconMap,
    title: "Интерактивная карта",
    text: "Все обращения отображаются на карте города с кластеризацией и тепловой картой активности",
  },
  {
    Icon: IconActivity,
    title: "ИИ-классификация",
    text: "Искусственный интеллект автоматически определяет категорию проблемы по тексту и фотографии",
  },
  {
    Icon: IconBell,
    title: "Уведомления в реальном времени",
    text: "WebSocket-уведомления о смене статуса вашего обращения и новых ответах ведомств",
  },
  {
    Icon: IconAward,
    title: "Система достижений",
    text: "Зарабатывайте баллы за активность, получайте бейджи и поднимайтесь в рейтинге участников",
  },
  {
    Icon: IconSettings,
    title: "Модерация и ведомства",
    text: "Прозрачная система модерации с официальными ответами от профильных городских служб",
  },
];

const TECH = [
  "React 19",
  "Go 1.21",
  "PostgreSQL 16",
  "Яндекс.Карты API",
  "Python / ML",
  "WebSocket",
  "Docker",
  "PostGIS",
];

const FAQ = [
  {
    q: "Как подать обращение?",
    a: "Зарегистрируйтесь, нажмите кнопку «Сообщить о проблеме», укажите точку на карте, опишите проблему и при желании прикрепите фото. ИИ предложит категорию автоматически.",
  },
  {
    q: "Сколько времени занимает рассмотрение?",
    a: "Сроки зависят от категории: дорожные проблемы — до 30 дней, ЖКХ — до 14 дней, благоустройство — до 45 дней. Вы получите уведомление при каждом изменении статуса.",
  },
  {
    q: "Можно ли отслеживать статус обращения?",
    a: "Да, в разделе «Профиль → Мои обращения» отображается полная история статусов с датами и комментариями модератора.",
  },
  {
    q: "Как работает система баллов?",
    a: "За каждое действие начисляются баллы: создание обращения +20, решение проблемы +50, комментарий +5. Набирайте баллы и повышайте уровень от «Жителя» до «Лидера города».",
  },
  {
    q: "Кто обрабатывает обращения?",
    a: "Обращения проходят модерацию и передаются в профильные ведомства. Официальные представители могут оставлять ответы прямо на платформе.",
  },
];

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="about-faq__item">
      <button type="button" className="about-faq__q" onClick={onToggle}>
        {item.q}
        <span className={`about-faq__chevron${open ? " is-open" : ""}`}>
          <IconChevronDown size={20} />
        </span>
      </button>
      <div className={`about-faq__a-wrap${open ? " is-open" : ""}`}>
        <p className="about-faq__a">{item.a}</p>
      </div>
    </div>
  );
}

export default function About() {
  const [openFaq, setOpenFaq] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    resolved: 0,
    participants: 0,
  });

  const loadStats = useCallback(() => {
    getMapStats()
      .then((s) => {
        setStats((prev) => ({
          ...prev,
          total: s.total ?? 0,
          active: s.active ?? 0,
          resolved: s.resolved ?? 0,
        }));
      })
      .catch(() => {});
    getMarkers({ layer: "all" })
      .then((d) => {
        const markers = d.markers || [];
        const users = new Set(
          markers.map((m) => m.user_id).filter((id) => id != null)
        );
        setStats((prev) => ({ ...prev, participants: users.size }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="kp-page about-page">
      <section className="about-hero">
        <KpLogo to="/" />
        <p className="about-hero__sub">
          Платформа для картографической фиксации социально значимых проблем
          городской среды
        </p>
      </section>

      <div className="kp-page__inner">
        <h2 className="kp-section-title">Как это работает</h2>
        <div className="about-steps-wrap">
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.num}>
              {idx > 0 ? <span className="about-step-arrow" aria-hidden="true">→</span> : null}
              <article className="about-step">
                <span className="about-step__num">{step.num}</span>
                <div className="about-step__icon">
                  <step.Icon size={32} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            </React.Fragment>
          ))}
        </div>

        <h2 className="kp-section-title">Возможности платформы</h2>
        <div className="about-features">
          {FEATURES.map((f) => (
            <article key={f.title} className="about-feature">
              <div className="about-feature__icon">
                <f.Icon size={28} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>

        <h2 className="kp-section-title">Технологии</h2>
        <div className="about-tech">
          {TECH.map((t) => (
            <span key={t} className="about-tech__badge">
              {t}
            </span>
          ))}
        </div>

        <h2 className="kp-section-title">КартаПроблем в цифрах</h2>
        <StatCounters stats={stats} />

        <h2 className="kp-section-title">Частые вопросы</h2>
        <div className="about-faq">
          {FAQ.map((item, i) => (
            <FaqItem
              key={item.q}
              item={item}
              open={openFaq === i}
              onToggle={() => setOpenFaq((v) => (v === i ? null : i))}
            />
          ))}
        </div>

        <section className="about-cta">
          <h2>Готовы изменить свой город?</h2>
          <p>Присоединяйтесь к тысячам активных жителей</p>
          <div className="about-cta__actions">
            <Link to="/register" className="kp-btn kp-btn--primary">
              Начать →
            </Link>
            <Link to="/" className="kp-btn kp-btn--outline">
              Посмотреть карту
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
