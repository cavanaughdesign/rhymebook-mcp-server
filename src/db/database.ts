import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path - stored in user's home directory
const DB_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.rhymebook');
const DB_PATH = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(DB_DIR, 'rhymebook.db');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database
let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  const database = db;

  // Songs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT CHECK(status IN ('writing', 'recording', 'mixing', 'mastering', 'released')) DEFAULT 'writing',
      progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Song sections table
  database.exec(`
    CREATE TABLE IF NOT EXISTS song_sections (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL,
      type TEXT CHECK(type IN ('intro', 'verse', 'chorus', 'bridge', 'outro', 'hook')) NOT NULL,
      content TEXT DEFAULT '',
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    )
  `);

  // Collaborators table
  database.exec(`
    CREATE TABLE IF NOT EXISTS collaborators (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT CHECK(role IN ('artist', 'producer', 'engineer', 'writer', 'feature')) NOT NULL,
      contact TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Song-Collaborator relationship
  database.exec(`
    CREATE TABLE IF NOT EXISTS song_collaborators (
      song_id TEXT NOT NULL,
      collaborator_id TEXT NOT NULL,
      PRIMARY KEY (song_id, collaborator_id),
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
      FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE
    )
  `);

  // Recording sessions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS recording_sessions (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL,
      date TEXT NOT NULL,
      studio TEXT DEFAULT '',
      engineer TEXT DEFAULT '',
      duration INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      status TEXT CHECK(status IN ('scheduled', 'in-progress', 'completed')) DEFAULT 'scheduled',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    )
  `);

  // Takes table
  database.exec(`
    CREATE TABLE IF NOT EXISTS takes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      take_number INTEGER NOT NULL,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5) DEFAULT 3,
      notes TEXT DEFAULT '',
      timestamp TEXT DEFAULT (datetime('now')),
      duration INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE CASCADE
    )
  `);

  // Beats table
  database.exec(`
    CREATE TABLE IF NOT EXISTS beats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      producer TEXT DEFAULT '',
      file_path TEXT,
      bpm INTEGER DEFAULT 0,
      key_signature TEXT DEFAULT '',
      duration INTEGER DEFAULT 0,
      energy INTEGER DEFAULT 50 CHECK(energy >= 0 AND energy <= 100),
      favorite INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Beat genres (many-to-many)
  database.exec(`
    CREATE TABLE IF NOT EXISTS beat_genres (
      beat_id TEXT NOT NULL,
      genre TEXT NOT NULL,
      PRIMARY KEY (beat_id, genre),
      FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE CASCADE
    )
  `);

  // Beat moods (many-to-many)
  database.exec(`
    CREATE TABLE IF NOT EXISTS beat_moods (
      beat_id TEXT NOT NULL,
      mood TEXT NOT NULL,
      PRIMARY KEY (beat_id, mood),
      FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE CASCADE
    )
  `);

  // Beat tags
  database.exec(`
    CREATE TABLE IF NOT EXISTS beat_tags (
      beat_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (beat_id, tag),
      FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE CASCADE
    )
  `);

  // Collections table
  database.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Collection beats (many-to-many)
  database.exec(`
    CREATE TABLE IF NOT EXISTS collection_beats (
      collection_id TEXT NOT NULL,
      beat_id TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      PRIMARY KEY (collection_id, beat_id),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE CASCADE
    )
  `);

  // Settings table
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Insert default settings
  const insertSetting = database.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);
  insertSetting.run('beats_library_path', path.join(DB_DIR, 'beats'));
  insertSetting.run('theme', 'dark');

  // Create indexes for common queries
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_songs_status ON songs(status);
    CREATE INDEX IF NOT EXISTS idx_songs_updated ON songs(updated_at);
    CREATE INDEX IF NOT EXISTS idx_songs_created ON songs(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON recording_sessions(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_song ON recording_sessions(song_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON recording_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_takes_session ON takes(session_id);
    CREATE INDEX IF NOT EXISTS idx_takes_timestamp ON takes(timestamp);
    CREATE INDEX IF NOT EXISTS idx_beats_favorite ON beats(favorite);
    CREATE INDEX IF NOT EXISTS idx_beats_bpm ON beats(bpm);
    CREATE INDEX IF NOT EXISTS idx_beats_energy ON beats(energy);
    CREATE INDEX IF NOT EXISTS idx_sections_song ON song_sections(song_id);
  `);
}

// Helper to generate unique IDs
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

// Close database connection
export function closeDatabase() {
  if (db) {
    db.close();
    db = undefined as any;
  }
}
