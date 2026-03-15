---
name: rhymebook-mcp
description: Comprehensive skill for building, extending, and maintaining the RhymeBook MCP App - a music artist studio with Lyric Lab, Session Tracker, Beat Explorer, and Dashboard. Use when working with MCP server tools, database operations, audio processing, UI components, or any RhymeBook-related development tasks. Trigger on: "rhymebook", "lyric lab", "session tracker", "beat explorer", "music artist app", "MCP app for music".
---

# RhymeBook MCP App Skill

This skill provides comprehensive guidance for developing, extending, and maintaining the RhymeBook MCP App - a full-featured music artist studio built on the Model Context Protocol.

## Quick Reference

| Task | File(s) to Edit | Key Consideration |
|------|-----------------|-------------------|
| Add new MCP tool | `src/tools/*.ts` | Register with `registerAppTool()`, add Zod schema |
| Add database table | `src/db/database.ts`, `src/db/operations.ts` | Add index for common queries |
| Add UI component | `src/ui/index.html`, `src/ui/styles.css`, `src/ui/main.ts` | Follow dark theme CSS variables |
| Add audio feature | `src/ui/audio-engine.ts`, `src/ui/visualizers.ts` | Use Web Audio API |
| Fix security issue | `src/server/index.ts` | Validate paths, sanitize inputs |
| Update documentation | `README.md`, `CONFIGURATION.md` | Keep tool counts accurate |

## Decision Tree: Which File to Edit?

```
User request involves...
├── MCP tool behavior? → src/tools/[category].ts
│   ├── Lyric-related → lyric-lab.ts
│   ├── Session/recording → session-tracker.ts
│   ├── Beats/audio → beat-explorer.ts
│   └── Dashboard/stats → dashboard.ts
├── Database changes? → src/db/
│   ├── Schema → database.ts
│   ├── CRUD operations → operations.ts
│   ├── Beat files → beats-library.ts
│   └── Lyrics I/O → lyrics-io.ts
├── UI changes? → src/ui/
│   ├── Layout/HTML → index.html
│   ├── Styling → styles.css
│   ├── Client logic → main.ts
│   ├── Audio playback → audio-engine.ts
│   ├── Visualizations → visualizers.ts
│   └── Player component → beat-player.ts
└── Server config? → src/server/index.ts
```

## Project Overview

RhymeBook is an MCP App that provides music artists with:
- **Lyric Lab** - AI-powered lyric writing with rhyme finding, syllable counting, flow visualization
- **Session Tracker** - Recording session management with takes, collaborators, and progress tracking
- **Beat Explorer** - Audio playback with waveform visualization, vocal removal, and beat library management
- **Dashboard** - Comprehensive overview with activity feed, insights, and quick actions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  MCP Host (Claude Desktop / VS Code / Web)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  MCP Protocol Layer                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │ Stdio       │  │ HTTP        │  │ SSE         │    │   │
│  │  │ Transport   │  │ Transport   │  │ Transport   │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  RhymeBook MCP Server                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │ Lyric Lab   │  │ Session     │  │ Beat        │    │   │
│  │  │ Tools (9)   │  │ Tracker(10) │  │ Explorer(14)│    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  │  ┌─────────────┐                                      │   │
│  │  │ Dashboard   │                                      │   │
│  │  │ Tools (4)   │                                      │   │
│  │  └─────────────┘                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Data Layer                                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │ SQLite DB   │  │ Beats       │  │ Lyrics      │    │   │
│  │  │ (13 tables) │  │ Library     │  │ Import/Export│   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  UI Layer (Single HTML Bundle)                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │ Dashboard   │  │ Lyric Lab   │  │ Beat Player │    │   │
│  │  │ UI          │  │ UI          │  │ + Visualizer│    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
rhymebook-mcp-server/
├── src/
│   ├── server/
│   │   └── index.ts              # MCP server entry point
│   ├── tools/
│   │   ├── lyric-lab.ts          # 9 Lyric Lab tools
│   │   ├── session-tracker.ts    # 10 Session Tracker tools
│   │   ├── beat-explorer.ts      # 14 Beat Explorer tools
│   │   └── dashboard.ts          # 4 Dashboard tools
│   ├── db/
│   │   ├── database.ts           # SQLite setup & schema
│   │   ├── operations.ts         # CRUD operations
│   │   ├── beats-library.ts      # Beat file management
│   │   └── lyrics-io.ts          # Lyrics import/export
│   └── ui/
│       ├── index.html            # Main HTML template
│       ├── styles.css            # Dark theme styles
│       ├── main.ts               # Client-side logic
│       ├── audio-engine.ts       # Web Audio API engine
│       ├── visualizers.ts        # Waveform & frequency
│       └── beat-player.ts        # Beat player component
├── dist/                         # Built files
├── assets/                       # Logo and assets
├── .github/skills/               # This skill
├── claude_desktop_config.example.json
├── CONFIGURATION.md
└── package.json
```

## MCP Tools Reference

### Lyric Lab Tools (9)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `find-rhymes` | Find rhymes for a word | `word: string` |
| `count-syllables` | Count syllables in text | `text: string` |
| `analyze-flow` | Analyze rhythm patterns | `lyrics: string` |
| `get-synonyms` | Find synonyms | `word: string` |
| `save-lyrics` | Save lyrics to DB | `title, sections[], notes?` |
| `export-lyrics` | Export in various formats | `title, sections[], format` |
| `import-lyrics` | Import from file/text | `filePath?`, `content?`, `title?` |
| `batch-import-lyrics` | Import directory | `directoryPath: string` |
| `get-all-songs` | List all songs | `filter?: status` |

### Session Tracker Tools (10)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `get-project-dashboard` | Overview stats | `filter?: status` |
| `get-recording-sessions` | List sessions | `songId?`, `status?` |
| `log-take` | Log recording take | `sessionId, rating, notes, duration` |
| `get-collaborators` | List collaborators | `role?: string` |
| `update-song-progress` | Update song | `songId, status?, progress?, notes?` |
| `add-session-note` | Add note to session | `sessionId, note` |
| `create-song` | Create new song | `title, collaborators?, notes?` |
| `create-session` | Schedule session | `songId, date, studio?, engineer?` |
| `add-collaborator` | Add collaborator | `name, role, contact?, songId?` |

### Beat Explorer Tools (14)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `browse-beats` | Browse/filter beats | `genre?, mood?, minBpm?, maxBpm?` |
| `get-beat-details` | Get beat info | `beatId: string` |
| `toggle-favorite` | Toggle favorite | `beatId: string` |
| `get-collections` | List collections | - |
| `add-to-collection` | Add beat to collection | `beatId, collectionName` |
| `create-collection` | Create collection | `name: string` |
| `match-lyrics-to-beat` | Match lyrics to beats | `lyrics, preferredBpm?, preferredGenre?` |
| `get-beat-stats` | Library statistics | - |
| `add-beat` | Add beat manually | `title, producer?, bpm?, key?` |
| `get-library-path` | Get library path | - |
| `set-library-path` | Set library path | `path: string` |
| `scan-library` | Scan for audio files | - |
| `import-beats` | Import from library | - |
| `copy-beat-to-library` | Copy file to library | `sourcePath: string` |

### Dashboard Tools (4)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `get-dashboard-summary` | Full dashboard data | `timeframe?: week/month/all` |
| `get-recent-activity` | Activity feed | `limit?, offset?, type?` |
| `get-progress-stats` | Progress statistics | `timeframe?: week/month/quarter/year` |
| `get-quick-stats` | Quick stats | - |

## Database Schema

### Core Tables

```sql
-- Songs
CREATE TABLE songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT CHECK(status IN ('writing', 'recording', 'mixing', 'mastering', 'released')),
  progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Song Sections
CREATE TABLE song_sections (
  id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('intro', 'verse', 'chorus', 'bridge', 'outro', 'hook')),
  content TEXT DEFAULT '',
  position INTEGER DEFAULT 0,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

-- Recording Sessions
CREATE TABLE recording_sessions (
  id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL,
  date TEXT NOT NULL,
  studio TEXT DEFAULT '',
  engineer TEXT DEFAULT '',
  duration INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT CHECK(status IN ('scheduled', 'in-progress', 'completed')),
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

-- Takes
CREATE TABLE takes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  take_number INTEGER NOT NULL,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  notes TEXT DEFAULT '',
  timestamp TEXT DEFAULT (datetime('now')),
  duration INTEGER DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE CASCADE
);

-- Beats
CREATE TABLE beats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  producer TEXT DEFAULT '',
  file_path TEXT,
  bpm INTEGER DEFAULT 0,
  key_signature TEXT DEFAULT '',
  duration INTEGER DEFAULT 0,
  energy INTEGER DEFAULT 50 CHECK(energy >= 0 AND energy <= 100),
  favorite INTEGER DEFAULT 0
);
```

## Development Workflows

### Adding a New Tool

1. **Define the tool** in the appropriate tools file:
```typescript
registerAppTool(
  server,
  'tool-name',
  {
    title: 'Tool Title',
    description: 'What the tool does',
    inputSchema: {
      param: z.string().describe('Parameter description'),
    },
    _meta: {
      ui: {
        resourceUri: 'ui://rhymebook/app.html',
      },
    },
  },
  async ({ param }) => {
    // Implementation
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ result: 'data' }),
      }],
    };
  }
);
```

2. **Add database operations** if needed in `src/db/operations.ts`
3. **Update UI** if the tool needs frontend interaction
4. **Update README** with tool documentation

### Adding a New Database Table

1. **Add schema** in `src/db/database.ts`:
```typescript
database.exec(`
  CREATE TABLE IF NOT EXISTS new_table (
    id TEXT PRIMARY KEY,
    ...
  )
`);
```

2. **Add index** for common queries:
```typescript
database.exec(`CREATE INDEX IF NOT EXISTS idx_new_table_x ON new_table(x)`);
```

3. **Add operations** in `src/db/operations.ts`:
```typescript
export function createNewItem(data: DataType): ItemType { ... }
export function getItem(id: string): ItemType | null { ... }
export function getAllItems(): ItemType[] { ... }
export function updateItem(id: string, updates: Partial<ItemType>): ItemType | null { ... }
export function deleteItem(id: string): boolean { ... }
```

### Adding UI Components

1. **Add HTML** in `src/ui/index.html`
2. **Add styles** in `src/ui/styles.css` following the dark theme:
```css
.new-component {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
}
```

3. **Add logic** in `src/ui/main.ts`
4. **Rebuild**: `npm run build`

### Audio Processing

The audio engine uses Web Audio API with Tone.js effects:
- **AudioEngine** (`audio-engine.ts`) - Core playback, processing, and effects
- **WaveformVisualizer** (`visualizers.ts`) - Wavesurfer.js waveform display
- **FrequencyVisualizer** (`visualizers.ts`) - Live frequency bars
- **ScrubBar** (`visualizers.ts`) - Interactive progress bar
- **BeatPlayer** (`beat-player.ts`) - Complete player with effects panel

### Audio Effects (Tone.js)
- **Reverb** - Room ambience (0-100%)
- **Delay** - Echo effect (0-100%)
- **Distortion** - Overdrive/fuzz (0-100%)
- **EQ3** - 3-band equalizer (Low/Mid/High, -12 to +12 dB)

### Audio Analysis (music-metadata)
- Auto-detect BPM from audio files
- Auto-detect musical key
- Extract duration and format info
- Read ID3 tags and metadata

### Vocal Removal
- Center channel extraction (built-in)
- Spleeter AI separation (optional, requires `pip install spleeter`)
- 2-stem (vocals/accompaniment) or 4/5-stem separation

### Rhyme Finding (Datamuse API)
- Unlimited rhymes via API (no database limit)
- Perfect rhymes, slant rhymes, similar words
- Synonyms and word associations
- Falls back to local database if API unavailable

## Security Considerations

### Path Traversal Protection
All file paths are validated:
```typescript
const normalizedPath = normalize(resolve(filePath));
const normalizedLibrary = normalize(resolve(libraryPath));
if (!normalizedPath.startsWith(normalizedLibrary + path.sep)) {
  // Block access
}
```

### Input Validation
All inputs use Zod schemas with length limits:
```typescript
title: z.string().min(1).max(200).describe('Song title'),
content: z.string().max(50000).describe('Lyrics content'),
```

### Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable via environment variables

### CORS
- Environment-based origin allowlist
- Default: localhost origins only

## Performance Optimizations

- **Async I/O** - All file operations are non-blocking
- **Database Indexes** - Optimized for common queries
- **Parallel Queries** - Dashboard uses Promise.all
- **Scan Caching** - Beat library scans cached for 1 minute
- **Real-time Processing** - Vocal removal uses filters, not buffer processing

## Common Tasks

### Run the Server
```bash
# HTTP mode
npm start

# Stdio mode (for Claude Desktop)
npm run start:stdio

# Development mode
npm run dev
```

### Build the Project
```bash
npm run build          # Full build
npm run build:server   # Server only
npm run build:ui       # UI only
```

### Test MCP Connection
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/mcp" `
  -Method Post `
  -ContentType "application/json" `
  -Headers @{"Accept"="application/json, text/event-stream"} `
  -Body '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Database Location
- Windows: `%USERPROFILE%\.rhymebook\rhymebook.db`
- Mac/Linux: `~/.rhymebook/rhymebook.db`

## Troubleshooting

### Server Won't Start
1. Check Node.js version (18+ required)
2. Rebuild: `npm run build`
3. Check port availability: `netstat -an | findstr 3001`

### Database Errors
1. Check database file exists
2. Verify file permissions
3. Delete and recreate if corrupted

### Audio Won't Play
1. Verify beat has file_path in database
2. Check file exists on disk
3. Verify file format is supported
4. Check server logs for path traversal blocks

### TypeScript Errors
1. Run `npm run build:server` to check server errors
2. Run `npm run build:ui` to check UI errors
3. Common issues: missing type annotations, interface mismatches

## Rules

### ALWAYS Do
1. **Use async/await** for all file operations
2. **Validate inputs** with Zod schemas including length limits
3. **Use parameterized queries** (better-sqlite3 prepared statements)
4. **Handle errors gracefully** with try/catch and user-friendly messages
5. **Update README.md** when adding new tools or features
6. **Test MCP tools** after changes using the test command
7. **Follow dark theme** CSS variables (`--bg-card`, `--accent-primary`, etc.)
8. **Use TypeScript strict mode** with explicit type annotations
9. **Add database indexes** for any new frequently-queried columns
10. **Register tools** with `_meta.ui.resourceUri: 'ui://rhymebook/app.html'`

### NEVER Do
1. **NEVER use synchronous file operations** in the server (blocks event loop)
2. **NEVER trust user-supplied file paths** without validation
3. **NEVER store passwords or secrets** in the database without encryption
4. **NEVER skip Zod validation** on tool inputs
5. **NEVER hardcode URLs** - use environment variables
6. **NEVER delete database tables** without migration strategy
7. **NEVER expose internal file paths** in error messages to users
8. **NEVER use `any` type** without explicit justification

## Success Criteria

When implementing features, verify:

### For MCP Tools
- [ ] Tool is registered with `registerAppTool()`
- [ ] Input schema uses Zod with `.describe()` on all fields
- [ ] Input schema includes length limits (`.max()`)
- [ ] Returns JSON in `content[0].text`
- [ ] Has `_meta.ui.resourceUri` set
- [ ] Error cases return `{ error: "message" }`

### For Database Changes
- [ ] Schema includes `id TEXT PRIMARY KEY`
- [ ] Foreign keys have `ON DELETE CASCADE`
- [ ] Indexes added for common query patterns
- [ ] CRUD operations in `operations.ts`
- [ ] Type exports for TypeScript

### For UI Components
- [ ] Uses CSS variables from dark theme
- [ ] Responsive design (works on mobile)
- [ ] Loading states implemented
- [ ] Error states implemented
- [ ] Keyboard accessible (tabindex, role)
- [ ] Toast notifications for user feedback

### For Audio Features
- [ ] Uses Web Audio API (not HTML5 Audio)
- [ ] Handles AudioContext suspension
- [ ] Cleans up resources on destroy
- [ ] Supports seek/range requests
- [ ] Graceful fallback for unsupported formats

## Performance Hints

### Database
```typescript
// GOOD: Use indexes
db.prepare('SELECT * FROM songs WHERE status = ?').all(status);

// BAD: Full table scan
db.prepare('SELECT * FROM songs').all().filter(s => s.status === status);
```

### File Operations
```typescript
// GOOD: Async with error handling
try {
  await fs.access(filePath);
  const content = await fs.readFile(filePath, 'utf-8');
} catch (err) {
  return { error: 'File not accessible' };
}

// BAD: Sync blocking
const content = fs.readFileSync(filePath, 'utf-8');
```

### UI Updates
```typescript
// GOOD: Batch DOM updates
const html = items.map(item => `<div>${item}</div>`).join('');
container.innerHTML = html;

// BAD: Multiple DOM writes
items.forEach(item => {
  container.innerHTML += `<div>${item}</div>`;
});
```

## Progressive Updates

This skill improves over time. When you discover:

1. **A new pattern** that works well → Add it to Best Practices
2. **A common mistake** → Add it to NEVER Do
3. **A useful shortcut** → Add it to Quick Reference
4. **A better example** → Replace the existing one
5. **A missing tool** → Add it to the Tools Reference

## Good Examples

### Adding a Tool (Complete Example)
```typescript
// In src/tools/lyric-lab.ts
registerAppTool(
  server,
  'find-rhymes',
  {
    title: 'Find Rhymes',
    description: 'Find perfect, slant, and multi-syllable rhymes for a word',
    inputSchema: {
      word: z.string().min(1).max(50).describe('The word to find rhymes for'),
    },
    _meta: {
      ui: {
        resourceUri: 'ui://rhymebook/app.html',
      },
    },
  },
  async ({ word }) => {
    try {
      const rhymes = await findRhymes(word);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ word, rhymes, totalResults: rhymes.length }),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Failed to find rhymes: ${error.message}` }),
        }],
      };
    }
  }
);
```

### Adding a Database Table (Complete Example)
```typescript
// In src/db/database.ts
database.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

database.exec(`CREATE INDEX IF NOT EXISTS idx_playlists_name ON playlists(name)`);

// In src/db/operations.ts
export interface Playlist {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export function createPlaylist(name: string, description?: string): Playlist {
  const db = getDatabase();
  const id = generateId('playlist');
  db.prepare('INSERT INTO playlists (id, name, description) VALUES (?, ?, ?)').run(id, name, description || '');
  return getPlaylist(id)!;
}

export function getPlaylist(id: string): Playlist | null {
  const db = getDatabase();
  return db.prepare('SELECT * FROM playlists WHERE id = ?').get(id) as Playlist | null;
}
```

## Reference Files

| File | Purpose | When to Load |
|------|---------|--------------|
| `references/tool-examples.md` | Detailed tool usage examples | When implementing tool calls |
| `references/patterns.md` | Good patterns and anti-patterns | When writing new code |
| `references/quick-reference.md` | Quick lookup for commands, CSS vars, templates | During development |

## Related Project Files

- `README.md` - Main documentation
- `CONFIGURATION.md` - Detailed configuration guide
- `claude_desktop_config.example.json` - Example Claude Desktop config
- `config.example.json` - Application config template
