/**
 * Lyrics I/O Tests
 * Tests for lyrics import/export functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  importLyricsFromFile,
  importLyricsAsSong,
  importLyricsFromText,
  exportLyricsToText,
  exportLyricsToMarkdown,
  exportLyricsToJson,
  exportLyricsToLrc,
  exportLyricsToFile,
  batchImportLyrics,
  batchExportLyrics,
} from '../../src/db/lyrics-io.js';
import { getDatabase, closeDatabase } from '../../src/db/database.js';
import { getAllSongs, deleteSong } from '../../src/db/operations.js';

describe('Lyrics I/O', () => {
  const testDir = path.join(__dirname, 'test-lyrics');
  
  beforeEach(() => {
    getDatabase();
    
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    // Clean up test songs
    const songs = getAllSongs();
    songs.forEach(song => deleteSong(song.id));
    
    closeDatabase();
  });

  describe('Text Format', () => {
    it('should parse plain text lyrics with sections', () => {
      const content = `Test Song

[Verse 1]
This is verse one
With multiple lines

[Chorus]
This is the chorus
It's catchy

[Verse 2]
This is verse two`;

      const result = importLyricsFromText('Test Song', content, 'txt');
      
      expect(result).toBeDefined();
      expect(result?.title).toBe('Test Song');
      expect(result?.sections).toBeDefined();
      expect(result?.sections?.length).toBeGreaterThan(0);
    });

    it('should parse lyrics without sections', () => {
      const content = `Simple lyrics
Without any sections
Just plain text`;

      const result = importLyricsFromText('Simple Song', content, 'txt');
      
      expect(result).toBeDefined();
      expect(result?.title).toBe('Simple Song');
    });

    it('should export lyrics to text format', () => {
      const song = {
        id: 'test-id',
        title: 'Export Test',
        status: 'writing' as const,
        progress: 0,
        notes: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sections: [
          { id: '1', song_id: 'test-id', type: 'verse' as const, content: 'Verse content', position: 0 },
          { id: '2', song_id: 'test-id', type: 'chorus' as const, content: 'Chorus content', position: 1 },
        ],
      };

      const text = exportLyricsToText(song);
      
      expect(text).toContain('Export Test');
      expect(text).toContain('[VERSE]');
      expect(text).toContain('Verse content');
      expect(text).toContain('[CHORUS]');
      expect(text).toContain('Chorus content');
    });
  });

  describe('Markdown Format', () => {
    it('should export lyrics to markdown format', () => {
      const song = {
        id: 'test-id',
        title: 'Markdown Test',
        status: 'writing' as const,
        progress: 0,
        notes: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sections: [
          { id: '1', song_id: 'test-id', type: 'verse' as const, content: 'Verse content', position: 0 },
        ],
      };

      const markdown = exportLyricsToMarkdown(song);
      
      expect(markdown).toContain('# Markdown Test');
      expect(markdown).toContain('## Verse');
      expect(markdown).toContain('Verse content');
    });
  });

  describe('JSON Format', () => {
    it('should export lyrics to JSON format', () => {
      const song = {
        id: 'test-id',
        title: 'JSON Test',
        status: 'writing' as const,
        progress: 0,
        notes: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sections: [
          { id: '1', song_id: 'test-id', type: 'verse' as const, content: 'Verse content', position: 0 },
        ],
      };

      const json = exportLyricsToJson(song);
      const parsed = JSON.parse(json);
      
      expect(parsed.title).toBe('JSON Test');
      expect(parsed.sections).toBeDefined();
      expect(parsed.sections.length).toBe(1);
      expect(parsed.sections[0].type).toBe('verse');
    });

    it('should parse JSON lyrics', () => {
      const jsonContent = JSON.stringify({
        title: 'JSON Import Test',
        sections: [
          { type: 'verse', content: 'Imported verse' },
          { type: 'chorus', content: 'Imported chorus' },
        ],
      });

      const result = importLyricsFromText('JSON Import Test', jsonContent, 'json');
      
      expect(result).toBeDefined();
      expect(result?.title).toBe('JSON Import Test');
    });
  });

  describe('LRC Format', () => {
    it('should export lyrics to LRC format', () => {
      const song = {
        id: 'test-id',
        title: 'LRC Test',
        status: 'writing' as const,
        progress: 0,
        notes: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sections: [
          { id: '1', song_id: 'test-id', type: 'verse' as const, content: 'Line 1\nLine 2', position: 0 },
        ],
      };

      const lrc = exportLyricsToLrc(song);
      
      expect(lrc).toContain('[ti:LRC Test]');
      expect(lrc).toContain('[00:00.00]Line 1');
    });

    it('should parse LRC format', () => {
      const lrcContent = `[ti:LRC Test]
[ar:Unknown]

[00:00.00]First line
[00:03.00]Second line
[00:06.00]Third line`;

      const result = importLyricsFromText('LRC Test', lrcContent, 'lrc');
      
      expect(result).toBeDefined();
      expect(result?.title).toBe('LRC Test');
    });
  });

  describe('File Operations', () => {
    it('should export lyrics to file', () => {
      const song = {
        id: 'test-id',
        title: 'File Export Test',
        status: 'writing' as const,
        progress: 0,
        notes: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sections: [
          { id: '1', song_id: 'test-id', type: 'verse' as const, content: 'Test content', position: 0 },
        ],
      };

      const filePath = path.join(testDir, 'export-test.txt');
      const success = exportLyricsToFile(song, filePath, 'txt');
      
      expect(success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
      
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('File Export Test');
    });

    it('should import lyrics from text content', () => {
      const content = `[Verse]
Imported verse content

[Chorus]
Imported chorus content`;

      const song = importLyricsFromText('Import Test', content, 'txt');
      
      expect(song).toBeDefined();
      expect(song?.title).toBe('Import Test');
      expect(song?.sections).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    it('should batch import lyrics from directory', () => {
      // Create test files
      fs.writeFileSync(path.join(testDir, 'song1.txt'), 'Song 1\n[Verse]\nContent 1');
      fs.writeFileSync(path.join(testDir, 'song2.txt'), 'Song 2\n[Verse]\nContent 2');
      fs.writeFileSync(path.join(testDir, 'not-a-song.md'), '# Not a song');

      const result = batchImportLyrics(testDir);
      
      expect(result.imported).toBe(2);
      expect(result.errors).toBe(0);
      expect(result.songs.length).toBe(2);
    });

    it('should batch export lyrics to directory', () => {
      importLyricsFromText('Export Song 1', '[Verse]\nContent 1', 'txt');
      importLyricsFromText('Export Song 2', '[Verse]\nContent 2', 'txt');

      const exportDir = path.join(testDir, 'exports');
      const result = batchExportLyrics(exportDir, 'txt');
      
      expect(result.exported).toBeGreaterThanOrEqual(2);
      expect(result.errors).toBe(0);
      expect(fs.existsSync(exportDir)).toBe(true);
    });
  });
});