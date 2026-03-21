import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { createSong, saveSongSections, getSong, getAllSongs, updateSong } from '../db/operations.js';
import { importLyricsFromText, exportLyricsToText, exportLyricsToMarkdown, exportLyricsToJson, exportLyricsToLrc, importLyricsAsSong, importLyricsFromFile, batchImportLyrics, batchExportLyrics } from '../db/lyrics-io.js';
import { logError } from '../utils/logger.js';

// Datamuse API for unlimited rhymes
const DATAMUSE_API = 'https://api.datamuse.com';

async function fetchRhymesFromAPI(word: string, type: 'rhyme' | 'slant' | 'similar' = 'rhyme'): Promise<string[]> {
  try {
    const relParam = type === 'rhyme' ? 'rel_rhy' : type === 'slant' ? 'rel_nry' : 'rel_syn';
    const response = await fetch(`${DATAMUSE_API}/words?${relParam}=${encodeURIComponent(word)}&max=50`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((item: any) => item.word);
  } catch (error) {
    logError('Datamuse API error', 'lyric-lab', error);
    return [];
  }
}

async function fetchSynonymsFromAPI(word: string): Promise<string[]> {
  try {
    const response = await fetch(`${DATAMUSE_API}/words?rel_syn=${encodeURIComponent(word)}&max=30`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((item: any) => item.word);
  } catch (error) {
    logError('Datamuse API error', 'lyric-lab', error);
    return [];
  }
}

// Local rhyme database (fallback/cache)
const rhymeDatabase: Record<string, { perfect: string[]; slant: string[]; multi: string[] }> = {
  flow: {
    perfect: ['go', 'show', 'know', 'grow', 'blow', 'low', 'snow', 'throw', 'glow', 'slow'],
    slant: ['soul', 'roll', 'control', 'gold', 'hold', 'cold', 'bold', 'told', 'fold'],
    multi: ['overflow', 'undertow', 'radio', 'studio', 'portfolio', 'scenario', 'audio'],
  },
  beat: {
    perfect: ['street', 'heat', 'meet', 'feat', 'seat', 'sweet', 'feet', 'treat', 'neat', 'fleet'],
    slant: ['deep', 'keep', 'sleep', 'steep', 'creep', 'leap', 'heap', 'sweep'],
    multi: ['defeat', 'complete', 'compete', 'repeat', 'retreat', 'discrete', 'concrete'],
  },
  rhyme: {
    perfect: ['time', 'climb', 'prime', 'crime', 'dime', 'lime', 'mime', 'sublime', 'chime'],
    slant: ['mind', 'find', 'kind', 'blind', 'grind', 'wind', 'behind', 'design'],
    multi: ['paradigm', 'pantomime', 'anytime', 'sometime', 'overtime', 'lifetime'],
  },
  mic: {
    perfect: ['like', 'strike', 'bike', 'hike', 'spike', 'psych', 'dyke', 'pike'],
    slant: ['night', 'light', 'right', 'fight', 'sight', 'tight', 'bright', 'flight', 'might'],
    multi: ['dynamite', 'overnight', 'satellite', 'kryptonite', 'appetite', 'parasite'],
  },
  rap: {
    perfect: ['cap', 'map', 'trap', 'snap', 'clap', 'gap', 'wrap', 'strap', 'flap', 'slap'],
    slant: ['back', 'black', 'stack', 'track', 'crack', 'pack', 'lack', 'attack', 'jack'],
    multi: ['handicap', 'overlap', 'bootstrap', 'mishap', 'entrap', 'recap'],
  },
  game: {
    perfect: ['name', 'fame', 'claim', 'flame', 'aim', 'shame', 'frame', 'blame', 'tame'],
    slant: ['change', 'range', 'strange', 'arrange', 'exchange', 'grain', 'brain', 'train'],
    multi: ['proclaim', 'exclaim', 'reclaim', 'disclaim', 'mainstream', 'downstream'],
  },
  king: {
    perfect: ['ring', 'sing', 'bring', 'thing', 'swing', 'string', 'wing', 'spring', 'sting'],
    slant: ['think', 'drink', 'link', 'sink', 'pink', 'blink', 'shrink', 'wink', 'sync'],
    multi: ['everything', 'anything', 'nothing', 'something', 'beginning', 'winning'],
  },
  fire: {
    perfect: ['higher', 'desire', 'inspire', 'require', 'admire', 'wire', 'tire', 'hire'],
    slant: ['fly', 'try', 'high', 'sky', 'die', 'lie', 'buy', 'guy', 'why', 'cry'],
    multi: ['empire', 'entire', 'retire', 'conspire', 'expire', 'transpire', 'acquire'],
  },
};

// Thesaurus database
const thesaurusDatabase: Record<string, string[]> = {
  money: ['cash', 'bread', 'paper', 'cheddar', 'guap', 'bands', 'dough', 'stacks', 'loot', 'funds'],
  car: ['whip', 'ride', 'wheels', 'vehicle', 'auto', 'motor', 'sled', 'bucket', 'benz', 'lambo'],
  friend: ['homie', 'dawg', 'bro', 'ace', 'comrade', 'ally', 'partner', 'crew', 'squad', 'fam'],
  cool: ['dope', 'fire', 'lit', 'fresh', 'clean', 'sick', 'tight', 'solid', 'smooth', 'fly'],
  fight: ['battle', 'clash', 'combat', 'war', 'conflict', 'beef', 'scrap', 'bout', 'duel', 'spar'],
  success: ['win', 'victory', 'triumph', 'achievement', 'glory', 'domination', 'conquest', 'crown'],
  love: ['affection', 'passion', 'devotion', 'adoration', 'desire', 'heart', 'soul', 'embrace'],
  hate: ['despise', 'loathe', 'detest', 'abhor', 'resent', 'animosity', 'venom', 'bitterness'],
  hustle: ['grind', 'work', 'strive', 'push', 'struggle', 'effort', 'dedication', 'ambition'],
  dream: ['vision', 'aspiration', 'goal', 'ambition', 'fantasy', 'desire', 'hope', 'wish'],
  street: ['block', 'hood', 'ghetto', 'turf', 'avenue', 'corner', 'concrete', 'asphalt'],
  power: ['strength', 'force', 'might', 'authority', 'control', 'dominance', 'influence', 'clout'],
  truth: ['reality', 'fact', 'honesty', 'verity', 'authenticity', 'genuine', 'real', 'legit'],
  pain: ['suffering', 'agony', 'hurt', 'anguish', 'torment', 'ache', 'misery', 'sorrow'],
  grind: ['hustle', 'grindset', 'work ethic', 'drive', 'ambition', 'determination', 'focus'],
};

// Syllable counter
function countSyllables(word: string): number {
  word = word.toLowerCase().trim();
  if (word.length <= 3) return 1;

  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');

  const syllables = word.match(/[aeiouy]{1,2}/g);
  return syllables ? syllables.length : 1;
}

function countLineSyllables(line: string): number {
  const words = line.split(/\s+/).filter(w => w.length > 0);
  return words.reduce((sum, word) => sum + countSyllables(word.replace(/[^a-zA-Z]/g, '')), 0);
}

// Flow pattern generator
function generateFlowPattern(lines: string[]): number[] {
  return lines.map(line => countLineSyllables(line));
}

export function registerLyricLabTools(server: McpServer): void {
  // Tool: Find Rhymes
  registerAppTool(
    server,
    'find-rhymes',
    {
      title: 'Find Rhymes',
      description: 'Find perfect, slant, and multi-syllable rhymes for a given word',
      inputSchema: {
        word: z.string().describe('The word to find rhymes for'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/lyric-lab.html',
        },
      },
    },
    async ({ word }) => {
      const lowerWord = word.toLowerCase().trim();
      
      // Try API first for unlimited rhymes
      const [perfectRhymes, slantRhymes, similarWords] = await Promise.all([
        fetchRhymesFromAPI(lowerWord, 'rhyme'),
        fetchRhymesFromAPI(lowerWord, 'slant'),
        fetchRhymesFromAPI(lowerWord, 'similar'),
      ]);

      // Use API results if available, otherwise fall back to local database
      const localRhymes = rhymeDatabase[lowerWord];
      
      const rhymes = {
        perfect: perfectRhymes.length > 0 ? perfectRhymes : (localRhymes?.perfect || ['No perfect rhymes found']),
        slant: slantRhymes.length > 0 ? slantRhymes : (localRhymes?.slant || ['No slant rhymes found']),
        multi: similarWords.filter(w => w.includes(' ') || w.length > 6).slice(0, 15),
      };

      const source = perfectRhymes.length > 0 ? 'datamuse-api' : 'local-database';

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              word: word,
              rhymes,
              totalResults: rhymes.perfect.length + rhymes.slant.length + rhymes.multi.length,
              source,
            }),
          },
        ],
      };
    }
  );

  // Tool: Count Syllables
  registerAppTool(
    server,
    'count-syllables',
    {
      title: 'Count Syllables',
      description: 'Count syllables in text for flow analysis',
      inputSchema: {
        text: z.string().describe('The text to count syllables in'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/lyric-lab.html',
        },
      },
    },
    async ({ text }) => {
      const lines = text.split('\n').filter(l => l.trim());
      const lineData = lines.map((line, i) => ({
        lineNumber: i + 1,
        text: line,
        syllables: countLineSyllables(line),
      }));

      const totalSyllables = lineData.reduce((sum, l) => sum + l.syllables, 0);
      const avgSyllables = lines.length > 0 ? totalSyllables / lines.length : 0;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              lines: lineData,
              totalSyllables,
              averageSyllables: Math.round(avgSyllables * 10) / 10,
              lineCount: lines.length,
            }),
          },
        ],
      };
    }
  );

  // Tool: Analyze Flow
  registerAppTool(
    server,
    'analyze-flow',
    {
      title: 'Analyze Flow',
      description: 'Analyze the rhythm and flow pattern of lyrics',
      inputSchema: {
        lyrics: z.string().describe('The lyrics to analyze'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/lyric-lab.html',
        },
      },
    },
    async ({ lyrics }) => {
      const lines = lyrics.split('\n').filter(line => line.trim().length > 0);
      const pattern = generateFlowPattern(lines);
      const maxSyllables = Math.max(...pattern);
      const minSyllables = Math.min(...pattern);
      const variance = maxSyllables - minSyllables;

      // Generate visual pattern
      const visualPattern = pattern.map(s => {
        const normalized = Math.round((s / maxSyllables) * 8);
        return '▁▂▃▄▅▆▇█'.charAt(Math.min(normalized, 7));
      }).join('');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pattern,
              visualPattern,
              stats: {
                maxSyllables,
                minSyllables,
                variance,
                consistency: variance <= 2 ? 'High' : variance <= 4 ? 'Medium' : 'Low',
              },
              lines: lines.length,
            }),
          },
        ],
      };
    }
  );

  // Tool: Get Synonyms
  registerAppTool(
    server,
    'get-synonyms',
    {
      title: 'Get Synonyms',
      description: 'Get contextual synonyms and alternative words for lyrics',
      inputSchema: {
        word: z.string().describe('The word to find synonyms for'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/lyric-lab.html',
        },
      },
    },
    async ({ word }) => {
      const lowerWord = word.toLowerCase();
      
      // Try API first
      const apiSynonyms = await fetchSynonymsFromAPI(lowerWord);
      
      // Use API results if available, otherwise fall back to local database
      const synonyms = apiSynonyms.length > 0 
        ? apiSynonyms 
        : (thesaurusDatabase[lowerWord] || [
            'No synonyms found',
            'Try: money, car, friend, cool, fight, success, love, hate, hustle, dream, street, power, truth, pain',
          ]);

      const source = apiSynonyms.length > 0 ? 'datamuse-api' : 'local-database';

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              word: word,
              synonyms,
              count: synonyms.length,
              source,
            }),
          },
        ],
      };
    }
  );

  // Tool: Save Lyrics
  registerAppTool(
    server,
    'save-lyrics',
    {
      title: 'Save Lyrics',
      description: 'Save lyrics to a song project in the database',
      inputSchema: {
        title: z.string().min(1).max(200).describe('Song title'),
        sections: z.array(z.object({
          type: z.enum(['intro', 'verse', 'chorus', 'bridge', 'outro', 'hook']),
          content: z.string().max(50000),
        })).max(20).describe('Song sections with their content'),
        notes: z.string().max(5000).optional().describe('Additional notes'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/lyric-lab.html',
        },
      },
    },
    async ({ title, sections, notes }) => {
      // Create song in database
      const song = createSong(title, notes);
      saveSongSections(song.id, sections);

      const totalLines = sections.reduce((sum, s) => sum + s.content.split('\n').length, 0);
      const totalWords = sections.reduce((sum, s) => sum + s.content.split(/\s+/).filter(w => w).length, 0);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              saved: true,
              songId: song.id,
              title,
              sections: sections.length,
              totalLines,
              totalWords,
              notes: notes || 'No notes',
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };
    }
  );

  // Tool: Export Lyrics
  registerAppTool(
    server,
    'export-lyrics',
    {
      title: 'Export Lyrics',
      description: 'Export lyrics in various formats (text, markdown, JSON, LRC)',
      inputSchema: {
        title: z.string().describe('Song title'),
        sections: z.array(z.object({
          type: z.string(),
          content: z.string(),
        })).describe('Song sections'),
        format: z.enum(['text', 'markdown', 'json', 'lrc']).describe('Export format'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/lyric-lab.html',
        },
      },
    },
    async ({ title, sections, format }) => {
      const song = { title, sections, status: 'writing', progress: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any;

      let output: string;
      switch (format) {
        case 'markdown':
          output = exportLyricsToMarkdown(song);
          break;
        case 'json':
          output = exportLyricsToJson(song);
          break;
        case 'lrc':
          output = exportLyricsToLrc(song);
          break;
        default:
          output = exportLyricsToText(song);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              format,
              output,
              size: output.length,
            }),
          },
        ],
      };
    }
  );

  // Tool: Import Lyrics
  registerAppTool(
    server,
    'import-lyrics',
    {
      title: 'Import Lyrics',
      description: 'Import lyrics from a file or text content',
      inputSchema: {
        filePath: z.string().optional().describe('Path to lyrics file'),
        content: z.string().optional().describe('Lyrics text content'),
        title: z.string().optional().describe('Song title (for text import)'),
        format: z.enum(['txt', 'json', 'lrc', 'srt']).optional().describe('Format of the lyrics'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/lyric-lab.html',
        },
      },
    },
    async ({ filePath, content, title, format }) => {
      if (filePath) {
        const song = importLyricsAsSong(filePath);
        if (song) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                imported: true,
                song,
              }),
            }],
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Failed to import file' }) }],
        };
      }

      if (content) {
        const song = importLyricsFromText(title || 'Imported Song', content, format || 'txt');
        if (song) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                imported: true,
                song,
              }),
            }],
          };
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'No file path or content provided' }) }],
      };
    }
  );

  // Tool: Batch Import Lyrics
  registerAppTool(
    server,
    'batch-import-lyrics',
    {
      title: 'Batch Import Lyrics',
      description: 'Import all lyrics files from a directory',
      inputSchema: {
        directoryPath: z.string().describe('Path to directory containing lyrics files'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/lyric-lab.html',
        },
      },
    },
    async ({ directoryPath }) => {
      const result = batchImportLyrics(directoryPath);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result),
        }],
      };
    }
  );

  // Tool: Get All Songs
  registerAppTool(
    server,
    'get-all-songs',
    {
      title: 'Get All Songs',
      description: 'Get all saved songs from the database',
      inputSchema: {
        filter: z.enum(['all', 'writing', 'recording', 'mixing', 'mastering', 'released']).optional().describe('Filter by status'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/lyric-lab.html',
        },
      },
    },
    async ({ filter }) => {
      const songs = getAllSongs(filter);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ songs, total: songs.length }),
        }],
      };
    }
  );
}
