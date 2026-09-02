export class UnityAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.enabled = false;
    this.nodes = [];
    this.suspendTimer = null;
  }

  async toggle() {
    if (!this.context) this.#build();
    this.enabled = !this.enabled;

    clearTimeout(this.suspendTimer);

    if (this.enabled) {
      await this.context.resume();
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setValueAtTime(this.master.gain.value, this.context.currentTime);
      this.master.gain.linearRampToValueAtTime(0.032, this.context.currentTime + 1.8);
    } else {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setValueAtTime(this.master.gain.value, this.context.currentTime);
      this.master.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 1.1);
      this.suspendTimer = window.setTimeout(() => this.context?.suspend(), 1250);
    }

    return this.enabled;
  }

  #build() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error("Web Audio is unavailable in this browser.");

    this.context = new AudioContext();
    const now = this.context.currentTime;

    this.master = this.context.createGain();
    this.master.gain.setValueAtTime(0.0001, now);

    const lowpass = this.context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 1350;
    lowpass.Q.value = 0.42;

    const reverb = this.context.createConvolver();
    reverb.buffer = this.#impulse(4.8, 3.4);

    const dry = this.context.createGain();
    const wet = this.context.createGain();
    dry.gain.value = 0.42;
    wet.gain.value = 0.74;

    lowpass.connect(dry).connect(this.master);
    lowpass.connect(reverb).connect(wet).connect(this.master);
    this.master.connect(this.context.destination);

    const chord = [65.406, 98.0, 130.813, 195.998];
    chord.forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const voice = this.context.createGain();
      const drift = this.context.createOscillator();
      const driftDepth = this.context.createGain();

      oscillator.type = index < 2 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = [-6, 4, -2, 7][index];
      voice.gain.value = [0.55, 0.33, 0.16, 0.08][index];

      drift.type = "sine";
      drift.frequency.value = 0.035 + index * 0.013;
      driftDepth.gain.value = 2.1 + index * 0.8;
      drift.connect(driftDepth).connect(oscillator.detune);

      oscillator.connect(voice).connect(lowpass);
      oscillator.start();
      drift.start();
      this.nodes.push(oscillator, drift, voice, driftDepth);
    });

    const breath = this.context.createBufferSource();
    breath.buffer = this.#noise(3.5);
    breath.loop = true;
    const breathFilter = this.context.createBiquadFilter();
    const breathGain = this.context.createGain();
    breathFilter.type = "bandpass";
    breathFilter.frequency.value = 720;
    breathFilter.Q.value = 0.55;
    breathGain.gain.value = 0.018;
    breath.connect(breathFilter).connect(breathGain).connect(reverb);
    breath.start();

    const lfo = this.context.createOscillator();
    const lfoDepth = this.context.createGain();
    lfo.frequency.value = 0.047;
    lfoDepth.gain.value = 380;
    lfo.connect(lfoDepth).connect(lowpass.frequency);
    lfo.start();

    this.nodes.push(breath, breathFilter, breathGain, lfo, lfoDepth, lowpass, reverb, dry, wet);
  }

  #impulse(seconds, decay) {
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(2, length, this.context.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const envelope = Math.pow(1 - index / length, decay);
        data[index] = (Math.random() * 2 - 1) * envelope;
      }
    }

    return buffer;
  }

  #noise(seconds) {
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;

    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.985 + white * 0.015;
      data[index] = previous * 3.2;
    }

    return buffer;
  }
}
