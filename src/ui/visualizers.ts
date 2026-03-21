/**
 * RhymeBook Visualizer Components
 * Waveform and frequency visualization components
 */

import { AudioEngine, WaveformData } from './audio-engine.js';

// Static import for Wavesurfer.js - bundled into single file for MCP compatibility
import WaveSurfer from 'wavesurfer.js';

// ============ WAVEFORM VISUALIZER (Wavesurfer.js) ============

export interface WaveformOptions {
  height?: number;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  barWidth?: number;
  barGap?: number;
  responsive?: boolean;
}

export class WaveformVisualizer {
  private container: HTMLElement;
  private wavesurfer: WaveSurfer | null = null;
  private options: Required<WaveformOptions>;
  private onSeek?: (time: number) => void;

  constructor(container: HTMLElement, options: WaveformOptions = {}) {
    this.container = container;
    this.options = {
      height: options.height || 80,
      waveColor: options.waveColor || '#4a4a4a',
      progressColor: options.progressColor || '#9333ea',
      cursorColor: options.cursorColor || '#ffffff',
      barWidth: options.barWidth || 2,
      barGap: options.barGap || 1,
      responsive: options.responsive !== false,
    };

    this.setupWavesurfer();
  }

  private async setupWavesurfer(): Promise<void> {
    try {
      // WaveSurfer is already imported statically
      this.wavesurfer = WaveSurfer.create({
        container: this.container,
        height: this.options.height,
        waveColor: this.options.waveColor,
        progressColor: this.options.progressColor,
        cursorColor: this.options.cursorColor,
        barWidth: this.options.barWidth,
        barGap: this.options.barGap,
        barRadius: 2,
        cursorWidth: 2,
        normalize: true,
        fillParent: true,
        minPxPerSec: 1,
      });

      this.wavesurfer.on('interaction', (newTime: number) => {
        if (this.onSeek) {
          const duration = this.wavesurfer?.getDuration() || 0;
          if (duration > 0) {
            this.onSeek(newTime);
          }
        }
      });
    } catch (error) {
      console.error('Failed to load WaveSurfer:', error);
    }
  }

  setSeekCallback(callback: (time: number) => void): void {
    this.onSeek = callback;
  }

  async loadAudio(url: string): Promise<WaveformData | null> {
    if (!this.wavesurfer) return null;

    try {
      await this.wavesurfer.load(url);
      const duration = this.wavesurfer.getDuration();
      
      return {
        peaks: [], // Wavesurfer handles peaks internally
        duration,
        sampleRate: 44100,
      };
    } catch (error) {
      console.error('Error loading audio:', error);
      return null;
    }
  }

  setProgress(progress: number): void {
    if (this.wavesurfer && this.wavesurfer.getDuration() > 0) {
      this.wavesurfer.setTime(progress * this.wavesurfer.getDuration());
    }
  }

  seek(time: number): void {
    if (this.wavesurfer) {
      this.wavesurfer.setTime(time);
    }
  }

  destroy(): void {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
  }
}

// ============ FREQUENCY VISUALIZER ============

export interface FrequencyOptions {
  width?: number;
  height?: number;
  barCount?: number;
  barGap?: number;
  barColor?: string;
  peakColor?: string;
  backgroundColor?: string;
  smoothing?: number;
  responsive?: boolean;
}

export class FrequencyVisualizer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioEngine: AudioEngine;
  private options: Required<FrequencyOptions>;
  private animationFrame: number | null = null;
  private peaks: number[] = [];
  private peakDecay: number = 0.02;

  constructor(container: HTMLElement, audioEngine: AudioEngine, options: FrequencyOptions = {}) {
    this.container = container;
    this.audioEngine = audioEngine;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;

    this.options = {
      width: options.width || container.clientWidth || 400,
      height: options.height || 100,
      barCount: options.barCount || 64,
      barGap: options.barGap || 2,
      barColor: options.barColor || '#9333ea',
      peakColor: options.peakColor || '#fbbf24',
      backgroundColor: options.backgroundColor || 'transparent',
      smoothing: options.smoothing || 0.8,
      responsive: options.responsive !== false,
    };

    this.peaks = new Array(this.options.barCount).fill(0);
    this.setupCanvas();
  }

  private setupCanvas(): void {
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    this.canvas.style.width = '100%';
    this.canvas.style.height = `${this.options.height}px`;
    this.container.appendChild(this.canvas);

    if (this.options.responsive) {
      const resizeObserver = new ResizeObserver(() => {
        this.options.width = this.container.clientWidth;
        this.canvas.width = this.options.width;
      });
      resizeObserver.observe(this.container);
    }
  }

  start(): void {
    if (this.animationFrame) return;
    this.animate();
  }

  stop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.clear();
  }

  private animate(): void {
    this.render();
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  private render(): void {
    const { width, height, barCount, barGap, barColor, peakColor, backgroundColor } = this.options;

    // Clear canvas
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, width, height);

    const frequencyData = this.audioEngine.getFrequencyData();
    if (frequencyData.length === 0) {
      this.drawIdleState();
      return;
    }

    const barWidth = (width - (barCount - 1) * barGap) / barCount;
    const step = Math.floor(frequencyData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      // Get average frequency for this bar
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += frequencyData[i * step + j];
      }
      const average = sum / step;
      const normalizedValue = average / 255;

      // Calculate bar height
      const barHeight = Math.max(2, normalizedValue * height * 0.95);
      const x = i * (barWidth + barGap);
      const y = height - barHeight;

      // Update peaks
      if (barHeight > this.peaks[i]) {
        this.peaks[i] = barHeight;
      } else {
        this.peaks[i] = Math.max(0, this.peaks[i] - this.peakDecay * height);
      }

      // Draw bar with gradient
      const gradient = this.ctx.createLinearGradient(x, y, x, height);
      gradient.addColorStop(0, barColor);
      gradient.addColorStop(1, this.adjustColor(barColor, -30));
      this.ctx.fillStyle = gradient;

      this.drawRoundedRect(x, y, barWidth, barHeight, 2);

      // Draw peak
      if (this.peaks[i] > 2) {
        this.ctx.fillStyle = peakColor;
        this.ctx.fillRect(x, height - this.peaks[i] - 2, barWidth, 2);
      }
    }
  }

  private drawIdleState(): void {
    const { width, height, barCount, barGap, barColor } = this.options;
    const barWidth = (width - (barCount - 1) * barGap) / barCount;

    this.ctx.fillStyle = barColor;
    this.ctx.globalAlpha = 0.2;

    for (let i = 0; i < barCount; i++) {
      const barHeight = 4;
      const x = i * (barWidth + barGap);
      const y = height - barHeight;
      this.ctx.fillRect(x, y, barWidth, barHeight);
    }

    this.ctx.globalAlpha = 1;
  }

  private drawRoundedRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h);
    this.ctx.lineTo(x, y + h);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private adjustColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
  }

  private clear(): void {
    this.ctx.fillStyle = this.options.backgroundColor;
    this.ctx.fillRect(0, 0, this.options.width, this.options.height);
  }

  destroy(): void {
    this.stop();
    this.canvas.remove();
  }
}

// ============ SCRUB BAR ============

export interface ScrubBarOptions {
  height?: number;
  trackColor?: string;
  progressColor?: string;
  handleColor?: string;
  handleSize?: number;
}

export class ScrubBar {
  private container: HTMLElement;
  private track: HTMLElement;
  private progress: HTMLElement;
  private handle: HTMLElement;
  private currentTime: number = 0;
  private duration: number = 0;
  private isDragging: boolean = false;
  private onSeek?: (time: number) => void;
  private options: Required<ScrubBarOptions>;

  constructor(container: HTMLElement, options: ScrubBarOptions = {}) {
    this.container = container;
    this.options = {
      height: options.height || 6,
      trackColor: options.trackColor || '#333333',
      progressColor: options.progressColor || '#9333ea',
      handleColor: options.handleColor || '#ffffff',
      handleSize: options.handleSize || 14,
    };

    this.track = this.createTrack();
    this.progress = this.createProgress();
    this.handle = this.createHandle();

    this.setupEvents();
  }

  private createTrack(): HTMLElement {
    const track = document.createElement('div');
    track.className = 'scrub-track';
    track.style.cssText = `
      position: relative;
      width: 100%;
      height: ${this.options.height}px;
      background: ${this.options.trackColor};
      border-radius: ${this.options.height / 2}px;
      cursor: pointer;
    `;
    this.container.appendChild(track);
    return track;
  }

  private createProgress(): HTMLElement {
    const progress = document.createElement('div');
    progress.className = 'scrub-progress';
    progress.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      background: ${this.options.progressColor};
      border-radius: ${this.options.height / 2}px;
      width: 0%;
      transition: width 0.1s linear;
    `;
    this.track.appendChild(progress);
    return progress;
  }

  private createHandle(): HTMLElement {
    const handle = document.createElement('div');
    handle.className = 'scrub-handle';
    handle.style.cssText = `
      position: absolute;
      top: 50%;
      left: 0%;
      width: ${this.options.handleSize}px;
      height: ${this.options.handleSize}px;
      background: ${this.options.handleColor};
      border-radius: 50%;
      transform: translate(-50%, -50%);
      cursor: grab;
      opacity: 0;
      transition: opacity 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `;
    this.track.appendChild(handle);

    // Show handle on hover
    this.track.addEventListener('mouseenter', () => {
      handle.style.opacity = '1';
    });
    this.track.addEventListener('mouseleave', () => {
      if (!this.isDragging) {
        handle.style.opacity = '0';
      }
    });

    return handle;
  }

  private setupEvents(): void {
    this.track.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.handle.style.cursor = 'grabbing';
      this.handle.style.opacity = '1';
      this.handleSeek(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.handleSeek(e);
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.handle.style.cursor = 'grab';
        this.handle.style.opacity = '0';
      }
    });

    this.track.addEventListener('click', (e) => {
      this.handleSeek(e);
    });
  }

  private handleSeek(e: MouseEvent): void {
    if (!this.onSeek || this.duration === 0) return;

    const rect = this.track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    const time = progress * this.duration;

    this.onSeek(time);
  }

  setSeekCallback(callback: (time: number) => void): void {
    this.onSeek = callback;
  }

  setDuration(duration: number): void {
    this.duration = duration;
  }

  setCurrentTime(time: number): void {
    this.currentTime = time;
    const progress = this.duration > 0 ? (time / this.duration) * 100 : 0;
    this.progress.style.width = `${progress}%`;
    this.handle.style.left = `${progress}%`;
  }

  destroy(): void {
    this.track.remove();
  }
}

// ============ TIME DISPLAY ============

export class TimeDisplay {
  private container: HTMLElement;
  private currentEl: HTMLElement;
  private durationEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.style.cssText = `
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #888;
      font-family: monospace;
      margin-top: 4px;
    `;

    this.currentEl = document.createElement('span');
    this.currentEl.textContent = '0:00';

    this.durationEl = document.createElement('span');
    this.durationEl.textContent = '0:00';

    this.container.appendChild(this.currentEl);
    this.container.appendChild(this.durationEl);
  }

  setCurrentTime(time: number): void {
    this.currentEl.textContent = this.formatTime(time);
  }

  setDuration(duration: number): void {
    this.durationEl.textContent = this.formatTime(duration);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  destroy(): void {
    this.container.remove();
  }
}
