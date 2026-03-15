/**
 * RhymeBook Audio Engine
 * Core audio playback and analysis using Web Audio API with Tone.js effects
 */

import * as Tone from 'tone';

export interface AudioState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  error: string | null;
}

export interface AudioEffects {
  reverb: number;      // 0-1
  eq: { low: number; mid: number; high: number }; // -12 to 12 dB
  delay: number;       // 0-1
  distortion: number;  // 0-1
}

export interface WaveformData {
  peaks: number[];
  duration: number;
  sampleRate: number;
}

export type AudioStateCallback = (state: AudioState) => void;

export class AudioEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private originalBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private animationFrame: number | null = null;
  private stateListeners: Set<AudioStateCallback> = new Set();

  // Vocal removal
  private vocalRemovalAmount: number = 0;

  // Tone.js effects
  private toneInitialized: boolean = false;
  private reverb: Tone.Reverb | null = null;
  private eq3: Tone.EQ3 | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private distortion: Tone.Distortion | null = null;
  private effectsChain: Tone.ToneAudioNode[] = [];
  private effectsEnabled: boolean = false;

  private state: AudioState = {
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isLoading: false,
    error: null,
  };

  constructor() {
    // Initialize on first user interaction
  }

  private async initContext(): Promise<void> {
    if (this.context) return;

    this.context = new AudioContext();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = this.state.volume;

    // Initialize Tone.js effects
    await this.initEffects();

    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.context.destination);
  }

  private async initEffects(): Promise<void> {
    if (this.toneInitialized) return;

    try {
      await Tone.start();
      
      // Create effects
      this.reverb = new Tone.Reverb({ decay: 2, wet: 0 });
      this.eq3 = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
      this.delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: 0 });
      this.distortion = new Tone.Distortion({ distortion: 0, wet: 0 });

      // Connect effects chain
      this.distortion.connect(this.eq3);
      this.eq3.connect(this.reverb);
      this.reverb.connect(this.delay);
      this.delay.toDestination();

      this.effectsChain = [this.distortion, this.eq3, this.reverb, this.delay];
      this.toneInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Tone.js effects:', error);
    }
  }

  /**
   * Set audio effects
   */
  setEffects(effects: Partial<AudioEffects>): void {
    if (!this.toneInitialized) return;

    if (effects.reverb !== undefined && this.reverb) {
      this.reverb.wet.value = effects.reverb;
    }

    if (effects.eq && this.eq3) {
      if (effects.eq.low !== undefined) this.eq3.low.value = effects.eq.low;
      if (effects.eq.mid !== undefined) this.eq3.mid.value = effects.eq.mid;
      if (effects.eq.high !== undefined) this.eq3.high.value = effects.eq.high;
    }

    if (effects.delay !== undefined && this.delay) {
      this.delay.wet.value = effects.delay;
    }

    if (effects.distortion !== undefined && this.distortion) {
      this.distortion.distortion = effects.distortion;
      this.distortion.wet.value = effects.distortion > 0 ? 1 : 0;
    }
  }

  /**
   * Get current effects settings
   */
  getEffects(): AudioEffects {
    return {
      reverb: this.reverb?.wet.value || 0,
      eq: {
        low: this.eq3?.low.value || 0,
        mid: this.eq3?.mid.value || 0,
        high: this.eq3?.high.value || 0,
      },
      delay: this.delay?.wet.value || 0,
      distortion: this.distortion?.distortion || 0,
    };
  }

  /**
   * Reset all effects to default
   */
  resetEffects(): void {
    this.setEffects({
      reverb: 0,
      eq: { low: 0, mid: 0, high: 0 },
      delay: 0,
      distortion: 0,
    });
  }

  private updateState(updates: Partial<AudioState>): void {
    this.state = { ...this.state, ...updates };
    this.stateListeners.forEach(listener => listener(this.state));
  }

  onStateChange(callback: AudioStateCallback): () => void {
    this.stateListeners.add(callback);
    callback(this.state);
    return () => this.stateListeners.delete(callback);
  }

  getState(): AudioState {
    return { ...this.state };
  }

  async loadAudio(url: string): Promise<WaveformData | null> {
    this.initContext();
    this.stop();

    this.updateState({ isLoading: true, error: null });

    // Explicitly release previous buffer to prevent memory leak
    if (this.audioBuffer) {
      this.audioBuffer = null;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load audio: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      this.originalBuffer = await this.context!.decodeAudioData(arrayBuffer);

      // Apply vocal removal if enabled
      this.audioBuffer = this.vocalRemovalAmount > 0
        ? this.processVocalRemoval(this.originalBuffer)
        : this.originalBuffer;

      const waveformData = this.generateWaveformData(this.audioBuffer);

      this.updateState({
        isLoading: false,
        duration: this.audioBuffer.duration,
        currentTime: 0,
      });

      return waveformData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load audio';
      this.updateState({ isLoading: false, error: errorMessage });
      return null;
    }
  }

  private generateWaveformData(buffer: AudioBuffer): WaveformData {
    const channelData = buffer.getChannelData(0);
    const samples = 200;
    const blockSize = Math.floor(channelData.length / samples);
    const peaks: number[] = [];

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[i * blockSize + j]);
      }
      peaks.push(sum / blockSize);
    }

    // Normalize peaks
    const maxPeak = Math.max(...peaks);
    const normalizedPeaks = peaks.map(p => p / maxPeak);

    return {
      peaks: normalizedPeaks,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
    };
  }

  play(): void {
    if (!this.audioBuffer || !this.context || !this.gainNode) return;

    if (this.state.isPlaying && !this.state.isPaused) return;

    // Resume context if suspended
    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    // Stop existing source
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
    }

    // Create new source
    this.source = this.context.createBufferSource();
    this.source.buffer = this.audioBuffer;

    // Connect with vocal removal filters if enabled
    if (this.vocalRemovalAmount > 0) {
      const filters = this.createVocalFilterChain();
      if (filters.length > 0) {
        this.source.connect(filters[0]);
        filters[filters.length - 1].connect(this.gainNode);
      } else {
        this.source.connect(this.gainNode);
      }
    } else {
      this.source.connect(this.gainNode);
    }

    // Calculate start offset
    const offset = this.state.isPaused ? this.pauseTime : 0;
    this.startTime = this.context.currentTime - offset;

    this.source.start(0, offset);
    this.source.onended = () => {
      if (this.state.isPlaying && !this.state.isPaused) {
        this.updateState({ isPlaying: false, isPaused: false, currentTime: 0 });
      }
    };

    this.updateState({ isPlaying: true, isPaused: false });
    this.startProgressTracking();
  }

  pause(): void {
    if (!this.state.isPlaying || this.state.isPaused) return;

    this.pauseTime = this.getCurrentTime();
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }

    this.updateState({ isPaused: true });
    this.stopProgressTracking();
  }

  stop(): void {
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }

    this.pauseTime = 0;
    this.startTime = 0;
    this.updateState({ isPlaying: false, isPaused: false, currentTime: 0 });
    this.stopProgressTracking();
  }

  seek(time: number): void {
    const wasPlaying = this.state.isPlaying && !this.state.isPaused;
    const clampedTime = Math.max(0, Math.min(time, this.state.duration));

    if (this.source) {
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }

    this.pauseTime = clampedTime;
    this.updateState({ currentTime: clampedTime });

    if (wasPlaying) {
      this.play();
    }
  }

  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = clampedVolume;
    }
    this.updateState({ volume: clampedVolume });
  }

  /**
   * Set vocal removal amount
   * @param amount 0 = original audio, 1 = vocals removed (instrumental only)
   */
  setVocalRemoval(amount: number): void {
    this.vocalRemovalAmount = Math.max(0, Math.min(1, amount));

    // Update vocal filters in real-time if they exist
    this.updateVocalFilters();

    // If no filters exist and we need them, rebuild audio graph
    if (this.vocalRemovalAmount > 0 && !this.vocalFilters.length && this.state.isPlaying) {
      this.rebuildAudioGraph();
    }
  }

  getVocalRemoval(): number {
    return this.vocalRemovalAmount;
  }

  // Vocal removal filters (real-time)
  private vocalFilters: BiquadFilterNode[] = [];
  private vocalGainNode: GainNode | null = null;

  /**
   * Update vocal removal filters in real-time
   */
  private updateVocalFilters(): void {
    if (!this.context) return;

    const amount = this.vocalRemovalAmount;

    // Update existing filters
    this.vocalFilters.forEach(filter => {
      filter.gain.value = -12 * amount; // Reduce by up to 12dB
    });

    // Update vocal gain node for center channel extraction
    if (this.vocalGainNode) {
      this.vocalGainNode.gain.value = 1 - amount;
    }
  }

  /**
   * Create vocal removal filter chain
   * Uses notch filters at vocal frequencies for real-time processing
   */
  private createVocalFilterChain(): BiquadFilterNode[] {
    if (!this.context) return [];

    const filters: BiquadFilterNode[] = [];

    // Vocal frequency ranges to attenuate
    const vocalFreqs = [
      { freq: 250, q: 1.0 },   // Low fundamental
      { freq: 500, q: 1.5 },   // Fundamental
      { freq: 1000, q: 2.0 },  // Mid vocal presence
      { freq: 2000, q: 2.0 },  // Vocal clarity
      { freq: 3500, q: 1.5 },  // Vocal presence/air
    ];

    vocalFreqs.forEach(({ freq, q }) => {
      const filter = this.context!.createBiquadFilter();
      filter.type = 'peaking'; // Use peaking for smoother attenuation
      filter.frequency.value = freq;
      filter.Q.value = q;
      filter.gain.value = -12 * this.vocalRemovalAmount;
      filters.push(filter);
    });

    // Chain filters together
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1]);
    }

    this.vocalFilters = filters;
    return filters;
  }

  /**
   * Rebuild audio graph with vocal removal filters
   */
  private rebuildAudioGraph(): void {
    if (!this.context || !this.source || !this.gainNode) return;

    // Disconnect current chain
    this.source.disconnect();

    // Create new filter chain
    const filters = this.createVocalFilterChain();

    if (filters.length > 0) {
      // Connect: source -> filters -> gain -> analyser -> destination
      this.source.connect(filters[0]);
      filters[filters.length - 1].connect(this.gainNode);
    } else {
      // No filters, connect directly
      this.source.connect(this.gainNode);
    }
  }

  /**
   * Process audio buffer for vocal removal using center channel extraction
   * This is used for pre-processing when loading audio
   */
  private processVocalRemoval(buffer: AudioBuffer): AudioBuffer {
    if (this.vocalRemovalAmount === 0 || buffer.numberOfChannels < 2) {
      return buffer;
    }

    const context = this.context!;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;

    // Create new buffer for processed audio
    const processedBuffer = context.createBuffer(2, length, sampleRate);

    const leftInput = buffer.getChannelData(0);
    const rightInput = buffer.getChannelData(1);
    const leftOutput = processedBuffer.getChannelData(0);
    const rightOutput = processedBuffer.getChannelData(1);

    const amount = this.vocalRemovalAmount;

    for (let i = 0; i < length; i++) {
      const left = leftInput[i];
      const right = rightInput[i];

      // Center channel extraction: (L - R) gives us sides only (instruments)
      const sides = (left - right) / 2;

      // Mix: keep some original, add extracted sides
      leftOutput[i] = left * (1 - amount) + sides * amount * 2;
      rightOutput[i] = right * (1 - amount) - sides * amount * 2;

      // Soft clipping to prevent distortion
      leftOutput[i] = Math.tanh(leftOutput[i]);
      rightOutput[i] = Math.tanh(rightOutput[i]);
    }

    return processedBuffer;
  }

  private getCurrentTime(): number {
    if (!this.context) return 0;
    if (this.state.isPaused) return this.pauseTime;
    return this.context.currentTime - this.startTime;
  }

  private startProgressTracking(): void {
    const track = () => {
      if (!this.state.isPlaying || this.state.isPaused) return;

      const currentTime = this.getCurrentTime();
      this.updateState({ currentTime });

      if (currentTime >= this.state.duration) {
        this.updateState({ isPlaying: false, isPaused: false, currentTime: 0 });
        return;
      }

      this.animationFrame = requestAnimationFrame(track);
    };

    this.animationFrame = requestAnimationFrame(track);
  }

  private stopProgressTracking(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  getWaveformData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  isPlaying(): boolean {
    return this.state.isPlaying && !this.state.isPaused;
  }

  destroy(): void {
    this.stop();
    this.stateListeners.clear();
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}

// Singleton instance
let globalEngine: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!globalEngine) {
    globalEngine = new AudioEngine();
  }
  return globalEngine;
}

export function destroyAudioEngine(): void {
  if (globalEngine) {
    globalEngine.destroy();
    globalEngine = null;
  }
}
