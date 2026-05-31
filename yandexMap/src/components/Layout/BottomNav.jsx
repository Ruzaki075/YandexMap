import React, { useContext, useEffect, useRef, useState } from "react";

import { NavLink, useLocation } from "react-router-dom";

import { AuthContext } from "../Auth/AuthContext.jsx";

import { useUnreadNotifications } from "../../hooks/useUnreadNotifications.js";

import "./BottomNav.css";



const HIDE = new Set(["/login", "/register"]);



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

          🗺

        </span>

        Карта

      </NavLink>



      {user ? (

        <>

          <NavLink to="/profile" className="bottom-nav__item" activeClassName="is-active">

            <span className="bottom-nav__icon" aria-hidden="true">

              👤

            </span>

            Мои

          </NavLink>

          <NavLink

            to="/notifications"

            className="bottom-nav__item bottom-nav__item--badge-host"

            activeClassName="is-active"

          >

            <span className="bottom-nav__icon" aria-hidden="true">

              🔔

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

                ✓

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

                ⋯

              </span>

              Ещё

            </button>

            {moreOpen ? (

              <div className="bottom-nav__sheet" role="menu">

                <NavLink to="/stats" className="bottom-nav__sheet-link" role="menuitem">

                  📊 Статистика

                </NavLink>

                <NavLink to="/analytics" className="bottom-nav__sheet-link" role="menuitem">

                  📈 Аналитика

                </NavLink>

                <NavLink

                  to="/leaderboard"

                  className="bottom-nav__sheet-link"

                  role="menuitem"

                >

                  🏆 Рейтинг

                </NavLink>

                {user?.is_admin ? (

                  <NavLink to="/admin" className="bottom-nav__sheet-link" role="menuitem">

                    ⚙ Админ

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

                  Выйти

                </button>

              </div>

            ) : null}

          </div>

        </>

      ) : (

        <>

          <NavLink to="/login" className="bottom-nav__item" activeClassName="is-active">

            <span className="bottom-nav__icon" aria-hidden="true">

              →

            </span>

            Войти

          </NavLink>

        </>

      )}

    </nav>

  );

}

