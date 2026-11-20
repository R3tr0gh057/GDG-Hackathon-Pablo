"""Harbor — local scam check. One Flask process, no database."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

from services.ai_service import AIError, analyze_message, check_ollama, ollama_model
from services.audio_service import AudioError, speech_available, transcribe_upload
from services.language_service import detect_language, translate_to_english
from services.text_service import clean_text

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 26 * 1024 * 1024
MAX_TEXT = 20000


@app.get("/")
def index():
    return render_template("index.html", model=ollama_model())


@app.get("/api/health")
def health():
    ollama = check_ollama()
    return jsonify(
        {
            "status": "ok",
            "flask": True,
            "ollama": ollama["available"],
            "model": ollama["model"],
            "model_installed": ollama["installed"],
            "speech": speech_available(),
        }
    )


@app.post("/api/analyze")
def analyze():
    payload = request.get_json(silent=True) or {}
    text = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        return _error("Paste a message to analyze.", 400)
    if len(text) > MAX_TEXT:
        return _error(f"The message is longer than {MAX_TEXT} characters.", 400)
    language = str(payload.get("language") or "auto").strip().lower()[:16]
    try:
        result = run_analysis(text, language, transcribing=False)
    except AIError as exc:
        return _error(exc.message, exc.status)
    return jsonify(result)


@app.post("/api/transcribe")
def transcribe():
    try:
        result = transcribe_upload(request.files.get("audio"))
    except AudioError as exc:
        return _error(exc.message, exc.status)
    return jsonify(result)


@app.post("/api/analyze-audio")
def analyze_audio():
    try:
        spoken = transcribe_upload(request.files.get("audio"))
        result = run_analysis(spoken["transcript"], spoken.get("language") or "auto", transcribing=True)
    except AudioError as exc:
        return _error(exc.message, exc.status)
    except AIError as exc:
        return _error(exc.message, exc.status)
    result["transcript"] = spoken["transcript"]
    return jsonify(result)


def run_analysis(text: str, language: str, transcribing: bool) -> dict:
    """Clean, detect language, translate when possible, then ask Ollama."""
    stages = ["Processing input"]
    if transcribing:
        stages.append("Transcribing audio")
    original = text.strip()
    cleaned = clean_text(original)
    if len(cleaned) < 8:
        raise AIError("The message is too short to assess. Paste the full text.", 400)
    stages.append("Detecting language")
    detected = language if language and language != "auto" else detect_language(cleaned)
    translated = None
    performed = False
    note = None
    if detected != "en":
        stages.append("Translating")
        translated, performed, note = translate_to_english(cleaned, detected)
    stages.append("Analyzing with local AI")
    analysis_input = translated if performed and translated else cleaned
    analysis = analyze_message(analysis_input)
    stages.append("Preparing results")
    analysis.update(
        {
            "success": True,
            "original_text": original,
            "cleaned_text": cleaned,
            "translated_text": translated if performed else None,
            "detected_language": detected,
            "translation_performed": performed,
            "translation_note": note,
            "stages": stages,
        }
    )
    return analysis


def _error(message: str, status: int):
    return jsonify({"success": False, "error": message}), status


@app.errorhandler(413)
def too_large(_err):
    return _error("The upload is larger than 25 MB.", 413)


if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5000")),
        debug=False,
        threaded=True,
    )
