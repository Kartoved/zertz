// Simple sound synthesis using Web Audio API
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not supported or blocked
  }
}

export function playPlaceSound(): void {
  playTone(440, 0.1, 'sine', 0.2);
  setTimeout(() => playTone(550, 0.1, 'sine', 0.15), 50);
}

export function playRemoveRingSound(): void {
  playTone(330, 0.15, 'triangle', 0.2);
}

export function playCaptureSound(): void {
  playTone(523, 0.1, 'sine', 0.25);
  setTimeout(() => playTone(659, 0.1, 'sine', 0.2), 80);
  setTimeout(() => playTone(784, 0.15, 'sine', 0.15), 160);
}

export function playWinSound(): void {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, 'sine', 0.3), i * 150);
  });
}

export function playUndoSound(): void {
  playTone(300, 0.1, 'triangle', 0.15);
}

export function playErrorSound(): void {
  playTone(200, 0.2, 'sawtooth', 0.1);
}
