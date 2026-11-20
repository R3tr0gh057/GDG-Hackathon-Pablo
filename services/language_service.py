"""Language detection and optional offline translation.

Argos Translate is used only when that package and the language pair are installed.
If translation cannot run, the original text is returned and the caller is told.
"""

from __future__ import annotations


def detect_language(text: str) -> str:
    sample = (text or "").strip()
    if len(sample) < 8:
        return "unknown"
    try:
        from langdetect import detect
        from langdetect.lang_detect_exception import LangDetectException
    except ImportError:
        return "unknown"
    try:
        return detect(sample)
    except LangDetectException:
        return "unknown"


def translate_to_english(text: str, source: str) -> tuple[str | None, bool, str | None]:
    """Return (translated_text, performed, note).

    `performed` is True only when a real translation was produced.
    """
    if source in {"en", "unknown"}:
        return None, False, None
    try:
        import argostranslate.translate
    except ImportError:
        return None, False, (
            "Offline translation is not installed, so the original message was analyzed."
        )
    try:
        languages = argostranslate.translate.get_installed_languages()
        source_lang = next((item for item in languages if item.code == source), None)
        english = next((item for item in languages if item.code == "en"), None)
        translation = source_lang.get_translation(english) if source_lang and english else None
        if translation is None:
            return None, False, (
                f"No offline {source} to English translation is installed. "
                "The original message was analyzed."
            )
        translated = (translation.translate(text) or "").strip()
    except Exception:
        return None, False, "Translation failed. The original message was analyzed."
    if not translated:
        return None, False, "Translation returned no text. The original message was analyzed."
    return translated, True, None
