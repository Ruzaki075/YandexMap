import React, { useCallback, useEffect, useState } from "react";
import {
  addFavorite,
  getFavoriteStatus,
  postAbuseReport,
  removeFavorite,
} from "../../services/api.js";
import { showToast } from "../ToastHost.jsx";
import { STATUS_LABELS } from "../../utils/slaLabels.js";
import {
  CATEGORY_UI,
  avatarColor,
  formatMarkerDate,
  likeWord,
  markerAddressLine,
  markerSupportCount,
  userInitials,
} from "../../utils/mainPageUtils.js";
import {
  CategoryIcon,
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconHeart,
  IconStar,
} from "../Icons.jsx";
import styles from "../../styles/MainPage.module.css";

function statusBadgeClass(status) {
  const st = status || "pending";
  return `${styles.statusBadge} ${styles[`statusBadge_${st}`] || styles.statusBadge_pending}`;
}

export default function MainPageMarkerList({
  markers,
  totalCount,
  page,
  totalPages,
  onPageChange,
  onCardClick,
  user,
}) {
  const [favorites, setFavorites] = useState({});

  const loadFav = useCallback(
    async (id) => {
      if (!user) return;
      try {
        const d = await getFavoriteStatus(id);
        setFavorites((prev) => ({ ...prev, [id]: !!d.favorited }));
      } catch {
        /* */
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user) {
      setFavorites({});
      return;
    }
    markers.forEach((m) => loadFav(m.id));
  }, [markers, user, loadFav]);

  const quickReport = async (e, marker) => {
    e.stopPropagation();
    if (!user) {
      showToast("Войдите, чтобы пожаловаться", "info");
      return;
    }
    if (marker.user_id === user.id) {
      showToast("Нельзя пожаловаться на своё обращение", "error");
      return;
    }
    if (
      !window.confirm(
        "Отправить жалобу модераторам? Она появится во вкладке «Спам»."
      )
    ) {
      return;
    }
    try {
      await postAbuseReport({
        target_type: "marker",
        target_id: marker.id,
        reason: "spam",
        details: "",
      });
      showToast("Жалоба отправлена", "success");
      window.dispatchEvent(new Event("yandexmap:notifications"));
    } catch (err) {
      showToast(err.message || "Ошибка", "error");
    }
  };

  const toggleFav = async (e, markerId) => {
    e.stopPropagation();
    if (!user) return;
    try {
      if (favorites[markerId]) {
        await removeFavorite(markerId);
        setFavorites((prev) => ({ ...prev, [markerId]: false }));
      } else {
        await addFavorite(markerId);
        setFavorites((prev) => ({ ...prev, [markerId]: true }));
      }
    } catch {
      /* */
    }
  };

  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    if (
      i === 1 ||
      i === totalPages ||
      Math.abs(i - page) <= 1 ||
      (page <= 3 && i <= 4) ||
      (page >= totalPages - 2 && i >= totalPages - 3)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <section className={styles.listPanel} aria-label="Список сообщений">
      <div className={styles.listHead}>
        <div className={styles.listHeadLeft}>
          <span className={styles.listTitle}>Сообщения</span>
          <span className={styles.listCount}>({totalCount})</span>
        </div>
      </div>

      <div className={styles.listGrid}>
        {markers.length === 0 ? (
          <p className={styles.listEmpty}>Нет обращений по выбранным фильтрам</p>
        ) : (
          markers.map((m) => {
            const cat = CATEGORY_UI[m.domain_key] || {
              bg: "#555",
              short: "Прочее",
            };
            const st = m.status || "pending";
            const likes = markerSupportCount(m);
            return (
              <article
                key={m.id}
                className={styles.card}
                onClick={() => onCardClick(m)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCardClick(m);
                }}
                role="button"
                tabIndex={0}
              >
                <div className={styles.cardTop}>
                  <span
                    className={styles.cardCatIcon}
                    style={{ background: cat.bg }}
                    aria-hidden
                  >
                    <CategoryIcon domainKey={m.domain_key} size={16} />
                  </span>
                  <button
                    type="button"
                    className={styles.cardAddress}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCardClick(m);
                    }}
                  >
                    {markerAddressLine(m)}
                  </button>
                  {user ? (
                    <>
                      {m.user_id !== user.id ? (
                        <button
                          type="button"
                          className={styles.cardReport}
                          aria-label="Пожаловаться"
                          title="Пожаловаться — попадёт модераторам во вкладку «Спам»"
                          onClick={(e) => quickReport(e, m)}
                        >
                          <IconAlertCircle size={16} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={`${styles.cardStar}${
                          favorites[m.id] ? ` ${styles.cardStarOn}` : ""
                        }`}
                        aria-label={
                          favorites[m.id] ? "Убрать из избранного" : "В избранное"
                        }
                        onClick={(e) => toggleFav(e, m.id)}
                      >
                        <IconStar size={16} />
                      </button>
                    </>
                  ) : null}
                </div>
                <p className={styles.cardSub}>
                  {cat.short} · №{m.id}
                  <span
                    className={`${styles.cardLikes}${
                      likes > 0 ? ` ${styles.cardLikesHot}` : ""
                    }`}
                    title={`${likes} ${likeWord(likes)}`}
                  >
                    <IconHeart size={14} filled={likes > 0} />
                    {likes}
                  </span>
                </p>
                <div className={styles.cardAuthor}>
                  <span
                    className={styles.cardAvatar}
                    style={{ background: avatarColor(m.user_id) }}
                  >
                    {userInitials(m)}
                  </span>
                  <div className={styles.cardAuthorText}>
                    <span>{m.user_email || "Участник"}</span>
                    <span className={styles.cardDate}>
                      Опубликовано {formatMarkerDate(m.created_at)}
                    </span>
                  </div>
                  <span className={statusBadgeClass(st)}>
                    {STATUS_LABELS[st] || st}
                  </span>
                </div>
              </article>
            );
          })
        )}
      </div>

      {totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="Страницы">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Предыдущая"
          >
            <IconChevronLeft size={16} />
          </button>
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`e-${i}`} className={styles.pageEllipsis}>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={p === page ? styles.pageActive : ""}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Следующая"
          >
            <IconChevronRight size={16} />
          </button>
        </nav>
      ) : null}
    </section>
  );
}
