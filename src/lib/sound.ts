/**
 * Reproduce un sonido corto y agradable de "confirmación" (como una
 * campanita ascendente de dos notas) usando la Web Audio API. No depende
 * de ningún archivo de audio externo, así que funciona siempre, sin
 * pesar nada en la descarga de la app.
 */
export function playSuccessSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();

    // Dos notas ascendentes (acorde tipo "ding~ding", muy usado en apps
    // de pagos para confirmar algo positivo), con un ataque suave y una
    // caída natural para que no suene golpeado ni artificial.
    const notes = [
      { freq: 880, start: 0, duration: 0.18 },     // A5
      { freq: 1318.5, start: 0.11, duration: 0.32 }, // E6
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;

      const startTime = ctx.currentTime + start;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.22, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    });

    // Cierra el contexto de audio después de que termine, para no dejar
    // recursos abiertos innecesariamente.
    setTimeout(() => ctx.close(), 700);
  } catch {
    // Si el navegador bloquea el audio (por ejemplo, sin interacción
    // previa del usuario), simplemente no suena. No debe romper la app.
  }
}
