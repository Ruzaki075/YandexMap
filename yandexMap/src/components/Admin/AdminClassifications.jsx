import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTaxonomy } from "../../hooks/useTaxonomy.js";
import {
  getAdminClassifications,
  createAdminClassification,
  patchAdminClassification,
  deleteAdminClassification,
  reorderAdminClassifications,
} from "../../services/api.js";
import ClassificationToolbar from "./ClassificationToolbar.jsx";
import ClassificationList from "./ClassificationList.jsx";
import ClassificationEditor from "./ClassificationEditor.jsx";
import { filterClassifications, sortClassifications } from "./classificationUtils.js";
import "./AdminTaxonomy.css";

function DeleteDialog({ row, onCancel, onConfirm, busy }) {
  const n = row.markers_count ?? 0;
  return (
    <div className="tax-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="tax-modal tax-modal--sm"
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Удалить «{row.label_ru}»?</h3>
        {n > 0 ? (
          <p className="tax-modal__warn">
            Нельзя удалить: к направлению привязано <strong>{n}</strong> обращений.
            Сначала переназначьте или удалите их.
          </p>
        ) : (
          <p className="tax-modal__text">
            Ключ <code>{row.key}</code> будет удалён. Классификатор нужно перезапустить
            после изменений.
          </p>
        )}
        <footer className="tax-modal__foot">
          <button type="button" className="mod-action mod-action--muted" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className="mod-action mod-action--bad"
            disabled={busy || n > 0}
            onClick={onConfirm}
          >
            {busy ? "Удаление…" : "Удалить"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function AdminClassifications() {
  const { reload: reloadTaxonomy } = useTaxonomy();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("order");
  const [orderMode, setOrderMode] = useState(false);
  const [editor, setEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await getAdminClassifications();
      setItems(Array.isArray(data?.classifications) ? data.classifications : []);
    } catch (e) {
      setItems([]);
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displayed = useMemo(() => {
    const filtered = filterClassifications(items, debouncedSearch);
    if (orderMode) {
      return sortClassifications(filtered, "order");
    }
    return sortClassifications(filtered, sort);
  }, [items, debouncedSearch, sort, orderMode]);

  const saveCreate = async (payload) => {
    setBusy(true);
    setError("");
    try {
      await createAdminClassification(payload);
      setEditor(null);
      await load();
      await reloadTaxonomy();
    } catch (e) {
      setError(e.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (payload) => {
    if (!editor?.row) return;
    setBusy(true);
    setError("");
    try {
      await patchAdminClassification(editor.row.key, payload);
      setEditor(null);
      await load();
      await reloadTaxonomy();
    } catch (e) {
      setError(e.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    try {
      await deleteAdminClassification(deleteTarget.key);
      setDeleteTarget(null);
      await load();
      await reloadTaxonomy();
    } catch (e) {
      setError(e.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleReorder = async (keys) => {
    setBusy(true);
    setError("");
    try {
      await reorderAdminClassifications(keys);
      await load();
      await reloadTaxonomy();
    } catch (e) {
      setError(e.message || "Ошибка сортировки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-section tax-section">
      <div className="admin-section-head">
        <h3>Классификации направлений</h3>
      </div>
      <p className="mod-intro admin-intro tax-intro">
        Направления обращений и цвет меток на карте. После изменений перезапустите
        классификатор (<code>serve.py</code>).
      </p>
      {error ? <div className="mod-alert">{error}</div> : null}

      <ClassificationToolbar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        count={items.length}
        filteredCount={displayed.length}
        onCreate={() => setEditor({ mode: "create" })}
        orderMode={orderMode}
        onOrderModeToggle={() => setOrderMode((v) => !v)}
      />

      {loading ? (
        <p className="admin-meta-muted">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="admin-meta-muted">Классификаций пока нет.</p>
      ) : (
        <ClassificationList
          items={displayed}
          busy={busy}
          orderMode={orderMode}
          onEdit={(row) => setEditor({ mode: "edit", row })}
          onDelete={setDeleteTarget}
          onReorder={handleReorder}
        />
      )}

      {editor ? (
        <ClassificationEditor
          mode={editor.mode}
          initial={editor.row}
          others={items}
          busy={busy}
          onSave={editor.mode === "create" ? saveCreate : saveEdit}
          onClose={() => setEditor(null)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteDialog
          row={deleteTarget}
          busy={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  );
}
