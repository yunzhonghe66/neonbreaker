// NEONBREAKER's sound: every effect is synthesised with WebAudio, no audio files.
// The context is created on the first player gesture (browsers forbid sound before
// one), and every effect is a no-op until then, so headless renders stay silent.

/** Bass line for the background pulse, one quiet step every eighth note at 126 BPM. */
const BASS_STEPS = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 82.41, 0, 73.42, 65.41, 58.27, 49];
const STEP_SECONDS = 60 / 126 / 2;

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicStep = 0;
  let nextStepTime = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      nextStepTime = ctx.currentTime + 0.1;
    } catch {
      ctx = null;
    }
  }

  function tone(freq, dur, type, gain, slideTo) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(amp);
    amp.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, gain, lowpass) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + dur);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start(now);
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Paddle bounce: pitch rises a little with the combo. */
    paddle(combo) {
      tone(220 + Math.min(combo, 12) * 12, 0.07, 'square', 0.12);
    },
    /** Brick break: pitch rises with the combo so streaks sound like they climb. */
    brick(combo) {
      const base = 340 + Math.min(combo, 16) * 22;
      tone(base, 0.09, 'triangle', 0.22, base * 1.6);
      noise(0.08, 0.14, 3200);
    },
    steel() {
      tone(140, 0.06, 'square', 0.14, 90);
      noise(0.04, 0.08, 900);
    },
    powerup() {
      tone(523, 0.09, 'sine', 0.18);
      setTimeout(() => tone(659, 0.09, 'sine', 0.18), 70);
      setTimeout(() => tone(784, 0.14, 'sine', 0.2), 140);
    },
    laser() {
      tone(880, 0.08, 'sawtooth', 0.1, 220);
    },
    launch() {
      tone(330, 0.08, 'sine', 0.14, 520);
    },
    loseLife() {
      tone(320, 0.35, 'sawtooth', 0.16, 70);
      noise(0.25, 0.12, 700);
    },
    levelClear() {
      [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => tone(freq, 0.16, 'triangle', 0.2), i * 90));
    },
    gameOver() {
      [392, 330, 262, 196].forEach((freq, i) => setTimeout(() => tone(freq, 0.25, 'triangle', 0.18), i * 160));
    },
    victory() {
      [523, 659, 784, 1047, 1319, 1568].forEach((freq, i) => setTimeout(() => tone(freq, 0.22, 'triangle', 0.2), i * 110));
    },
    /** The quiet bass pulse, scheduled a step ahead while the game runs. */
    updateMusic() {
      if (!ctx || muted) return;
      while (nextStepTime < ctx.currentTime + 0.15) {
        const freq = BASS_STEPS[musicStep % BASS_STEPS.length];
        if (freq > 0) {
          const osc = ctx.createOscillator();
          const amp = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          amp.gain.setValueAtTime(0.0001, nextStepTime);
          amp.gain.exponentialRampToValueAtTime(0.06, nextStepTime + 0.02);
          amp.gain.exponentialRampToValueAtTime(0.001, nextStepTime + STEP_SECONDS * 0.9);
          osc.connect(amp);
          amp.connect(master);
          osc.start(nextStepTime);
          osc.stop(nextStepTime + STEP_SECONDS);
        }
        musicStep += 1;
        nextStepTime += STEP_SECONDS;
      }
    },
  };
}
