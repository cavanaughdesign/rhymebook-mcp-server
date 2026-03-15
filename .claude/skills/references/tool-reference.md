# RhymeBook Tool Reference

## Lyric Lab Tools

### find-rhymes
Find perfect, slant, and multi-syllable rhymes for a word.

**Parameters:**
- `word` (required): The word to find rhymes for
- `type` (optional): "perfect" | "slant" | "multi" | "all" (default: "all")
- `limit` (optional): Number of results (default: 20)

**Example:**
```
find-rhymes(word="flow", type="perfect", limit=10)
```

### count-syllables
Count syllables in lyrics text.

**Parameters:**
- `text` (required): The lyrics text to analyze

**Example:**
```
count-syllables(text="I'm spitting fire with my flow")
```

### analyze-flow
Analyze rhythm and flow patterns in lyrics.

**Parameters:**
- `lyrics` (required): The lyrics to analyze

**Example:**
```
analyze-flow(lyrics="Verse 1:\nI'm spitting fire...\n\nChorus:\nWe rise up...")
```

### get-synonyms
Get contextual synonyms for a word.

**Parameters:**
- `word` (required): The word to find synonyms for
- `context` (optional): Context for better suggestions

### save-lyrics
Save lyrics to the database.

**Parameters:**
- `songId` (required): Song ID to save lyrics for
- `sections` (required): Array of {type, content} objects

### export-lyrics
Export lyrics in various formats.

**Parameters:**
- `songId` (required): Song ID to export
- `format` (optional): "text" | "markdown" | "json" | "lrc" (default: "text")

### import-lyrics
Import lyrics from text or file.

**Parameters:**
- `songId` (required): Song ID to import into
- `content` (required): Lyrics content
- `format` (optional): "text" | "json" | "lrc" | "srt"

### get-all-songs
Get all saved songs.

**Parameters:**
- `status` (optional): Filter by status
- `limit` (optional): Number of results

## Session Tracker Tools

### create-song
Create a new song project.

**Parameters:**
- `title` (required): Song title
- `notes` (optional): Initial notes
- `collaborators` (optional): Array of collaborator names

### create-session
Schedule a recording session.

**Parameters:**
- `songId` (required): Song ID for the session
- `date` (required): Session date (YYYY-MM-DD)
- `studio` (optional): Studio name
- `engineer` (optional): Engineer name

### log-take
Log a recording take.

**Parameters:**
- `sessionId` (required): Session ID
- `takeNumber` (required): Take number
- `rating` (optional): 1-5 stars
- `notes` (optional): Take notes
- `duration` (optional): Duration in seconds

### add-session-note
Add notes to a session.

**Parameters:**
- `sessionId` (required): Session ID
- `note` (required): Note content

### get-recording-sessions
Get recording sessions.

**Parameters:**
- `songId` (optional): Filter by song
- `status` (optional): "scheduled" | "completed" | "all"
- `limit` (optional): Number of results

### update-song-progress
Update song status and progress.

**Parameters:**
- `songId` (required): Song ID
- `status` (optional): "writing" | "recording" | "mixing" | "mastering" | "released"
- `progress` (optional): 0-100

### add-collaborator
Add a collaborator to a song.

**Parameters:**
- `songId` (required): Song ID
- `name` (required): Collaborator name
- `role` (optional): "artist" | "producer" | "engineer" | "writer"

### get-collaborators
Get all collaborators.

## Beat Explorer Tools

### browse-beats
Browse and filter beats.

**Parameters:**
- `genre` (optional): Filter by genre
- `mood` (optional): Filter by mood
- `minBpm` (optional): Minimum BPM
- `maxBpm` (optional): Maximum BPM
- `favorite` (optional): Only favorites
- `limit` (optional): Number of results

### get-beat-details
Get detailed beat information.

**Parameters:**
- `beatId` (required): Beat ID

### toggle-favorite
Add/remove beat from favorites.

**Parameters:**
- `beatId` (required): Beat ID

### match-lyrics-to-beat
Find beats matching lyrics energy/mood.

**Parameters:**
- `lyrics` (required): Lyrics to match
- `limit` (optional): Number of results

### get-beat-stats
Get beat library statistics.

**Parameters:** None

### add-beat
Add a new beat to the library.

**Parameters:**
- `title` (required): Beat title
- `filePath` (optional): File path
- `bpm` (optional): BPM
- `keySignature` (optional): Musical key
- `producer` (optional): Producer name
- `genres` (optional): Array of genres
- `moods` (optional): Array of moods

### analyze-audio
Analyze audio file for BPM, key, duration.

**Parameters:**
- `filePath` (required): Path to audio file

### get-library-path
Get current beats library path.

**Parameters:** None

### set-library-path
Set beats library folder path.

**Parameters:**
- `path` (required): Library folder path

### scan-library
Scan library for audio files.

**Parameters:**
- `path` (optional): Path to scan (uses library path if not provided)

### import-beats
Import new beats from library.

**Parameters:**
- `path` (optional): Path to import from

## Audio Processing Tools

### check-audio-tools
Check available audio processing tools.

**Parameters:** None

### separate-audio
Separate audio into stems using Spleeter AI.

**Parameters:**
- `filePath` (required): Path to audio file
- `stems` (optional): 2 or 4 stems

### extract-vocals
Extract vocals from a track.

**Parameters:**
- `filePath` (required): Path to audio file

## Dashboard Tools

### get-dashboard-summary
Get comprehensive overview of all data.

**Parameters:** None

### get-recent-activity
Get activity feed with filtering.

**Parameters:**
- `type` (optional): Filter by type
- `limit` (optional): Number of results

### get-progress-stats
Get detailed progress statistics.

**Parameters:** None

### get-quick-stats
Get quick stats for widgets.

**Parameters:** None
