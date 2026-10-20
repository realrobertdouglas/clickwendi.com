let ctx;

function context() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, duration, type, gain) {
  try {
    const audio = context();
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    osc.connect(amp);
    amp.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch {
    /* autoplay or missing device */
  }
}

export const sfx = {
  unlock() {
    context();
  },
  shot() {
    tone(160, 0.07, "square", 0.025);
  },
  layer() {
    tone(480, 0.05, "sine", 0.03);
    tone(720, 0.08, "sine", 0.02);
  },
  hurt() {
    tone(90, 0.16, "sawtooth", 0.035);
  },
  good() {
    tone(440, 0.08, "sine", 0.03);
    setTimeout(() => tone(660, 0.12, "sine", 0.028), 80);
  },
  bad() {
    tone(130, 0.22, "triangle", 0.04);
  },
  checkpoint() {
    tone(520, 0.07, "sine", 0.025);
  },
};
