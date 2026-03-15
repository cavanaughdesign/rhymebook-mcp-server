import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { getBeatsLibraryPath } from '../db/beats-library.js';

const execAsync = promisify(exec);

// Check if spleeter is installed
async function isSpleeterAvailable(): Promise<boolean> {
  try {
    await execAsync('spleeter --version');
    return true;
  } catch {
    return false;
  }
}

// Separate audio using Spleeter
async function separateAudio(
  inputPath: string,
  outputDir: string,
  stems: number = 2
): Promise<{ success: boolean; outputFiles: string[]; error?: string }> {
  try {
    // Check if spleeter is available
    const available = await isSpleeterAvailable();
    if (!available) {
      return {
        success: false,
        outputFiles: [],
        error: 'Spleeter is not installed. Install with: pip install spleeter',
      };
    }

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Run spleeter
    const command = `spleeter separate -p spleeter:${stems}stems -o "${outputDir}" "${inputPath}"`;
    await execAsync(command, { timeout: 300000 }); // 5 minute timeout

    // Find output files
    const files = await fs.readdir(outputDir, { recursive: true });
    const audioFiles = files.filter((f: any) => 
      typeof f === 'string' && (f.endsWith('.wav') || f.endsWith('.mp3'))
    );

    return {
      success: true,
      outputFiles: audioFiles.map((f: any) => path.join(outputDir, f.toString())),
    };
  } catch (error) {
    return {
      success: false,
      outputFiles: [],
      error: `Separation failed: ${error}`,
    };
  }
}

export function registerAudioProcessingTools(server: McpServer): void {
  // Tool: Separate Audio Stems
  registerAppTool(
    server,
    'separate-audio',
    {
      title: 'Separate Audio Stems',
      description: 'Separate audio into stems (vocals, drums, bass, etc.) using Spleeter AI. Requires Spleeter to be installed.',
      inputSchema: {
        inputPath: z.string().describe('Path to input audio file'),
        stems: z.enum(['2', '4', '5']).optional().describe('Number of stems: 2 (vocals/accompaniment), 4 (vocals/drums/bass/other), or 5 (vocals/drums/bass/piano/other)'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ inputPath, stems = '2' }) => {
      const outputDir = path.join(getBeatsLibraryPath(), '.separated', path.basename(inputPath, path.extname(inputPath)));
      const stemCount = parseInt(stems);

      const result = await separateAudio(inputPath, outputDir, stemCount);

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

  // Tool: Check Audio Processing Status
  registerAppTool(
    server,
    'check-audio-tools',
    {
      title: 'Check Audio Tools',
      description: 'Check which audio processing tools are available (Spleeter, FFmpeg, etc.)',
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async () => {
      const tools: Record<string, { available: boolean; version?: string }> = {};

      // Check Spleeter
      try {
        const { stdout } = await execAsync('spleeter --version');
        tools.spleeter = { available: true, version: stdout.trim() };
      } catch {
        tools.spleeter = { available: false };
      }

      // Check FFmpeg
      try {
        const { stdout } = await execAsync('ffmpeg -version');
        tools.ffmpeg = { available: true, version: stdout.split('\n')[0] };
      } catch {
        tools.ffmpeg = { available: false };
      }

      // Check SoX
      try {
        const { stdout } = await execAsync('sox --version');
        tools.sox = { available: true, version: stdout.trim() };
      } catch {
        tools.sox = { available: false };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              tools,
              recommendations: {
                vocalRemoval: tools.spleeter.available 
                  ? 'Spleeter available for high-quality vocal separation'
                  : 'Install Spleeter: pip install spleeter',
                audioConversion: tools.ffmpeg.available
                  ? 'FFmpeg available for audio conversion'
                  : 'Install FFmpeg for audio format conversion',
              },
            }),
          },
        ],
      };
    }
  );

  // Tool: Extract Vocals
  registerAppTool(
    server,
    'extract-vocals',
    {
      title: 'Extract Vocals',
      description: 'Extract vocals from a track using AI separation. Returns path to vocal and instrumental stems.',
      inputSchema: {
        inputPath: z.string().describe('Path to input audio file'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ inputPath }) => {
      const outputDir = path.join(getBeatsLibraryPath(), '.vocals', path.basename(inputPath, path.extname(inputPath)));
      
      const result = await separateAudio(inputPath, outputDir, 2);

      if (result.success) {
        const vocals = result.outputFiles.find(f => f.includes('vocals'));
        const accompaniment = result.outputFiles.find(f => f.includes('accompaniment'));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                vocals: vocals || null,
                instrumental: accompaniment || null,
                message: 'Vocals extracted successfully',
              }),
            },
          ],
        };
      }

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
}
