import fs from 'fs';
import path from 'path';
import { createSong, saveSongSections, Song, getSong, getAllSongs } from './operations.js';
import { logError } from '../utils/logger.js';

// Supported lyrics formats
export type LyricsFormat = 'txt' | 'json' | 'lrc' | 'srt';

export interface ImportedLyrics {
  title: string;
  sections: Array<{ type: string; content: string }>;
  metadata?: Record<string, string>;
}

// Parse plain text lyrics
function parseTextLyrics(content: string): ImportedLyrics {
  const lines = content.split('\n');
  const sections: Array<{ type: string; content: string }> = [];
  let currentSection = { type: 'verse', content: '' };
  let title = 'Untitled';

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for title (first non-empty line or line starting with #)
    if (!title || trimmed.startsWith('# ')) {
      if (trimmed.startsWith('# ')) {
        title = trimmed.substring(2).trim();
        continue;
      } else if (title === 'Untitled' && trimmed) {
        title = trimmed;
        continue;
      }
    }

    // Check for section headers like [Verse], [Chorus], etc.
    const sectionMatch = trimmed.match(/^\[(\w+)\]$/i);
    if (sectionMatch) {
      // Save previous section if it has content
      if (currentSection.content.trim()) {
        sections.push({ ...currentSection });
      }
      currentSection = {
        type: sectionMatch[1].toLowerCase(),
        content: '',
      };
      continue;
    }

    // Add line to current section
    if (trimmed || currentSection.content) {
      currentSection.content += (currentSection.content ? '\n' : '') + line;
    }
  }

  // Save last section
  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }

  // If no sections found, treat entire content as one verse
  if (sections.length === 0 && content.trim()) {
    sections.push({ type: 'verse', content: content.trim() });
  }

  return { title, sections };
}

// Parse JSON lyrics
function parseJsonLyrics(content: string): ImportedLyrics {
  const data = JSON.parse(content);

  return {
    title: data.title || data.name || 'Untitled',
    sections: data.sections || data.verses || [{ type: 'verse', content: data.lyrics || data.content || '' }],
    metadata: data.metadata,
  };
}

// Parse LRC format (synchronized lyrics)
function parseLrcLyrics(content: string): ImportedLyrics {
  const lines = content.split('\n');
  const lyricsLines: string[] = [];
  let title = 'Untitled';

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for metadata
    const titleMatch = trimmed.match(/^\[ti:(.+)\]$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    // Remove timestamps [00:12.34]
    const lyricLine = trimmed.replace(/\[\d+:\d+\.\d+\]/g, '').trim();
    if (lyricLine) {
      lyricsLines.push(lyricLine);
    }
  }

  return {
    title,
    sections: [{ type: 'verse', content: lyricsLines.join('\n') }],
  };
}

// Parse SRT format (subtitles)
function parseSrtLyrics(content: string): ImportedLyrics {
  const blocks = content.split(/\n\n+/);
  const lyricsLines: string[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    // Skip sequence number and timestamp, get text lines
    const textLines = lines.slice(2).filter(l => l.trim());
    lyricsLines.push(...textLines);
  }

  return {
    title: 'Untitled',
    sections: [{ type: 'verse', content: lyricsLines.join('\n') }],
  };
}

// Import lyrics from file
export function importLyricsFromFile(filePath: string): ImportedLyrics | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase().substring(1) as LyricsFormat;

    switch (ext) {
      case 'json':
        return parseJsonLyrics(content);
      case 'lrc':
        return parseLrcLyrics(content);
      case 'srt':
        return parseSrtLyrics(content);
      case 'txt':
      default:
        return parseTextLyrics(content);
    }
  } catch (error) {
    logError('Error importing lyrics', 'lyrics-io', error);
    return null;
  }
}

// Import lyrics and create a song
export function importLyricsAsSong(filePath: string): Song | null {
  const imported = importLyricsFromFile(filePath);
  if (!imported) return null;

  const song = createSong(imported.title);
  saveSongSections(song.id, imported.sections);

  return getSong(song.id);
}

// Import lyrics from text content
export function importLyricsFromText(title: string, content: string, format: LyricsFormat = 'txt'): Song | null {
  let imported: ImportedLyrics;

  switch (format) {
    case 'json':
      imported = parseJsonLyrics(content);
      break;
    case 'lrc':
      imported = parseLrcLyrics(content);
      break;
    case 'srt':
      imported = parseSrtLyrics(content);
      break;
    default:
      imported = parseTextLyrics(content);
  }

  // Override title if provided
  if (title) {
    imported.title = title;
  }

  const song = createSong(imported.title);
  saveSongSections(song.id, imported.sections);

  return getSong(song.id);
}

// Export lyrics to text format
export function exportLyricsToText(song: Song): string {
  let output = `${song.title}\n${'='.repeat(song.title.length)}\n\n`;

  if (song.sections) {
    for (const section of song.sections) {
      output += `[${section.type.toUpperCase()}]\n${section.content}\n\n`;
    }
  }

  return output.trim();
}

// Export lyrics to markdown format
export function exportLyricsToMarkdown(song: Song): string {
  let output = `# ${song.title}\n\n`;

  if (song.sections) {
    for (const section of song.sections) {
      output += `## ${section.type.charAt(0).toUpperCase() + section.type.slice(1)}\n\n${section.content}\n\n`;
    }
  }

  return output.trim();
}

// Export lyrics to JSON format
export function exportLyricsToJson(song: Song): string {
  return JSON.stringify({
    title: song.title,
    sections: song.sections?.map(s => ({ type: s.type, content: s.content })) || [],
    metadata: {
      status: song.status,
      progress: song.progress,
      created: song.created_at,
      updated: song.updated_at,
      collaborators: song.collaborators,
    },
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

// Export lyrics to LRC format
export function exportLyricsToLrc(song: Song): string {
  let output = `[ti:${song.title}]\n[ar:Unknown]\n[al:Unknown]\n\n`;

  if (song.sections) {
    let timeOffset = 0;
    for (const section of song.sections) {
      const lines = section.content.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          const minutes = Math.floor(timeOffset / 60);
          const seconds = timeOffset % 60;
          output += `[${minutes.toString().padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}]${line}\n`;
          timeOffset += 3; // Approximate 3 seconds per line
        }
      }
    }
  }

  return output.trim();
}

// Export lyrics to file
export function exportLyricsToFile(song: Song, filePath: string, format: LyricsFormat = 'txt'): boolean {
  try {
    let content: string;

    switch (format) {
      case 'json':
        content = exportLyricsToJson(song);
        break;
      case 'lrc':
        content = exportLyricsToLrc(song);
        break;
      case 'txt':
      default:
        content = exportLyricsToText(song);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    logError('Error exporting lyrics', 'lyrics-io', error);
    return false;
  }
}

// Batch import lyrics from a directory
export function batchImportLyrics(directoryPath: string): { imported: number; errors: number; songs: Song[] } {
  const songs: Song[] = [];
  let imported = 0;
  let errors = 0;

  try {
    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (['.txt', '.json', '.lrc', '.srt'].includes(ext)) {
        const filePath = path.join(directoryPath, file);
        const song = importLyricsAsSong(filePath);

        if (song) {
          songs.push(song);
          imported++;
        } else {
          errors++;
        }
      }
    }
  } catch (error) {
    logError('Error batch importing', 'lyrics-io', error);
  }

  return { imported, errors, songs };
}

// Export all songs to a directory
export function batchExportLyrics(directoryPath: string, format: LyricsFormat = 'txt'): { exported: number; errors: number } {
  const songs = getAllSongs();
  let exported = 0;
  let errors = 0;

  // Ensure directory exists
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  for (const song of songs) {
    const safeTitle = song.title.replace(/[^a-zA-Z0-9]/g, '_');
    const ext = format === 'json' ? 'json' : format === 'lrc' ? 'lrc' : 'txt';
    const filePath = path.join(directoryPath, `${safeTitle}.${ext}`);

    if (exportLyricsToFile(song, filePath, format)) {
      exported++;
    } else {
      errors++;
    }
  }

  return { exported, errors };
}
