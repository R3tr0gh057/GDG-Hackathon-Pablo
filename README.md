# Harbor

Local scam check for pasted messages and short voice notes. Flask serves the page and the API. Ollama does the analysis on this computer. Nothing is stored.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Install [Ollama](https://ollama.com), then:

```powershell
ollama pull llama3.1:8b
```

Set `OLLAMA_MODEL` in `.env` to a model you already have if you are not using `llama3.1:8b`.

Faster-Whisper transcribes audio. The first transcription downloads the Whisper model (`WHISPER_MODEL`, default `base`). Install [FFmpeg](https://ffmpeg.org) and add it to `PATH` for MP3, M4A, and WebM. WAV can work without it.

Argos Translate is optional. Without it, non-English text is analyzed in the original language and the result says translation did not run.

```powershell
pip install argostranslate
```

Install the language pair you need with Argos Package before expecting a translation.

## Run

```powershell
python app.py
```

Open http://127.0.0.1:5000

## API

```powershell
curl http://127.0.0.1:5000/api/health
curl -X POST http://127.0.0.1:5000/api/analyze -H "Content-Type: application/json" -d "{\"text\":\"Your bank account will be blocked. Share your OTP immediately.\"}"
curl -X POST http://127.0.0.1:5000/api/transcribe -F "audio=@message.wav"
curl -X POST http://127.0.0.1:5000/api/analyze-audio -F "audio=@message.wav"
```

## Limits

- Scores are model judgments, not proof of fraud.
- No scan history.
- Translation and speech only work after those models are installed.
- Voice notes recorded in the browser are WebM and need FFmpeg or a Whisper build that can decode them.
