/**
 * Beats Library Tests
 * Tests for beat library management functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getBeatsLibraryPath,
  setBeatsLibraryPath,
  scanBeatsLibrary,
  scanBeatsLibrarySync,
  importBeatFile,
  importNewBeats,
  getLibraryStats,
  copyBeatToLibrary,
  deleteBeatFile,
} from '../../src/db/beats-library.js';
import { getDatabase, closeDatabase } from '../../src/db/database.js';
import { getAllBeats, deleteBeat, getSetting, setSetting } from '../../src/db/operations.js';

describe('Beats Library', () => {
  const testLibraryDir = path.join(__dirname, 'test-library');
  const testBeatFile = path.join(testLibraryDir, 'test-beat.mp3');
  
  beforeEach(() => {
    getDatabase();
    
    // Create test library directory
    if (!fs.existsSync(testLibraryDir)) {
      fs.mkdirSync(testLibraryDir, { recursive: true });
    }
    
    // Create a dummy beat file for testing
    fs.writeFileSync(testBeatFile, 'dummy audio content');
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testLibraryDir)) {
      fs.rmSync(testLibraryDir, { recursive: true, force: true });
    }
    
    // Clean up test beats
    const beats = getAllBeats();
    beats.forEach(beat => deleteBeat(beat.id));
    
    closeDatabase();
  });

  describe('Library Path', () => {
    it('should get default library path', () => {
      const libraryPath = getBeatsLibraryPath();
      
      expect(libraryPath).toBeDefined();
      expect(typeof libraryPath).toBe('string');
      expect(libraryPath.length).toBeGreaterThan(0);
    });

    it('should set library path', async () => {
      const result = await setBeatsLibraryPath(testLibraryDir);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Beats library path set');
      
      const newPath = getBeatsLibraryPath();
      expect(newPath).toBe(testLibraryDir);
    });

    it('should create directory if it does not exist', async () => {
      const newDir = path.join(testLibraryDir, 'new-library');
      const result = await setBeatsLibraryPath(newDir);
      
      expect(result.success).toBe(true);
      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should fail if path is not a directory', async () => {
      const filePath = path.join(testLibraryDir, 'not-a-dir.txt');
      fs.writeFileSync(filePath, 'test');
      
      const result = await setBeatsLibraryPath(filePath);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not a directory');
    });
  });

  describe('Library Scanning', () => {
    it('should scan library for audio files', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      // Create test audio files
      fs.writeFileSync(path.join(testLibraryDir, 'beat1.mp3'), 'audio1');
      fs.writeFileSync(path.join(testLibraryDir, 'beat2.wav'), 'audio2');
      fs.writeFileSync(path.join(testLibraryDir, 'not-audio.txt'), 'text');
      
      const files = await scanBeatsLibrary(true);
      
      expect(files.length).toBe(3); // test-beat.mp3 (from beforeEach) + beat1.mp3 + beat2.wav
      expect(files.some(f => f.filename === 'beat1.mp3')).toBe(true);
      expect(files.some(f => f.filename === 'beat2.wav')).toBe(true);
      expect(files.some(f => f.filename === 'test-beat.mp3')).toBe(true);
      expect(files.every(f => f.filename !== 'not-audio.txt')).toBe(true);
    });

    it('should scan library synchronously', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      fs.writeFileSync(path.join(testLibraryDir, 'sync-beat.mp3'), 'audio');
      
      const files = scanBeatsLibrarySync();
      
      expect(files.length).toBeGreaterThanOrEqual(1);
      expect(files.some(f => f.filename === 'sync-beat.mp3')).toBe(true);
    });

    it('should scan subdirectories', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      const subDir = path.join(testLibraryDir, 'subfolder');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(subDir, 'sub-beat.mp3'), 'audio');
      
      const files = await scanBeatsLibrary(true);
      
      expect(files.some(f => f.filename === 'sub-beat.mp3')).toBe(true);
    });

    it('should cache scan results', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      fs.writeFileSync(path.join(testLibraryDir, 'cached-beat.mp3'), 'audio');
      
      // First scan
      const files1 = await scanBeatsLibrary();
      const count1 = files1.length;
      
      // Add new file
      fs.writeFileSync(path.join(testLibraryDir, 'new-beat.mp3'), 'audio');
      
      // Second scan without force refresh (should use cache)
      const files2 = await scanBeatsLibrary();
      expect(files2.length).toBe(count1);
      
      // Third scan with force refresh
      const files3 = await scanBeatsLibrary(true);
      expect(files3.length).toBe(count1 + 1);
    });
  });

  describe('Beat Import', () => {
    it('should import beat file', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      const beat = importBeatFile(testBeatFile);
      
      expect(beat).toBeDefined();
      expect(beat?.title).toBe('test beat'); // Filename 'test-beat.mp3' gets cleaned to 'test beat'
      expect(beat?.file_path).toBe(testBeatFile);
    });

    it('should parse BPM from filename', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      const bpmFile = path.join(testLibraryDir, 'Beat 140BPM.mp3');
      fs.writeFileSync(bpmFile, 'audio');
      
      const beat = importBeatFile(bpmFile);
      
      expect(beat?.bpm).toBe(140);
      expect(beat?.title).toBe('Beat');
    });

    it('should parse key from filename', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      const keyFile = path.join(testLibraryDir, 'Dark Trap Am.mp3');
      fs.writeFileSync(keyFile, 'audio');
      
      const beat = importBeatFile(keyFile);
      
      expect(beat?.key_signature).toBe('Am');
    });

    it('should import new beats from library', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      fs.writeFileSync(path.join(testLibraryDir, 'new1.mp3'), 'audio1');
      fs.writeFileSync(path.join(testLibraryDir, 'new2.mp3'), 'audio2');
      
      const result = await importNewBeats();
      
      expect(result.imported).toBe(3); // test-beat.mp3 (from beforeEach) + new1.mp3 + new2.mp3
      expect(result.errors).toBe(0);
    });

    it('should skip already imported beats', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      fs.writeFileSync(path.join(testLibraryDir, 'imported.mp3'), 'audio');
      
      // First import
      const result1 = await importNewBeats();
      expect(result1.imported).toBe(2); // test-beat.mp3 (from beforeEach) + imported.mp3
      
      // Second import should skip both
      const result2 = await importNewBeats();
      expect(result2.skipped).toBe(2);
      expect(result2.imported).toBe(0);
    });
  });

  describe('Library Stats', () => {
    it('should get library statistics', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      fs.writeFileSync(path.join(testLibraryDir, 'beat1.mp3'), 'x'.repeat(1000));
      fs.writeFileSync(path.join(testLibraryDir, 'beat2.wav'), 'x'.repeat(2000));
      
      const stats = await getLibraryStats();
      
      expect(stats.path).toBe(testLibraryDir);
      expect(stats.totalFiles).toBe(3); // test-beat.mp3 (from beforeEach) + beat1.mp3 + beat2.wav
      expect(stats.totalSize).toBe(3019); // 19 (test-beat.mp3) + 1000 + 2000
      expect(stats.formats).toContain('.mp3');
      expect(stats.formats).toContain('.wav');
    });
  });

  describe('Copy Beat to Library', () => {
    it('should copy beat file to library', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      const sourceFile = path.join(testLibraryDir, 'source-beat.mp3');
      fs.writeFileSync(sourceFile, 'source audio');
      
      const result = await copyBeatToLibrary(sourceFile);
      
      expect(result.success).toBe(true);
      expect(result.newPath).toBeDefined();
      expect(fs.existsSync(result.newPath!)).toBe(true);
    });

    it('should handle duplicate filenames', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      const sourceFile = path.join(testLibraryDir, 'duplicate.mp3');
      fs.writeFileSync(sourceFile, 'source audio');
      
      // First copy
      const result1 = await copyBeatToLibrary(sourceFile);
      expect(result1.success).toBe(true);
      
      // Second copy should add timestamp
      const result2 = await copyBeatToLibrary(sourceFile);
      expect(result2.success).toBe(true);
      expect(result2.message).toContain('original already exists');
    });

    it('should fail for non-existent source file', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      const result = await copyBeatToLibrary('/non/existent/file.mp3');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
    });
  });

  describe('Delete Beat File', () => {
    it('should delete beat file', async () => {
      await setBeatsLibraryPath(testLibraryDir);
      
      const fileToDelete = path.join(testLibraryDir, 'delete-me.mp3');
      fs.writeFileSync(fileToDelete, 'delete me');
      
      const result = await deleteBeatFile(fileToDelete);
      
      expect(result.success).toBe(true);
      expect(fs.existsSync(fileToDelete)).toBe(false);
    });

    it('should fail for non-existent file', async () => {
      const result = await deleteBeatFile('/non/existent/file.mp3');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });
});