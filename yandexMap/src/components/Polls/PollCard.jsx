import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../Auth/AuthContext.jsx";
import { getPoll, votePoll } from "../../services/api.js";
import { showToast } from "../ToastHost.jsx";
import { IconVote } from "../Icons.jsx";
import "./PollCard.css";

function useCountdown(endsAt) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!endsAt) {
      setLeft("");
      return undefined;
    }
    const tick = () => {
      const diff = new Date(endsAt) - Date.now();
      if (diff <= 0) {
        setLeft("Завершён");
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLeft(d > 0 ? `${d}д ${h}ч` : h > 0 ? `${h}ч ${m}м` : `${m} мин`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [endsAt]);
  return left;
}

export default function PollCard({ pollId, poll: initialPoll, compact = false, onVoted }) {
  const { user } = useContext(AuthContext);
  const [poll, setPoll] = useState(initialPoll || null);
  const [loading, setLoading] = useState(!initialPoll);
  const [voting, setVoting] = useState(false);
  const [anim, setAnim] = useState(false);
  const countdown = useCountdown(poll?.ends_at);

  const id = pollId || poll?.id;

  useEffect(() => {
    if (!id) return;
    const needsDetail = !initialPoll?.options?.length;
    if (initialPoll && !needsDetail) {
      setPoll(initialPoll);
      setLoading(false);
      return;
    }
    setLoading(true);
    getPoll(id)
      .then(setPoll)
      .catch(() => setPoll(initialPoll || null))
      .finally(() => setLoading(false));
  }, [id, initialPoll]);

  const handleVote = async (optionId) => {
    if (!user) {
      showToast("Войдите, чтобы проголосовать", "info");
      return;
    }
    setVoting(true);
    try {
      const res = await votePoll(id, optionId);
      setPoll(res.poll || poll);
      setAnim(true);
      setTimeout(() => setAnim(false), 600);
      showToast("Голос учтён! +10 баллов", "success");
      onVoted?.(res.poll);
    } catch (e) {
      showToast(e.message || "Ошибка", "error");
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return <div className="poll-card poll-card--loading">Загрузка…</div>;
  }
  if (!poll) return null;

  const options = poll.options || [];
  const showResults = poll.show_results || poll.voted;
  const voters = poll.total_voters ?? 0;
  const totalVotes = options.reduce((s, o) => s + (o.votes_count || 0), 0) || 1;

  return (
    <article
      className={`poll-card${compact ? " poll-card--compact" : ""}${anim ? " poll-card--voted" : ""}`}
    >
      <header className="poll-card-head">
        <h3 className="poll-card-title">
          {compact ? poll.title_ru : <Link to={`/polls`}>{poll.title_ru}</Link>}
        </h3>
        {poll.category_key ? (
          <span className="poll-card-cat">{poll.category_key}</span>
        ) : null}
      </header>
      {!compact && poll.description_ru ? (
        <p className="poll-card-desc">{poll.description_ru}</p>
      ) : null}
      <p className="poll-card-meta">
        <IconVote size={16} style={{ verticalAlign: "middle", marginRight: 4 }} />
        {voters} {voters === 1 ? "участник" : "участников"}
        {countdown ? ` · ${countdown}` : ""}
      </p>

      {showResults ? (
        <ul className="poll-card-results">
          {options.map((o) => {
            const pct = o.percent ?? Math.round(((o.votes_count || 0) / totalVotes) * 100);
            return (
              <li key={o.id} className="poll-card-result">
                <div className="poll-card-result-label">
                  <span>{o.text_ru}</span>
                  <span>{pct}%</span>
                </div>
                <div className="poll-card-bar">
                  <div
                    className="poll-card-bar-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="poll-card-options">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="poll-card-option-btn"
                disabled={voting}
                onClick={() => handleVote(o.id)}
              >
                {o.text_ru}
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
