/**
 * RhymeBook Beat Player
 * Complete audio player component with visualizations
 */

import { getAudioEngine, AudioEngine, AudioState, WaveformData } from './audio-engine.js';
import { WaveformVisualizer, FrequencyVisualizer, ScrubBar, TimeDisplay } from './visualizers.js';

export interface BeatInfo {
  id: string;
  title: string;
  producer: string;
  bpm: number;
  key: string;
  duration: number;
  filePath: string | null;
  favorite: boolean;
}

export interface BeatPlayerOptions {
  showWaveform?: boolean;
  showFrequency?: boolean;
  showScrubBar?: boolean;
  showTimeDisplay?: boolean;
  showControls?: boolean;
  showInfo?: boolean;
  autoPlay?: boolean;
  compact?: boolean;
}

export class BeatPlayer {
  private container: HTMLElement;
  private audioEngine: AudioEngine;
  private beat: BeatInfo | null = null;
  private options: Required<BeatPlayerOptions>;

  // Components
  private waveformVisualizer: WaveformVisualizer | null = null;
  private frequencyVisualizer: FrequencyVisualizer | null = null;
  private scrubBar: ScrubBar | null = null;
  private timeDisplay: TimeDisplay | null = null;

  // UI Elements
  private playerEl: HTMLElement;
  private infoEl: HTMLElement | null = null;
  private controlsEl: HTMLElement | null = null;
  private waveformContainer: HTMLElement | null = null;
  private frequencyContainer: HTMLElement | null = null;
  private scrubContainer: HTMLElement | null = null;
  private timeContainer: HTMLElement | null = null;

  // Buttons
  private playBtn: HTMLButtonElement | null = null;
  private stopBtn: HTMLButtonElement | null = null;
  private volumeSlider: HTMLInputElement | null = null;
  private vocalSlider: HTMLInputElement | null = null;
  private favoriteBtn: HTMLButtonElement | null = null;

  // Callbacks
  private onFavoriteToggle?: (beatId: string) => void;
  private onPlayStart?: (beatId: string) => void;
  private onPlayEnd?: (beatId: string) => void;

  constructor(container: HTMLElement, options: BeatPlayerOptions = {}) {
    this.container = container;
    this.audioEngine = getAudioEngine();

    this.options = {
      showWaveform: options.showWaveform !== false,
      showFrequency: options.showFrequency !== false,
      showScrubBar: options.showScrubBar !== false,
      showTimeDisplay: options.showTimeDisplay !== false,
      showControls: options.showControls !== false,
      showInfo: options.showInfo !== false,
      autoPlay: options.autoPlay || false,
      compact: options.compact || false,
    };

    this.playerEl = this.createPlayerElement();
    this.setupStateListener();
  }

  private createPlayerElement(): HTMLElement {
    const player = document.createElement('div');
    player.className = 'beat-player';
    player.style.cssText = `
      background: var(--bg-card, #1e1e1e);
      border: 1px solid var(--border-color, #333);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // Info section
    if (this.options.showInfo) {
      this.infoEl = this.createInfoSection();
      player.appendChild(this.infoEl);
    }

    // Waveform
    if (this.options.showWaveform) {
      this.waveformContainer = document.createElement('div');
      this.waveformContainer.className = 'waveform-container';
      this.waveformContainer.style.cssText = `
        height: ${this.options.compact ? 40 : 80}px;
        border-radius: 8px;
        overflow: hidden;
      `;
      player.appendChild(this.waveformContainer);

      this.waveformVisualizer = new WaveformVisualizer(this.waveformContainer, {
        height: this.options.compact ? 40 : 80,
      });
    }

    // Scrub bar
    if (this.options.showScrubBar) {
      this.scrubContainer = document.createElement('div');
      this.scrubContainer.className = 'scrub-container';
      player.appendChild(this.scrubContainer);

      this.scrubBar = new ScrubBar(this.scrubContainer);
      this.scrubBar.setSeekCallback((time) => {
        this.audioEngine.seek(time);
      });
    }

    // Time display
    if (this.options.showTimeDisplay) {
      this.timeContainer = document.createElement('div');
      this.timeContainer.className = 'time-container';
      player.appendChild(this.timeContainer);

      this.timeDisplay = new TimeDisplay(this.timeContainer);
    }

    // Controls
    if (this.options.showControls) {
      this.controlsEl = this.createControlsSection();
      player.appendChild(this.controlsEl);
    }

    // Frequency visualizer
    if (this.options.showFrequency && !this.options.compact) {
      this.frequencyContainer = document.createElement('div');
      this.frequencyContainer.className = 'frequency-container';
      this.frequencyContainer.style.cssText = `
        height: 60px;
        border-radius: 8px;
        overflow: hidden;
      `;
      player.appendChild(this.frequencyContainer);

      this.frequencyVisualizer = new FrequencyVisualizer(
        this.frequencyContainer,
        this.audioEngine,
        { height: 60 }
      );
    }

    this.container.appendChild(player);
    return player;
  }

  private createInfoSection(): HTMLElement {
    const info = document.createElement('div');
    info.className = 'beat-info';
    info.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    `;

    info.innerHTML = `
      <div class="beat-details">
        <div class="beat-title" style="font-size: 16px; font-weight: 600; color: var(--text-primary, #fff);">
          No beat selected
        </div>
        <div class="beat-meta" style="font-size: 12px; color: var(--text-muted, #666); margin-top: 4px;">
          Select a beat to play
        </div>
      </div>
    `;

    // Favorite button
    this.favoriteBtn = document.createElement('button');
    this.favoriteBtn.className = 'favorite-btn';
    this.favoriteBtn.innerHTML = '☆';
    this.favoriteBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--text-muted, #666);
      transition: all 0.2s ease;
    `;
    this.favoriteBtn.addEventListener('click', () => {
      if (this.beat && this.onFavoriteToggle) {
        this.onFavoriteToggle(this.beat.id);
      }
    });
    info.appendChild(this.favoriteBtn);

    return info;
  }

  private createControlsSection(): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'beat-controls';
    controls.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    // Play/Pause button
    this.playBtn = document.createElement('button');
    this.playBtn.className = 'play-btn';
    this.playBtn.innerHTML = '▶';
    this.playBtn.style.cssText = `
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: var(--accent-primary, #9333ea);
      color: white;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    `;
    this.playBtn.addEventListener('click', () => this.togglePlay());
    controls.appendChild(this.playBtn);

    // Stop button
    this.stopBtn = document.createElement('button');
    this.stopBtn.className = 'stop-btn';
    this.stopBtn.innerHTML = '⏹';
    this.stopBtn.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid var(--border-color, #333);
      background: transparent;
      color: var(--text-secondary, #888);
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    `;
    this.stopBtn.addEventListener('click', () => this.stop());
    controls.appendChild(this.stopBtn);

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    controls.appendChild(spacer);

    // Vocal removal control
    const vocalContainer = document.createElement('div');
    vocalContainer.className = 'vocal-control';
    vocalContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      background: var(--bg-tertiary, #252525);
      border-radius: 8px;
    `;

    const vocalIcon = document.createElement('span');
    vocalIcon.textContent = '🎤';
    vocalIcon.style.fontSize = '14px';
    vocalIcon.title = 'Vocal Removal';
    vocalContainer.appendChild(vocalIcon);

    const vocalLabel = document.createElement('span');
    vocalLabel.textContent = 'Vocals';
    vocalLabel.style.cssText = `
      font-size: 11px;
      color: var(--text-muted, #666);
      min-width: 35px;
    `;
    vocalContainer.appendChild(vocalLabel);

    this.vocalSlider = document.createElement('input');
    this.vocalSlider.type = 'range';
    this.vocalSlider.min = '0';
    this.vocalSlider.max = '100';
    this.vocalSlider.value = '0';
    this.vocalSlider.title = 'Vocal Removal (works best with stereo tracks with centered vocals)';
    this.vocalSlider.style.cssText = `
      width: 60px;
      accent-color: var(--accent-gold, #fbbf24);
    `;
    this.vocalSlider.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.audioEngine.setVocalRemoval(value / 100);
      vocalLabel.textContent = value === 0 ? 'Full' : value === 100 ? 'Off' : `${value}%`;
      vocalIcon.textContent = value === 0 ? '🎤' : value === 100 ? '🎸' : '🎤';
    });
    vocalContainer.appendChild(this.vocalSlider);

    controls.appendChild(vocalContainer);

    // Effects toggle button
    const effectsBtn = document.createElement('button');
    effectsBtn.className = 'effects-toggle-btn';
    effectsBtn.innerHTML = '🎛️';
    effectsBtn.title = 'Toggle Audio Effects';
    effectsBtn.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid var(--border-color, #333);
      background: transparent;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    effectsBtn.addEventListener('click', () => {
      this.toggleEffectsPanel();
    });
    controls.appendChild(effectsBtn);

    // Volume control
    const volumeContainer = document.createElement('div');
    volumeContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    const volumeIcon = document.createElement('span');
    volumeIcon.textContent = '🔊';
    volumeIcon.style.fontSize = '16px';
    volumeContainer.appendChild(volumeIcon);

    this.volumeSlider = document.createElement('input');
    this.volumeSlider.type = 'range';
    this.volumeSlider.min = '0';
    this.volumeSlider.max = '100';
    this.volumeSlider.value = '80';
    this.volumeSlider.style.cssText = `
      width: 80px;
      accent-color: var(--accent-primary, #9333ea);
    `;
    this.volumeSlider.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.audioEngine.setVolume(value / 100);
      volumeIcon.textContent = value === 0 ? '🔇' : value < 50 ? '🔉' : '🔊';
    });
    volumeContainer.appendChild(this.volumeSlider);

    controls.appendChild(volumeContainer);

    return controls;
  }

  private setupStateListener(): void {
    this.audioEngine.onStateChange((state) => {
      this.updateUI(state);
    });
  }

  private updateUI(state: AudioState): void {
    // Update play button
    if (this.playBtn) {
      this.playBtn.innerHTML = state.isPlaying && !state.isPaused ? '⏸' : '▶';
    }

    // Update time display
    if (this.timeDisplay) {
      this.timeDisplay.setCurrentTime(state.currentTime);
      this.timeDisplay.setDuration(state.duration);
    }

    // Update scrub bar
    if (this.scrubBar) {
      this.scrubBar.setCurrentTime(state.currentTime);
      this.scrubBar.setDuration(state.duration);
    }

    // Update waveform progress
    if (this.waveformVisualizer && state.duration > 0) {
      this.waveformVisualizer.setProgress(state.currentTime / state.duration);
    }

    // Start/stop frequency visualizer
    if (this.frequencyVisualizer) {
      if (state.isPlaying && !state.isPaused) {
        this.frequencyVisualizer.start();
      } else {
        this.frequencyVisualizer.stop();
      }
    }

    // Handle play end
    if (!state.isPlaying && !state.isPaused && this.beat && this.onPlayEnd) {
      this.onPlayEnd(this.beat.id);
    }
  }

  async loadBeat(beat: BeatInfo): Promise<boolean> {
    this.beat = beat;

    // Update info display
    if (this.infoEl) {
      const titleEl = this.infoEl.querySelector('.beat-title');
      const metaEl = this.infoEl.querySelector('.beat-meta');

      if (titleEl) titleEl.textContent = beat.title;
      if (metaEl) {
        const parts = [];
        if (beat.producer) parts.push(`by ${beat.producer}`);
        if (beat.bpm > 0) parts.push(`${beat.bpm} BPM`);
        if (beat.key) parts.push(beat.key);
        metaEl.textContent = parts.join(' • ') || 'No metadata';
      }

      // Update favorite button
      if (this.favoriteBtn) {
        this.favoriteBtn.innerHTML = beat.favorite ? '★' : '☆';
        this.favoriteBtn.style.color = beat.favorite ? '#fbbf24' : 'var(--text-muted, #666)';
      }
    }

    // Load audio file
    if (!beat.filePath) {
      console.warn('No file path for beat:', beat.id);
      return false;
    }

    // Construct audio URL (server endpoint)
    const audioUrl = `/audio/${beat.id}`;

    const waveformData = await this.audioEngine.loadAudio(audioUrl);
    if (!waveformData) {
      return false;
    }

    // Update waveform visualizer (Wavesurfer.js loads audio directly)
    if (this.waveformVisualizer) {
      await this.waveformVisualizer.loadAudio(audioUrl);
    }

    // Update time display
    if (this.timeDisplay) {
      this.timeDisplay.setDuration(waveformData.duration);
    }

    // Auto play if enabled
    if (this.options.autoPlay) {
      this.play();
    }

    return true;
  }

  play(): void {
    this.audioEngine.play();
    if (this.beat && this.onPlayStart) {
      this.onPlayStart(this.beat.id);
    }
  }

  pause(): void {
    this.audioEngine.pause();
  }

  togglePlay(): void {
    const state = this.audioEngine.getState();
    if (state.isPlaying && !state.isPaused) {
      this.pause();
    } else {
      this.play();
    }
  }

  stop(): void {
    this.audioEngine.stop();
  }

  setVolume(volume: number): void {
    this.audioEngine.setVolume(volume);
    if (this.volumeSlider) {
      this.volumeSlider.value = String(Math.round(volume * 100));
    }
  }

  onFavorite(callback: (beatId: string) => void): void {
    this.onFavoriteToggle = callback;
  }

  onPlay(callback: (beatId: string) => void): void {
    this.onPlayStart = callback;
  }

  onEnded(callback: (beatId: string) => void): void {
    this.onPlayEnd = callback;
  }

  getCurrentBeat(): BeatInfo | null {
    return this.beat;
  }

  isPlaying(): boolean {
    return this.audioEngine.isPlaying();
  }

  private effectsPanel: HTMLElement | null = null;
  private effectsVisible: boolean = false;

  private toggleEffectsPanel(): void {
    if (this.effectsPanel) {
      this.effectsVisible = !this.effectsVisible;
      this.effectsPanel.style.display = this.effectsVisible ? 'block' : 'none';
      return;
    }

    // Create effects panel
    this.effectsPanel = document.createElement('div');
    this.effectsPanel.className = 'effects-panel';
    this.effectsPanel.style.cssText = `
      background: var(--bg-secondary, #1a1a1a);
      border: 1px solid var(--border-color, #333);
      border-radius: 12px;
      padding: 16px;
      margin-top: 12px;
    `;

    this.effectsPanel.innerHTML = `
      <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary, #fff);">🎛️ Audio Effects</h4>
      
      <div class="effect-group">
        <label style="font-size: 12px; color: var(--text-muted, #666);">Reverb</label>
        <input type="range" class="effect-slider" data-effect="reverb" min="0" max="100" value="0">
      </div>
      
      <div class="effect-group">
        <label style="font-size: 12px; color: var(--text-muted, #666);">Delay</label>
        <input type="range" class="effect-slider" data-effect="delay" min="0" max="100" value="0">
      </div>
      
      <div class="effect-group">
        <label style="font-size: 12px; color: var(--text-muted, #666);">Distortion</label>
        <input type="range" class="effect-slider" data-effect="distortion" min="0" max="100" value="0">
      </div>
      
      <div class="effect-group">
        <label style="font-size: 12px; color: var(--text-muted, #666);">EQ - Low</label>
        <input type="range" class="effect-slider" data-effect="eq-low" min="-12" max="12" value="0">
      </div>
      
      <div class="effect-group">
        <label style="font-size: 12px; color: var(--text-muted, #666);">EQ - Mid</label>
        <input type="range" class="effect-slider" data-effect="eq-mid" min="-12" max="12" value="0">
      </div>
      
      <div class="effect-group">
        <label style="font-size: 12px; color: var(--text-muted, #666);">EQ - High</label>
        <input type="range" class="effect-slider" data-effect="eq-high" min="-12" max="12" value="0">
      </div>
      
      <button class="reset-effects-btn" style="
        margin-top: 12px;
        padding: 6px 12px;
        background: var(--bg-tertiary, #252525);
        border: 1px solid var(--border-color, #333);
        border-radius: 6px;
        color: var(--text-secondary, #888);
        font-size: 12px;
        cursor: pointer;
      ">Reset All</button>
    `;

    // Add event listeners
    this.effectsPanel.querySelectorAll('.effect-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const effect = target.getAttribute('data-effect')!;
        const value = parseInt(target.value);
        this.updateEffect(effect, value);
      });
    });

    this.effectsPanel.querySelector('.reset-effects-btn')?.addEventListener('click', () => {
      this.resetEffects();
    });

    this.playerEl.appendChild(this.effectsPanel);
    this.effectsVisible = true;
  }

  private updateEffect(effect: string, value: number): void {
    switch (effect) {
      case 'reverb':
        this.audioEngine.setEffects({ reverb: value / 100 });
        break;
      case 'delay':
        this.audioEngine.setEffects({ delay: value / 100 });
        break;
      case 'distortion':
        this.audioEngine.setEffects({ distortion: value / 100 });
        break;
      case 'eq-low':
        this.audioEngine.setEffects({ eq: { low: value, mid: 0, high: 0 } });
        break;
      case 'eq-mid':
        this.audioEngine.setEffects({ eq: { low: 0, mid: value, high: 0 } });
        break;
      case 'eq-high':
        this.audioEngine.setEffects({ eq: { low: 0, mid: 0, high: value } });
        break;
    }
  }

  private resetEffects(): void {
    this.audioEngine.resetEffects();
    
    // Reset all sliders
    this.effectsPanel?.querySelectorAll('.effect-slider').forEach(slider => {
      (slider as HTMLInputElement).value = '0';
    });
  }

  destroy(): void {
    this.waveformVisualizer?.destroy();
    this.frequencyVisualizer?.destroy();
    this.scrubBar?.destroy();
    this.timeDisplay?.destroy();
    this.playerEl.remove();
  }
}

// ============ COMPACT BEAT CARD ============

export class BeatCard {
  private container: HTMLElement;
  private beat: BeatInfo;
  private player: BeatPlayer | null = null;
  private isExpanded: boolean = false;
  private onFavoriteToggle?: (beatId: string) => void;
  private onPlay?: (beat: BeatInfo) => void;

  constructor(container: HTMLElement, beat: BeatInfo) {
    this.container = container;
    this.beat = beat;
    this.render();
  }

  private render(): void {
    const card = document.createElement('div');
    card.className = 'beat-card';
    card.style.cssText = `
      background: var(--bg-card, #1e1e1e);
      border: 1px solid var(--border-color, #333);
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.2s ease;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    `;

    const info = document.createElement('div');
    info.innerHTML = `
      <div style="font-size: 14px; font-weight: 600; color: var(--text-primary, #fff);">
        ${this.beat.title}
      </div>
      <div style="font-size: 11px; color: var(--text-muted, #666); margin-top: 2px;">
        ${this.beat.producer} • ${this.beat.bpm} BPM • ${this.beat.key}
      </div>
    `;
    header.appendChild(info);

    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Play button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶';
    playBtn.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: var(--accent-primary, #9333ea);
      color: white;
      font-size: 12px;
      cursor: pointer;
    `;
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onPlay) {
        this.onPlay(this.beat);
      }
    });
    actions.appendChild(playBtn);

    // Favorite button
    const favBtn = document.createElement('button');
    favBtn.innerHTML = this.beat.favorite ? '★' : '☆';
    favBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: ${this.beat.favorite ? '#fbbf24' : 'var(--text-muted, #666)'};
    `;
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onFavoriteToggle) {
        this.onFavoriteToggle(this.beat.id);
      }
    });
    actions.appendChild(favBtn);

    header.appendChild(actions);
    card.appendChild(header);

    // Player container (hidden by default)
    const playerContainer = document.createElement('div');
    playerContainer.className = 'player-container';
    playerContainer.style.display = 'none';
    card.appendChild(playerContainer);

    // Toggle expansion on header click
    header.addEventListener('click', () => {
      this.isExpanded = !this.isExpanded;
      playerContainer.style.display = this.isExpanded ? 'block' : 'none';

      if (this.isExpanded && !this.player) {
        this.player = new BeatPlayer(playerContainer, {
          compact: true,
          showFrequency: false,
        });
        this.player.loadBeat(this.beat);
      }
    });

    this.container.appendChild(card);
  }

  onFavoriteClick(callback: (beatId: string) => void): void {
    this.onFavoriteToggle = callback;
  }

  onPlayClick(callback: (beat: BeatInfo) => void): void {
    this.onPlay = callback;
  }

  updateBeat(beat: BeatInfo): void {
    this.beat = beat;
    // Re-render would go here
  }

  destroy(): void {
    this.player?.destroy();
  }
}
