import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getActivePollWidget } from "../../services/api.js";
import PollCard from "./PollCard.jsx";
import { IconChevronRight, IconVote, IconX } from "../Icons.jsx";
import "./ActivePollWidget.css";

export default function ActivePollWidget() {
  const [poll, setPoll] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    getActivePollWidget()
      .then((d) => setPoll(d.poll || null))
      .catch(() => setPoll(null));
  }, []);

  if (!poll || hidden) return null;

  return (
    <aside className="active-poll-widget" aria-label="Актуальный опрос">
      <div className="active-poll-widget-head">
        <span>
          <IconVote size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
          Актуальный опрос
        </span>
        <button
          type="button"
          className="active-poll-widget-close"
          aria-label="Скрыть"
          onClick={() => setHidden(true)}
        >
          <IconX size={16} />
        </button>
      </div>
      <PollCard poll={poll} compact onVoted={setPoll} />
      <Link to="/polls" className="active-poll-widget-more">
        Все опросы <IconChevronRight size={14} />
      </Link>
    </aside>
  );
}
