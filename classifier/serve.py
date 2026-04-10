"""
HTTP API для классификации текста обращения по таксономии.

  pip install -r requirements.txt
  python train.py
  python serve.py

Порт по умолчанию 5055. Переменная окружения PORT.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path

import joblib
from flask import Flask, jsonify, request
from flask_cors import CORS

from clip_prompts import CLIP_LEAVES, CLIP_PROMPTS_EN

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
TAXONOMY_PATH = ROOT_DIR / "issue-taxonomy.json"
MODEL_PATH = BASE_DIR / "model.joblib"

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

_bundle = None
_taxonomy_index: dict[str, dict] = {}
# None = ещё не пробовали, False = недоступен, иначе easyocr.Reader
_ocr_reader = None
# CLIP: None не пробовали, False ошибка, иначе (model, processor)
_clip_bundle = None


def _build_taxonomy_index() -> dict[str, dict]:
    """Один уровень: leaf == domain_key (roads, transit, …)."""
    with open(TAXONOMY_PATH, encoding="utf-8") as f:
        tax = json.load(f)
    idx: dict[str, dict] = {}
    for d in tax["domains"]:
        leaf = d["key"]
        idx[leaf] = {
            "domain_key": d["key"],
            "domain_label_ru": d["label_ru"],
            "group_key": "",
            "group_label_ru": "",
            "issue_key": "",
            "issue_label_ru": "",
            "leaf": leaf,
        }
    return idx


def _tokenize(s: str) -> set[str]:
    s = s.lower()
    return set(re.findall(r"[а-яёa-z0-9]+", s))


def _fallback_classify(text: str, top_k: int = 3) -> list[dict]:
    """Если model.joblib нет — грубое совпадение по словам из training_phrases."""
    with open(TAXONOMY_PATH, encoding="utf-8") as f:
        tax = json.load(f)
    q = _tokenize(text)
    if not q:
        return []
    scores: list[tuple[float, str]] = []
    for d in tax["domains"]:
        leaf = d["key"]
        score = 0.0
        for phrase in d.get("training_phrases_ru", []):
            inter = len(q & _tokenize(phrase))
            if inter:
                score += inter / (1 + len(_tokenize(phrase)) ** 0.5)
        if score > 0:
            scores.append((score, leaf))
    scores.sort(reverse=True)
    out = []
    for sc, leaf in scores[:top_k]:
        meta = _taxonomy_index.get(leaf, {})
        out.append(
            {
                "leaf": leaf,
                "score": round(min(0.99, sc / 3.0), 4),
                "domain_key": meta.get("domain_key"),
                "group_key": meta.get("group_key"),
                "issue_key": meta.get("issue_key"),
                "domain_label_ru": meta.get("domain_label_ru"),
                "group_label_ru": meta.get("group_label_ru"),
                "issue_label_ru": meta.get("issue_label_ru"),
                "method": "keyword_fallback",
            }
        )
    return out


def _load_bundle():
    global _bundle
    if MODEL_PATH.exists():
        _bundle = joblib.load(MODEL_PATH)


def _get_ocr_reader():
    """Опционально: pip install easyocr (тяжёлая первая загрузка моделей)."""
    global _ocr_reader
    if _ocr_reader is False:
        return None
    if _ocr_reader is not None:
        return _ocr_reader
    try:
        import easyocr  # type: ignore

        _ocr_reader = easyocr.Reader(["ru", "en"], gpu=False, verbose=False)
    except Exception:
        _ocr_reader = False
        return None
    return _ocr_reader


def _get_clip():
    """Опционально: pip install -r requirements-vision.txt (torch + transformers)."""
    global _clip_bundle
    if _clip_bundle is False:
        return None, None
    if _clip_bundle is not None:
        return _clip_bundle
    try:
        import torch  # noqa: F401
        from transformers import CLIPModel, CLIPProcessor

        mid = os.environ.get("CLIP_MODEL", "openai/clip-vit-base-patch32")
        model = CLIPModel.from_pretrained(mid)
        proc = CLIPProcessor.from_pretrained(mid)
        model.eval()
        _clip_bundle = (model, proc)
    except Exception:
        _clip_bundle = False
        return None, None
    return _clip_bundle


def _classify_image_clip(image_path: str) -> tuple[str | None, float]:
    model, proc = _get_clip()
    if model is None:
        return None, 0.0
    try:
        import torch
        from PIL import Image

        image = Image.open(image_path).convert("RGB")
        prompts = [CLIP_PROMPTS_EN[k] for k in CLIP_LEAVES]
        inputs = proc(
            text=prompts, images=image, return_tensors="pt", padding=True
        )
        with torch.no_grad():
            out = model(**inputs)
            logits = out.logits_per_image[0]
            probs = logits.softmax(dim=0)
        bi = int(probs.argmax())
        return CLIP_LEAVES[bi], float(probs[bi])
    except Exception:
        return None, 0.0


def _best_from_leaf(leaf: str, score: float, method: str) -> dict:
    meta = _taxonomy_index.get(leaf, {})
    return {
        "leaf": leaf,
        "score": round(score, 4),
        "domain_key": meta.get("domain_key"),
        "group_key": meta.get("group_key"),
        "issue_key": meta.get("issue_key"),
        "domain_label_ru": meta.get("domain_label_ru"),
        "group_label_ru": meta.get("group_label_ru"),
        "issue_label_ru": meta.get("issue_label_ru"),
        "method": method,
    }


def _ocr_extract_text(image_path: str) -> str:
    reader = _get_ocr_reader()
    if reader is None:
        return ""
    try:
        lines = reader.readtext(image_path, detail=0, paragraph=False)
        if isinstance(lines, str):
            return lines.strip()
        return " ".join(str(x) for x in lines).strip()
    except Exception:
        return ""


def _predict_from_text(text: str, top_k: int = 3) -> dict:
    top_k = max(1, min(top_k, 5))
    text = (text or "").strip()
    if not text:
        return {"error": "empty", "predictions": [], "best": None}

    if _bundle is None:
        cands = _fallback_classify(text, top_k=top_k)
        if not cands:
            return {
                "predictions": [],
                "best": None,
                "ai_confidence": None,
                "hint": "Запустите python train.py для обученной модели",
            }
        best = cands[0]
        return {
            "predictions": cands,
            "best": best,
            "ai_confidence": best.get("score"),
        }

    pipe = _bundle["pipeline"]
    le = _bundle["label_encoder"]
    proba = pipe.predict_proba([text])[0]
    idx = proba.argsort()[::-1][:top_k]
    preds = []
    for i in idx:
        leaf = le.inverse_transform([int(i)])[0]
        meta = _taxonomy_index.get(leaf, {})
        preds.append(
            {
                "leaf": leaf,
                "score": round(float(proba[i]), 4),
                "domain_key": meta.get("domain_key"),
                "group_key": meta.get("group_key"),
                "issue_key": meta.get("issue_key"),
                "domain_label_ru": meta.get("domain_label_ru"),
                "group_label_ru": meta.get("group_label_ru"),
                "issue_label_ru": meta.get("issue_label_ru"),
                "method": "tfidf_lr",
            }
        )
    return {
        "predictions": preds,
        "best": preds[0],
        "ai_confidence": preds[0]["score"],
    }


def _module_status_clip() -> tuple[str, bool]:
    """not_loaded — ещё не вызывали CLIP; ready — модель в памяти; unavailable — импорт/загрузка не удалась."""
    if _clip_bundle is False:
        return "unavailable", False
    if _clip_bundle is not None:
        return "ready", True
    return "not_loaded", False


def _module_status_ocr() -> tuple[str, bool]:
    if _ocr_reader is False:
        return "unavailable", False
    if _ocr_reader is not None:
        return "ready", True
    return "not_loaded", False


@app.route("/health", methods=["GET"])
def health():
    clip_st, clip_ok = _module_status_clip()
    ocr_st, ocr_ok = _module_status_ocr()
    init = (request.args.get("init") or "").lower() in ("1", "true", "yes")
    if init:
        # Опционально подгрузить CLIP/EasyOCR при проверке (долго, первый раз качает веса)
        _get_clip()
        _get_ocr_reader()
        clip_st, clip_ok = _module_status_clip()
        ocr_st, ocr_ok = _module_status_ocr()

    payload = {
        "ok": True,
        "model_loaded": _bundle is not None,
        "taxonomy": str(TAXONOMY_PATH),
        "clip_status": clip_st,
        "clip_ready": clip_ok,
        "ocr_status": ocr_st,
        "ocr_ready": ocr_ok,
        "ocr_note": "Текст с фото: pip install -r requirements-ocr.txt (EasyOCR)",
        "vision_note": "Снимок (CLIP): pip install -r requirements-vision.txt",
        "full_install": "python -m pip install -r requirements-full.txt",
    }
    if not init:
        payload["health_init_hint"] = (
            "Добавьте ?init=1 чтобы попробовать загрузить CLIP и OCR из этого запроса "
            "(первый раз долго, качает модели)."
        )
    return jsonify(payload)


@app.route("/taxonomy", methods=["GET"])
def taxonomy():
    with open(TAXONOMY_PATH, encoding="utf-8") as f:
        return jsonify(json.load(f))


@app.route("/classify", methods=["POST", "OPTIONS"])
def classify():
    if request.method == "OPTIONS":
        return "", 204
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    top_k = int(data.get("top_k") or 3)

    if not text:
        return jsonify({"error": "text required"}), 400

    out = _predict_from_text(text, top_k=top_k)
    return jsonify({**out, "source": "text"})


@app.route("/classify_image", methods=["POST", "OPTIONS"])
def classify_image():
    if request.method == "OPTIONS":
        return "", 204
    top_k = int(request.form.get("top_k") or 3)

    if "image" not in request.files:
        return jsonify({"error": "image file field required"}), 400

    f = request.files["image"]
    if not f or not f.filename:
        return jsonify({"error": "empty file"}), 400

    suffix = Path(f.filename).suffix.lower() or ".jpg"
    if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}:
        suffix = ".jpg"

    path = None
    try:
        fd, path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        f.save(path)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e), "need_text": True}), 500

    try:
        clip_leaf, clip_p = _classify_image_clip(path)
        extracted = _ocr_extract_text(path)
        ocr_pred = (
            _predict_from_text(extracted, top_k=top_k)
            if len(extracted) >= 3
            else {"predictions": [], "best": None, "ai_confidence": None}
        )

        ocr_best = ocr_pred.get("best")
        ocr_sc = ocr_pred.get("ai_confidence")
        ocr_sc_f = float(ocr_sc) if ocr_sc is not None else 0.0

        model_clip, _ = _get_clip()
        clip_installed = model_clip is not None
        clip_ok = clip_leaf is not None and clip_p > 0

        def _clip_response(src: str, msg: str | None) -> dict:
            b = _best_from_leaf(clip_leaf, clip_p, "clip_visual")
            return {
                "ok": True,
                "need_text": False,
                "source": src,
                "clip_available": True,
                "clip_score": round(clip_p, 4),
                "ocr_available": _get_ocr_reader() is not None,
                "extracted_text": extracted or None,
                "message": msg,
                "predictions": [b],
                "best": b,
                "ai_confidence": clip_p,
            }

        # Длинный читаемый текст на фото — часто точнее CLIP
        if (
            len(extracted) >= 15
            and ocr_best
            and ocr_best.get("domain_key")
            and ocr_sc_f >= 0.2
        ):
            return jsonify(
                {
                    "ok": True,
                    "need_text": False,
                    "source": "image_ocr",
                    "clip_available": clip_installed,
                    "clip_score": round(clip_p, 4) if clip_ok else None,
                    "ocr_available": True,
                    "extracted_text": extracted,
                    **ocr_pred,
                }
            )

        # CLIP загружен и отработал — всегда отдаём лучший класс (с разной пометкой)
        # 5 классов CLIP: случайный уровень ~0.2
        if clip_ok:
            if clip_p >= 0.30:
                return jsonify(_clip_response("image_visual", None))
            if clip_p >= 0.22:
                return jsonify(
                    _clip_response(
                        "image_visual_low",
                        "Средняя уверенность по снимку — при необходимости уточните направление вручную.",
                    )
                )
            return jsonify(
                _clip_response(
                    "image_visual_guess",
                    "Низкая уверенность CLIP — категория ориентировочная; лучше дописать описание или выбрать тип вручную.",
                )
            )

        if ocr_best and ocr_best.get("domain_key"):
            return jsonify(
                {
                    "ok": True,
                    "need_text": False,
                    "source": "image_ocr",
                    "clip_available": clip_installed,
                    "clip_score": None,
                    "ocr_available": True,
                    "extracted_text": extracted,
                    **ocr_pred,
                }
            )

        hints = [
            "Одной командой в папке classifier: python -m pip install -r requirements-full.txt "
            "(или запустите START_ALL.bat — он ставит полный набор). После этого перезапустите serve.py."
        ]
        return jsonify(
            {
                "ok": True,
                "need_text": True,
                "clip_available": clip_installed,
                "clip_score": round(clip_p, 4) if clip_ok else None,
                "ocr_available": _get_ocr_reader() is not None,
                "extracted_text": extracted or "",
                "message": (
                    "Распознавание по фото не работает: не установлены torch/transformers (CLIP) "
                    "или не удалось прочитать снимок. Установите зависимости или добавьте текстовое описание."
                ),
                "hints": hints,
            }
        )
    finally:
        if path:
            try:
                os.unlink(path)
            except OSError:
                pass


def main():
    global _taxonomy_index
    _taxonomy_index = _build_taxonomy_index()
    _load_bundle()
    port = int(os.environ.get("PORT", "5055"))
    app.run(host="0.0.0.0", port=port, debug=False)


if __name__ == "__main__":
    main()
