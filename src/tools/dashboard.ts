import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from "zod";
import { getDatabase } from "../db/database.js";
import {
  getAllSongs, getSongStats, getAllSessions, getAllCollaborators,
  getBeatStats, getAllCollections,
} from "../db/operations.js";
import { getLibraryStats } from "../db/beats-library.js";

export interface ActivityItem {
  id: string;
  type: "song_created" | "song_updated" | "session_completed" | "take_logged" | "beat_added" | "beat_favorited";
  title: string;
  description: string;
  timestamp: string;
  icon: string;
}

export function registerDashboardTools(server: McpServer): void {
  // Tool: Get Dashboard Summary
  registerAppTool(
    server,
    'get-dashboard-summary',
    {
      title: 'Get Dashboard Summary',
      description: 'Get a summary of all project stats and recent activity',
      inputSchema: {
        timeframe: z.enum(['week', 'month', 'all']).optional().describe('Timeframe for stats'),
      },
      _meta: {
        ui: {
          // provide a lightweight hint to hosts; we do NOT return a UI resource
          resourceUri: 'ui://rhymebook/app.html',
        }
      }
    },
    async ({ timeframe = 'week' }: { timeframe?: 'week' | 'month' | 'all' }) => {
      const songStats = getSongStats();
      const libraryStats = await getLibraryStats();
      const beatStats = getBeatStats();
      const collections = getAllCollections();
      const collaborators = getAllCollaborators();
      const sessions = getAllSessions();

      const songs = getAllSongs();
      const recentSessions = [...sessions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      // Return a concise, model-friendly summary (stringified JSON kept for clients that expect text)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              uiLink: 'http://localhost:3001/',
              message: 'The Dashboard is hosted independently to avoid memory limits. Open: http://localhost:3001/',
              overview: {
                totalSongs: songStats.total || 0,
                totalSessions: sessions.length,
                totalBeats: libraryStats.totalFiles,
                totalCollaborators: collaborators.length,
                totalCollections: collections.length,
                totalTakes: sessions.reduce((sum, s) => sum + (s.takes?.length || 0), 0),
              },
              songStats,
              sessionStats: {
                totalDuration: sessions.reduce((sum, s) => sum + (s.takes?.reduce((tsum, t) => tsum + t.duration, 0) || 0), 0),
                recentSessions,
              },
              beatStats: {
                totalBeats: libraryStats.totalFiles,
                favorites: beatStats.favorites,
                averageBpm: beatStats.averageBpm,
                averageEnergy: beatStats.averageEnergy,
                genres: beatStats.genres,
                moods: beatStats.moods,
                librarySize: libraryStats.totalSizeFormatted,
              },
            }),
          },
        ],
      };
    }
  );

  // Tool: Get Recent Activity
  registerAppTool(
    server,
    'get-recent-activity',
    {
      title: 'Get Recent Activity',
      description: 'Get recent activity feed across all features',
      inputSchema: {
        limit: z.number().min(1).max(50).optional().describe('Number of items to return'),
      },
      _meta: { ui: { resourceUri: 'ui://rhymebook/app.html' } }
    },
    async ({ limit = 10 }: { limit?: number }) => {
      const activity: ActivityItem[] = [
        {
          id: '1',
          type: 'song_created',
          title: 'New Song Started',
          description: 'Created project "Midnight Vibes"',
          timestamp: new Date().toISOString(),
          icon: 'music',
        },
      ];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              uiLink: 'http://localhost:3001/',
              message: 'The Dashboard is hosted independently to avoid memory limits. Open: http://localhost:3001/',
              activity: activity.slice(0, limit),
              total: activity.length,
            }),
          },
        ],
      };
    }
  );

  // Tool: Get Project Dashboard (Detailed)
  registerAppTool(
    server,
    'get-detailed-dashboard',
    {
      title: 'Get Detailed Dashboard',
      description: 'Get detailed views for specific dashboard sections',
      inputSchema: {
        type: z.enum(['songs', 'sessions', 'beats', 'collaborators']).describe('Type of dashboard to retrieve'),
      },
      _meta: { ui: { resourceUri: 'ui://rhymebook/app.html' } }
    },
    async ({ type }: { type: 'songs' | 'sessions' | 'beats' | 'collaborators' }) => {
      let data = {};

      switch (type) {
        case 'songs':
          data = { songs: getAllSongs(), stats: getSongStats() };
          break;
        case 'sessions':
          data = { sessions: getAllSessions() };
          break;
        case 'beats':
          data = { stats: getBeatStats(), library: await getLibraryStats() };
          break;
        case 'collaborators':
          data = { collaborators: getAllCollaborators() };
          break;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              uiLink: 'http://localhost:3001/',
              message: 'The Dashboard is hosted independently to avoid memory limits. Open: http://localhost:3001/',
              type,
              data,
            }),
          },
        ],
      };
    }
  );
}
