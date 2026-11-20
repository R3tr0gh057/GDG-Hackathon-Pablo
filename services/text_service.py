"""Lightweight cleaning that keeps scam evidence intact."""

from __future__ import annotations

import re
import unicodedata

CONTROL = re.compile(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]")
ZERO_WIDTH = re.compile(r"[\u200b-\u200f\u202a-\u202e\ufeff]")


def clean_text(text: str) -> str:
    """Normalize whitespace and invisible characters without rewriting the message."""
    cleaned = unicodedata.normalize("NFKC", text or "")
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = CONTROL.sub("", cleaned)
    cleaned = ZERO_WIDTH.sub("", cleaned)
    cleaned = cleaned.replace("\u00a0", " ")
    lines = [re.sub(r"[ \t]{2,}", " ", line).strip() for line in cleaned.split("\n")]
    cleaned = re.sub(r"\n{3,}", "\n\n", "\n".join(lines))
    return cleaned.strip()
