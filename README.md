<p align="center">
  <img src="./assets/rhymebook_logo.jpeg" alt="RhymeBook Logo" width="400">
</p>

<h1 align="center">🎤 RhymeBook - Music Artist MCP App</h1>

<p align="center">
  Your AI-powered creative studio for writing lyrics, finding beats, and tracking sessions.<br>
  <strong>40+ tools</strong> to supercharge your music workflow — from rhyme schemes to vocal separation.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/MCP-Protocol-FF6B6B?style=flat" alt="MCP">
  <img src="https://img.shields.io/badge/SQLite-Database-003B57?style=flat&logo=sqlite&logoColor=white" alt="SQLite">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat" alt="License">
  <img src="https://img.shields.io/badge/tools-40+-orange?style=flat" alt="Tools">
  <img src="https://img.shields.io/badge/tests-78%20passing-brightgreen?style=flat" alt="Tests">
</p>

<p align="center">
  <a href="https://github.com/cavanaughdesign/rhymebook-mcp-server">⭐ Star on GitHub</a> •
  <a href="https://github.com/cavanaughdesign/rhymebook-mcp-server/issues">🐛 Report Bug</a> •
  <a href="https://github.com/cavanaughdesign/rhymebook-mcp-server/issues">💡 Request Feature</a>
</p>

---

## 🎯 What is RhymeBook?

RhymeBook is an **AI-powered music production assistant** that lives inside your favorite AI tools (Claude Desktop, VS Code, and more). It combines powerful lyric writing tools, beat management, and session tracking into one seamless workflow.

### Why Artists Love It

| 🎤 **Write Better** | 🎧 **Find Perfect Beats** | 📊 **Stay Organized** |
|:---|:---|:---|
| AI rhyme finder with slant & multi-syllable matches | Filter by genre, mood, BPM, and energy | Track every session, take, and collaborator |
| Real-time syllable counting & flow analysis | Match lyrics to beats using AI | Visual progress from writing → released |
| Export to text, markdown, JSON, or LRC | Waveform visualization & audio effects | Persistent SQLite database |

### 🚀 Powered by Model Context Protocol

RhymeBook uses MCP to give AI assistants direct access to your music tools. Ask Claude to find rhymes, log a take, or browse beats — it all happens instantly through natural conversation.

---

## ✨ Features

### 📊 Dashboard
- **Overview Stats** - Total songs, sessions, takes, beats, collaborators
- **Song Progress Funnel** - Visual pipeline from writing to released
- **Weekly Activity Chart** - 8-week trend visualization
- **Activity Feed** - Real-time feed of all actions with filtering
- **Insights** - Most productive day, avg session length, completion rate
- **Recent Items** - Quick access to recent songs and sessions
- **Quick Actions** - One-click access to common tasks
- **Beat Library Stats** - Overview of beat collection

### 🎵 Lyric Lab
- **Rhyme Finder** - Find perfect, slant, and multi-syllable rhymes
- **Syllable Counter** - Live syllable counting per line
- **Flow Visualizer** - Visual representation of rhythm patterns
- **Thesaurus** - Contextual word suggestions
- **Section Organizer** - Manage verses, choruses, bridges, and more
- **Save & Export** - Export lyrics in text, markdown, JSON, or LRC formats
- **Import Lyrics** - Import from TXT, JSON, LRC, or SRT files
- **Batch Import/Export** - Process multiple files at once

### 🎛️ Session Tracker
- **Project Dashboard** - Overview of all songs in progress
- **Take Manager** - Log and rate recording takes (1-5 stars)
- **Collaboration Tracker** - Manage features, producers, engineers
- **Milestone Progress** - Visual progress bars (writing → recording → mixing → mastering)
- **Notes & Feedback** - Attach notes to sessions
- **Persistent Storage** - All data saved to SQLite database

### 🎧 Beat Explorer
- **Browse & Filter** - Filter by genre, mood, BPM, energy level
- **Wavesurfer.js Waveform** - Professional waveform visualization
- **Frequency Visualizer** - Live frequency bars during playback
- **Audio Player** - Full playback controls with seek, volume
- **Audio Effects** - Reverb, delay, distortion, and 3-band EQ (Tone.js)
- **Scrub Bar** - Interactive progress bar with drag-to-seek
- **Auto BPM/Key Detection** - music-metadata analyzes audio files
- **Favorites & Collections** - Organize beats into playlists
- **Lyric-to-Beat Matcher** - AI suggests beats matching your lyrics' energy
- **Library Management** - Set custom folder path for beat files
- **Auto-Import** - Scan and import beats from your library folder
- **Copy to Library** - Add beats from anywhere to your library
- **Vocal Separation** - Spleeter AI for stem extraction

## ⚡ Performance & Security

### Performance Optimizations
- **Async File Operations** - All file I/O is non-blocking
- **Database Indexes** - Optimized queries for common operations
- **Parallel Dashboard Queries** - Faster dashboard loading
- **Scan Caching** - Beat library scans cached for 1 minute
- **Real-time Vocal Removal** - No playback restart needed

### Security Features
- **Path Traversal Protection** - Validates all file paths
- **Rate Limiting** - 100 requests per 15 minutes
- **CORS Configuration** - Environment-based origin allowlist
- **Input Validation** - Zod schemas with length limits
- **Graceful Shutdown** - Proper cleanup handlers

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/rhymebook-mcp-server.git
cd rhymebook-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

### Running the Server

#### HTTP Mode (for web-based hosts)
```bash
npm start
# Server runs on http://localhost:3001
# MCP endpoint: http://localhost:3001/mcp
```

#### Stdio Mode (for Claude Desktop)
```bash
npm run start:stdio
```

### Development Mode
```bash
npm run dev
# Runs both server and UI in watch mode
```

## 📁 Project Structure

```
rhymebook-mcp-server/
├── src/
│   ├── server/
│   │   └── index.ts              # MCP server entry point
│   ├── tools/
│   │   ├── lyric-lab.ts          # Lyric Lab tools (9 tools)
│   │   ├── session-tracker.ts    # Session Tracker tools (10 tools)
│   │   ├── beat-explorer.ts      # Beat Explorer tools (14 tools)
│   │   └── dashboard.ts          # Dashboard tools (4 tools)
│   ├── db/
│   │   ├── database.ts           # SQLite database setup
│   │   ├── operations.ts         # Database CRUD operations
│   │   ├── beats-library.ts      # Beat library file management
│   │   └── lyrics-io.ts          # Lyrics import/export
│   └── ui/
│       ├── index.html            # Main HTML template
│       ├── styles.css            # UI styles (dark theme)
│       ├── main.ts               # Client-side logic
│       ├── audio-engine.ts       # Web Audio API engine
│       ├── visualizers.ts        # Waveform & frequency visualizers
│       └── beat-player.ts        # Beat player component
├── dist/
│   ├── server/                   # Compiled server code
│   └── ui/
│       └── index.html            # Bundled single-file UI
├── claude_desktop_config.example.json  # Example Claude Desktop config
├── CONFIGURATION.md              # Detailed configuration guide
├── package.json
├── tsconfig.json
├── tsconfig.server.json
└── vite.config.ts
```

## 🛠️ Available Tools

### Lyric Lab Tools
| Tool | Description |
|------|-------------|
| `find-rhymes` | Find perfect, slant, and multi-syllable rhymes |
| `count-syllables` | Count syllables in lyrics |
| `analyze-flow` | Analyze rhythm and flow patterns |
| `get-synonyms` | Get contextual synonyms |
| `save-lyrics` | Save lyrics to database |
| `export-lyrics` | Export lyrics (text, markdown, JSON, LRC) |
| `import-lyrics` | Import lyrics from file or text |
| `batch-import-lyrics` | Import all lyrics from a directory |
| `get-all-songs` | Get all saved songs |

### Session Tracker Tools
| Tool | Description |
|------|-------------|
| `get-project-dashboard` | Get overview of all songs |
| `get-recording-sessions` | Get recording sessions |
| `log-take` | Log a new recording take |
| `get-collaborators` | Get all collaborators |
| `update-song-progress` | Update song status and progress |
| `add-session-note` | Add notes to a session |
| `create-song` | Create a new song project |
| `create-session` | Schedule a recording session |
| `add-collaborator` | Add a new collaborator |

### Beat Explorer Tools
| Tool | Description |
|------|-------------|
| `browse-beats` | Browse and filter beats |
| `get-beat-details` | Get detailed beat information |
| `toggle-favorite` | Add/remove from favorites |
| `get-collections` | Get all beat collections |
| `add-to-collection` | Add beat to collection |
| `create-collection` | Create a new collection |
| `match-lyrics-to-beat` | Find beats matching lyrics |
| `get-beat-stats` | Get library statistics |
| `add-beat` | Add a new beat (auto-detects BPM/key) |
| `analyze-audio` | Analyze audio file for BPM, key, duration |

### Audio Processing Tools
| Tool | Description |
|------|-------------|
| `separate-audio` | Separate audio into stems using Spleeter AI |
| `extract-vocals` | Extract vocals from a track |
| `check-audio-tools` | Check available audio processing tools |

### Library Management Tools
| Tool | Description |
|------|-------------|
| `get-library-path` | Get current beats library path |
| `set-library-path` | Set beats library folder path |
| `scan-library` | Scan library for audio files |
| `import-beats` | Import new beats from library |
| `copy-beat-to-library` | Copy beat file to library |

### Dashboard Tools
| Tool | Description |
|------|-------------|
| `get-dashboard-summary` | Get comprehensive overview of all data |
| `get-recent-activity` | Get activity feed with filtering |
| `get-progress-stats` | Get detailed progress statistics |
| `get-quick-stats` | Get quick stats for widgets |

## 🎨 UI Features

- **Dark Theme** - Easy on the eyes for late-night sessions
- **Responsive Design** - Works on desktop and tablet
- **Real-time Updates** - Instant feedback as you type
- **Toast Notifications** - Clear feedback for actions
- **Modal Dialogs** - Clean export interface
- **Drag & Drop** - Reorder song sections
- **Keyboard Shortcuts** - Ctrl+S (save), Ctrl+N (new), Space (play/pause), Escape (close modal)
- **Auto-Save** - Automatic save after 30 seconds of inactivity
- **Loading States** - Visual feedback during async operations

## 🎤 Vocal Removal

RhymeBook includes real-time vocal removal for practicing and remixing:

- **Center Channel Extraction** - Removes centered vocals from stereo tracks
- **Real-time Adjustment** - Smooth slider control with no audio glitches
- **Frequency Filtering** - Attenuates vocal frequency ranges (250Hz - 3.5kHz)

### How to Use
1. Load a beat in the Beat Explorer
2. Use the **🎤 Vocals** slider in the player controls
3. Slide right to reduce vocals (0% = original, 100% = maximum removal)

### Best Results
- ✅ Stereo tracks with centered vocals
- ✅ Modern pop/hip-hop productions
- ⚠️ Older stereo mixes (moderate results)
- ❌ Mono tracks (no stereo information to extract)

## 💾 Database

RhymeBook uses SQLite for persistent storage. The database is automatically created at:
- **Windows**: `%USERPROFILE%\.rhymebook\rhymebook.db`
- **Mac/Linux**: `~/.rhymebook/rhymebook.db`

### Database Schema
| Table | Description |
|-------|-------------|
| `songs` | Song projects with title, status, progress, notes |
| `song_sections` | Lyrics organized by section type (verse, chorus, etc.) |
| `collaborators` | Artists, producers, engineers, writers |
| `song_collaborators` | Many-to-many relationship between songs and collaborators |
| `recording_sessions` | Studio session tracking with date, studio, engineer |
| `takes` | Individual recording takes with ratings (1-5 stars) |
| `beats` | Beat library with BPM, key, energy, file path |
| `beat_genres` | Genre tags for beats (many-to-many) |
| `beat_moods` | Mood tags for beats (many-to-many) |
| `beat_tags` | Custom tags for beats |
| `collections` | Named beat playlists |
| `collection_beats` | Beats in collections with position |
| `settings` | App configuration (library path, theme) |

### Database Indexes
Optimized indexes for common queries:
- Songs by status and update date
- Sessions by date and song
- Takes by session and timestamp
- Beats by favorite status, BPM, and energy

## 📁 Beats Library Management

### Setting Your Library Path
Use the `set-library-path` tool to point to your beats folder:
```
Set library path: C:\Users\You\Music\Beats
```

### Supported Audio Formats
- MP3, WAV, FLAC, AAC, OGG, M4A, WMA

### Auto-Import Beats
1. Set your library path
2. Run `scan-library` to see all audio files
3. Run `import-beats` to add them to the database

### Filename Parsing
RhymeBook automatically extracts info from filenames:
- `Beat Name 140BPM Am.mp3` → Title: "Beat Name", BPM: 140, Key: Am
- `Dark_Trap_150_Cm.wav` → Title: "Dark Trap", BPM: 150, Key: Cm

## ⚙️ Configuration

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3001` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:3000,http://localhost:3001,http://localhost:5173` |

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

**Windows:**
```json
{
  "mcpServers": {
    "rhymebook": {
      "command": "node",
      "args": ["C:\\Users\\YourUsername\\path\\to\\rhymebook-mcp-server\\dist\\server\\index.js", "--stdio"]
    }
  }
}
```

**macOS/Linux:**
```json
{
  "mcpServers": {
    "rhymebook": {
      "command": "node",
      "args": ["/Users/yourusername/path/to/rhymebook-mcp-server/dist/server/index.js", "--stdio"]
    }
  }
}
```

**With Environment Variables:**
```json
{
  "mcpServers": {
    "rhymebook": {
      "command": "node",
      "args": ["/path/to/rhymebook-mcp-server/dist/server/index.js", "--stdio"],
      "env": {
        "PORT": "3001"
      }
    }
  }
}
```

### VS Code Configuration

Add to your VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "rhymebook": {
      "command": "node",
      "args": ["${workspaceFolder}/dist/server/index.js", "--stdio"]
    }
  }
}
```

### HTTP Mode (for web-based hosts)

```json
{
  "mcpServers": {
    "rhymebook-http": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

> 📖 **For detailed configuration instructions, see [CONFIGURATION.md](./CONFIGURATION.md)**

## 📝 Usage Examples

### Finding Rhymes
```
User: Find rhymes for "flow"
Assistant: [Calls find-rhymes tool]
Result: Perfect: go, show, know, grow...
        Slant: soul, roll, control...
        Multi: overflow, undertow...
```

### Matching Lyrics to Beats
```
User: I have aggressive lyrics about hustling, find me a beat
Assistant: [Calls match-lyrics-to-beat with lyrics]
Result: Suggested beats ranked by energy/mood match
```

### Tracking Recording Sessions
```
User: Log take 4 for today's session - 5 stars, best take!
Assistant: [Calls log-take tool]
Result: Take logged, marked as best take
```

### Getting Dashboard Overview
```
User: Show me my project dashboard
Assistant: [Calls get-dashboard-summary tool]
Result: Overview stats, recent activity, insights
```

### Vocal Removal
```
User: Play this beat with vocals removed
Assistant: [Loads beat in player, sets vocal removal to 100%]
Result: Instrumental version plays
```



## 🗺️ Roadmap

- [ ] SoundCloud integration for beat discovery
- [ ] Spotify playlist sync
- [ ] AI-powered lyric suggestions
- [ ] Collaborative sessions with real-time sync
- [ ] Mobile companion app
- [ ] Export to DAW formats (MIDI, stems)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/rhymebook-mcp-server.git
cd rhymebook-mcp-server

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Anthony M Cavanaugh** (he/him)
- Company: [Cavanaugh Design Studio](https://cavanaughdesignstudio.com)
- GitHub: [@cavanaughdesign](https://github.com/cavanaughdesign)
- Email: cavanaughdesign@gmail.com
- Twitter/X: [@cavanaughdesign](https://twitter.com/cavanaughdesign)
- Instagram: [@cavanaughdesignstudio](https://instagram.com/cavanaughdesignstudio)

## 🙏 Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io/)
- UI powered by [MCP Apps SDK](https://github.com/modelcontextprotocol/ext-apps)
- Audio processing with [Tone.js](https://tonejs.github.io/) and [Wavesurfer.js](https://wavesurfer-js.org/)
- Database powered by [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3)
- Inspired by the creative process of music artists everywhere

---

<p align="center">
  <strong>Made with 🎤 by <a href="https://cavanaughdesignstudio.com">Cavanaugh Design Studio</a></strong><br>
  <em>For artists who rap, write, and create</em>
</p>
