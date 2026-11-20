# Local AI Scam Detector

A lightweight hackathon proof of concept that analyzes suspicious
messages and calls using a locally running language model. It accepts
text or audio, transcribes audio, and explains potential scam indicators
in plain language.

The application is designed as a **local service** with a Flask web
interface and REST API. It does not require user accounts, a database,
or persistent scan history.

## Features

-   **Text analysis:** Submit a message, email, SMS, or other text for
    analysis.
-   **Audio analysis:** Upload an audio recording or record audio in the
    browser. The application transcribes it before analysis.
-   **Local AI:** Uses Ollama to run the language model locally.
-   **Speech-to-text:** Uses Faster-Whisper for audio transcription.
-   **Language support:** Detects the input language and can optionally
    translate it before analysis, depending on the configured
    translation support.
-   **Explainable results:** Returns a risk score, risk level,
    suspicious indicators, evidence from the input, and recommended
    actions.
-   **REST API:** The analysis and transcription functions can be used
    independently of the web interface.

> **Important:** This is a demonstration tool, not a guarantee that a
> message or call is safe or fraudulent. Treat its score as a heuristic
> warning indicator, not a statistically calibrated probability. Do not
> rely on it as the sole basis for financial, legal, or security
> decisions.

## Technology

  -----------------------------------------------------------------------
  Component                           Technology
  ----------------------------------- -----------------------------------
  Backend                             Python, Flask

  Frontend                            HTML, CSS, JavaScript, Jinja2

  Local language model                Ollama

  Speech-to-text                      Faster-Whisper

  Audio recording                     Browser MediaRecorder API

  Language detection / translation    Project-configured language
                                      detection and optional translation
                                      support
  -----------------------------------------------------------------------

## Requirements

-   Python 3.10 or newer
-   Ollama installed and running
-   A model downloaded in Ollama
-   A working microphone or an audio file for audio analysis
-   Internet access may be required to install Python dependencies or
    download the speech-recognition model for the first time. Text
    analysis itself is intended to use the local Ollama service.

## Setup

### 1. Install Ollama

Install Ollama from <https://ollama.com>, then pull the model you intend
to use.

Example:

``` bash
ollama pull llama3.1:8b
```

Start Ollama if it is not already running. Its default local API address
is:

``` text
http://localhost:11434
```

The model name must match the model installed on your machine.

### 2. Create and activate a virtual environment

From the project directory:

**Windows (PowerShell):**

``` powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**

``` bat
python -m venv .venv
.venv\Scripts\activate
```

**Linux / macOS:**

``` bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

``` bash
pip install -r requirements.txt
```

If Faster-Whisper or its model is not installed/configured, text
analysis can still be used; audio transcription will require the
speech-to-text dependency to be available.

### 4. Configure the application

If the project includes an environment example file, copy it:

**Windows:**

``` powershell
Copy-Item .env.example .env
```

**Linux / macOS:**

``` bash
cp .env.example .env
```

Review the available settings in `.env.example` and configure the Ollama
URL, model name, and any optional language or audio settings supported
by the implementation.

Typical Ollama settings:

``` env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

The exact environment variable names depend on the implementation in the
project. Keep local configuration in `.env`; do not commit private
credentials or machine-specific settings.

### 5. Run the application

From the project root:

``` bash
python app.py
```

Open the local address printed by Flask in your browser. In a typical
Flask development configuration, this is:

``` text
http://127.0.0.1:5000
```

Keep Ollama running while using the application.

## How to use

### Analyze text

1.  Open the application in your browser.
2.  Choose the text analysis option.
3.  Paste the message or communication you want to inspect.
4.  Select or confirm the language if the interface provides that
    option.
5.  Submit the text for analysis.
6.  Review the risk level, score, warning signs, evidence, and
    recommended actions.

Include the complete message where possible. Preserve phone numbers,
URLs, payment instructions, names of organizations, deadlines, and
requests for passwords or one-time passwords. These details may be
important evidence.

### Analyze audio

1.  Open the audio analysis option.
2.  Upload a supported audio file or use the browser recording control.
3.  Submit the recording.
4.  Wait for transcription and analysis to finish.
5.  Review the transcript as well as the analysis.

Transcription quality can be affected by background noise, accents,
overlapping speakers, recording quality, and language support. If the
transcript is incorrect, verify it manually before relying on the
analysis.

### Understand the result

The analysis response is intended to include fields such as:

  -----------------------------------------------------------------------
  Field                               Meaning
  ----------------------------------- -----------------------------------
  `risk_score`                        Heuristic score from 0 to 100. It
                                      is not a probability.

  `risk_level`                        Human-readable risk band.

  `classification`                    The model's overall assessment of
                                      the input.

  `summary`                           Short explanation of the
                                      assessment.

  `warning_signs`                     Suspicious patterns, evidence,
                                      explanations, and severity.

  `sender_intent`                     The apparent goal of the sender or
                                      caller, when inferable.

  `recommended_actions`               Practical steps the recipient can
                                      take.

  `confidence`                        The model's stated confidence in
                                      its assessment.

  `uncertainties`                     Missing context or reasons the
                                      assessment may be unreliable.
  -----------------------------------------------------------------------

The intended score bands are:

      Score Risk level
  --------- ------------
      0--19 Very Low
     20--39 Low
     40--59 Moderate
     60--79 High
    80--100 Very High

A low score does not prove that a communication is legitimate. A high
score does not prove criminal intent. Always consider the evidence and
uncertainties.

## REST API

The Flask service exposes the following endpoints in the PoC.

### `GET /`

Loads the web interface.

### `GET /api/health`

Checks whether the Flask application is responding.

Example:

``` bash
curl http://127.0.0.1:5000/api/health
```

The endpoint's exact response fields are defined by the implementation.

### `POST /api/analyze`

Analyzes text supplied as JSON.

Example request:

``` bash
curl -X POST http://127.0.0.1:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Your bank account will be blocked. Share your OTP immediately.\",\"language\":\"en\"}"
```

Expected input fields:

  -----------------------------------------------------------------------
  Field                   Type                    Description
  ----------------------- ----------------------- -----------------------
  `text`                  String                  Text to analyze.

  `language`              String                  Optional language code
                                                  or language identifier,
                                                  if supported.
  -----------------------------------------------------------------------

The response contains the structured analysis generated by the
configured local model. Refer to the running implementation for exact
validation and error-response formats.

### `POST /api/transcribe`

Transcribes an uploaded audio file without running scam analysis.

Send the audio as `multipart/form-data` using the field name `audio`.

Example:

``` bash
curl -X POST http://127.0.0.1:5000/api/transcribe \
  -F "audio=@recording.wav"
```

The response contains the transcript and any transcription metadata
returned by the implementation.

### `POST /api/analyze-audio`

Transcribes an uploaded audio file and analyzes the resulting
transcript.

Example:

``` bash
curl -X POST http://127.0.0.1:5000/api/analyze-audio \
  -F "audio=@recording.wav"
```

The response is intended to include the transcript and the scam-analysis
result.

**Note:** These examples describe the intended PoC API contract.
Accepted audio formats, maximum upload size, exact JSON response fields,
and error formats depend on the implemented Flask routes.

## Project structure

The intended lightweight structure is:

``` text
scam-detector/
├── app.py
├── requirements.txt
├── .env.example
├── README.md
├── services/
│   ├── __init__.py
│   ├── ai_service.py
│   ├── audio_service.py
│   ├── text_service.py
│   └── language_service.py
├── prompts/
│   └── scam_prompt.txt
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── style.css
    ├── js/
    │   └── app.js
    └── assets/
```

The actual files in the repository take precedence if the implementation
differs from this proposed structure.

## Troubleshooting

### Ollama connection failed

-   Confirm that Ollama is installed and running.
-   Check that the configured base URL is correct.
-   Confirm that the configured model has been pulled.
-   Try running the model directly:

``` bash
ollama run llama3.1:8b
```

### Model not found

Pull the configured model or update the application's model setting to
match an installed model:

``` bash
ollama list
```

### Audio transcription fails

-   Confirm that the audio dependency is installed.
-   Try a clear recording with minimal background noise.
-   Check that the audio file is in a format supported by the installed
    transcription stack.
-   Allow time for the speech-recognition model to load, especially on
    its first run.

### Browser microphone access is unavailable

-   Grant microphone permission to the browser.
-   Use the application through `localhost` or a secure context
    supported by the browser.
-   If recording is unavailable, try uploading an audio file instead.

### Analysis is slow

Local inference speed depends on the selected Ollama model, available
RAM, CPU/GPU capability, and audio transcription settings. A smaller
model may respond faster but can produce less reliable analysis.

## Privacy and data handling

This PoC is designed without accounts, a database, or persistent scan
history. Text and audio are submitted to the local Flask application for
processing, and text analysis is intended to use the local Ollama
service.

Do not assume that data is never retained in memory, temporary files,
application logs, or dependency caches. Review the implementation before
using real personal or sensitive information. Optional translation
services, if enabled, may send text to an external service; verify their
behavior and configuration before use.

## Scope and limitations

This project is a hackathon proof of concept, not a production security
product.

-   It does not authenticate users or manage user accounts.
-   It does not provide a database or persistent scan history.
-   It does not guarantee detection of every scam.
-   It may produce false positives or false negatives.
-   Results depend on the language model, prompt, transcription quality,
    and context supplied.
-   Language detection and translation support depend on the
    installed/configured implementation.
-   It should not be used as the only basis for deciding whether to
    transfer money, disclose credentials, or trust a caller.

## Development

Run the Flask application locally:

``` bash
python app.py
```

When changing the analysis behavior, review the scam-analysis prompt in
`prompts/scam_prompt.txt`. Keep the response structured so the Flask
backend can validate and return consistent JSON to both the web
interface and API clients.

Before demonstrating the project, verify:

-   Flask starts successfully.
-   The web interface loads.
-   Ollama is reachable and the configured model responds.
-   Text analysis returns a structured result.
-   The result includes a score, explanation, warning signs, and
    recommended actions.
-   Audio transcription works if audio functionality is being
    demonstrated.
-   The API endpoints can be called independently of the web interface.
-   No scan history or database is required.

------------------------------------------------------------------------

**Project type:** Hackathon proof of concept\
**Processing approach:** Local-first, using Ollama for language-model
inference\
**Backend:** Flask
