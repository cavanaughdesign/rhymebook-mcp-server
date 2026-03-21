import { App } from '@modelcontextprotocol/ext-apps';
import { BeatPlayer, BeatCard, BeatInfo } from './beat-player.js';

// Types
interface SongSection {
  id: string;
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'hook';
  content: string;
}

interface RhymeResult {
  word: string;
  rhymes: {
    perfect: string[];
    slant: string[];
    multi: string[];
  };
  totalResults: number;
}

interface SyllableResult {
  lines: Array<{
    lineNumber: number;
    text: string;
    syllables: number;
  }>;
  totalSyllables: number;
  averageSyllables: number;
  lineCount: number;
}

interface FlowResult {
  pattern: number[];
  visualPattern: string;
  stats: {
    maxSyllables: number;
    minSyllables: number;
    variance: number;
    consistency: string;
  };
  lines: number;
}

interface Beat {
  id: string;
  title: string;
  producer: string;
  bpm: number;
  key: string;
  genre: string[];
  mood: string[];
  duration: number;
  energy: number;
  tags: string[];
  favorite: boolean;
  file_path?: string | null;
  waveform?: string;
  energyLabel?: string;
  matchScore?: number;
}

interface Song {
  id: string;
  title: string;
  status: 'writing' | 'recording' | 'mixing' | 'mastering' | 'released';
  progress: number;
  createdAt: string;
  updatedAt: string;
  collaborators: string[];
  notes: string;
  sections?: Array<{ type: string; content: string }>;
}

interface RecordingSession {
  id: string;
  songId: string;
  songTitle: string;
  date: string;
  studio: string;
  engineer: string;
  duration: number;
  takes: Array<{
    id: number;
    take_number: number;
    rating: number;
    notes: string;
    timestamp: string;
    duration: number;
  }>;
  notes: string;
  status: 'scheduled' | 'in-progress' | 'completed';
}

interface Collaborator {
  id: string;
  name: string;
  role: 'artist' | 'producer' | 'engineer' | 'writer' | 'feature';
  contact: string;
  songs: string[];
}

// Initialize MCP App
const app = new App({
  name: 'RhymeBook',
  version: '1.0.0',
});

// Helper to extract text content from tool results
function getTextContent(result: any): string {
  const textItem = result.content?.find((c: any) => c.type === 'text');
  if (textItem && 'text' in textItem) {
    return textItem.text;
  }
  throw new Error('No text content in result');
}

// State
let sections: SongSection[] = [
  { id: 'section-1', type: 'verse', content: '' },
  { id: 'section-2', type: 'chorus', content: '' },
];

let currentExportFormat: 'text' | 'markdown' | 'json' = 'text';
let currentExportContent = '';

// Audio player instance
let mainPlayer: BeatPlayer | null = null;
let beatCards: BeatCard[] = [];

// DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');
const tabContents = document.querySelectorAll('.tab-content');
const sectionsContainer = document.getElementById('sections-container')!;
const songTitleInput = document.getElementById('song-title') as HTMLInputElement;
const rhymeInput = document.getElementById('rhyme-input') as HTMLInputElement;
const rhymeResults = document.getElementById('rhyme-results')!;
const thesaurusInput = document.getElementById('thesaurus-input') as HTMLInputElement;
const thesaurusResults = document.getElementById('thesaurus-results')!;
const flowBars = document.getElementById('flow-bars')!;
const flowConsistency = document.getElementById('flow-consistency')!;
const exportModal = document.getElementById('export-modal')!;
const exportContent = document.getElementById('export-content')!;
const toastContainer = document.getElementById('toast-container')!;

// Tab Navigation
navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.getAttribute('data-tab')!;

    navTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === targetTab) {
        content.classList.add('active');
      }
    });

    // Load data for the active tab
    if (targetTab === 'dashboard') {
      loadDashboard();
    } else if (targetTab === 'session-tracker') {
      loadSessionData();
    } else if (targetTab === 'beat-explorer') {
      loadBeats();
    }
  });
});

// Render Sections
function renderSections() {
  sectionsContainer.innerHTML = sections.map(section => `
    <div class="section" data-id="${section.id}">
      <div class="section-header">
        <div class="section-type">
          <span class="section-type-badge">${section.type}</span>
          <span class="section-syllables" id="syllables-${section.id}">0 syllables</span>
        </div>
        <div class="section-actions">
          <button class="move-up" title="Move Up">↑</button>
          <button class="move-down" title="Move Down">↓</button>
          <button class="delete-section" title="Delete">×</button>
        </div>
      </div>
      <div class="section-content">
        <textarea
          class="section-textarea"
          data-id="${section.id}"
          placeholder="Write your ${section.type} here..."
        >${section.content}</textarea>
      </div>
    </div>
  `).join('');

  // Add event listeners
  document.querySelectorAll('.section-textarea').forEach(textarea => {
    textarea.addEventListener('input', handleSectionInput);
  });

  document.querySelectorAll('.move-up').forEach(btn => {
    btn.addEventListener('click', handleMoveUp);
  });

  document.querySelectorAll('.move-down').forEach(btn => {
    btn.addEventListener('click', handleMoveDown);
  });

  document.querySelectorAll('.delete-section').forEach(btn => {
    btn.addEventListener('click', handleDeleteSection);
  });

  updateSyllableCounts();
}

// Handle Section Input
async function handleSectionInput(e: Event) {
  const textarea = e.target as HTMLTextAreaElement;
  const sectionId = textarea.getAttribute('data-id')!;
  const section = sections.find(s => s.id === sectionId);
  if (section) {
    section.content = textarea.value;
  }

  await updateSyllableCounts();
  await updateFlowVisualization();
}

// Update Syllable Counts
async function updateSyllableCounts() {
  const allText = sections.map(s => s.content).join('\n');
  if (!allText.trim()) {
    document.getElementById('total-syllables')!.textContent = '0';
    document.getElementById('avg-syllables')!.textContent = '0';
    document.getElementById('line-count')!.textContent = '0';
    return;
  }

  try {
    const result = await app.callServerTool({
      name: 'count-syllables',
      arguments: { text: allText },
    });

    const data: SyllableResult = JSON.parse(getTextContent(result));

    document.getElementById('total-syllables')!.textContent = data.totalSyllables.toString();
    document.getElementById('avg-syllables')!.textContent = data.averageSyllables.toString();
    document.getElementById('line-count')!.textContent = data.lineCount.toString();

    // Update per-section syllable counts
    let lineIndex = 0;
    sections.forEach(section => {
      const sectionLines = section.content.split('\n').filter(l => l.trim()).length;
      const sectionSyllables = data.lines
        .slice(lineIndex, lineIndex + sectionLines)
        .reduce((sum, l) => sum + l.syllables, 0);

      const syllableEl = document.getElementById(`syllables-${section.id}`);
      if (syllableEl) {
        syllableEl.textContent = `${sectionSyllables} syllables`;
      }
      lineIndex += sectionLines;
    });
  } catch (error) {
    console.error('Error counting syllables:', error);
  }
}

// Update Flow Visualization
async function updateFlowVisualization() {
  const allText = sections.map(s => s.content).join('\n');
  if (!allText.trim()) {
    flowBars.innerHTML = '';
    flowConsistency.textContent = '-';
    return;
  }

  try {
    const result = await app.callServerTool({
      name: 'analyze-flow',
      arguments: { lyrics: allText },
    });

    const data: FlowResult = JSON.parse(getTextContent(result));

    // Render flow bars
    const maxPattern = Math.max(...data.pattern);
    flowBars.innerHTML = data.pattern.map(value => {
      const height = maxPattern > 0 ? (value / maxPattern) * 100 : 0;
      return `<div class="flow-bar" style="height: ${height}%"></div>`;
    }).join('');

    flowConsistency.textContent = data.stats.consistency;
  } catch (error) {
    console.error('Error analyzing flow:', error);
  }
}

// Handle Move Up
function handleMoveUp(e: Event) {
  const sectionEl = (e.target as HTMLElement).closest('.section')!;
  const sectionId = sectionEl.getAttribute('data-id')!;
  const index = sections.findIndex(s => s.id === sectionId);

  if (index > 0) {
    [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
    renderSections();
  }
}

// Handle Move Down
function handleMoveDown(e: Event) {
  const sectionEl = (e.target as HTMLElement).closest('.section')!;
  const sectionId = sectionEl.getAttribute('data-id')!;
  const index = sections.findIndex(s => s.id === sectionId);

  if (index < sections.length - 1) {
    [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
    renderSections();
  }
}

// Handle Delete Section
function handleDeleteSection(e: Event) {
  const sectionEl = (e.target as HTMLElement).closest('.section')!;
  const sectionId = sectionEl.getAttribute('data-id')!;

  if (sections.length > 1) {
    sections = sections.filter(s => s.id !== sectionId);
    renderSections();
  } else {
    showToast('Cannot delete the last section', 'warning');
  }
}

// Add Section
document.getElementById('btn-add-section')!.addEventListener('click', () => {
  const sectionType = (document.getElementById('section-type') as HTMLSelectElement).value as SongSection['type'];
  const newSection: SongSection = {
    id: `section-${Date.now()}`,
    type: sectionType,
    content: '',
  };
  sections.push(newSection);
  renderSections();
});

// Find Rhymes
document.getElementById('btn-find-rhymes')!.addEventListener('click', async () => {
  const word = rhymeInput.value.trim();
  if (!word) {
    showToast('Please enter a word', 'warning');
    return;
  }

  try {
    const result = await app.callServerTool({
      name: 'find-rhymes',
      arguments: { word },
    });

    const data: RhymeResult = JSON.parse(getTextContent(result));
    renderRhymeResults(data);
  } catch (error) {
    console.error('Error finding rhymes:', error);
    showToast('Error finding rhymes', 'error');
  }
});

// Render Rhyme Results
function renderRhymeResults(data: RhymeResult) {
  rhymeResults.innerHTML = `
    <div class="rhyme-category">
      <div class="rhyme-category-label">Perfect Rhymes (${data.rhymes.perfect.length})</div>
      <div class="rhyme-words">
        ${data.rhymes.perfect.map(word => `<span class="rhyme-word perfect">${word}</span>`).join('')}
      </div>
    </div>
    <div class="rhyme-category">
      <div class="rhyme-category-label">Slant Rhymes (${data.rhymes.slant.length})</div>
      <div class="rhyme-words">
        ${data.rhymes.slant.map(word => `<span class="rhyme-word slant">${word}</span>`).join('')}
      </div>
    </div>
    <div class="rhyme-category">
      <div class="rhyme-category-label">Multi-Syllable (${data.rhymes.multi.length})</div>
      <div class="rhyme-words">
        ${data.rhymes.multi.map(word => `<span class="rhyme-word multi">${word}</span>`).join('')}
      </div>
    </div>
  `;

  // Add click handlers to rhyme words
  document.querySelectorAll('.rhyme-word').forEach(wordEl => {
    wordEl.addEventListener('click', () => {
      const word = wordEl.textContent!;
      navigator.clipboard.writeText(word);
      showToast(`Copied "${word}" to clipboard`, 'success');
    });
  });
}

// Find Synonyms
document.getElementById('btn-find-synonyms')!.addEventListener('click', async () => {
  const word = thesaurusInput.value.trim();
  if (!word) {
    showToast('Please enter a word', 'warning');
    return;
  }

  try {
    const result = await app.callServerTool({
      name: 'get-synonyms',
      arguments: { word },
    });

    const data = JSON.parse(getTextContent(result));
    renderThesaurusResults(data);
  } catch (error) {
    console.error('Error finding synonyms:', error);
    showToast('Error finding synonyms', 'error');
  }
});

// Render Thesaurus Results
function renderThesaurusResults(data: { word: string; synonyms: string[]; count: number }) {
  thesaurusResults.innerHTML = `
    <div class="rhyme-words">
      ${data.synonyms.map(word => `<span class="rhyme-word">${word}</span>`).join('')}
    </div>
  `;

  // Add click handlers
  document.querySelectorAll('#thesaurus-results .rhyme-word').forEach(wordEl => {
    wordEl.addEventListener('click', () => {
      const word = wordEl.textContent!;
      navigator.clipboard.writeText(word);
      showToast(`Copied "${word}" to clipboard`, 'success');
    });
  });
}

// Save Lyrics
document.getElementById('btn-save-lyrics')!.addEventListener('click', async () => {
  const title = songTitleInput.value || 'Untitled Track';

  try {
    const result = await app.callServerTool({
      name: 'save-lyrics',
      arguments: {
        title,
        sections: sections.map(s => ({ type: s.type, content: s.content })),
      },
    });

    const data = JSON.parse(getTextContent(result));
    showToast(`Saved "${title}" - ${data.totalWords} words`, 'success');

    // Update model context
    await app.updateModelContext({
      content: [{
        type: 'text',
        text: `User saved lyrics for "${title}" with ${sections.length} sections and ${data.totalWords} words`,
      }],
    });
  } catch (error) {
    console.error('Error saving lyrics:', error);
    showToast('Error saving lyrics', 'error');
  }
});

// Export Lyrics
document.getElementById('btn-export-lyrics')!.addEventListener('click', () => {
  exportModal.classList.add('active');
  updateExportPreview('text');
});

// Close Modal (all modals)
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('data-modal');
    if (modalId) {
      document.getElementById(modalId)?.classList.remove('active');
    }
  });
});

// Close modal on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

// Export Format Selection
document.querySelectorAll('.export-option').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.export-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    const format = option.getAttribute('data-format') as 'text' | 'markdown' | 'json';
    updateExportPreview(format);
  });
});

// Update Export Preview
async function updateExportPreview(format: 'text' | 'markdown' | 'json') {
  const title = songTitleInput.value || 'Untitled Track';
  currentExportFormat = format;

  try {
    const result = await app.callServerTool({
      name: 'export-lyrics',
      arguments: {
        title,
        sections: sections.map(s => ({ type: s.type, content: s.content })),
        format,
      },
    });

    const data = JSON.parse(getTextContent(result));
    currentExportContent = data.output;
    exportContent.textContent = data.output;
  } catch (error) {
    console.error('Error exporting lyrics:', error);
  }
}

// Copy Export
document.getElementById('btn-copy-export')!.addEventListener('click', () => {
  navigator.clipboard.writeText(currentExportContent);
  showToast('Copied to clipboard!', 'success');
});

// New Song
document.getElementById('btn-new-song')!.addEventListener('click', () => {
  (document.getElementById('song-id') as HTMLInputElement).value = '';
  songTitleInput.value = 'Untitled Track';
  sections = [
    { id: 'section-1', type: 'verse', content: '' },
    { id: 'section-2', type: 'chorus', content: '' },
  ];
  renderSections();
  showToast('New song created', 'info');
});

// Load Song
document.getElementById('btn-load-song')!.addEventListener('click', async () => {
  const modal = document.getElementById('load-song-modal')!;
  modal.classList.add('active');

  try {
    const result = await app.callServerTool({
      name: 'get-all-songs',
      arguments: {},
    });

    const data = JSON.parse(getTextContent(result));
    renderSongListModal(data.songs);
  } catch (error) {
    console.error('Error loading songs:', error);
    showToast('Error loading songs', 'error');
  }
});

function renderSongListModal(songs: Song[]) {
  const container = document.getElementById('song-list-modal')!;

  if (songs.length === 0) {
    container.innerHTML = '<p class="placeholder-text">No songs saved yet</p>';
    return;
  }

  container.innerHTML = songs.map((song: Song) => `
    <div class="song-list-item" data-id="${song.id}">
      <div>
        <div class="song-title">${song.title}</div>
        <div class="song-meta">${song.status} • ${song.progress}% • ${new Date(song.updatedAt).toLocaleDateString()}</div>
      </div>
      <span class="song-status ${song.status}">${song.status}</span>
    </div>
  `).join('');

  // Add click handlers
  container.querySelectorAll('.song-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const songId = item.getAttribute('data-id')!;
      loadSongIntoEditor(songId, songs);
      document.getElementById('load-song-modal')!.classList.remove('active');
    });
  });
}

function loadSongIntoEditor(songId: string, songs: Song[]) {
  const song = songs.find((s: Song) => s.id === songId);
  if (!song) return;

  (document.getElementById('song-id') as HTMLInputElement).value = song.id;
  songTitleInput.value = song.title;

  // Load sections from song data
  if (song.sections && song.sections.length > 0) {
    sections = song.sections.map((sec: { type: string; content: string }, i: number) => ({
      id: `section-${i}`,
      type: sec.type as SongSection['type'],
      content: sec.content,
    }));
  } else {
    sections = [
      { id: 'section-1', type: 'verse', content: '' },
      { id: 'section-2', type: 'chorus', content: '' },
    ];
  }

  renderSections();
  showToast(`Loaded "${song.title}"`, 'success');
}

// Import Lyrics
document.getElementById('btn-import-lyrics')!.addEventListener('click', () => {
  document.getElementById('import-modal')!.classList.add('active');
});

// Import tabs
document.querySelectorAll('.import-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const tabType = tab.getAttribute('data-tab')!;
    document.querySelectorAll('.import-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`import-${tabType}-content`)!.classList.remove('hidden');
  });
});

// Import from file
document.getElementById('btn-import-file')!.addEventListener('click', async () => {
  const filePath = (document.getElementById('import-file-path') as HTMLInputElement).value.trim();
  if (!filePath) {
    showToast('Please enter a file path', 'warning');
    return;
  }

  try {
    const result = await app.callServerTool({
      name: 'import-lyrics',
      arguments: { filePath },
    });

    const data = JSON.parse(getTextContent(result));
    if (data.imported && data.song) {
      (document.getElementById('song-id') as HTMLInputElement).value = data.song.id;
      songTitleInput.value = data.song.title;

      if (data.song.sections) {
        sections = data.song.sections.map((s: any, i: number) => ({
          id: `section-${i}`,
          type: s.type,
          content: s.content,
        }));
      }

      renderSections();
      document.getElementById('import-modal')!.classList.remove('active');
      showToast(`Imported "${data.song.title}"`, 'success');
    } else {
      showToast(data.error || 'Import failed', 'error');
    }
  } catch (error) {
    console.error('Error importing:', error);
    showToast('Error importing lyrics', 'error');
  }
});

// Import from text
document.getElementById('btn-import-text')!.addEventListener('click', async () => {
  const content = (document.getElementById('import-text-area') as HTMLTextAreaElement).value.trim();
  if (!content) {
    showToast('Please paste some lyrics', 'warning');
    return;
  }

  try {
    const result = await app.callServerTool({
      name: 'import-lyrics',
      arguments: {
        content,
        title: songTitleInput.value || 'Imported Song',
      },
    });

    const data = JSON.parse(getTextContent(result));
    if (data.imported && data.song) {
      (document.getElementById('song-id') as HTMLInputElement).value = data.song.id;
      songTitleInput.value = data.song.title;

      if (data.song.sections) {
        sections = data.song.sections.map((s: any, i: number) => ({
          id: `section-${i}`,
          type: s.type,
          content: s.content,
        }));
      }

      renderSections();
      document.getElementById('import-modal')!.classList.remove('active');
      showToast(`Imported "${data.song.title}"`, 'success');
    }
  } catch (error) {
    console.error('Error importing:', error);
    showToast('Error importing lyrics', 'error');
  }
});

// Batch import
document.getElementById('btn-import-batch')!.addEventListener('click', async () => {
  const directoryPath = (document.getElementById('import-batch-path') as HTMLInputElement).value.trim();
  if (!directoryPath) {
    showToast('Please enter a directory path', 'warning');
    return;
  }

  try {
    const result = await app.callServerTool({
      name: 'batch-import-lyrics',
      arguments: { directoryPath },
    });

    const data = JSON.parse(getTextContent(result));
    showToast(`Imported ${data.imported} songs (${data.errors} errors)`, data.errors > 0 ? 'warning' : 'success');
    document.getElementById('import-modal')!.classList.remove('active');
  } catch (error) {
    console.error('Error batch importing:', error);
    showToast('Error batch importing', 'error');
  }
});

// Session Tracker Functions
async function loadSessionData() {
  try {
    // Load dashboard
    const dashboardResult = await app.callServerTool({
      name: 'get-project-dashboard',
      arguments: {},
    });
    const dashboard = JSON.parse(getTextContent(dashboardResult));
    renderSessionDashboard(dashboard);

    // Load sessions
    const sessionsResult = await app.callServerTool({
      name: 'get-recording-sessions',
      arguments: {},
    });
    const sessionsData = JSON.parse(getTextContent(sessionsResult));
    renderSessions(sessionsData.sessions);

    // Load collaborators
    const collabsResult = await app.callServerTool({
      name: 'get-collaborators',
      arguments: {},
    });
    const collabsData = JSON.parse(getTextContent(collabsResult));
    renderCollaborators(collabsData.collaborators);
  } catch (error) {
    console.error('Error loading session data:', error);
  }
}

function renderSessionDashboard(data: { songs: Song[]; stats: any }) {
  document.getElementById('stat-total-songs')!.textContent = data.stats.total.toString();
  document.getElementById('stat-writing')!.textContent = data.stats.writing.toString();
  document.getElementById('stat-recording')!.textContent = data.stats.recording.toString();
  document.getElementById('stat-mixing')!.textContent = data.stats.mixing.toString();
  document.getElementById('stat-avg-progress')!.textContent = `${data.stats.averageProgress}%`;

  const songsList = document.getElementById('songs-list')!;
  songsList.innerHTML = data.songs.map((song: Song) => `
    <div class="song-item">
      <div class="song-info">
        <h4>${song.title}</h4>
        <div class="song-meta">
          <span>${(song.collaborators || []).length} collaborators</span>
          <span>${new Date(song.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
      <span class="song-status ${song.status}">${song.status}</span>
      <div class="song-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${song.progress}%"></div>
        </div>
        <div class="progress-text">${song.progress}%</div>
      </div>
    </div>
  `).join('');
}

function renderSessions(sessions: RecordingSession[]) {
  const sessionsList = document.getElementById('sessions-list')!;
  sessionsList.innerHTML = sessions.map((session: RecordingSession) => {
    const takes = session.takes || [];
    const takesHtml = takes.length > 0
      ? `<div class="session-takes">${takes.map((take: { take_number: number; rating: number }) => `
            <span class="take-badge ${take.rating === 5 ? 'best' : ''}">
              Take ${take.take_number}: ${'⭐'.repeat(take.rating)}
            </span>
          `).join('')}</div>`
      : '';

    return `
    <div class="session-item" data-id="${session.id}">
      <div class="session-header">
        <span class="session-title">${session.songTitle}</span>
        <span class="session-status ${session.status}">${session.status}</span>
      </div>
      <div class="session-details">
        <div>📅 ${session.date} | 🏢 ${session.studio} | 👷 ${session.engineer}</div>
        <div>⏱️ ${session.duration} min | 🎤 ${takes.length} takes</div>
      </div>
      ${takesHtml}
      <div class="session-actions">
        <button class="btn btn-sm btn-secondary log-take-btn" data-session="${session.id}">🎤 Log Take</button>
        <button class="btn btn-sm btn-secondary add-note-btn" data-session="${session.id}">📝 Add Note</button>
      </div>
    </div>
  `}).join('');

  // Add event listeners for log take buttons
  sessionsList.querySelectorAll('.log-take-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sessionId = btn.getAttribute('data-session')!;
      openLogTakeModal(sessionId);
    });
  });

  // Add event listeners for add note buttons
  sessionsList.querySelectorAll('.add-note-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const sessionId = btn.getAttribute('data-session')!;
      const note = prompt('Enter note:');
      if (note) {
        try {
          await app.callServerTool({
            name: 'add-session-note',
            arguments: { sessionId, note },
          });
          showToast('Note added', 'success');
          loadSessionData();
        } catch (error) {
          console.error('Error adding note:', error);
          showToast('Error adding note', 'error');
        }
      }
    });
  });
}

// New Session button
document.getElementById('btn-new-session')!.addEventListener('click', async () => {
  const modal = document.getElementById('create-session-modal')!;
  modal.classList.add('active');

  // Set default date to today
  (document.getElementById('session-date') as HTMLInputElement).value = new Date().toISOString().split('T')[0];

  // Load songs into select
  try {
    const result = await app.callServerTool({
      name: 'get-all-songs',
      arguments: {},
    });

    const data = JSON.parse(getTextContent(result));
    const select = document.getElementById('session-song-select') as HTMLSelectElement;
    select.innerHTML = data.songs.map((s: Song) => `<option value="${s.id}">${s.title}</option>`).join('');
  } catch (error) {
    console.error('Error loading songs:', error);
  }
});

// Create Session
document.getElementById('btn-create-session')!.addEventListener('click', async () => {
  const songId = (document.getElementById('session-song-select') as HTMLSelectElement).value;
  const date = (document.getElementById('session-date') as HTMLInputElement).value;
  const studio = (document.getElementById('session-studio') as HTMLInputElement).value;
  const engineer = (document.getElementById('session-engineer') as HTMLInputElement).value;

  if (!songId || !date) {
    showToast('Please select a song and date', 'warning');
    return;
  }

  try {
    await app.callServerTool({
      name: 'create-session',
      arguments: { songId, date, studio, engineer },
    });

    document.getElementById('create-session-modal')!.classList.remove('active');
    showToast('Session created', 'success');
    loadSessionData();
  } catch (error) {
    console.error('Error creating session:', error);
    showToast('Error creating session', 'error');
  }
});

// Log Take Modal
let currentTakeRating = 3;

function openLogTakeModal(sessionId: string) {
  (document.getElementById('take-session-id') as HTMLInputElement).value = sessionId;
  currentTakeRating = 3;
  updateStarRating(3);
  (document.getElementById('take-duration') as HTMLInputElement).value = '';
  (document.getElementById('take-notes') as HTMLTextAreaElement).value = '';
  document.getElementById('log-take-modal')!.classList.add('active');
}

function updateStarRating(rating: number) {
  currentTakeRating = rating;
  document.querySelectorAll('#take-rating .star').forEach((star, index) => {
    star.textContent = index < rating ? '★' : '☆';
    star.classList.toggle('active', index < rating);
  });
}

document.querySelectorAll('#take-rating .star').forEach(star => {
  star.addEventListener('click', () => {
    const rating = parseInt(star.getAttribute('data-rating')!);
    updateStarRating(rating);
  });
});

// Log Take
document.getElementById('btn-log-take')!.addEventListener('click', async () => {
  const sessionId = (document.getElementById('take-session-id') as HTMLInputElement).value;
  const duration = parseInt((document.getElementById('take-duration') as HTMLInputElement).value) || 0;
  const notes = (document.getElementById('take-notes') as HTMLTextAreaElement).value;

  try {
    await app.callServerTool({
      name: 'log-take',
      arguments: { sessionId, rating: currentTakeRating, notes, duration },
    });

    document.getElementById('log-take-modal')!.classList.remove('active');
    showToast('Take logged', 'success');
    loadSessionData();
  } catch (error) {
    console.error('Error logging take:', error);
    showToast('Error logging take', 'error');
  }
});

// Add Collaborator button
document.getElementById('btn-add-collab')!.addEventListener('click', () => {
  document.getElementById('add-collaborator-modal')!.classList.add('active');
});

// Add Collaborator
document.getElementById('btn-add-collaborator')!.addEventListener('click', async () => {
  const name = (document.getElementById('collab-name') as HTMLInputElement).value.trim();
  const role = (document.getElementById('collab-role') as HTMLSelectElement).value;
  const contact = (document.getElementById('collab-contact') as HTMLInputElement).value;

  if (!name) {
    showToast('Please enter a name', 'warning');
    return;
  }

  try {
    await app.callServerTool({
      name: 'add-collaborator',
      arguments: { name, role, contact },
    });

    document.getElementById('add-collaborator-modal')!.classList.remove('active');
    showToast('Collaborator added', 'success');
    loadSessionData();
  } catch (error) {
    console.error('Error adding collaborator:', error);
    showToast('Error adding collaborator', 'error');
  }
});

function renderCollaborators(collabs: Collaborator[]) {
  const collabsList = document.getElementById('collaborators-list')!;
  collabsList.innerHTML = collabs.map((collab: Collaborator) => `
    <div class="collaborator-item">
      <div class="collaborator-avatar">${collab.name.charAt(0)}</div>
      <div class="collaborator-info">
        <h4>${collab.name}</h4>
        <span class="collaborator-role">${collab.role}</span>
      </div>
    </div>
  `).join('');
}

// Beat Explorer Functions
async function loadBeats(filters?: any) {
  try {
    const result = await app.callServerTool({
      name: 'browse-beats',
      arguments: filters || {},
    });

    const data = JSON.parse(getTextContent(result));
    renderBeats(data.beats);
    loadCollections();
  } catch (error) {
    console.error('Error loading beats:', error);
  }
}

function renderBeats(beats: Beat[]) {
  const beatsGrid = document.getElementById('beats-grid')!;

  // Clean up existing cards
  beatCards.forEach(card => card.destroy());
  beatCards = [];

  // Clear grid
  beatsGrid.innerHTML = '';

  // Create main player if not exists
  if (!mainPlayer) {
    const playerContainer = document.createElement('div');
    playerContainer.id = 'main-player-container';
    playerContainer.style.cssText = 'margin-bottom: 24px;';
    beatsGrid.parentElement?.insertBefore(playerContainer, beatsGrid);

    mainPlayer = new BeatPlayer(playerContainer, {
      showWaveform: true,
      showFrequency: true,
      showScrubBar: true,
      showTimeDisplay: true,
      showControls: true,
      showInfo: true,
    });

    mainPlayer.onFavorite(async (beatId) => {
      try {
        await app.callServerTool({
          name: 'toggle-favorite',
          arguments: { beatId },
        });
        loadBeats();
        showToast('Favorite updated', 'success');
      } catch (error) {
        console.error('Error toggling favorite:', error);
      }
    });
  }

  // Create beat cards
  beats.forEach(beat => {
    const cardContainer = document.createElement('div');
    beatsGrid.appendChild(cardContainer);

    const beatInfo: BeatInfo = {
      id: beat.id,
      title: beat.title,
      producer: beat.producer,
      bpm: beat.bpm,
      key: beat.key,
      duration: beat.duration,
      filePath: beat.file_path || null,
      favorite: beat.favorite,
    };

    const card = new BeatCard(cardContainer, beatInfo);

    card.onPlayClick((beatToPlay) => {
      if (mainPlayer) {
        mainPlayer.loadBeat(beatToPlay);
      }
    });

    card.onFavoriteClick(async (beatId) => {
      try {
        await app.callServerTool({
          name: 'toggle-favorite',
          arguments: { beatId },
        });
        loadBeats();
        showToast('Favorite updated', 'success');
      } catch (error) {
        console.error('Error toggling favorite:', error);
      }
    });

    beatCards.push(card);
  });
}

async function loadCollections() {
  try {
    const result = await app.callServerTool({
      name: 'get-collections',
      arguments: {},
    });

    const data = JSON.parse(getTextContent(result));
    renderCollections(data.collections);
  } catch (error) {
    console.error('Error loading collections:', error);
  }
}

function renderCollections(collections: Array<{ name: string; beatCount: number }>) {
  const collectionsGrid = document.getElementById('collections-grid')!;
  collectionsGrid.innerHTML = collections.map((col: { name: string; beatCount: number }) => `
    <div class="collection-card">
      <div class="collection-name">📁 ${col.name}</div>
      <div class="collection-count">${col.beatCount} beats</div>
    </div>
  `).join('');
}

// Apply Filters
document.getElementById('btn-apply-filters')!.addEventListener('click', () => {
  const filters: any = {};

  const genre = (document.getElementById('filter-genre') as HTMLSelectElement).value;
  const mood = (document.getElementById('filter-mood') as HTMLSelectElement).value;
  const minBpm = (document.getElementById('filter-bpm-min') as HTMLInputElement).value;
  const maxBpm = (document.getElementById('filter-bpm-max') as HTMLInputElement).value;
  const energy = (document.getElementById('filter-energy') as HTMLInputElement).value;
  const favoritesOnly = (document.getElementById('filter-favorites') as HTMLInputElement).checked;

  if (genre) filters.genre = genre;
  if (mood) filters.mood = mood;
  if (minBpm) filters.minBpm = parseInt(minBpm);
  if (maxBpm) filters.maxBpm = parseInt(maxBpm);
  if (parseInt(energy) > 0) filters.minEnergy = parseInt(energy);
  if (favoritesOnly) filters.favoritesOnly = true;

  loadBeats(filters);
});

// Library Settings
document.getElementById('btn-library-settings')!.addEventListener('click', async () => {
  const modal = document.getElementById('library-settings-modal')!;
  modal.classList.add('active');

  try {
    const result = await app.callServerTool({
      name: 'get-library-path',
      arguments: {},
    });

    const data = JSON.parse(getTextContent(result));
    (document.getElementById('library-path-input') as HTMLInputElement).value = data.path;

    const statsEl = document.getElementById('library-stats')!;
    statsEl.innerHTML = `
      <div class="stat-row">
        <span>Total Files</span>
        <span>${data.stats.totalFiles}</span>
      </div>
      <div class="stat-row">
        <span>Total Size</span>
        <span>${data.stats.totalSizeFormatted}</span>
      </div>
      <div class="stat-row">
        <span>Formats</span>
        <span>${data.stats.formats.join(', ') || 'None'}</span>
      </div>
    `;
  } catch (error) {
    console.error('Error loading library stats:', error);
  }
});

// Set Library Path
document.getElementById('btn-set-library-path')!.addEventListener('click', async () => {
  const newPath = (document.getElementById('library-path-input') as HTMLInputElement).value.trim();
  if (!newPath) {
    showToast('Please enter a path', 'warning');
    return;
  }

  try {
    const result = await app.callServerTool({
      name: 'set-library-path',
      arguments: { path: newPath },
    });

    const data = JSON.parse(getTextContent(result));
    showToast(data.message, data.success ? 'success' : 'error');

    if (data.success) {
      // Refresh stats
      document.getElementById('btn-library-settings')!.click();
    }
  } catch (error) {
    console.error('Error setting library path:', error);
    showToast('Error setting library path', 'error');
  }
});

// Scan Library
document.getElementById('btn-scan-library')!.addEventListener('click', async () => {
  try {
    const result = await app.callServerTool({
      name: 'scan-library',
      arguments: {},
    });

    const data = JSON.parse(getTextContent(result));
    const resultsEl = document.getElementById('scan-results')!;

    if (data.totalFiles === 0) {
      resultsEl.innerHTML = '<p class="placeholder-text">No audio files found</p>';
    } else {
      resultsEl.innerHTML = `
        <p><strong>Found ${data.totalFiles} audio files:</strong></p>
        ${data.files.slice(0, 20).map((f: any) => `
          <div class="scan-file-item">
            <span>${f.filename}</span>
            <span class="file-size">${formatFileSize(f.size)}</span>
          </div>
        `).join('')}
        ${data.totalFiles > 20 ? `<p>...and ${data.totalFiles - 20} more</p>` : ''}
      `;
    }
  } catch (error) {
    console.error('Error scanning library:', error);
    showToast('Error scanning library', 'error');
  }
});

// Import Beats
document.getElementById('btn-import-beats')!.addEventListener('click', async () => {
  try {
    const result = await app.callServerTool({
      name: 'import-beats',
      arguments: {},
    });

    const data = JSON.parse(getTextContent(result));
    showToast(`Imported: ${data.imported}, Skipped: ${data.skipped}, Errors: ${data.errors}`, data.errors > 0 ? 'warning' : 'success');
    loadBeats();
  } catch (error) {
    console.error('Error importing beats:', error);
    showToast('Error importing beats', 'error');
  }
});

// Add Beat Modal
document.getElementById('btn-add-beat-modal')!.addEventListener('click', () => {
  document.getElementById('add-beat-modal')!.classList.add('active');
});

// Add Beat
document.getElementById('btn-add-beat')!.addEventListener('click', async () => {
  const title = (document.getElementById('beat-title') as HTMLInputElement).value.trim();
  const producer = (document.getElementById('beat-producer') as HTMLInputElement).value;
  const bpm = parseInt((document.getElementById('beat-bpm') as HTMLInputElement).value) || 0;
  const key = (document.getElementById('beat-key') as HTMLInputElement).value;
  const energy = parseInt((document.getElementById('beat-energy') as HTMLInputElement).value) || 50;
  const filePath = (document.getElementById('beat-file-path') as HTMLInputElement).value;
  const genres = (document.getElementById('beat-genres') as HTMLInputElement).value.split(',').map(g => g.trim()).filter(Boolean);
  const moods = (document.getElementById('beat-moods') as HTMLInputElement).value.split(',').map(m => m.trim()).filter(Boolean);

  if (!title) {
    showToast('Please enter a title', 'warning');
    return;
  }

  try {
    await app.callServerTool({
      name: 'add-beat',
      arguments: { title, producer, bpm, key, energy, filePath: filePath || undefined, genres, moods },
    });

    document.getElementById('add-beat-modal')!.classList.remove('active');
    showToast('Beat added', 'success');
    loadBeats();
  } catch (error) {
    console.error('Error adding beat:', error);
    showToast('Error adding beat', 'error');
  }
});

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Energy slider value display
document.getElementById('filter-energy')!.addEventListener('input', (e) => {
  const value = (e.target as HTMLInputElement).value;
  document.getElementById('energy-value')!.textContent = `${value}+`;
});

// Match Lyrics to Beats
document.getElementById('btn-match-beats')!.addEventListener('click', async () => {
  const lyrics = (document.getElementById('lyrics-for-matching') as HTMLTextAreaElement).value.trim();
  if (!lyrics) {
    showToast('Please enter some lyrics', 'warning');
    return;
  }

  try {
    const result = await app.callServerTool({
      name: 'match-lyrics-to-beat',
      arguments: { lyrics },
    });

    const data = JSON.parse(getTextContent(result));
    renderMatchResults(data);
  } catch (error) {
    console.error('Error matching lyrics:', error);
    showToast('Error matching lyrics to beats', 'error');
  }
});

function renderMatchResults(data: { analysis: { energyLabel: string; detectedEnergy: number; moodHints: string[] }; matches: Beat[] }) {
  const matchResults = document.getElementById('match-results')!;

  matchResults.innerHTML = `
    <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
      <strong>Analysis:</strong> Energy: ${data.analysis.energyLabel} (${data.analysis.detectedEnergy}%)
      ${data.analysis.moodHints.length > 0 ? ` | Moods: ${data.analysis.moodHints.join(', ')}` : ''}
    </div>
    ${data.matches.map((beat: Beat) => `
      <div class="match-result-item">
        <span class="match-score">${beat.matchScore}%</span>
        <div>
          <strong>${beat.title}</strong> by ${beat.producer}
          <div style="font-size: 12px; color: var(--text-muted);">
            ${beat.bpm} BPM | ${beat.key} | ${(beat.genre || []).join(', ')}
          </div>
        </div>
      </div>
    `).join('')}
  `;
}

// Toast Notifications
function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Handle tool results from server
app.ontoolresult = (result) => {
  console.log('Tool result received:', result);
};

// Host / AppBridge interaction handlers
app.onhostcontextchanged = (ctx: any) => {
  try {
    if (ctx?.theme === 'dark') document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');

    if (ctx?.displayMode) {
      // Allow host to request compact / expanded display modes
      document.body.setAttribute('data-display-mode', ctx.displayMode);
    }
  } catch (err) {
    console.error('Error handling host context change', err);
  }
};

app.ontoolinput = async (input: any) => {
  // Hosts may forward tool inputs directly to the view; log for debugging
  console.log('Tool input forwarded to view:', input);
};

app.onteardown = async () => {
  // Save lightweight UI state if possible before host tears down the view.
  try {
    await app.callServerTool({ name: 'save-ui-state', arguments: { sections } }).catch(() => {});
  } catch (e) {
    // ignore
  }
  return {};
};

app.onloggingmessage = (msg: any) => {
  // Mirror view-side logs and attempt to forward to host if supported
  console.log('[View Log]', msg);
  try {
    if ((app as any).sendLog) (app as any).sendLog(msg);
  } catch (err) {
    // best-effort
  }
};

// ============ ERROR HANDLING ============

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  showToast('An unexpected error occurred. Please refresh if issues persist.', 'error');
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showToast('An operation failed. Please try again.', 'error');
  event.preventDefault();
});

// ============ LOADING STATES ============

const loadingStates = new Map<string, boolean>();

function showLoading(containerId: string, message: string = 'Loading...'): void {
  loadingStates.set(containerId, true);
  const container = document.getElementById(containerId);
  if (!container) return;

  // Add loading overlay
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.id = `loading-${containerId}`;
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-message">${message}</div>
  `;
  container.style.position = 'relative';
  container.appendChild(overlay);
}

function hideLoading(containerId: string): void {
  loadingStates.set(containerId, false);
  const overlay = document.getElementById(`loading-${containerId}`);
  if (overlay) {
    overlay.remove();
  }
}

function isLoading(containerId: string): boolean {
  return loadingStates.get(containerId) || false;
}

// ============ KEYBOARD SHORTCUTS ============

document.addEventListener('keydown', (e) => {
  // Ctrl+S to save lyrics
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    document.getElementById('btn-save-lyrics')?.click();
  }

  // Ctrl+N for new song
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    document.getElementById('btn-new-song')?.click();
  }

  // Space to play/pause (when not in input)
  if (e.key === ' ' && !['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement?.tagName || '')) {
    e.preventDefault();
    if (mainPlayer) {
      mainPlayer.togglePlay();
    }
  }

  // Escape to close modals
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});

// ============ AUTO-SAVE ============

let autoSaveTimer: NodeJS.Timeout | null = null;
let hasUnsavedChanges = false;

function markUnsaved(): void {
  hasUnsavedChanges = true;

  // Clear existing timer
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  // Auto-save after 30 seconds of inactivity
  autoSaveTimer = setTimeout(() => {
    if (hasUnsavedChanges) {
      document.getElementById('btn-save-lyrics')?.click();
    }
  }, 30000);
}

function markSaved(): void {
  hasUnsavedChanges = false;
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

// ============ DASHBOARD FUNCTIONS ============

let dashboardData: any = null;
let activityFilter = 'all';

async function loadDashboard() {
  showLoading('dashboard', 'Loading dashboard...');
  
  try {
    const result = await app.callServerTool({
      name: 'get-dashboard-summary',
      arguments: { timeframe: 'week' },
    });

    dashboardData = JSON.parse(getTextContent(result));
    renderDashboard(dashboardData);
  } catch (error) {
    console.error('Error loading dashboard:', error);
    showToast('Error loading dashboard', 'error');
    
    // Show error state
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
      const errorState = dashboard.querySelector('.dashboard-layout');
      if (errorState) {
        errorState.innerHTML = `
          <div class="error-state">
            <span class="error-icon">⚠️</span>
            <p class="error-message">Failed to load dashboard data</p>
            <button class="btn btn-primary error-retry" onclick="loadDashboard()">Retry</button>
          </div>
        `;
      }
    }
  } finally {
    hideLoading('dashboard');
  }
}

function renderDashboard(data: any) {
  // Overview stats
  document.getElementById('dash-total-songs')!.textContent = data.overview.totalSongs;
  document.getElementById('dash-total-sessions')!.textContent = data.overview.totalSessions;
  document.getElementById('dash-total-takes')!.textContent = data.overview.totalTakes;
  document.getElementById('dash-total-beats')!.textContent = data.overview.totalBeats;
  document.getElementById('dash-total-collabs')!.textContent = data.overview.totalCollaborators;
  document.getElementById('dash-total-collections')!.textContent = data.overview.totalCollections;

  // Song funnel
  const totalSongs = data.overview.totalSongs || 1;
  const funnelData = data.songStats.byStatus;

  Object.keys(funnelData).forEach(status => {
    const count = funnelData[status];
    const percent = Math.round((count / totalSongs) * 100);
    const stage = document.querySelector(`.funnel-stage[data-status="${status}"]`);
    if (stage) {
      const bar = stage.querySelector('.funnel-bar') as HTMLElement;
      const countEl = stage.querySelector('.funnel-count') as HTMLElement;
      if (bar) bar.style.setProperty('--progress', `${percent}%`);
      if (countEl) countEl.textContent = count.toString();
    }
  });

  // Completion rate
  document.getElementById('completion-rate')!.textContent = `${data.insights.completionRate}%`;

  // Weekly activity chart
  renderActivityChart(data.activity.weeklyProgress);

  // Activity feed
  renderActivityFeed(data.activity.recentActivity);

  // Insights
  document.getElementById('insight-productive-day')!.textContent = data.insights.mostProductiveDay;
  document.getElementById('insight-avg-session')!.textContent = `${data.insights.averageSessionLength} min`;
  document.getElementById('insight-completion')!.textContent = `${data.insights.completionRate}%`;
  document.getElementById('insight-top-collab')!.textContent = data.insights.topCollaborators[0] || 'None yet';

  // Recent songs
  renderRecentSongs(data.songStats.recentlyUpdated);

  // Recent sessions
  renderRecentSessions(data.sessionStats.recentSessions);

  // Beat stats
  document.getElementById('beat-stat-total')!.textContent = data.beatStats.totalBeats;
  document.getElementById('beat-stat-favorites')!.textContent = data.beatStats.favorites;
  document.getElementById('beat-stat-bpm')!.textContent = data.beatStats.averageBpm;
  document.getElementById('beat-stat-size')!.textContent = data.beatStats.librarySize;

  // Top genres
  const genresContainer = document.getElementById('beat-top-genres')!;
  genresContainer.innerHTML = data.beatStats.topGenres
    .slice(0, 5)
    .map((g: string) => `<span class="genre-tag">${g}</span>`)
    .join('');
}

function renderActivityChart(weeklyProgress: Array<{ week: string; songsCreated: number; sessionsCompleted: number; takesLogged: number }>) {
  const chart = document.getElementById('activity-chart')!;

  const maxSongs = Math.max(...weeklyProgress.map((w: { songsCreated: number }) => w.songsCreated), 1);
  const maxSessions = Math.max(...weeklyProgress.map((w: { sessionsCompleted: number }) => w.sessionsCompleted), 1);
  const maxTakes = Math.max(...weeklyProgress.map((w: { takesLogged: number }) => w.takesLogged), 1);

  chart.innerHTML = weeklyProgress.map((week: { week: string; songsCreated: number; sessionsCompleted: number; takesLogged: number }) => `
    <div class="chart-bar-group">
      <div class="chart-bars">
        <div class="chart-bar songs" style="height: ${(week.songsCreated / maxSongs) * 100}%"></div>
        <div class="chart-bar sessions" style="height: ${(week.sessionsCompleted / maxSessions) * 100}%"></div>
        <div class="chart-bar takes" style="height: ${(week.takesLogged / maxTakes) * 100}%"></div>
      </div>
      <span class="chart-label">${week.week}</span>
    </div>
  `).join('');
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
}

function renderActivityFeed(activities: ActivityItem[]) {
  const feed = document.getElementById('activity-feed')!;

  const filtered = activityFilter === 'all'
    ? activities
    : activities.filter((a: ActivityItem) => {
        if (activityFilter === 'songs') return a.type.includes('song');
        if (activityFilter === 'sessions') return a.type.includes('session') || a.type.includes('take');
        if (activityFilter === 'beats') return a.type.includes('beat');
        return true;
      });

  if (filtered.length === 0) {
    feed.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span><span class="empty-message">No recent activity</span></div>';
    return;
  }

  feed.innerHTML = filtered.slice(0, 15).map((item: ActivityItem) => `
    <div class="activity-item">
      <span class="activity-icon">${item.icon}</span>
      <div class="activity-content">
        <div class="activity-title">${item.title}</div>
        <div class="activity-description">${item.description}</div>
      </div>
      <span class="activity-time">${formatRelativeTime(item.timestamp)}</span>
    </div>
  `).join('');
}

function renderRecentSongs(songs: Array<{ id: string; title: string; status: string; progress: number; updatedAt: string }>) {
  const container = document.getElementById('recent-songs')!;

  if (songs.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="empty-icon">🎵</span><span class="empty-message">No songs yet</span></div>';
    return;
  }

  container.innerHTML = songs.map((song: { id: string; title: string; status: string; progress: number; updatedAt: string }) => `
    <div class="recent-item" data-id="${song.id}">
      <div class="recent-item-info">
        <div class="recent-item-title">${song.title}</div>
        <div class="recent-item-meta">${song.progress}% complete • ${formatRelativeTime(song.updatedAt)}</div>
      </div>
      <span class="recent-item-badge song-status ${song.status}">${song.status}</span>
    </div>
  `).join('');
}

function renderRecentSessions(sessions: Array<{ id: string; songTitle: string; date: string; studio: string; status: string; takeCount: number }>) {
  const container = document.getElementById('recent-sessions')!;

  if (sessions.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="empty-icon">🎙️</span><span class="empty-message">No sessions yet</span></div>';
    return;
  }

  container.innerHTML = sessions.map((session: { id: string; songTitle: string; date: string; studio: string; status: string; takeCount: number }) => `
    <div class="recent-item" data-id="${session.id}">
      <div class="recent-item-info">
        <div class="recent-item-title">${session.songTitle}</div>
        <div class="recent-item-meta">${session.date} • ${session.studio || 'No studio'} • ${session.takeCount} takes</div>
      </div>
      <span class="recent-item-badge session-status ${session.status}">${session.status}</span>
    </div>
  `).join('');
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

// Activity filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activityFilter = btn.getAttribute('data-filter')!;

    if (dashboardData) {
      renderActivityFeed(dashboardData.activity.recentActivity);
    }
  });
});

// Quick action buttons with keyboard support
const quickActions = [
  { id: 'qa-new-song', tab: 'lyric-lab', action: 'btn-new-song' },
  { id: 'qa-new-session', tab: 'session-tracker', action: 'btn-new-session' },
  { id: 'qa-import-lyrics', tab: 'lyric-lab', action: 'btn-import-lyrics' },
  { id: 'qa-browse-beats', tab: 'beat-explorer', action: null },
  { id: 'qa-add-collab', tab: 'session-tracker', action: 'btn-add-collab' },
  { id: 'qa-library-settings', tab: 'beat-explorer', action: 'btn-library-settings' },
];

quickActions.forEach(({ id, tab, action }) => {
  const btn = document.getElementById(id);
  if (!btn) return;

  // Add keyboard support
  btn.setAttribute('tabindex', '0');
  btn.setAttribute('role', 'button');

  const handler = () => {
    document.querySelector(`[data-tab="${tab}"]`)?.dispatchEvent(new Event('click'));
    if (action) {
      setTimeout(() => document.getElementById(action)?.click(), 100);
    }
  };

  btn.addEventListener('click', handler);
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  });
});

// View all buttons
document.getElementById('dash-view-all-songs')?.addEventListener('click', () => {
  document.querySelector('[data-tab="session-tracker"]')?.dispatchEvent(new Event('click'));
});

document.getElementById('dash-view-all-sessions')?.addEventListener('click', () => {
  document.querySelector('[data-tab="session-tracker"]')?.dispatchEvent(new Event('click'));
});

// ============ CONNECT TO HOST ============

async function initialize() {
  try {
    await app.connect();
    console.log('RhymeBook connected to MCP host');
    renderSections();
    loadDashboard(); // Load dashboard on startup
  } catch (error) {
    console.error('Failed to connect:', error);
    // Still render UI for standalone testing
    renderSections();
    loadDashboard();
  }
}

initialize();
