import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHistory } from "react-router-dom";
import { AuthContext } from "../Auth/AuthContext.jsx";
import {
  bulkPatchMarkerStatuses,
  getModerationAbuseReports,
  getModerationMarkers,
  getModerationStats,
  patchMarkerStatus,
  patchModerationAbuseReport,
} from "../../services/api.js";
import { useTaxonomy } from "../../hooks/useTaxonomy.js";
import "../Profile/Profile.css";
import "./Moderation.css";
import "./Moderation.v2.css";
import {
  apiParamsFromFilters,
  apiParamsFromSpamFilters,
  PAGE_SIZE,
} from "./moderationConstants.js";
import { useModerationFilters } from "./useModerationFilters.js";
import ModerationSidebar from "./ModerationSidebar.jsx";
import ModerationToolbar from "./ModerationToolbar.jsx";
import ModerationList from "./ModerationList.jsx";
import ModerationPreview from "./ModerationPreview.jsx";
import ModerationSpamList from "./ModerationSpamList.jsx";
import ModerationSpamPreview from "./ModerationSpamPreview.jsx";
import { normStatus } from "./moderationUtils.js";

function RejectDialog({ title, note, setNote, onCancel, onConfirm, busy }) {
  return (
    <div
      className="mod-v2-overlay"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="mod-v2-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Отклонить</h3>
        <p className="mod-v2-dialog__preview">{title}</p>
        <textarea
          className="mod-v2-textarea"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Причина (обязательно)"
        />
        <div className="mod-v2-dialog__actions">
          <button type="button" className="mod-v2-btn mod-v2-btn--ghost" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className="mod-v2-btn mod-v2-btn--bad"
            disabled={busy || !note.trim()}
            onClick={onConfirm}
          >
            Отклонить
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModerationDashboard() {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const { taxonomy } = useTaxonomy();
  const { filters, setFilters, resetFilters } = useModerationFilters();

  const [markers, setMarkers] = useState([]);
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState(filters.q);
  const [focusIndex, setFocusIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectNote, setBulkRejectNote] = useState("");
  const [spamRejectTarget, setSpamRejectTarget] = useState(null);
  const [spamRejectNote, setSpamRejectNote] = useState("");

  const isSpamTab = filters.tab === "spam";
  const abortRef = useRef(null);
  const listRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const domainOptions = useMemo(
    () => [
      { key: "", label: "Все направления" },
      ...(taxonomy?.domains || []).map((d) => ({
        key: d.key,
        label: d.label_ru,
      })),
      { key: "__none__", label: "Без категории" },
    ],
    [taxonomy]
  );

  const loadQueue = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError("");
    try {
      const statsData = await getModerationStats();
      if (ac.signal.aborted) return;
      setStats(statsData);

      if (filters.tab === "spam") {
        const listData = await getModerationAbuseReports(
          apiParamsFromSpamFilters(filters),
          { signal: ac.signal }
        );
        if (ac.signal.aborted) return;
        const list = listData.reports ?? listData.items ?? [];
        setReports(list);
        setMarkers([]);
        setTotal(listData.total ?? list.length);
      } else {
        const listData = await getModerationMarkers(
          apiParamsFromFilters(filters),
          { signal: ac.signal }
        );
        if (ac.signal.aborted) return;
        const list = listData.markers || [];
        setMarkers(list);
        setReports([]);
        setTotal(listData.total ?? list.length);
      }
      setFocusIndex(0);
      setSelectedIds([]);
    } catch (e) {
      if (e.name === "AbortError") return;
      setError(e.message || "Ошибка загрузки");
      setMarkers([]);
      setReports([]);
      setTotal(0);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!user) {
      history.push("/login");
      return;
    }
    if (!user.is_moderator && !user.is_admin) {
      history.push("/");
      return;
    }
    loadQueue();
    return () => abortRef.current?.abort();
  }, [user, history, loadQueue]);

  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  const focusedMarker = markers[focusIndex] || null;
  const focusedReport = reports[focusIndex] || null;

  const resolveAbuse = useCallback(
    async (reportId, abuseStatus) => {
      setBusyId(reportId);
      setError("");
      try {
        await patchModerationAbuseReport(reportId, abuseStatus);
        await loadQueue();
      } catch (e) {
        setError(e.message || "Ошибка");
      } finally {
        setBusyId(null);
      }
    },
    [loadQueue]
  );

  const patchStatus = useCallback(
    async (id, status, note) => {
      setBusyId(id);
      setError("");
      try {
        await patchMarkerStatus(id, status, note);
        await loadQueue();
        window.dispatchEvent(new Event("yandexmap:notifications"));
      } catch (e) {
        setError(e.message || "Ошибка");
      } finally {
        setBusyId(null);
      }
    },
    [loadQueue]
  );

  const runBulk = async (status, note) => {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    try {
      await bulkPatchMarkerStatuses(selectedIds, status, note);
      setSelectedIds([]);
      setBulkRejectOpen(false);
      setBulkRejectNote("");
      await loadQueue();
      window.dispatchEvent(new Event("yandexmap:notifications"));
    } catch (e) {
      setError(e.message || "Ошибка");
    } finally {
      setBulkBusy(false);
    }
  };

  const onSearchInput = (v) => {
    setSearchInput(v);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setFilters({ q: v });
    }, 400);
  };

  const onSearchSubmit = () => setFilters({ q: searchInput });

  const toggleCheck = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (rejectTarget || bulkRejectOpen || spamRejectTarget) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const listLen = isSpamTab ? reports.length : markers.length;
      if (!listLen) return;

      if (isSpamTab) {
        if (e.key === "ArrowDown" || e.key === "j") {
          e.preventDefault();
          setFocusIndex((i) => Math.min(reports.length - 1, i + 1));
        } else if (e.key === "ArrowUp" || e.key === "k") {
          e.preventDefault();
          setFocusIndex((i) => Math.max(0, i - 1));
        }
        return;
      }

      if (!markers.length) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusIndex((i) => Math.min(markers.length - 1, i + 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusIndex((i) => Math.max(0, i - 1));
      } else if (!focusedMarker) return;
      else if (e.key === "a" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (normStatus(focusedMarker) !== "approved") {
          patchStatus(focusedMarker.id, "approved");
        }
      } else if (e.key === "r" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setRejectTarget({
          id: focusedMarker.id,
          title: (focusedMarker.text || "").slice(0, 120),
        });
        setRejectNote("");
      } else if (e.key === "i" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        patchStatus(focusedMarker.id, "in_progress");
      } else if (e.key === "x" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (["approved", "in_progress"].includes(normStatus(focusedMarker))) {
          patchStatus(focusedMarker.id, "resolved");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isSpamTab,
    reports.length,
    markers.length,
    focusIndex,
    focusedMarker,
    rejectTarget,
    bulkRejectOpen,
    spamRejectTarget,
    patchStatus,
  ]);

  if (!user?.is_moderator && !user?.is_admin) return null;

  return (
    <>
      <div className="profile-page page-aurora page-aurora--karta mod-v2-page">
        <div className="mod-v2-wrap">
          <ModerationToolbar
            filters={filters}
            setFilters={setFilters}
            searchInput={searchInput}
            onSearchInput={onSearchInput}
            onSearchSubmit={onSearchSubmit}
            stats={stats}
            loading={loading}
            onRefresh={loadQueue}
            selectedCount={selectedIds.length}
            onBulkApprove={() => runBulk("approved")}
            onBulkReject={() => setBulkRejectOpen(true)}
            onClearSelection={() => setSelectedIds([])}
            bulkBusy={bulkBusy}
          />

          {error ? (
            <div className="mod-v2-alert" role="alert">
              {error}
            </div>
          ) : null}

          <div className={`mod-v2-layout${isSpamTab ? " mod-v2-layout--spam" : ""}`}>
            {!isSpamTab ? (
              <ModerationSidebar
                filters={filters}
                setFilters={setFilters}
                resetFilters={resetFilters}
                domainOptions={domainOptions}
                stats={stats}
              />
            ) : null}
            {isSpamTab ? (
              <ModerationSpamList
                reports={reports}
                focusIndex={focusIndex}
                onSelect={setFocusIndex}
                loading={loading}
                total={total}
                page={filters.page}
                pageSize={PAGE_SIZE}
                onPageChange={(p) => setFilters({ page: p })}
              />
            ) : (
              <ModerationList
                markers={markers}
                taxonomy={taxonomy}
                focusIndex={focusIndex}
                selectedIds={selectedIds}
                onSelect={setFocusIndex}
                onToggleCheck={toggleCheck}
                loading={loading}
                total={total}
                page={filters.page}
                pageSize={PAGE_SIZE}
                onPageChange={(p) => setFilters({ page: p })}
                listRef={listRef}
              />
            )}
            {isSpamTab ? (
              <ModerationSpamPreview
                report={focusedReport}
                busy={busyId != null}
                onDismiss={(r) => resolveAbuse(r.id, "dismissed")}
                onActioned={(r) => resolveAbuse(r.id, "actioned")}
                onRejectMarker={(r) => {
                  if (r.target_type !== "marker" || !r.target_id) return;
                  setSpamRejectTarget({
                    reportId: r.id,
                    markerId: r.target_id,
                    title: (r.marker_text || "").slice(0, 120),
                  });
                  setSpamRejectNote("");
                }}
              />
            ) : (
              <ModerationPreview
                marker={focusedMarker}
                taxonomy={taxonomy}
                busy={busyId != null}
                onApprove={(m) => patchStatus(m.id, "approved")}
                onReject={(m) => {
                  setRejectTarget({
                    id: m.id,
                    title: (m.text || "").slice(0, 120),
                  });
                  setRejectNote("");
                }}
                onInProgress={(m) => patchStatus(m.id, "in_progress")}
                onResolved={(m) => patchStatus(m.id, "resolved")}
              />
            )}
          </div>
        </div>
      </div>

      {rejectTarget ? (
        <RejectDialog
          title={rejectTarget.title}
          note={rejectNote}
          setNote={setRejectNote}
          busy={busyId === rejectTarget.id}
          onCancel={() => {
            setRejectTarget(null);
            setRejectNote("");
          }}
          onConfirm={() => {
            const id = rejectTarget.id;
            const note = rejectNote.trim();
            if (!note) {
              setError("Укажите причину");
              return;
            }
            setRejectTarget(null);
            patchStatus(id, "rejected", note);
            setRejectNote("");
          }}
        />
      ) : null}

      {bulkRejectOpen ? (
        <RejectDialog
          title={`Массово (${selectedIds.length})`}
          note={bulkRejectNote}
          setNote={setBulkRejectNote}
          busy={bulkBusy}
          onCancel={() => setBulkRejectOpen(false)}
          onConfirm={() => {
            const note = bulkRejectNote.trim();
            if (!note) {
              setError("Укажите причину");
              return;
            }
            runBulk("rejected", note);
          }}
        />
      ) : null}

      {spamRejectTarget ? (
        <RejectDialog
          title={spamRejectTarget.title}
          note={spamRejectNote}
          setNote={setSpamRejectNote}
          busy={busyId === spamRejectTarget.reportId}
          onCancel={() => {
            setSpamRejectTarget(null);
            setSpamRejectNote("");
          }}
          onConfirm={async () => {
            const note = spamRejectNote.trim();
            if (!note) {
              setError("Укажите причину");
              return;
            }
            const { reportId, markerId } = spamRejectTarget;
            setSpamRejectTarget(null);
            setBusyId(reportId);
            setError("");
            try {
              await patchMarkerStatus(markerId, "rejected", note);
              await patchModerationAbuseReport(reportId, "actioned");
              await loadQueue();
              window.dispatchEvent(new Event("yandexmap:notifications"));
            } catch (e) {
              setError(e.message || "Ошибка");
            } finally {
              setBusyId(null);
              setSpamRejectNote("");
            }
          }}
        />
      ) : null}
    </>
  );
}
