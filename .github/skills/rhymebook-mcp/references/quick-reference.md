# RhymeBook Quick Reference Card

## 🚀 Common Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Full production build
npm run build:server     # Build server only
npm run build:ui         # Build UI only
npm start                # Start production server
npm run start:stdio      # Start in stdio mode (Claude Desktop)

# Testing
Invoke-RestMethod -Uri "http://localhost:3001/mcp" -Method Post `
  -ContentType "application/json" `
  -Headers @{"Accept"="application/json, text/event-stream"} `
  -Body '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## 📁 File Locations

| What | Where |
|------|-------|
| MCP Tools | `src/tools/*.ts` |
| Database Schema | `src/db/database.ts` |
| CRUD Operations | `src/db/operations.ts` |
| UI Components | `src/ui/*.ts` |
| Styles | `src/ui/styles.css` |
| Server Entry | `src/server/index.ts` |
| Database File | `~/.rhymebook/rhymebook.db` |
| Beats Library | `~/.rhymebook/beats/` |

## 🎨 CSS Variables (Dark Theme)

```css
/* Backgrounds */
--bg-primary: #0d0d0d;
--bg-secondary: #1a1a1a;
--bg-tertiary: #252525;
--bg-card: #1e1e1e;
--bg-hover: #2a2a2a;

/* Text */
--text-primary: #ffffff;
--text-secondary: #b0b0b0;
--text-muted: #666666;

/* Accents */
--accent-primary: #9333ea;
--accent-secondary: #a855f7;
--accent-gold: #fbbf24;

/* Status */
--success: #22c55e;
--warning: #f59e0b;
--error: #ef4444;
--info: #3b82f6;

/* Spacing */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;

/* Radius */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
```

## 🔧 Tool Registration Template

```typescript
registerAppTool(
  server,
  'tool-name',
  {
    title: 'Tool Title',
    description: 'What it does',
    inputSchema: {
      param: z.string().min(1).max(200).describe('Description'),
    },
    _meta: {
      ui: { resourceUri: 'ui://rhymebook/app.html' },
    },
  },
  async ({ param }) => {
    try {
      // Implementation
      return {
        content: [{ type: 'text', text: JSON.stringify({ result: 'data' }) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
      };
    }
  }
);
```

## 🗄️ Database Query Patterns

```typescript
// Get single item
db.prepare('SELECT * FROM table WHERE id = ?').get(id);

// Get all items
db.prepare('SELECT * FROM table ORDER BY created_at DESC').all();

// Insert
db.prepare('INSERT INTO table (id, name) VALUES (?, ?)').run(id, name);

// Update
db.prepare('UPDATE table SET name = ?, updated_at = datetime(\'now\') WHERE id = ?').run(name, id);

// Delete
db.prepare('DELETE FROM table WHERE id = ?').run(id);

// Count
db.prepare('SELECT COUNT(*) as count FROM table').get();

// With index
db.prepare('SELECT * FROM songs WHERE status = ? ORDER BY updated_at DESC').all(status);
```

## 🎵 Audio API Quick Reference

```typescript
// Initialize
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;

// Load audio
const response = await fetch(url);
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

// Play
const source = audioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(analyser);
analyser.connect(audioContext.destination);
source.start();

// Get frequency data
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);

// Get waveform data
analyser.getByteTimeDomainData(dataArray);
```

## 🎯 Zod Schema Examples

```typescript
// String with length limits
z.string().min(1).max(200).describe('Title')

// Number with range
z.number().min(0).max(100).describe('Progress percentage')

// Optional field
z.string().optional().describe('Optional note')

// Enum
z.enum(['writing', 'recording', 'mixing']).describe('Status')

// Array with limits
z.array(z.string()).max(10).describe('Tags')

// Object
z.object({
  type: z.enum(['verse', 'chorus']),
  content: z.string().max(5000),
}).describe('Section')
```

## 🐛 Common Fixes

| Error | Fix |
|-------|-----|
| `Property 'text' does not exist` | Use `getTextContent(result)` helper |
| `Parameter implicitly has 'any' type` | Add explicit type annotation |
| `Property 'x' does not exist on type` | Add to interface definition |
| `Cannot find module` | Check import path and file extension |
| `EADDRINUSE` | Change PORT or kill existing process |
| `SQLITE_ERROR` | Check table exists and column names |
