import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PollCard from "../components/Polls/PollCard.jsx";
import { getPolls } from "../services/api.js";
import { useTaxonomy } from "../hooks/useTaxonomy.js";
import { IconChevronLeft, IconVote } from "../components/Icons.jsx";
import "./Polls.css";

export default function Polls() {
  const { taxonomy } = useTaxonomy();
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("active");
  const [category, setCategory] = useState("");

  const load = () => {
    setLoading(true);
    getPolls({ status, category: category || undefined })
      .then((d) => setPolls(d.polls || []))
      .catch(() => setPolls([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [status, category]);

  const domains = taxonomy?.domains || [];

  return (
    <>
      <div className="polls-page page-aurora page-aurora--karta">
        <div className="polls-container">
          <header className="polls-header">
            <h1 className="kp-section-title">
              <IconVote size={22} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Городские опросы
            </h1>
            <p className="polls-sub">
              Голосуйте за важные решения — как в «Активном гражданине»
            </p>
            <Link to="/" className="polls-back page-back-link">
              <IconChevronLeft size={14} style={{ verticalAlign: "middle" }} /> На карту
            </Link>
          </header>

          <div className="polls-filters">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Статус опроса"
            >
              <option value="active">Активные</option>
              <option value="closed">Завершённые</option>
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Категория"
            >
              <option value="">Все категории</option>
              {domains.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label_ru}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="polls-muted">Загрузка…</p>
          ) : polls.length === 0 ? (
            <p className="polls-muted">Нет опросов по выбранным фильтрам.</p>
          ) : (
            <div className="polls-grid">
              {polls.map((p) => (
                <PollCard key={p.id} pollId={p.id} poll={p} onVoted={load} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
