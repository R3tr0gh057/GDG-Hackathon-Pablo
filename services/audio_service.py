"""Local transcription with Faster-Whisper. Audio files are temporary."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

ALLOWED = {"wav", "mp3", "m4a", "webm", "ogg", "flac"}
_MODEL = None
_MODEL_NAME = None


class AudioError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def speech_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return False
    return True


def transcribe_upload(upload: FileStorage) -> dict:
    if upload is None or not upload.filename:
        raise AudioError("Choose an audio file first.")
    filename = secure_filename(upload.filename)
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED:
        raise AudioError("Upload a WAV, MP3, M4A, WebM, OGG, or FLAC recording.")
    if not speech_available():
        raise AudioError(
            "Faster-Whisper is not installed, so this recording cannot be transcribed. Paste the message as text instead.",
            503,
        )
    with tempfile.TemporaryDirectory(prefix="harbor-audio-") as folder:
        source = Path(folder) / f"source.{extension}"
        written = 0
        max_bytes = 25 * 1024 * 1024
        with source.open("wb") as handle:
            while True:
                chunk = upload.stream.read(64 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    raise AudioError("The audio file is larger than 25 MB.", 413)
                handle.write(chunk)
        if written < 16:
            raise AudioError("The audio file is empty.")
        audio_path = _prepare_audio(source, Path(folder))
        transcript, language = _transcribe(audio_path)
    if not transcript:
        raise AudioError("No speech was detected in that recording.")
    return {"success": True, "transcript": transcript, "language": language}


def _prepare_audio(source: Path, folder: Path) -> Path:
    """Convert with FFmpeg when it is installed. Otherwise Whisper reads the original file."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return source
    wav_path = folder / "speech.wav"
    completed = subprocess.run(
        [ffmpeg, "-y", "-i", str(source), "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(wav_path)],
        capture_output=True,
        check=False,
        timeout=120,
    )
    if completed.returncode == 0 and wav_path.exists():
        return wav_path
    return source


def _transcribe(path: Path) -> tuple[str, str]:
    global _MODEL, _MODEL_NAME
    import os

    from faster_whisper import WhisperModel

    name = os.getenv("WHISPER_MODEL", "base")
    if _MODEL is None or _MODEL_NAME != name:
        # int8 keeps the model usable on ordinary CPUs. Loaded once per process.
        _MODEL = WhisperModel(name, device="cpu", compute_type="int8")
        _MODEL_NAME = name
    try:
        segments, info = _MODEL.transcribe(str(path), vad_filter=True)
        text = " ".join(segment.text.strip() for segment in segments).strip()
    except Exception as exc:
        raise AudioError(
            "The recording could not be transcribed. If this is not a WAV file, install FFmpeg and try again.",
            400,
        ) from exc
    language = getattr(info, "language", None) or "unknown"
    return text, language
