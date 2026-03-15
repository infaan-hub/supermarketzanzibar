let audioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

export function primeNotificationTone() {
  const context = getAudioContext();
  if (!context || typeof document === "undefined") return () => {};

  const unlock = () => {
    context.resume().catch(() => {});
  };

  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("keydown", unlock);

  return () => {
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("keydown", unlock);
  };
}

export async function playNotificationTone() {
  const context = getAudioContext();
  if (!context) return;

  try {
    await context.resume();
  } catch {
    return;
  }

  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate([80, 40, 120]);
  }

  const output = context.createGain();
  output.gain.setValueAtTime(0.0001, context.currentTime);
  output.connect(context.destination);

  const notes = [
    { frequency: 880, start: 0.0, duration: 0.09 },
    { frequency: 1318.51, start: 0.14, duration: 0.08 },
    { frequency: 1046.5, start: 0.28, duration: 0.16 },
  ];

  const baseTime = context.currentTime + 0.02;
  output.gain.exponentialRampToValueAtTime(0.11, baseTime + 0.02);
  output.gain.exponentialRampToValueAtTime(0.0001, baseTime + 0.62);

  notes.forEach((note) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(note.frequency, baseTime + note.start);
    gain.gain.setValueAtTime(0.0001, baseTime + note.start);
    gain.gain.exponentialRampToValueAtTime(0.18, baseTime + note.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, baseTime + note.start + note.duration);

    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(baseTime + note.start);
    oscillator.stop(baseTime + note.start + note.duration + 0.02);
  });
}
