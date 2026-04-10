"""
Обучение классификатора типов городских проблем (TF-IDF + логистическая регрессия).

Базовые примеры — из ../issue-taxonomy.json (поле training_phrases_ru).
Готовый расширенный набор — data/ready_train.csv (уже в репозитории).
Свои примеры — data/user_labeled.csv (колонки text,label; label = ключ направления: roads, transit, …).

Готовые крупные датасеты (в основном EN, нужна своя маппинг-таблица на ваши классы):
- NYC 311 Service Requests — https://data.cityofnewyork.us/ (Complaint Type / Descriptor)
- Chicago 311 / data.gov — поиск "311 pothole"
- Исследовательские агрегаты, напр. nyc_urban_incident_data на GitHub

Запуск из папки classifier:
  python train.py
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
TAXONOMY_PATH = ROOT_DIR / "issue-taxonomy.json"
DATA_DIR = BASE_DIR / "data"
USER_LABELED = DATA_DIR / "user_labeled.csv"
READY_TRAIN = DATA_DIR / "ready_train.csv"
MODEL_PATH = BASE_DIR / "model.joblib"


def append_labeled_csv(path: Path, rows: list[dict]) -> None:
    if not path.exists():
        return
    extra = pd.read_csv(path, encoding="utf-8")
    if not {"text", "label"}.issubset(extra.columns.str.lower()):
        raise SystemExit(f"{path.name}: нужны колонки text, label")
    extra = extra.rename(columns={c: c.lower() for c in extra.columns})
    for _, r in extra.iterrows():
        t, lb = str(r["text"]).strip(), str(r["label"]).strip()
        if t and lb:
            rows.append({"text": t, "label": lb})


def load_rows_from_taxonomy() -> list[dict]:
    with open(TAXONOMY_PATH, encoding="utf-8") as f:
        tax = json.load(f)
    rows: list[dict] = []
    for d in tax["domains"]:
        leaf = d["key"]
        for phrase in d.get("training_phrases_ru", []):
            rows.append({"text": phrase.strip(), "label": leaf})
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--test-size", type=float, default=0.15)
    args = parser.parse_args()

    rows = load_rows_from_taxonomy()
    append_labeled_csv(READY_TRAIN, rows)
    append_labeled_csv(USER_LABELED, rows)

    if len(rows) < 8:
        raise SystemExit("Слишком мало строк для обучения.")

    df = pd.DataFrame(rows)
    X = df["text"].values
    le = LabelEncoder()
    y = le.fit_transform(df["label"].values)

    strat = y if min(Counter(y).values()) >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=42, stratify=strat
    )

    pipe = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    min_df=1,
                    max_df=0.9,
                    sublinear_tf=True,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=3000,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )
    pipe.fit(X_train, y_train)
    acc = float(pipe.score(X_test, y_test))
    print(f"Hold-out accuracy (оценка): {acc:.3f}")

    bundle = {
        "pipeline": pipe,
        "label_encoder": le,
        "taxonomy_path": str(TAXONOMY_PATH),
    }
    joblib.dump(bundle, MODEL_PATH)
    print(f"Сохранено: {MODEL_PATH}")


if __name__ == "__main__":
    main()
