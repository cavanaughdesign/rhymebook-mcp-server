# RhymeBook MCP Server - UI Refactoring

## Overview

This refactoring addresses the Claude Desktop 5MB size limit warning by splitting the monolithic UI into lightweight individual tool UIs while keeping the full dashboard as a streamable interface.

## Architecture Changes

### Before
- Single bundled `app.html` (~635KB) served for all tools
- All tools pointed to `ui://rhymebook/app.html`
- Heavy dependencies (Tone.js, Wavesurfer.js) bundled together

### After
- **Dashboard** (`app.html`): Full dashboard UI for overview and navigation (~635KB)
- **Lyric Lab** (`lyric-lab.html`): Lightweight lyric writing tools (~15KB)
- **Session Tracker** (`session-tracker.html`): Recording session management (~19KB)
- **Beat Explorer** (`beat-explorer.html`): Beat browsing and filtering (~20KB)
- **Audio Player** (`audio-player.html`): Audio playback controls (~16KB)

## File Structure

```
src/ui/
├── index.html          # Full dashboard (streamable)
├── main.ts             # Dashboard logic
├── styles.css          # Dashboard styles
├── audio-engine.ts     # Audio engine (for dashboard)
├── beat-player.ts      # Beat player (for dashboard)
├── visualizers.ts      # Visualizers (for dashboard)
└── tools/
    ├── lyric-lab.html      # Lightweight lyric lab UI
    ├── session-tracker.html # Lightweight session tracker UI
    ├── beat-explorer.html   # Lightweight beat explorer UI
    └── audio-player.html    # Lightweight audio player UI
```

## Tool Registration Updates

All tool registrations now point to their respective lightweight UIs:

| Tool Category | UI Resource URI | Size |
|--------------|-----------------|------|
| Dashboard | `ui://rhymebook/app.html` | ~635KB |
| Lyric Lab | `ui://rhymebook/lyric-lab.html` | ~15KB |
| Session Tracker | `ui://rhymebook/session-tracker.html` | ~19KB |
| Beat Explorer | `ui://rhymebook/beat-explorer.html` | ~20KB |
| Audio Processing | `ui://rhymebook/audio-player.html` | ~16KB |

## Benefits

1. **Size Compliance**: Individual UIs are well under the 5MB limit
2. **Faster Loading**: Lightweight UIs load instantly
3. **Better UX**: Focused interfaces for each tool
4. **Maintainability**: Easier to update individual UIs
5. **Performance**: No unnecessary code loaded for simple tasks

## Server Changes

The server now registers multiple UI resources:
- `ui://rhymebook/app.html` - Dashboard
- `ui://rhymebook/lyric-lab.html` - Lyric Lab
- `ui://rhymebook/session-tracker.html` - Session Tracker
- `ui://rhymebook/beat-explorer.html` - Beat Explorer
- `ui://rhymebook/audio-player.html` - Audio Player

## Next Steps

1. **Test in Claude Desktop**: Verify all UIs load without size warnings
2. **Add Vite configs**: Create separate build configs for each UI if needed
3. **Optimize dashboard**: Consider lazy-loading heavy dependencies in dashboard
4. **Add streaming**: Implement real-time updates for dashboard metrics

## Testing

To test the refactored UIs:

```bash
# Build the server
npm run build:server

# Start in stdio mode (for Claude Desktop)
npm run start:stdio

# Or start in HTTP mode (for development)
npm start
```

## Notes

- The dashboard (`app.html`) remains as a streamable interface for users who want the full experience
- Individual tool UIs use inline styles and minimal JavaScript for maximum compatibility
- All UIs implement the MCP App protocol for communication with the host
- Audio player uses Web Audio API directly instead of heavy libraries
