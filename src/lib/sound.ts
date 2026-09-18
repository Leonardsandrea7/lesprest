/**
 * Toca una nota de piano individual a una frecuencia dada. Usado para
 * armar melodías cortas nota por nota (ver playLevelClimb).
 */
function playNote(freq: number, startDelay: number, duration = 0.35) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle"; // más cálido y "de piano" que una sinusoide pura
    osc.frequency.value = freq;

    const startTime = ctx.currentTime + startDelay;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.25, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
    setTimeout(() => ctx.close(), (startDelay + duration + 0.3) * 1000);
  } catch {
    // Silencioso si el navegador bloquea el audio.
  }
}

// Escala pentatónica mayor (Do, Re, Mi, Sol, La, Do octava arriba...):
// suena alegre y "de videojuego" sin notas que choquen entre sí, ideal
// para una melodía ascendente de "subir de nivel".
const PENTATONIC_SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

/**
 * Reproduce una melodía ascendente, una nota por cada paso/nivel, cada
 * vez más aguda — para acompañar una animación de "subiendo de nivel".
 * Llama a onStep(i) justo cuando debería sonar/iluminarse el paso i,
 * para sincronizar el sonido con la animación visual.
 */
export function playLevelClimb(steps: number, onStep?: (index: number) => void) {
  const interval = 0.28;
  for (let i = 0; i < steps; i++) {
    const freq = PENTATONIC_SCALE[Math.min(i, PENTATONIC_SCALE.length - 1)];
    playNote(freq, i * interval, i === steps - 1 ? 0.6 : 0.3);
    if (onStep) setTimeout(() => onStep(i), i * interval * 1000);
  }
}

/**
 * Reproduce un sonido corto y agradable de "confirmación" (como una
 * campanita ascendente de dos notas) usando la Web Audio API.
 */
export function playSuccessSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();

    const notes = [
      { freq: 880, start: 0, duration: 0.18 },
      { freq: 1318.5, start: 0.11, duration: 0.32 },
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

    setTimeout(() => ctx.close(), 700);
  } catch {
    // Silencioso si el navegador bloquea el audio.
  }
}
