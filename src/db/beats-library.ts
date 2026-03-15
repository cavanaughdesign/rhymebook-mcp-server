import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { getSetting, setSetting, createBeat, getAllBeats, Beat } from './operations.js';
import { logError } from '../utils/logger.js';

// Supported audio formats
const SUPPORTED_FORMATS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'];

export interface BeatFileInfo {
  filename: string;
  fullPath: string;
  size: number;
  modified: Date;
  extension: string;
}

// Cache for library scans
interface ScanCache {
  files: BeatFileInfo[];
  timestamp: number;
  path: string;
}
let scanCache: ScanCache | null = null;
const SCAN_CACHE_TTL = 60000; // 1 minute

// Get the configured beats library path
export function getBeatsLibraryPath(): string {
  return getSetting('beats_library_path') || path.join(process.env.HOME || process.env.USERPROFILE || '.', '.rhymebook', 'beats');
}

// Set the beats library path (async)
export async function setBeatsLibraryPath(newPath: string): Promise<{ success: boolean; message: string }> {
  try {
    // Create directory if it doesn't exist
    try {
      await fs.access(newPath);
    } catch {
      await fs.mkdir(newPath, { recursive: true });
    }

    // Verify it's a directory
    const stat = await fs.stat(newPath);
    if (!stat.isDirectory()) {
      return { success: false, message: 'Path is not a directory' };
    }

    setSetting('beats_library_path', newPath);
    
    // Invalidate cache
    scanCache = null;
    
    return { success: true, message: `Beats library path set to: ${newPath}` };
  } catch (error) {
    return { success: false, message: `Error setting path: ${error}` };
  }
}

// Scan the beats library for audio files (async with caching)
export async function scanBeatsLibrary(forceRefresh: boolean = false): Promise<BeatFileInfo[]> {
  const libraryPath = getBeatsLibraryPath();

  // Check cache
  if (!forceRefresh && scanCache && scanCache.path === libraryPath) {
    if (Date.now() - scanCache.timestamp < SCAN_CACHE_TTL) {
      return scanCache.files;
    }
  }

  // Ensure directory exists
  try {
    await fs.access(libraryPath);
  } catch {
    await fs.mkdir(libraryPath, { recursive: true });
    scanCache = { files: [], timestamp: Date.now(), path: libraryPath };
    return [];
  }

  const files: BeatFileInfo[] = [];

  async function scanDirectory(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const promises = entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_FORMATS.includes(ext)) {
          try {
            const stat = await fs.stat(fullPath);
            files.push({
              filename: entry.name,
              fullPath,
              size: stat.size,
              modified: stat.mtime,
              extension: ext,
            });
          } catch (err) {
            // Skip files that can't be accessed
            console.warn(`Skipping file ${fullPath}: ${err}`);
          }
        }
      }
    });

    await Promise.all(promises);
  }

  await scanDirectory(libraryPath);

  // Update cache
  scanCache = {
    files,
    timestamp: Date.now(),
    path: libraryPath,
  };

  return files;
}

// Synchronous version for backward compatibility
export function scanBeatsLibrarySync(): BeatFileInfo[] {
  const libraryPath = getBeatsLibraryPath();

  if (!fsSync.existsSync(libraryPath)) {
    fsSync.mkdirSync(libraryPath, { recursive: true });
    return [];
  }

  const files: BeatFileInfo[] = [];

  function scanDirectory(dirPath: string) {
    const entries = fsSync.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_FORMATS.includes(ext)) {
          try {
            const stat = fsSync.statSync(fullPath);
            files.push({
              filename: entry.name,
              fullPath,
              size: stat.size,
              modified: stat.mtime,
              extension: ext,
            });
          } catch (err) {
            console.warn(`Skipping file ${fullPath}: ${err}`);
          }
        }
      }
    }
  }

  scanDirectory(libraryPath);
  return files;
}

// Parse beat info from filename
function parseBeatFilename(filename: string): { title: string; bpm?: number; key?: string } {
  // Remove extension
  const name = path.basename(filename, path.extname(filename));

  // Common patterns:
  // "Beat Name 140BPM Am"
  // "Beat_Name_140_Am"
  // "Beat Name (140 BPM) [Am]"

  let title = name;
  let bpm: number | undefined;
  let key: string | undefined;

  // Try to extract BPM
  const bpmMatch = name.match(/(\d+)\s*bpm/i);
  if (bpmMatch) {
    bpm = parseInt(bpmMatch[1]);
    title = title.replace(bpmMatch[0], '').trim();
  }

  // Try to extract key (common musical keys)
  const keyMatch = name.match(/\b([A-G][#b]?(?:m|maj|min|dim|aug)?)\b/i);
  if (keyMatch) {
    key = keyMatch[1];
    title = title.replace(keyMatch[0], '').trim();
  }

  // Clean up title
  title = title
    .replace(/[_\-()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { title: title || name, bpm, key };
}

// Import a beat file into the database
export function importBeatFile(filePath: string): Beat | null {
  try {
    const filename = path.basename(filePath);
    const { title, bpm, key } = parseBeatFilename(filename);

    const beat = createBeat({
      title,
      producer: '',
      file_path: filePath,
      bpm: bpm || 0,
      key_signature: key || '',
      duration: 0, // Would need audio analysis to get actual duration
      energy: 50,
      favorite: false,
      genres: [],
      moods: [],
      tags: [],
    });

    return beat;
  } catch (error) {
    logError('Error importing beat', 'beats-library', error);
    return null;
  }
}

// Import all unimported beats from the library (async)
export async function importNewBeats(): Promise<{ imported: number; skipped: number; errors: number }> {
  const files = await scanBeatsLibrary();
  const existingBeats = getAllBeats();
  const existingPaths = new Set(existingBeats.map(b => b.file_path).filter(Boolean));

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    if (existingPaths.has(file.fullPath)) {
      skipped++;
      continue;
    }

    const beat = importBeatFile(file.fullPath);
    if (beat) {
      imported++;
    } else {
      errors++;
    }
  }

  return { imported, skipped, errors };
}

// Get library statistics (async)
export async function getLibraryStats() {
  const libraryPath = getBeatsLibraryPath();
  const files = await scanBeatsLibrary();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return {
    path: libraryPath,
    totalFiles: files.length,
    totalSize,
    totalSizeFormatted: formatFileSize(totalSize),
    formats: [...new Set(files.map(f => f.extension))],
  };
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Copy a beat file to the library (async)
export async function copyBeatToLibrary(sourcePath: string): Promise<{ success: boolean; message: string; newPath?: string }> {
  try {
    const libraryPath = getBeatsLibraryPath();
    const filename = path.basename(sourcePath);
    const destPath = path.join(libraryPath, filename);

    // Check if file already exists
    try {
      await fs.access(destPath);
      // File exists, add timestamp to make unique
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      const timestamp = Date.now();
      const newFilename = `${base}_${timestamp}${ext}`;
      const newDestPath = path.join(libraryPath, newFilename);

      await fs.copyFile(sourcePath, newDestPath);
      return {
        success: true,
        message: `Copied as ${newFilename} (original already exists)`,
        newPath: newDestPath,
      };
    } catch {
      // File doesn't exist, copy normally
      await fs.copyFile(sourcePath, destPath);
      return {
        success: true,
        message: `Copied ${filename} to library`,
        newPath: destPath,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error copying file: ${error}`,
    };
  }
}

// Delete a beat file from the library (async)
export async function deleteBeatFile(filePath: string): Promise<{ success: boolean; message: string }> {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    return { success: true, message: 'File deleted' };
  } catch {
    return { success: false, message: 'File not found' };
  }
}
