// =====================================================================
// Los navegadores bloquean cualquier sonido que no venga directamente de
// un clic/toque del usuario. Antes, cada función creaba su propio canal
// de audio "desde cero" en el momento de sonar — y como la animación de
// subir de nivel se dispara sola (no dentro de un clic), ese canal nacía
// bloqueado y nunca sonaba.
//
// La solución: un solo canal de audio compartido para toda la app, que
// se "desbloquea" una sola vez con el primer toque que la persona haga
// en cualquier parte (iniciar sesión, tocar un botón, etc.). Una vez
// desbloqueado, cualquier sonido posterior —aunque se dispare solo, sin
// un clic directo— sí se escucha con normalidad.
// =====================================================================

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      sharedContext = new AudioContextClass();
    }
    return sharedContext;
  } catch {
    return null;
  }
}

function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

if (typeof window !== "undefined") {
  // Se desbloquea con el primer toque/clic en cualquier parte de la app,
  // y no hace falta escuchar más eventos después de eso.
  const unlockOnce = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", unlockOnce);
    window.removeEventListener("keydown", unlockOnce);
  };
  window.addEventListener("pointerdown", unlockOnce);
  window.addEventListener("keydown", unlockOnce);
}

function playNote(freq: number, startDelay: number, duration = 0.35) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
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
  } catch {
    // Silencioso si el navegador bloquea el audio.
  }
}

// Escala pentatónica mayor: suena alegre y "de videojuego" sin notas que
// choquen entre sí, ideal para una melodía ascendente de "subir de nivel".
const PENTATONIC_SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

/**
 * Reproduce una melodía ascendente, una nota por cada paso/nivel, cada
 * vez más aguda. Llama a onStep(i) justo cuando debería sonar/iluminarse
 * el paso i, para sincronizar el sonido con la animación visual.
 */
export function playLevelClimb(steps: number, onStep?: (index: number) => void) {
  unlockAudio();
  const interval = 0.28;
  for (let i = 0; i < steps; i++) {
    const freq = PENTATONIC_SCALE[Math.min(i, PENTATONIC_SCALE.length - 1)];
    playNote(freq, i * interval, i === steps - 1 ? 0.6 : 0.3);
    if (onStep) setTimeout(() => onStep(i), i * interval * 1000);
  }
}

/**
 * Reproduce un sonido corto y agradable de "confirmación" (como una
 * campanita ascendente de dos notas).
 */
export function playSuccessSound() {
  unlockAudio();
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
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
  } catch {
    // Silencioso si el navegador bloquea el audio.
  }
}
