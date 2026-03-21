import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import {
  getAllBeats, getBeat, createBeat, toggleBeatFavorite, deleteBeat, getBeatStats,
  getAllCollections, createCollection, addBeatToCollection, removeBeatFromCollection,
  getSetting, setSetting, updateSong,
} from '../db/operations.js';
import {
  getBeatsLibraryPath, setBeatsLibraryPath, scanBeatsLibrary,
  importNewBeats, getLibraryStats, copyBeatToLibrary, deleteBeatFile,
} from '../db/beats-library.js';
import * as mm from 'music-metadata';
import fs from 'fs/promises';
import { logError } from '../utils/logger.js';

// Analyze audio file for BPM and key
async function analyzeAudioFile(filePath: string): Promise<{ bpm: number; key: string; duration: number }> {
  try {
    const metadata = await mm.parseFile(filePath);
    return {
      bpm: metadata.common.bpm || 0,
      key: metadata.common.key || '',
      duration: Math.round(metadata.format.duration || 0),
    };
  } catch (error) {
    logError('Error analyzing audio file', 'beat-explorer', error);
    return { bpm: 0, key: '', duration: 0 };
  }
}

// Energy to mood mapping for lyric matching
function getEnergyMood(energy: number): string {
  if (energy >= 80) return 'high-energy';
  if (energy >= 60) return 'medium-energy';
  if (energy >= 40) return 'chill';
  return 'mellow';
}

// Generate waveform visualization
function generateWaveform(bpm: number, energy: number): string {
  const bars = 40;
  const pattern: string[] = [];
  const baseHeight = Math.floor(energy / 10);

  for (let i = 0; i < bars; i++) {
    const variation = Math.sin(i * 0.5) * 3;
    const height = Math.max(1, Math.min(10, baseHeight + variation + Math.random() * 2));
    pattern.push('▁▂▃▄▅▆▇█'.charAt(Math.min(Math.floor(height), 7)));
  }

  return pattern.join('');
}

export function registerBeatExplorerTools(server: McpServer): void {
  // Tool: Browse Beats
  registerAppTool(
    server,
    'browse-beats',
    {
      title: 'Browse Beats',
      description: 'Find beats by genre, mood, BPM, or energy level',
      inputSchema: {
        genre: z.string().optional().describe('Filter by genre (trap, drill, lo-fi, etc.)'),
        mood: z.string().optional().describe('Filter by mood (dark, happy, chill, etc.)'),
        minBpm: z.number().optional().describe('Minimum BPM'),
        maxBpm: z.number().optional().describe('Maximum BPM'),
        minEnergy: z.number().optional().describe('Minimum energy level (0-100)'),
        maxEnergy: z.number().optional().describe('Maximum energy level (0-100)'),
        favoritesOnly: z.boolean().optional().describe('Show only favorites'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/beat-explorer.html',
        },
      },
    },
    async ({ genre, mood, minBpm, maxBpm, minEnergy, maxEnergy, favoritesOnly }: {
      genre?: string;
      mood?: string;
      minBpm?: number;
      maxBpm?: number;
      minEnergy?: number;
      maxEnergy?: number;
      favoritesOnly?: boolean;
    }) => {
      const beats = getAllBeats({ genre, mood, minBpm, maxBpm, minEnergy, maxEnergy, favoritesOnly });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              beats: beats.map(b => ({
                ...b,
                waveform: generateWaveform(b.bpm, b.energy),
                energyLabel: getEnergyMood(b.energy),
              })),
              totalResults: beats.length,
              filters: { genre, mood, minBpm, maxBpm, minEnergy, maxEnergy, favoritesOnly },
              uiLink: 'http://localhost:3001/ui/tools/beat-explorer.html',
              message: 'For interactive beat exploration with full UI, use the interactive tab or open: http://localhost:3001/ui/tools/beat-explorer.html',
            }),
          },
        ],
      };
    }
  );

  // Tool: Get Beat Details
  registerAppTool(
    server,
    'get-beat-details',
    {
      title: 'Get Beat Details',
      description: 'Get detailed information about a specific beat',
      inputSchema: {
        beatId: z.string().describe('Beat ID'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/beat-explorer.html',
        },
      },
    },
    async ({ beatId }: { beatId: string }) => {
      const beat = getBeat(beatId);
      if (!beat) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Beat not found' }) }],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              beat: {
                ...beat,
                waveform: generateWaveform(beat.bpm, beat.energy),
                energyLabel: getEnergyMood(beat.energy),
                durationFormatted: beat.duration > 0
                  ? `${Math.floor(beat.duration / 60)}:${(beat.duration % 60).toString().padStart(2, '0')}`
                  : 'Unknown',
              },
              uiLink: 'http://localhost:3001/ui/tools/beat-explorer.html',
              message: 'For interactive beat exploration with full UI, use the interactive tab or open: http://localhost:3001/ui/tools/beat-explorer.html',
            }),
          },
        ],
      };
    }
  );

  // Tool: Toggle Favorite
  registerAppTool(
    server,
    'toggle-favorite',
    {
      title: 'Toggle Favorite',
      description: 'Mark or unmark a beat as a favorite',
      inputSchema: {
        beatId: z.string().describe('Beat ID'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/beat-explorer.html',
        },
      },
    },
    async ({ beatId }: { beatId: string }) => {
      const favorite = toggleBeatFavorite(beatId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              beatId,
              favorite,
              message: favorite ? 'Added to favorites' : 'Removed from favorites',
            }),
          },
        ],
      };
    }
  );

  // Tool: Get Collections
  server.registerTool(
    'get-collections',
    {
      description: 'Retrieve all beat collections and playlists saved in the library',
      inputSchema: {},
    },
    async () => {
      const collections = getAllCollections();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              collections,
              totalCollections: collections.length,
            }),
          },
        ],
      };
    }
  );

  // Tool: Add to Collection
  server.registerTool(
    'add-to-collection',
    {
      description: 'Add a beat to an existing collection or create a new collection and add the beat to it',
      inputSchema: {
        beatId: z.string().describe('Beat ID'),
        collectionName: z.string().describe('Collection name'),
      },
    },
    async ({ beatId, collectionName }: { beatId: string; collectionName: string }) => {
      const beat = getBeat(beatId);
      if (!beat) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Beat not found' }) }],
        };
      }

      // Find or create collection
      const collections = getAllCollections();
      let collection = collections.find(c => c.name === collectionName);

      if (!collection) {
        collection = createCollection(collectionName);
      }

      addBeatToCollection(collection.id, beatId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              added: true,
              beatId,
              collectionName,
              collectionId: collection.id,
            }),
          },
        ],
      };
    }
  );

  // Tool: Create Collection
  server.registerTool(
    'create-collection',
    {
      description: 'Create a new named beat collection or playlist for organising beats',
      inputSchema: {
        name: z.string().describe('Collection name'),
      },
    },
    async ({ name }: { name: string }) => {
      const collection = createCollection(name);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              created: true,
              collection,
            }),
          },
        ],
      };
    }
  );

  // Tool: Match Lyrics to Beat
  server.registerTool(
    'match-lyrics-to-beat',
    {
      description: 'Analyze lyrics for energy, mood and flow, then rank the best-matching beats from the library',
      inputSchema: {
        lyrics: z.string().describe('The lyrics to analyze'),
        preferredBpm: z.number().optional().describe('Preferred BPM range center'),
        preferredGenre: z.string().optional().describe('Preferred genre'),
      },
    },
    async ({ lyrics, preferredBpm, preferredGenre }: { lyrics: string; preferredBpm?: number; preferredGenre?: string }) => {
      const beats = getAllBeats();

      // Analyze lyrics energy
      const words = lyrics.toLowerCase().split(/\s+/);
      const aggressiveWords = ['fight', 'kill', 'die', 'war', 'battle', 'hate', 'rage', 'fire', 'burn', 'destroy'];
      const chillWords = ['love', 'peace', 'dream', 'calm', 'soft', 'gentle', 'flow', 'smooth', 'easy', 'slow'];
      const motivationalWords = ['hustle', 'grind', 'rise', 'win', 'success', 'money', 'power', 'crown', 'king', 'boss'];

      let energyScore = 50;
      let moodHints: string[] = [];

      words.forEach((word: string) => {
        if (aggressiveWords.some(w => word.includes(w))) {
          energyScore += 10;
          moodHints.push('aggressive');
        }
        if (chillWords.some(w => word.includes(w))) {
          energyScore -= 10;
          moodHints.push('chill');
        }
        if (motivationalWords.some(w => word.includes(w))) {
          energyScore += 5;
          moodHints.push('motivational');
        }
      });

      energyScore = Math.max(0, Math.min(100, energyScore));

      // Score and rank beats
      const scoredBeats = beats.map(beat => {
        let score = 0;

        // Energy match
        const energyDiff = Math.abs(beat.energy - energyScore);
        score += Math.max(0, 50 - energyDiff);

        // BPM preference
        if (preferredBpm) {
          const bpmDiff = Math.abs(beat.bpm - preferredBpm);
          score += Math.max(0, 30 - bpmDiff / 2);
        }

        // Genre preference
        if (preferredGenre && beat.genres?.some(g => g.toLowerCase().includes(preferredGenre.toLowerCase()))) {
          score += 20;
        }

        // Mood match
        moodHints.forEach(hint => {
          if (beat.moods?.some(m => m.includes(hint))) {
            score += 15;
          }
        });

        return { beat, score };
      });

      scoredBeats.sort((a, b) => b.score - a.score);
      const topMatches = scoredBeats.slice(0, 5);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              analysis: {
                detectedEnergy: energyScore,
                energyLabel: getEnergyMood(energyScore),
                moodHints: [...new Set(moodHints)],
                wordCount: words.length,
              },
              matches: topMatches.map(({ beat, score }) => ({
                ...beat,
                matchScore: Math.round(score),
                waveform: generateWaveform(beat.bpm, beat.energy),
              })),
            }),
          },
        ],
      };
    }
  );

  // Tool: Get Beat Stats
  server.registerTool(
    'get-beat-stats',
    {
      description: 'Get aggregate statistics for the beats library including genre breakdown, BPM ranges, and total counts',
      inputSchema: {},
    },
    async () => {
      const stats = getBeatStats();
      const libraryStats = await getLibraryStats();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...stats,
              library: libraryStats,
              uiLink: 'http://localhost:3001/ui/tools/beat-explorer.html',
              message: 'For interactive beat exploration with full UI, open: http://localhost:3001/ui/tools/beat-explorer.html',
            }),
          },
        ],
      };
    }
  );

  // ============ LIBRARY MANAGEMENT TOOLS ============

  // Tool: Get Beats Library Path
  server.registerTool(
    'get-library-path',
    {
      description: 'Get the current beats library folder path and its file statistics',
      inputSchema: {},
    },
    async () => {
      const libraryPath = getBeatsLibraryPath();
      const stats = await getLibraryStats();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              path: libraryPath,
              stats,
              uiLink: 'http://localhost:3001/ui/tools/beat-explorer.html',
              message: 'For interactive beat exploration with full UI, open: http://localhost:3001/ui/tools/beat-explorer.html',
            }),
          },
        ],
      };
    }
  );

  // Tool: Set Beats Library Path
  server.registerTool(
    'set-library-path',
    {
      description: 'Set or change the folder path where beat audio files are stored and managed',
      inputSchema: {
        path: z.string().describe('Path to the beats library folder'),
      },
    },
    async ({ path: newPath }: { path: string }) => {
      const result = await setBeatsLibraryPath(newPath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              message: result.message,
              uiLink: 'http://localhost:3001/ui/tools/beat-explorer.html',
            }),
          },
        ],
      };
    }
  );

  // Tool: Scan Beats Library
  server.registerTool(
    'scan-library',
    {
      description: 'Scan the beats library folder and return all audio files found, including filename, size, and modification date',
      inputSchema: {},
    },
    async () => {
      const files = await scanBeatsLibrary();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              files: files.map(f => ({
                filename: f.filename,
                size: f.size,
                extension: f.extension,
                modified: f.modified,
              })),
              totalFiles: files.length,
              uiLink: 'http://localhost:3001/ui/tools/beat-explorer.html',
              message: 'For interactive beat exploration with full UI, open: http://localhost:3001/ui/tools/beat-explorer.html',
            }),
          },
        ],
      };
    }
  );

  // Tool: Import Beats from Library
  server.registerTool(
    'import-beats',
    {
      description: 'Scan the beats library folder and import any new audio files that are not yet in the database',
      inputSchema: {},
    },
    async () => {
      const result = await importNewBeats();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...result,
              uiLink: 'http://localhost:3001/ui/tools/beat-explorer.html',
              message: 'For interactive beat exploration with full UI, open: http://localhost:3001/ui/tools/beat-explorer.html',
            }),
          },
        ],
      };
    }
  );

  // Tool: Copy Beat to Library
  server.registerTool(
    'copy-beat-to-library',
    {
      description: 'Copy an audio file from any location into the managed beats library folder',
      inputSchema: {
        sourcePath: z.string().describe('Path to the source beat file'),
      },
    },
    async ({ sourcePath }: { sourcePath: string }) => {
      const result = await copyBeatToLibrary(sourcePath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              message: result.message,
              ...(result.newPath ? { newPath: result.newPath } : {}),
              uiLink: 'http://localhost:3001/ui/tools/beat-explorer.html',
            }),
          },
        ],
      };
    }
  );

  // Tool: Add Beat Manually
  server.registerTool(
    'add-beat',
    {
      description: 'Manually add a beat to the database with metadata; auto-detects BPM, key and duration from the file when a path is provided',
      inputSchema: {
        title: z.string().describe('Beat title'),
        producer: z.string().optional().describe('Producer name'),
        filePath: z.string().optional().describe('Path to beat file (will auto-detect metadata)'),
        bpm: z.number().optional().describe('BPM (overrides auto-detection)'),
        key: z.string().optional().describe('Musical key (overrides auto-detection)'),
        genres: z.array(z.string()).optional().describe('Genres'),
        moods: z.array(z.string()).optional().describe('Moods'),
        tags: z.array(z.string()).optional().describe('Tags'),
        energy: z.number().optional().describe('Energy level (0-100)'),
      },
    },
    async ({ title, producer, filePath, bpm, key, genres, moods, tags, energy }: {
      title: string;
      producer?: string;
      filePath?: string;
      bpm?: number;
      key?: string;
      genres?: string[];
      moods?: string[];
      tags?: string[];
      energy?: number;
    }) => {
      let detectedBpm = bpm || 0;
      let detectedKey = key || '';
      let detectedDuration = 0;

      // Auto-detect metadata from file if provided
      if (filePath) {
        try {
          const metadata = await analyzeAudioFile(filePath);
          if (!bpm && metadata.bpm > 0) detectedBpm = metadata.bpm;
          if (!key && metadata.key) detectedKey = metadata.key;
          detectedDuration = metadata.duration;
        } catch (error) {
          console.warn('Could not analyze audio file:', error);
        }
      }

      const beat = createBeat({
        title,
        producer: producer || '',
        file_path: filePath || null,
        bpm: detectedBpm,
        key_signature: detectedKey,
        duration: detectedDuration,
        energy: energy || 50,
        favorite: false,
        genres: genres || [],
        moods: moods || [],
        tags: tags || [],
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              created: true,
              beat,
              autoDetected: {
                bpm: detectedBpm !== (bpm || 0),
                key: detectedKey !== (key || ''),
                duration: detectedDuration,
              },
              uiLink: 'http://localhost:3001/ui/tools/beat-explorer.html',
              message: 'For interactive beat exploration with full UI, open: http://localhost:3001/ui/tools/beat-explorer.html',
            }),
          },
        ],
      };
    }
  );

  // Tool: Analyze Audio File
  server.registerTool(
    'analyze-audio',
    {
      description: 'Analyze an audio file to extract BPM, musical key, duration, codec, sample rate, and embedded tags',
      inputSchema: {
        filePath: z.string().describe('Path to audio file'),
      },
    },
    async ({ filePath }: { filePath: string }) => {
      try {
        const analysis = await analyzeAudioFile(filePath);
        const metadata = await mm.parseFile(filePath);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                analysis: {
                  bpm: analysis.bpm,
                  key: analysis.key,
                  duration: analysis.duration,
                  durationFormatted: `${Math.floor(analysis.duration / 60)}:${(analysis.duration % 60).toString().padStart(2, '0')}`,
                },
                format: {
                  codec: metadata.format.codec,
                  sampleRate: metadata.format.sampleRate,
                  bitrate: metadata.format.bitrate,
                  channels: metadata.format.numberOfChannels,
                },
                tags: {
                  title: metadata.common.title,
                  artist: metadata.common.artist,
                  album: metadata.common.album,
                  year: metadata.common.year,
                },
                uiLink: 'http://localhost:3001/ui/tools/beat-explorer.html',
                message: 'For interactive beat exploration with full UI, open: http://localhost:3001/ui/tools/beat-explorer.html',
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Failed to analyze audio: ${error}`,
                uiLink: 'http://localhost:3001/ui/tools/beat-explorer.html',
                message: 'For interactive beat exploration with full UI, open: http://localhost:3001/ui/tools/beat-explorer.html',
              }),
            },
          ],
        };
      }
    }
  );
}
