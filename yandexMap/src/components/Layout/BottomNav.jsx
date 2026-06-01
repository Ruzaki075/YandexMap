import React, { useContext, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AuthContext } from "../Auth/AuthContext.jsx";
import { useUnreadNotifications } from "../../hooks/useUnreadNotifications.js";
import {
  IconAward,
  IconBell,
  IconCheck,
  IconPin,
  IconLogOut,
  IconLogin,
  IconMap,
  IconMenu,
  IconModeration,
  IconSettings,
  IconTrendingUp,
  IconUser,
} from "../Icons.jsx";
import "./BottomNav.css";

const HIDE = new Set(["/", "/login", "/register"]);

function NavBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span className="bottom-nav__badge" aria-hidden="true">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const { user, logout } = useContext(AuthContext);
  const { unreadCount } = useUnreadNotifications();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const close = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);

  if (HIDE.has(pathname)) return null;

  const isMod = user?.is_moderator || user?.is_admin;

  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      <NavLink exact to="/" className="bottom-nav__item" activeClassName="is-active">
        <span className="bottom-nav__icon" aria-hidden="true">
          <IconMap size={26} />
        </span>
        Карта
      </NavLink>

      {user ? (
        <>
          <NavLink to="/profile" className="bottom-nav__item" activeClassName="is-active">
            <span className="bottom-nav__icon" aria-hidden="true">
              <IconUser size={26} />
            </span>
            Мои
          </NavLink>

          <NavLink
            to="/notifications"
            className="bottom-nav__item bottom-nav__item--badge-host"
            activeClassName="is-active"
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              <IconBell size={26} />
            </span>
            Алерты
            <NavBadge count={unreadCount} />
          </NavLink>

          {isMod ? (
            <NavLink
              to="/moderation"
              className="bottom-nav__item"
              activeClassName="is-active"
            >
              <span className="bottom-nav__icon" aria-hidden="true">
                <IconModeration size={26} />
              </span>
              Модерация
            </NavLink>
          ) : null}

          <div className="bottom-nav__more-wrap" ref={moreRef}>
            <button
              type="button"
              className={`bottom-nav__item bottom-nav__more-btn${moreOpen ? " is-active" : ""}`}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              onClick={() => setMoreOpen((v) => !v)}
            >
              <span className="bottom-nav__icon" aria-hidden="true">
                <IconMenu size={26} />
              </span>
              Ещё
            </button>

            {moreOpen ? (
              <div className="bottom-nav__sheet" role="menu">
                <NavLink to="/results" className="bottom-nav__sheet-link" role="menuitem">
                  <IconCheck size={18} />
                  Результаты
                </NavLink>
                <NavLink to="/about" className="bottom-nav__sheet-link" role="menuitem">
                  <IconPin size={18} />
                  О проекте
                </NavLink>
                <NavLink to="/analytics" className="bottom-nav__sheet-link" role="menuitem">
                  <IconTrendingUp size={18} />
                  Аналитика
                </NavLink>
                <NavLink
                  to="/leaderboard"
                  className="bottom-nav__sheet-link"
                  role="menuitem"
                >
                  <IconAward size={18} />
                  Рейтинг
                </NavLink>
                {user?.is_admin ? (
                  <NavLink to="/admin" className="bottom-nav__sheet-link" role="menuitem">
                    <IconSettings size={18} />
                    Админ
                  </NavLink>
                ) : null}
                <button
                  type="button"
                  className="bottom-nav__sheet-link bottom-nav__sheet-link--danger"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    logout();
                  }}
                >
                  <IconLogOut size={18} />
                  Выйти
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <NavLink to="/login" className="bottom-nav__item" activeClassName="is-active">
          <span className="bottom-nav__icon" aria-hidden="true">
            <IconLogin size={26} />
          </span>
          Войти
        </NavLink>
      )}
    </nav>
  );
}
