// src/audio.js
let audioCtx = null;

export function ensureAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function midiFromPitch(pitch) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(pitch || "");
  if (!m) return 69; // A4
  const step = m[1];
  const acc = m[2];
  const oct = parseInt(m[3], 10);
  const base = ({ C:0, D:2, E:4, F:5, G:7, A:9, B:11 }[step] ?? 9);
  const alter = acc === "#" ? 1 : (acc === "b" ? -1 : 0);
  return (oct + 1) * 12 + base + alter;
}

function hzFromMidi(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function secondsFromTypeName(name) {
  const dotted = (name || "").startsWith("점");
  const base =
    name.includes("16분") ? 0.22 :
    name.includes("8분")  ? 0.32 :
    name.includes("4분")  ? 0.48 :
    name.includes("2분")  ? 0.78 :
    name.includes("온")   ? 1.10 : 0.45;
  return dotted ? base * 1.5 : base;
}

export function playPitch(pitch, seconds) {
  const ctx = ensureAudio();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime;

  osc.type = "sine";
  osc.frequency.setValueAtTime(hzFromMidi(midiFromPitch(pitch)), t0);

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.12, seconds));

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t0);
  osc.stop(t0 + Math.max(0.14, seconds) + 0.02);
}
