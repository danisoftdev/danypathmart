/** Short beeps for USB scanner feedback at the POS register. */
export function posBeep(type = 'ok') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = type === 'ok' ? 880 : 220;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + (type === 'ok' ? 0.08 : 0.2));
    osc.onended = () => ctx.close();
  } catch {
    // Audio not available — silent fallback
  }
}
