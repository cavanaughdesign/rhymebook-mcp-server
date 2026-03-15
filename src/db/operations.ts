import { getDatabase, generateId } from './database.js';

// ============ SONGS ============

export interface Song {
  id: string;
  title: string;
  status: 'writing' | 'recording' | 'mixing' | 'mastering' | 'released';
  progress: number;
  notes: string;
  created_at: string;
  updated_at: string;
  collaborators?: string[];
  sections?: SongSection[];
}

export interface SongSection {
  id: string;
  song_id: string;
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'hook';
  content: string;
  position: number;
}

export function createSong(title: string, notes?: string): Song {
  const db = getDatabase();
  const id = generateId('song');

  db.prepare(`
    INSERT INTO songs (id, title, notes) VALUES (?, ?, ?)
  `).run(id, title, notes || '');

  return getSong(id)!;
}

export function getSong(id: string): Song | null {
  const db = getDatabase();
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as Song | undefined;

  if (song) {
    song.sections = getSongSections(id);
    song.collaborators = getSongCollaboratorNames(id);
    return song;
  }

  return null;
}

export function getAllSongs(filter?: string): Song[] {
  const db = getDatabase();
  let query = 'SELECT * FROM songs';
  const params: any[] = [];

  if (filter && filter !== 'all') {
    query += ' WHERE status = ?';
    params.push(filter);
  }

  query += ' ORDER BY updated_at DESC';

  const songs = db.prepare(query).all(...params) as Song[];

  return songs.map(song => ({
    ...song,
    sections: getSongSections(song.id),
    collaborators: getSongCollaboratorNames(song.id),
  }));
}

export function updateSong(id: string, updates: Partial<Song>): Song | null {
  const db = getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.progress !== undefined) {
    fields.push('progress = ?');
    values.push(updates.progress);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE songs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  return getSong(id);
}

export function deleteSong(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM songs WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============ SONG SECTIONS ============

export function getSongSections(songId: string): SongSection[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM song_sections WHERE song_id = ? ORDER BY position').all(songId) as SongSection[];
}

export function saveSongSections(songId: string, sections: Array<{ type: string; content: string }>): void {
  const db = getDatabase();

  // Delete existing sections
  db.prepare('DELETE FROM song_sections WHERE song_id = ?').run(songId);

  // Insert new sections
  const insert = db.prepare(`
    INSERT INTO song_sections (id, song_id, type, content, position) VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    sections.forEach((section, index) => {
      insert.run(generateId('sec'), songId, section.type, section.content, index);
    });
  });

  transaction();

  // Update song timestamp
  db.prepare("UPDATE songs SET updated_at = datetime('now') WHERE id = ?").run(songId);
}

// ============ COLLABORATORS ============

export interface Collaborator {
  id: string;
  name: string;
  role: 'artist' | 'producer' | 'engineer' | 'writer' | 'feature';
  contact: string;
  songs?: string[];
}

export function createCollaborator(name: string, role: Collaborator['role'], contact?: string): Collaborator {
  const db = getDatabase();
  const id = generateId('collab');

  db.prepare(`
    INSERT INTO collaborators (id, name, role, contact) VALUES (?, ?, ?, ?)
  `).run(id, name, role, contact || '');

  return { id, name, role, contact: contact || '' };
}

export function getAllCollaborators(role?: string): Collaborator[] {
  const db = getDatabase();
  let query = 'SELECT * FROM collaborators';
  const params: any[] = [];

  if (role && role !== 'all') {
    query += ' WHERE role = ?';
    params.push(role);
  }

  query += ' ORDER BY name';

  const collabs = db.prepare(query).all(...params) as Collaborator[];

  return collabs.map(c => ({
    ...c,
    songs: getCollaboratorSongIds(c.id),
  }));
}

export function getSongCollaboratorNames(songId: string): string[] {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT c.name FROM collaborators c
    JOIN song_collaborators sc ON c.id = sc.collaborator_id
    WHERE sc.song_id = ?
  `).all(songId) as { name: string }[];

  return result.map(r => r.name);
}

export function getCollaboratorSongIds(collabId: string): string[] {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT song_id FROM song_collaborators WHERE collaborator_id = ?
  `).all(collabId) as { song_id: string }[];

  return result.map(r => r.song_id);
}

export function addCollaboratorToSong(songId: string, collaboratorId: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO song_collaborators (song_id, collaborator_id) VALUES (?, ?)
  `).run(songId, collaboratorId);
}

// ============ RECORDING SESSIONS ============

export interface RecordingSession {
  id: string;
  song_id: string;
  song_title?: string;
  date: string;
  studio: string;
  engineer: string;
  duration: number;
  notes: string;
  status: 'scheduled' | 'in-progress' | 'completed';
  takes?: Take[];
}

export interface Take {
  id: number;
  session_id: string;
  take_number: number;
  rating: number;
  notes: string;
  timestamp: string;
  duration: number;
}

export function createSession(songId: string, date: string, studio?: string, engineer?: string): RecordingSession {
  const db = getDatabase();
  const id = generateId('session');

  db.prepare(`
    INSERT INTO recording_sessions (id, song_id, date, studio, engineer) VALUES (?, ?, ?, ?, ?)
  `).run(id, songId, date, studio || '', engineer || '');

  return getSession(id)!;
}

export function getSession(id: string): RecordingSession | null {
  const db = getDatabase();
  const session = db.prepare(`
    SELECT rs.*, s.title as song_title 
    FROM recording_sessions rs 
    JOIN songs s ON rs.song_id = s.id 
    WHERE rs.id = ?
  `).get(id) as RecordingSession | null;

  if (session) {
    session.takes = getSessionTakes(id);
  }

  return session;
}

export function getAllSessions(songId?: string, status?: string): RecordingSession[] {
  const db = getDatabase();
  let query = `
    SELECT rs.*, s.title as song_title 
    FROM recording_sessions rs 
    JOIN songs s ON rs.song_id = s.id
  `;
  const conditions: string[] = [];
  const params: any[] = [];

  if (songId) {
    conditions.push('rs.song_id = ?');
    params.push(songId);
  }
  if (status && status !== 'all') {
    conditions.push('rs.status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY rs.date DESC';

  const sessions = db.prepare(query).all(...params) as RecordingSession[];

  return sessions.map(s => ({
    ...s,
    takes: getSessionTakes(s.id),
  }));
}

export function updateSessionStatus(id: string, status: RecordingSession['status']): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE recording_sessions SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, id);
}

export function addSessionNote(id: string, note: string): void {
  const db = getDatabase();
  const session = db.prepare('SELECT notes FROM recording_sessions WHERE id = ?').get(id) as { notes: string } | null;

  if (session) {
    const newNotes = session.notes
      ? `${session.notes}\n[${new Date().toLocaleDateString()}] ${note}`
      : `[${new Date().toLocaleDateString()}] ${note}`;

    db.prepare(`
      UPDATE recording_sessions SET notes = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newNotes, id);
  }
}

// ============ TAKES ============

export function getSessionTakes(sessionId: string): Take[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM takes WHERE session_id = ? ORDER BY take_number').all(sessionId) as Take[];
}

export function logTake(sessionId: string, rating: number, notes: string, duration: number): Take {
  const db = getDatabase();

  // Get next take number
  const maxTake = db.prepare('SELECT MAX(take_number) as max FROM takes WHERE session_id = ?').get(sessionId) as { max: number | null };
  const takeNumber = (maxTake.max || 0) + 1;

  db.prepare(`
    INSERT INTO takes (session_id, take_number, rating, notes, duration) VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, takeNumber, rating, notes, duration);

  return {
    id: 0,
    session_id: sessionId,
    take_number: takeNumber,
    rating,
    notes,
    timestamp: new Date().toISOString(),
    duration,
  };
}

// ============ BEATS ============

export interface Beat {
  id: string;
  title: string;
  producer: string;
  file_path: string | null;
  bpm: number;
  key_signature: string;
  duration: number;
  energy: number;
  favorite: boolean;
  genres?: string[];
  moods?: string[];
  tags?: string[];
  collection?: string;
}

export function createBeat(beat: Omit<Beat, 'id'>): Beat {
  const db = getDatabase();
  const id = generateId('beat');

  db.prepare(`
    INSERT INTO beats (id, title, producer, file_path, bpm, key_signature, duration, energy, favorite)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    beat.title,
    beat.producer,
    beat.file_path,
    beat.bpm,
    beat.key_signature,
    beat.duration,
    beat.energy,
    beat.favorite ? 1 : 0
  );

  // Add genres
  if (beat.genres) {
    const insertGenre = db.prepare('INSERT OR IGNORE INTO beat_genres (beat_id, genre) VALUES (?, ?)');
    beat.genres.forEach(g => insertGenre.run(id, g));
  }

  // Add moods
  if (beat.moods) {
    const insertMood = db.prepare('INSERT OR IGNORE INTO beat_moods (beat_id, mood) VALUES (?, ?)');
    beat.moods.forEach(m => insertMood.run(id, m));
  }

  // Add tags
  if (beat.tags) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO beat_tags (beat_id, tag) VALUES (?, ?)');
    beat.tags.forEach(t => insertTag.run(id, t));
  }

  return getBeat(id)!;
}

export function getBeat(id: string): Beat | null {
  const db = getDatabase();
  const beat = db.prepare('SELECT * FROM beats WHERE id = ?').get(id) as any;

  if (!beat) return null;

  return enrichBeat(beat);
}

export function getAllBeats(filters?: {
  genre?: string;
  mood?: string;
  minBpm?: number;
  maxBpm?: number;
  minEnergy?: number;
  maxEnergy?: number;
  favoritesOnly?: boolean;
}): Beat[] {
  const db = getDatabase();
  let query = 'SELECT DISTINCT b.* FROM beats b';
  const joins: string[] = [];
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters?.genre) {
    joins.push('JOIN beat_genres bg ON b.id = bg.beat_id');
    conditions.push('bg.genre LIKE ?');
    params.push(`%${filters.genre}%`);
  }

  if (filters?.mood) {
    joins.push('JOIN beat_moods bm ON b.id = bm.beat_id');
    conditions.push('bm.mood LIKE ?');
    params.push(`%${filters.mood}%`);
  }

  if (filters?.minBpm) {
    conditions.push('b.bpm >= ?');
    params.push(filters.minBpm);
  }

  if (filters?.maxBpm) {
    conditions.push('b.bpm <= ?');
    params.push(filters.maxBpm);
  }

  if (filters?.minEnergy) {
    conditions.push('b.energy >= ?');
    params.push(filters.minEnergy);
  }

  if (filters?.maxEnergy) {
    conditions.push('b.energy <= ?');
    params.push(filters.maxEnergy);
  }

  if (filters?.favoritesOnly) {
    conditions.push('b.favorite = 1');
  }

  if (joins.length > 0) {
    query += ' ' + joins.join(' ');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY b.updated_at DESC';

  const beats = db.prepare(query).all(...params) as any[];

  return beats.map(enrichBeat);
}

function enrichBeat(beat: any): Beat {
  const db = getDatabase();

  const genres = db.prepare('SELECT genre FROM beat_genres WHERE beat_id = ?').all(beat.id) as { genre: string }[];
  const moods = db.prepare('SELECT mood FROM beat_moods WHERE beat_id = ?').all(beat.id) as { mood: string }[];
  const tags = db.prepare('SELECT tag FROM beat_tags WHERE beat_id = ?').all(beat.id) as { tag: string }[];

  return {
    ...beat,
    favorite: Boolean(beat.favorite),
    genres: genres.map(g => g.genre),
    moods: moods.map(m => m.mood),
    tags: tags.map(t => t.tag),
  };
}

export function toggleBeatFavorite(id: string): boolean {
  const db = getDatabase();
  const beat = db.prepare('SELECT favorite FROM beats WHERE id = ?').get(id) as { favorite: number } | null;

  if (beat) {
    const newValue = beat.favorite ? 0 : 1;
    db.prepare('UPDATE beats SET favorite = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newValue, id);
    return Boolean(newValue);
  }

  return false;
}

export function deleteBeat(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM beats WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============ COLLECTIONS ============

export interface Collection {
  id: string;
  name: string;
  beat_count?: number;
  beats?: Beat[];
}

export function createCollection(name: string): Collection {
  const db = getDatabase();
  const id = generateId('col');

  db.prepare('INSERT INTO collections (id, name) VALUES (?, ?)').run(id, name);

  return { id, name, beat_count: 0 };
}

export function getAllCollections(): Collection[] {
  const db = getDatabase();
  const collections = db.prepare('SELECT * FROM collections ORDER BY name').all() as Collection[];

  return collections.map(col => ({
    ...col,
    beat_count: getCollectionBeatCount(col.id),
  }));
}

export function getCollectionBeatCount(collectionId: string): number {
  const db = getDatabase();
  const result = db.prepare('SELECT COUNT(*) as count FROM collection_beats WHERE collection_id = ?').get(collectionId) as { count: number };
  return result.count;
}

export function addBeatToCollection(collectionId: string, beatId: string): void {
  const db = getDatabase();
  const maxPos = db.prepare('SELECT MAX(position) as max FROM collection_beats WHERE collection_id = ?').get(collectionId) as { max: number | null };
  const position = (maxPos.max || 0) + 1;

  db.prepare(`
    INSERT OR IGNORE INTO collection_beats (collection_id, beat_id, position) VALUES (?, ?, ?)
  `).run(collectionId, beatId, position);
}

export function removeBeatFromCollection(collectionId: string, beatId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM collection_beats WHERE collection_id = ? AND beat_id = ?').run(collectionId, beatId);
}

// ============ SETTINGS ============

export function getSetting(key: string): string | null {
  const db = getDatabase();
  const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | null;
  return result?.value || null;
}

export function setSetting(key: string, value: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
  `).run(key, value);
}

// ============ STATS ============

export function getSongStats() {
  const db = getDatabase();
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'writing' THEN 1 ELSE 0 END) as writing,
      SUM(CASE WHEN status = 'recording' THEN 1 ELSE 0 END) as recording,
      SUM(CASE WHEN status = 'mixing' THEN 1 ELSE 0 END) as mixing,
      SUM(CASE WHEN status = 'mastering' THEN 1 ELSE 0 END) as mastering,
      SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) as released,
      AVG(progress) as avg_progress
    FROM songs
  `).get() as any;

  return {
    total: stats.total || 0,
    writing: stats.writing || 0,
    recording: stats.recording || 0,
    mixing: stats.mixing || 0,
    mastering: stats.mastering || 0,
    released: stats.released || 0,
    averageProgress: Math.round(stats.avg_progress || 0),
  };
}

export function getBeatStats() {
  const db = getDatabase();
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN favorite = 1 THEN 1 ELSE 0 END) as favorites,
      AVG(bpm) as avg_bpm,
      AVG(energy) as avg_energy,
      MIN(bpm) as min_bpm,
      MAX(bpm) as max_bpm
    FROM beats
  `).get() as any;

  const genres = db.prepare('SELECT DISTINCT genre FROM beat_genres ORDER BY genre').all() as { genre: string }[];
  const moods = db.prepare('SELECT DISTINCT mood FROM beat_moods ORDER BY mood').all() as { mood: string }[];
  const producers = db.prepare('SELECT DISTINCT producer FROM beats WHERE producer != \'\' ORDER BY producer').all() as { producer: string }[];

  return {
    totalBeats: stats.total || 0,
    favorites: stats.favorites || 0,
    collections: getAllCollections().length,
    averageBpm: Math.round(stats.avg_bpm || 0),
    averageEnergy: Math.round(stats.avg_energy || 0),
    bpmRange: {
      min: stats.min_bpm || 0,
      max: stats.max_bpm || 0,
    },
    genres: genres.map(g => g.genre),
    moods: moods.map(m => m.mood),
    producers: producers.map(p => p.producer),
  };
}
