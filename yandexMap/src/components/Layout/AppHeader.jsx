import React, { useContext, useState } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import { AuthContext } from "../Auth/AuthContext.jsx";
import { useUnreadNotifications } from "../../hooks/useUnreadNotifications.js";
import { resolveAvatarUrl } from "../../utils/avatarUrl.js";
import { userAvatarLetter } from "../../utils/userDisplay.js";
import KpLogo from "../KpLogo.jsx";
import {
  IconBellWithBadge,
  IconMenu,
  IconSearch,
  IconX,
} from "../Icons.jsx";
import styles from "./AppHeader.module.css";

/** Пункты навигации в шапке (как у портала «Активный гражданин»). */
function buildNav(user) {
  const items = [
    { to: "/", label: "КАРТА", exact: true },
    { to: "/results", label: "РЕЗУЛЬТАТЫ" },
    { to: "/about", label: "О ПРОЕКТЕ" },
  ];
  if (user) {
    items.push({ to: "/profile", label: "ПРОФИЛЬ" });
    if (user.is_moderator || user.is_admin) {
      items.push({ to: "/moderation", label: "МОДЕРАЦИЯ" });
    }
    if (user.is_admin) {
      items.push({ to: "/admin", label: "АДМИН" });
    }
  }
  return items;
}

/**
 * Единая шапка на всех страницах (кроме login/register).
 */
export default function AppHeader() {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const location = useLocation();
  const { unreadCount } = useUnreadNotifications();
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = buildNav(user);
  const isMap = location.pathname === "/";

  const renderLinks = (className) =>
    nav.map((item) => {
      const active = item.exact
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to);
      return (
        <Link
          key={item.to}
          to={item.to}
          className={`${styles.navLink}${active ? ` ${styles.navLinkActive}` : ""}`}
          onClick={() => setMenuOpen(false)}
        >
          {item.label}
        </Link>
      );
    });

  return (
    <>
      <header className={styles.header}>
        <KpLogo to="/" className={styles.logo} />

        <nav className={styles.nav} aria-label="Основная навигация">
          {renderLinks()}
        </nav>

        <div className={styles.headerActions}>
          {isMap ? (
            <button
              type="button"
              className={styles.headerIconBtn}
              aria-label="Поиск на карте"
              onClick={() =>
                document.getElementById("main-map-search")?.focus()
              }
            >
              <IconSearch size={20} />
            </button>
          ) : null}
          {user ? (
            <Link
              to="/notifications"
              className={styles.headerIconBtn}
              aria-label="Уведомления"
            >
              <IconBellWithBadge count={unreadCount} size={22} />
            </Link>
          ) : null}
          {user ? (
            <Link to="/profile" className={styles.headerAvatar} aria-label="Профиль">
              {resolveAvatarUrl(user.avatar_url) ? (
                <img src={resolveAvatarUrl(user.avatar_url)} alt="" />
              ) : (
                <span>{userAvatarLetter(user, "К")}</span>
              )}
            </Link>
          ) : (
            <button
              type="button"
              className={styles.headerLogin}
              onClick={() => history.push("/login")}
            >
              Войти
            </button>
          )}
          <button
            type="button"
            className={styles.burger}
            aria-label="Меню"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <IconX size={20} /> : <IconMenu size={20} />}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <nav className={styles.mobileNavOpen} aria-label="Мобильное меню">
          {renderLinks()}
          {!user ? (
            <Link
              to="/login"
              className={styles.navLink}
              onClick={() => setMenuOpen(false)}
            >
              ВОЙТИ
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
