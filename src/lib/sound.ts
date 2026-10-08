// Web Audio API chime synthesizer for timer completion
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTimerCompletionChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: now }, // C5
      { freq: 659.25, time: now + 0.15 }, // E5
      { freq: 783.99, time: now + 0.3 }, // G5
      { freq: 1046.5, time: now + 0.48 }, // C6
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, note.time);

      gain.gain.setValueAtTime(0.001, note.time);
      gain.gain.exponentialRampToValueAtTime(0.25, note.time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, note.time + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(note.time);
      osc.stop(note.time + 0.5);
    }
  } catch {
    // Ignore audio playback failures (e.g. autoplay policies before interaction)
  }
}
