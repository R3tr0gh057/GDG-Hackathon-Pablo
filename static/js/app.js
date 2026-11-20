// Harbor UI. All analysis goes through the Flask API.

const messageEl = document.querySelector("#message");
const transcriptEl = document.querySelector("#transcript");
const textPanel = document.querySelector("#text-panel");
const voicePanel = document.querySelector("#voice-panel");
const modeText = document.querySelector("#mode-text");
const modeVoice = document.querySelector("#mode-voice");
const analyzeBtn = document.querySelector("#analyze-btn");
const clearBtn = document.querySelector("#clear-btn");
const recordBtn = document.querySelector("#record-btn");
const fileInput = document.querySelector("#audio-file");
const fileName = document.querySelector("#file-name");
const playback = document.querySelector("#playback");
const timerEl = document.querySelector("#timer");
const recDot = document.querySelector("#rec-dot");
const transcribeBtn = document.querySelector("#transcribe-btn");
const progress = document.querySelector("#progress");
const progressLabel = document.querySelector("#progress-label");
const results = document.querySelector("#results");
const aiStatus = document.querySelector("#ai-status");
const apiStatus = document.querySelector("#api-status");

let mode = "text";
let recorder = null;
let chunks = [];
let recordTimer = null;
let recordStarted = 0;
let audioBlob = null;

boot();

function boot() {
  modeText.addEventListener("click", () => setMode("text"));
  modeVoice.addEventListener("click", () => setMode("voice"));
  analyzeBtn.addEventListener("click", onAnalyze);
  clearBtn.addEventListener("click", clearAll);
  recordBtn.addEventListener("click", toggleRecord);
  fileInput.addEventListener("change", onFile);
  transcribeBtn.addEventListener("click", () => transcribeCurrent());
  loadHealth();
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    apiStatus.textContent = "API: ready";
    apiStatus.className = "pill ok";
    if (data.ollama && data.model_installed) {
      aiStatus.textContent = `Local AI: ${data.model}`;
      aiStatus.className = "pill ok";
    } else if (data.ollama) {
      aiStatus.textContent = "Local AI: model missing";
      aiStatus.className = "pill bad";
    } else {
      aiStatus.textContent = "Local AI: offline";
      aiStatus.className = "pill bad";
    }
  } catch (_err) {
    apiStatus.textContent = "API: unavailable";
    apiStatus.className = "pill bad";
    aiStatus.textContent = "Local AI: unknown";
  }
}

function setMode(next) {
  mode = next;
  const voice = next === "voice";
  textPanel.hidden = voice;
  voicePanel.hidden = !voice;
  modeText.classList.toggle("active", !voice);
  modeVoice.classList.toggle("active", voice);
  modeText.setAttribute("aria-pressed", String(!voice));
  modeVoice.setAttribute("aria-pressed", String(voice));
}

async function onAnalyze() {
  results.hidden = true;
  results.innerHTML = "";
  if (mode === "voice") {
    const transcript = transcriptEl.value.trim();
    if (!transcript) {
      const spoken = await transcribeCurrent();
      if (!spoken) return;
    }
    await analyzeText(transcriptEl.value.trim(), "auto");
    return;
  }
  await analyzeText(messageEl.value, "auto");
}

async function analyzeText(text, language) {
  if (!text.trim()) {
    showProgress("Paste a message first.");
    return;
  }
  setBusy(true);
  showProgress("Analyzing with local AI");
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      showProgress(data.error || "The analysis could not be completed.");
      return;
    }
    hideProgress();
    renderResults(data);
  } catch (_err) {
    showProgress("The server could not be reached.");
  } finally {
    setBusy(false);
  }
}

async function transcribeCurrent() {
  if (!audioBlob) {
    showProgress("Record or upload a voice message first.");
    return false;
  }
  setBusy(true);
  showProgress("Transcribing audio");
  const body = new FormData();
  const name = audioBlob.name || "recording.webm";
  body.append("audio", audioBlob, name);
  try {
    const response = await fetch("/api/transcribe", { method: "POST", body });
    const data = await response.json();
    if (!response.ok || !data.success) {
      showProgress(data.error || "Transcription failed.");
      return false;
    }
    transcriptEl.value = data.transcript || "";
    hideProgress();
    return true;
  } catch (_err) {
    showProgress("The server could not be reached.");
    return false;
  } finally {
    setBusy(false);
  }
}

function renderResults(data) {
  const score = Number(data.risk_score) || 0;
  const tone = score >= 60 ? "high" : score >= 40 ? "medium" : "low";
  results.hidden = false;
  results.append(scoreCard(data, score, tone));
  results.append(signsPanel(data.warning_signs || []));
  results.append(intentPanel(data.sender_intent));
  results.append(actionsPanel(data.recommended_actions || []));
  results.append(technical(data));
  const disclaimer = document.createElement("p");
  disclaimer.className = "disclaimer";
  disclaimer.textContent = "AI-generated assessments are not guarantees. A low score does not prove that a message is safe.";
  results.append(disclaimer);
  results.scrollIntoView({ block: "start" });
}

function scoreCard(data, score, tone) {
  const card = document.createElement("article");
  card.className = "score-card";
  const layout = document.createElement("div");
  layout.className = "score-layout";
  layout.append(gauge(score, tone));
  const copy = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "SCAM RISK SCORE";
  const num = document.createElement("p");
  num.className = "score-num";
  num.append(document.createTextNode(String(score)));
  const denom = document.createElement("span");
  denom.textContent = " / 100";
  num.append(denom);
  const level = document.createElement("p");
  level.className = `level sev ${tone}`;
  level.textContent = `${data.risk_level || ""} RISK`.trim();
  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = data.summary || "";
  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = `Assessment confidence: ${data.confidence || "Unknown"}. This is not a probability that the message is fraudulent.`;
  copy.append(kicker, num, level, summary, meta);
  if (score >= 60) {
    const callout = document.createElement("p");
    callout.className = "callout";
    callout.textContent = "Do not send money, codes, or personal details until you have checked this with an official source you look up yourself.";
    copy.append(callout);
  }
  if (data.translation_note) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = data.translation_note;
    copy.append(note);
  }
  layout.append(copy);
  card.append(layout);
  return card;
}

function gauge(score, tone) {
  const wrap = document.createElement("div");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 200 120");
  svg.setAttribute("class", "gauge");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Risk score ${score} out of 100`);
  const color = tone === "high" ? "#F05252" : tone === "medium" ? "#E9AD46" : "#38D9A9";
  const radius = 70;
  const length = Math.PI * radius;
  const filled = length * (score / 100);
  const track = arc(radius, "#30343C", length, 0);
  const value = arc(radius, color, length, length - filled);
  svg.append(track, value);
  wrap.append(svg);
  return wrap;
}

function arc(radius, color, length, offset) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M20 100 A70 70 0 0 1 180 100");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", "12");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-dasharray", `${length} ${length}`);
  path.setAttribute("stroke-dashoffset", String(offset));
  return path;
}

function signsPanel(signs) {
  const panel = document.createElement("section");
  panel.className = "panel";
  const title = document.createElement("h2");
  title.textContent = "Why we think this is suspicious";
  panel.append(title);
  if (!signs.length) {
    const empty = document.createElement("p");
    empty.textContent = "No specific warning signs were quoted from this message. That does not prove the message is safe.";
    panel.append(empty);
    return panel;
  }
  signs.forEach((sign) => {
    const card = document.createElement("article");
    card.className = "sign";
    const heading = document.createElement("h3");
    heading.textContent = sign.title || "Warning";
    const severity = document.createElement("span");
    const sev = (sign.severity || "Medium").toLowerCase();
    severity.className = `sev ${sev}`;
    severity.textContent = `Severity: ${sign.severity || "Medium"}`;
    heading.append(" ");
    heading.append(severity);
    card.append(heading);
    if (sign.evidence) {
      const quote = document.createElement("blockquote");
      quote.className = "quote";
      quote.textContent = sign.evidence;
      card.append(quote);
    }
    const explanation = document.createElement("p");
    explanation.textContent = sign.explanation || "";
    card.append(explanation);
    panel.append(card);
  });
  return panel;
}

function intentPanel(intent) {
  const panel = document.createElement("section");
  panel.className = "panel";
  const title = document.createElement("h2");
  title.textContent = "What the sender might be trying to do";
  const body = document.createElement("p");
  body.textContent = intent || "This is not clear from the message.";
  panel.append(title, body);
  return panel;
}

function actionsPanel(actions) {
  const panel = document.createElement("section");
  panel.className = "panel";
  const title = document.createElement("h2");
  title.textContent = "What should you do?";
  panel.append(title);
  if (!actions.length) {
    const empty = document.createElement("p");
    empty.textContent = "No extra action was recommended. If money or personal details are involved, check with an official source.";
    panel.append(empty);
    return panel;
  }
  const list = document.createElement("ol");
  list.className = "actions-list";
  actions.forEach((action) => {
    const item = document.createElement("li");
    item.textContent = action;
    list.append(item);
  });
  panel.append(list);
  return panel;
}

function technical(data) {
  const panel = document.createElement("details");
  panel.className = "panel";
  const summary = document.createElement("summary");
  summary.textContent = "Technical details";
  panel.append(summary);
  addBlock(panel, "Original message", data.original_text);
  addBlock(panel, "Cleaned text", data.cleaned_text);
  addBlock(panel, "Translated text", data.translated_text || "Not translated.");
  addBlock(panel, "Detected language", data.detected_language || "unknown");
  addBlock(panel, "Model used", data.model || "");
  addBlock(panel, "Stages", (data.stages || []).join(" · "));
  return panel;
}

function addBlock(parent, label, value) {
  const heading = document.createElement("h3");
  heading.textContent = label;
  const body = document.createElement("p");
  body.textContent = value || "";
  parent.append(heading, body);
}

function showProgress(label) {
  progress.hidden = false;
  progressLabel.textContent = label;
}

function hideProgress() {
  progress.hidden = true;
}

function setBusy(busy) {
  analyzeBtn.disabled = busy;
  transcribeBtn.disabled = busy;
  recordBtn.disabled = busy;
}

function clearAll() {
  messageEl.value = "";
  transcriptEl.value = "";
  fileInput.value = "";
  fileName.textContent = "";
  playback.hidden = true;
  playback.removeAttribute("src");
  audioBlob = null;
  results.hidden = true;
  results.innerHTML = "";
  hideProgress();
  stopTimer();
}

async function toggleRecord() {
  if (recorder && recorder.state === "recording") {
    recorder.stop();
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showProgress("This browser cannot use the microphone. Upload a recording instead.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      audioBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      audioBlob.name = "recording.webm";
      playback.src = URL.createObjectURL(audioBlob);
      playback.hidden = false;
      fileName.textContent = "Recorded voice message";
      recordBtn.textContent = "Record";
      recDot.hidden = true;
      stopTimer();
    };
    recorder.start();
    recordBtn.textContent = "Stop";
    recDot.hidden = false;
    recordStarted = Date.now();
    recordTimer = setInterval(updateTimer, 250);
  } catch (_err) {
    showProgress("Microphone permission was blocked. You can upload a recording instead.");
  }
}

function onFile() {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  audioBlob = file;
  fileName.textContent = file.name;
  playback.src = URL.createObjectURL(file);
  playback.hidden = false;
}

function updateTimer() {
  const seconds = Math.floor((Date.now() - recordStarted) / 1000);
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  timerEl.textContent = `${mins}:${secs}`;
}

function stopTimer() {
  if (recordTimer) clearInterval(recordTimer);
  recordTimer = null;
  timerEl.textContent = "00:00";
}
