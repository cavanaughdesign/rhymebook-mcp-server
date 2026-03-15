# RhymeBook MCP Tool Examples

This reference provides detailed examples for all RhymeBook MCP tools, including expected inputs, outputs, and error handling patterns.

## Error Handling Pattern

All tools follow this error handling pattern:

```typescript
// Success response
{
  "result": "data",
  "status": "success"
}

// Error response
{
  "error": "Descriptive error message",
  "code": "ERROR_CODE"  // optional
}

// Common error codes:
// - NOT_FOUND: Resource doesn't exist
// - VALIDATION_ERROR: Invalid input
// - FILE_ERROR: File system issue
// - DATABASE_ERROR: Database operation failed
```

## Lyric Lab Examples

### Finding Rhymes
```typescript
// Call the find-rhymes tool
const result = await app.callServerTool({
  name: 'find-rhymes',
  arguments: { word: 'flow' },
});

// Response:
{
  "word": "flow",
  "rhymes": {
    "perfect": ["go", "show", "know", "grow", "blow", "low", "snow", "throw", "glow", "slow"],
    "slant": ["soul", "roll", "control", "gold", "hold", "cold", "bold", "told", "fold"],
    "multi": ["overflow", "undertow", "radio", "studio", "portfolio", "scenario", "audio"]
  },
  "totalResults": 26
}
```

### Counting Syllables
```typescript
const result = await app.callServerTool({
  name: 'count-syllables',
  arguments: { text: "I'm on a different level\nMy flow is never settling" },
});

// Response:
{
  "lines": [
    { "lineNumber": 1, "text": "I'm on a different level", "syllables": 7 },
    { "lineNumber": 2, "text": "My flow is never settling", "syllables": 8 }
  ],
  "totalSyllables": 15,
  "averageSyllables": 7.5,
  "lineCount": 2
}
```

### Saving Lyrics
```typescript
const result = await app.callServerTool({
  name: 'save-lyrics',
  arguments: {
    title: 'Midnight Drive',
    sections: [
      { type: 'verse', content: 'Driving through the city lights...' },
      { type: 'chorus', content: 'We keep moving, never stopping...' },
    ],
    notes: 'Working on bridge section',
  },
});

// Response:
{
  "saved": true,
  "songId": "song-abc123",
  "title": "Midnight Drive",
  "sections": 2,
  "totalLines": 2,
  "totalWords": 12,
  "timestamp": "2026-03-15T10:30:00Z"
}
```

### Importing Lyrics
```typescript
// From file
const result = await app.callServerTool({
  name: 'import-lyrics',
  arguments: { filePath: 'C:\\Lyrics\\my-song.txt' },
});

// From text
const result = await app.callServerTool({
  name: 'import-lyrics',
  arguments: {
    content: '[Verse 1]\nLyrics here...\n\n[Chorus]\nChorus lyrics...',
    title: 'My Song',
  },
});
```

## Session Tracker Examples

### Creating a Recording Session
```typescript
const result = await app.callServerTool({
  name: 'create-session',
  arguments: {
    songId: 'song-abc123',
    date: '2026-03-15',
    studio: 'SoundWave Studios',
    engineer: 'Mike Mix',
  },
});

// Response:
{
  "created": true,
  "session": {
    "id": "session-xyz789",
    "song_id": "song-abc123",
    "date": "2026-03-15",
    "studio": "SoundWave Studios",
    "engineer": "Mike Mix",
    "status": "scheduled"
  }
}
```

### Logging a Take
```typescript
const result = await app.callServerTool({
  name: 'log-take',
  arguments: {
    sessionId: 'session-xyz789',
    rating: 5,
    notes: 'Best take - perfect energy and timing',
    duration: 48,
  },
});

// Response:
{
  "logged": true,
  "take": {
    "take_number": 3,
    "rating": 5,
    "notes": "Best take - perfect energy and timing",
    "duration": 48
  },
  "totalTakes": 3,
  "bestTake": { "take_number": 3, "rating": 5 }
}
```

### Adding a Collaborator
```typescript
const result = await app.callServerTool({
  name: 'add-collaborator',
  arguments: {
    name: 'DJ Shadow',
    role: 'producer',
    contact: 'djshadow@email.com',
    songId: 'song-abc123',
  },
});
```

## Beat Explorer Examples

### Browsing Beats
```typescript
const result = await app.callServerTool({
  name: 'browse-beats',
  arguments: {
    genre: 'trap',
    mood: 'dark',
    minBpm: 130,
    maxBpm: 160,
    minEnergy: 70,
  },
});

// Response:
{
  "beats": [
    {
      "id": "beat-1",
      "title": "Night Rider",
      "producer": "DJ Shadow",
      "bpm": 140,
      "key": "Am",
      "energy": 85,
      "genres": ["trap", "hip-hop"],
      "moods": ["dark", "aggressive"],
      "waveform": "▁▂▃▄▅▆▇█▇▆▅▄▃▂▁",
      "energyLabel": "high-energy"
    }
  ],
  "totalResults": 1
}
```

### Matching Lyrics to Beats
```typescript
const result = await app.callServerTool({
  name: 'match-lyrics-to-beat',
  arguments: {
    lyrics: "Hustle hard, grind all day\nMoney on my mind, no time to play",
    preferredBpm: 140,
    preferredGenre: 'trap',
  },
});

// Response:
{
  "analysis": {
    "detectedEnergy": 65,
    "energyLabel": "medium-energy",
    "moodHints": ["motivational"],
    "wordCount": 12
  },
  "matches": [
    {
      "id": "beat-1",
      "title": "Night Rider",
      "matchScore": 85,
      "bpm": 140,
      "key": "Am"
    }
  ]
}
```

### Setting Library Path
```typescript
const result = await app.callServerTool({
  name: 'set-library-path',
  arguments: { path: 'C:\\Users\\You\\Music\\Beats' },
});

// Response:
{
  "success": true,
  "message": "Beats library path set to: C:\\Users\\You\\Music\\Beats"
}
```

## Dashboard Examples

### Getting Dashboard Summary
```typescript
const result = await app.callServerTool({
  name: 'get-dashboard-summary',
  arguments: { timeframe: 'week' },
});

// Response:
{
  "overview": {
    "totalSongs": 12,
    "totalSessions": 8,
    "totalBeats": 45,
    "totalCollaborators": 5,
    "totalCollections": 4,
    "totalTakes": 67
  },
  "songStats": {
    "byStatus": {
      "writing": 3,
      "recording": 2,
      "mixing": 1,
      "mastering": 1,
      "released": 5
    },
    "averageProgress": 58,
    "recentlyUpdated": [...]
  },
  "insights": {
    "mostProductiveDay": "Saturday",
    "averageSessionLength": 120,
    "completionRate": 42,
    "topCollaborators": ["DJ Shadow", "Mike Mix"]
  },
  "activity": {
    "recentActivity": [...],
    "weeklyProgress": [...]
  }
}
```

### Getting Recent Activity
```typescript
const result = await app.callServerTool({
  name: 'get-recent-activity',
  arguments: {
    limit: 10,
    offset: 0,
    type: 'songs',
  },
});

// Response:
{
  "activity": [
    {
      "id": "song-abc123",
      "type": "song_created",
      "title": "New Song Created",
      "description": "\"Midnight Drive\" - writing",
      "timestamp": "2026-03-15T10:30:00Z",
      "icon": "🎵"
    }
  ],
  "total": 5,
  "returned": 5,
  "hasMore": false
}
```

## Error Handling

All tools return errors in a consistent format:

```typescript
// Error response
{
  "error": "Error message describing what went wrong"
}

// Common errors:
// - "Song not found"
// - "Session not found"
// - "Beat not found or no file path"
// - "Access denied: file outside library"
// - "Invalid beat ID format"
```

## Troubleshooting Decision Tree

```
Tool call failed?
├── Check error message
│   ├── "not found" → Verify ID exists in database
│   ├── "validation" → Check input types and limits
│   ├── "file" → Check file path and permissions
│   └── "database" → Check DB connection and schema
├── Check input format
│   ├── Dates → Use YYYY-MM-DD format
│   ├── IDs → Must match existing records
│   └── Arrays → Must be valid JSON arrays
└── Check server logs
    └── Look for stack traces or warnings
```

## Best Practices

1. **Always check for errors** in the response
2. **Use try/catch** when calling tools
3. **Validate inputs** before sending to tools
4. **Handle empty results** gracefully
5. **Use pagination** for large result sets (limit/offset)
6. **Cache frequently accessed data** (beats, songs)
7. **Use batch operations** when processing multiple items
8. **Provide user feedback** for long-running operations
