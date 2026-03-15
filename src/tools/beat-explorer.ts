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
      description: 'Browse and filter beats by genre, mood, BPM range, or energy level',
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
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ genre, mood, minBpm, maxBpm, minEnergy, maxEnergy, favoritesOnly }) => {
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
      title: 'Beat Details',
      description: 'Get detailed information about a specific beat including waveform visualization',
      inputSchema: {
        beatId: z.string().describe('Beat ID'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ beatId }) => {
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
      description: 'Add or remove a beat from favorites',
      inputSchema: {
        beatId: z.string().describe('Beat ID'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ beatId }) => {
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
  registerAppTool(
    server,
    'get-collections',
    {
      title: 'Get Collections',
      description: 'Get all beat collections and their contents',
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
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
  registerAppTool(
    server,
    'add-to-collection',
    {
      title: 'Add to Collection',
      description: 'Add a beat to a collection',
      inputSchema: {
        beatId: z.string().describe('Beat ID'),
        collectionName: z.string().describe('Collection name'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ beatId, collectionName }) => {
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
  registerAppTool(
    server,
    'create-collection',
    {
      title: 'Create Collection',
      description: 'Create a new beat collection',
      inputSchema: {
        name: z.string().describe('Collection name'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ name }) => {
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
  registerAppTool(
    server,
    'match-lyrics-to-beat',
    {
      title: 'Match Lyrics to Beat',
      description: 'Analyze lyrics and suggest beats that match the energy and mood',
      inputSchema: {
        lyrics: z.string().describe('The lyrics to analyze'),
        preferredBpm: z.number().optional().describe('Preferred BPM range center'),
        preferredGenre: z.string().optional().describe('Preferred genre'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ lyrics, preferredBpm, preferredGenre }) => {
      const beats = getAllBeats();

      // Analyze lyrics energy
      const words = lyrics.toLowerCase().split(/\s+/);
      const aggressiveWords = ['fight', 'kill', 'die', 'war', 'battle', 'hate', 'rage', 'fire', 'burn', 'destroy'];
      const chillWords = ['love', 'peace', 'dream', 'calm', 'soft', 'gentle', 'flow', 'smooth', 'easy', 'slow'];
      const motivationalWords = ['hustle', 'grind', 'rise', 'win', 'success', 'money', 'power', 'crown', 'king', 'boss'];

      let energyScore = 50;
      let moodHints: string[] = [];

      words.forEach(word => {
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
  registerAppTool(
    server,
    'get-beat-stats',
    {
      title: 'Beat Library Stats',
      description: 'Get statistics about the beat library',
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
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
            }),
          },
        ],
      };
    }
  );

  // ============ LIBRARY MANAGEMENT TOOLS ============

  // Tool: Get Beats Library Path
  registerAppTool(
    server,
    'get-library-path',
    {
      title: 'Get Library Path',
      description: 'Get the current beats library folder path',
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
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
            }),
          },
        ],
      };
    }
  );

  // Tool: Set Beats Library Path
  registerAppTool(
    server,
    'set-library-path',
    {
      title: 'Set Library Path',
      description: 'Set the beats library folder path',
      inputSchema: {
        path: z.string().describe('Path to the beats library folder'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ path: newPath }) => {
      const result = await setBeatsLibraryPath(newPath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  // Tool: Scan Beats Library
  registerAppTool(
    server,
    'scan-library',
    {
      title: 'Scan Library',
      description: 'Scan the beats library folder for audio files',
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
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
            }),
          },
        ],
      };
    }
  );

  // Tool: Import Beats from Library
  registerAppTool(
    server,
    'import-beats',
    {
      title: 'Import Beats',
      description: 'Import new beat files from the library folder into the database',
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async () => {
      const result = await importNewBeats();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  // Tool: Copy Beat to Library
  registerAppTool(
    server,
    'copy-beat-to-library',
    {
      title: 'Copy Beat to Library',
      description: 'Copy a beat file from any location to the beats library',
      inputSchema: {
        sourcePath: z.string().describe('Path to the source beat file'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ sourcePath }) => {
      const result = await copyBeatToLibrary(sourcePath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  // Tool: Add Beat Manually
  registerAppTool(
    server,
    'add-beat',
    {
      title: 'Add Beat',
      description: 'Add a new beat to the database. If filePath is provided, BPM/key/duration will be auto-detected.',
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
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ title, producer, filePath, bpm, key, genres, moods, tags, energy }) => {
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
            }),
          },
        ],
      };
    }
  );

  // Tool: Analyze Audio File
  registerAppTool(
    server,
    'analyze-audio',
    {
      title: 'Analyze Audio',
      description: 'Analyze an audio file to detect BPM, key, and duration',
      inputSchema: {
        filePath: z.string().describe('Path to audio file'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ filePath }) => {
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
              }),
            },
          ],
        };
      }
    }
  );
}
