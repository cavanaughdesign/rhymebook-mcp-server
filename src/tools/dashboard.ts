import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { getDatabase } from '../db/database.js';
import {
  getAllSongs, getSongStats, getAllSessions, getAllCollaborators,
  getBeatStats, getAllCollections,
} from '../db/operations.js';
import { getLibraryStats } from '../db/beats-library.js';

export interface DashboardSummary {
  overview: {
    totalSongs: number;
    totalSessions: number;
    totalBeats: number;
    totalCollaborators: number;
    totalCollections: number;
    totalTakes: number;
  };
  songStats: {
    byStatus: Record<string, number>;
    averageProgress: number;
    recentlyUpdated: Array<{
      id: string;
      title: string;
      status: string;
      progress: number;
      updatedAt: string;
    }>;
  };
  sessionStats: {
    byStatus: Record<string, number>;
    totalDuration: number;
    recentSessions: Array<{
      id: string;
      songTitle: string;
      date: string;
      studio: string;
      status: string;
      takeCount: number;
    }>;
  };
  beatStats: {
    totalBeats: number;
    favorites: number;
    averageBpm: number;
    averageEnergy: number;
    topGenres: string[];
    topMoods: string[];
    librarySize: string;
  };
  activity: {
    recentActivity: ActivityItem[];
    weeklyProgress: WeeklyProgress[];
  };
  insights: {
    mostProductiveDay: string;
    averageSessionLength: number;
    completionRate: number;
    topCollaborators: string[];
  };
}

export interface ActivityItem {
  id: string;
  type: 'song_created' | 'song_updated' | 'session_completed' | 'take_logged' | 'beat_added' | 'beat_favorited';
  title: string;
  description: string;
  timestamp: string;
  icon: string;
}

export interface WeeklyProgress {
  week: string;
  songsCreated: number;
  sessionsCompleted: number;
  takesLogged: number;
  lyricsWritten: number;
}

export function registerDashboardTools(server: McpServer): void {
  // Tool: Get Dashboard Summary
  registerAppTool(
    server,
    'get-dashboard-summary',
    {
      title: 'Dashboard Summary',
      description: 'Get comprehensive overview of all projects, sessions, beats, and activity',
      inputSchema: {
        timeframe: z.enum(['week', 'month', 'all']).optional().describe('Timeframe for stats'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ timeframe = 'week' }) => {
      const db = getDatabase();

      // Parallelize all independent queries
      const [
        songs,
        sessions,
        collaborators,
        collections,
        songStats,
        beatStats,
        libraryStats,
        totalTakes,
        sessionDuration,
        sessionsByStatus,
        recentlyUpdated,
        recentSessions,
      ] = await Promise.all([
        Promise.resolve(getAllSongs()),
        Promise.resolve(getAllSessions()),
        Promise.resolve(getAllCollaborators()),
        Promise.resolve(getAllCollections()),
        Promise.resolve(getSongStats()),
        Promise.resolve(getBeatStats()),
        getLibraryStats(),
        Promise.resolve(db.prepare('SELECT COUNT(*) as count FROM takes').get() as { count: number }),
        Promise.resolve(db.prepare('SELECT COALESCE(SUM(duration), 0) as total FROM recording_sessions').get() as { total: number }),
        Promise.resolve(db.prepare('SELECT status, COUNT(*) as count FROM recording_sessions GROUP BY status').all() as { status: string; count: number }[]),
        Promise.resolve(db.prepare('SELECT id, title, status, progress, updated_at as updatedAt FROM songs ORDER BY updated_at DESC LIMIT 5').all()),
        Promise.resolve(db.prepare(`
          SELECT rs.id, s.title as songTitle, rs.date, rs.studio, rs.status,
            (SELECT COUNT(*) FROM takes WHERE session_id = rs.id) as takeCount
          FROM recording_sessions rs
          JOIN songs s ON rs.song_id = s.id
          ORDER BY rs.date DESC LIMIT 5
        `).all()),
      ]);

      // Get songs by status
      const songsByStatus: Record<string, number> = {
        writing: songStats.writing,
        recording: songStats.recording,
        mixing: songStats.mixing,
        mastering: songStats.mastering,
        released: songStats.released,
      };

      // Map sessions by status
      const sessionStatusMap: Record<string, number> = {
        scheduled: 0,
        'in-progress': 0,
        completed: 0,
      };
      sessionsByStatus.forEach(s => {
        sessionStatusMap[s.status] = s.count;
      });

      // Get recent activity and weekly progress (these depend on db)
      const recentActivity = getRecentActivity(db, timeframe);
      const weeklyProgress = getWeeklyProgress(db);
      const insights = calculateInsights(db);

      const summary: DashboardSummary = {
        overview: {
          totalSongs: songs.length,
          totalSessions: sessions.length,
          totalBeats: beatStats.totalBeats,
          totalCollaborators: collaborators.length,
          totalCollections: collections.length,
          totalTakes: totalTakes.count,
        },
        songStats: {
          byStatus: songsByStatus,
          averageProgress: songStats.averageProgress,
          recentlyUpdated: recentlyUpdated as any[],
        },
        sessionStats: {
          byStatus: sessionStatusMap,
          totalDuration: sessionDuration.total,
          recentSessions: recentSessions as any[],
        },
        beatStats: {
          totalBeats: beatStats.totalBeats,
          favorites: beatStats.favorites,
          averageBpm: beatStats.averageBpm,
          averageEnergy: beatStats.averageEnergy,
          topGenres: beatStats.genres.slice(0, 5),
          topMoods: beatStats.moods.slice(0, 5),
          librarySize: libraryStats.totalSizeFormatted,
        },
        activity: {
          recentActivity,
          weeklyProgress,
        },
        insights,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary),
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
      title: 'Recent Activity',
      description: 'Get recent activity feed across all features',
      inputSchema: {
        limit: z.number().min(1).max(50).optional().describe('Number of items to return'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
        type: z.enum(['all', 'songs', 'sessions', 'beats']).optional().describe('Filter by type'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ limit = 20, offset = 0, type = 'all' }) => {
      const db = getDatabase();
      const activity = getRecentActivity(db, 'all', limit + offset, type);
      const paginatedActivity = activity.slice(offset, offset + limit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              activity: paginatedActivity, 
              total: activity.length,
              returned: paginatedActivity.length,
              hasMore: offset + limit < activity.length,
              nextOffset: offset + paginatedActivity.length,
            }),
          },
        ],
      };
    }
  );

  // Tool: Get Progress Stats
  registerAppTool(
    server,
    'get-progress-stats',
    {
      title: 'Progress Statistics',
      description: 'Get detailed progress statistics and trends',
      inputSchema: {
        timeframe: z.enum(['week', 'month', 'quarter', 'year']).optional().describe('Timeframe'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async ({ timeframe = 'month' }) => {
      const db = getDatabase();
      const weeklyProgress = getWeeklyProgress(db);
      const insights = calculateInsights(db);

      // Get completion funnel
      const funnel = db.prepare(`
        SELECT 
          COUNT(CASE WHEN status = 'writing' THEN 1 END) as writing,
          COUNT(CASE WHEN status = 'recording' THEN 1 END) as recording,
          COUNT(CASE WHEN status = 'mixing' THEN 1 END) as mixing,
          COUNT(CASE WHERE status = 'mastering' THEN 1 END) as mastering,
          COUNT(CASE WHEN status = 'released' THEN 1 END) as released
        FROM songs
      `).get();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              weeklyProgress,
              insights,
              funnel,
              timeframe,
            }),
          },
        ],
      };
    }
  );

  // Tool: Get Quick Stats
  registerAppTool(
    server,
    'get-quick-stats',
    {
      title: 'Quick Stats',
      description: 'Get quick statistics for dashboard widgets',
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: 'ui://rhymebook/app.html',
        },
      },
    },
    async () => {
      const db = getDatabase();

      // Today's activity
      const today = new Date().toISOString().split('T')[0];
      const todaySessions = db.prepare(`
        SELECT COUNT(*) as count FROM recording_sessions WHERE date = ?
      `).get(today) as { count: number };

      const todayTakes = db.prepare(`
        SELECT COUNT(*) as count FROM takes 
        WHERE date(timestamp) = date('now')
      `).get() as { count: number };

      // This week's songs
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weekSongs = db.prepare(`
        SELECT COUNT(*) as count FROM songs WHERE created_at >= ?
      `).get(weekAgo) as { count: number };

      // In progress items
      const inProgress = db.prepare(`
        SELECT COUNT(*) as count FROM songs WHERE status != 'released' AND progress > 0
      `).get() as { count: number };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              today: {
                sessions: todaySessions.count,
                takes: todayTakes.count,
              },
              thisWeek: {
                newSongs: weekSongs.count,
              },
              inProgress: inProgress.count,
            }),
          },
        ],
      };
    }
  );
}

function getRecentActivity(db: any, timeframe: string, limit: number = 20, type: string = 'all'): ActivityItem[] {
  const activities: ActivityItem[] = [];

  // Get recent songs
  if (type === 'all' || type === 'songs') {
    const recentSongs = db.prepare(`
      SELECT id, title, status, created_at, updated_at FROM songs 
      ORDER BY updated_at DESC LIMIT 10
    `).all() as any[];

    recentSongs.forEach(song => {
      const isNew = song.created_at === song.updated_at;
      activities.push({
        id: `song-${song.id}`,
        type: isNew ? 'song_created' : 'song_updated',
        title: isNew ? 'New Song Created' : 'Song Updated',
        description: `"${song.title}" - ${song.status}`,
        timestamp: song.updated_at,
        icon: isNew ? '🎵' : '📝',
      });
    });
  }

  // Get recent sessions
  if (type === 'all' || type === 'sessions') {
    const recentSessions = db.prepare(`
      SELECT rs.id, s.title as songTitle, rs.date, rs.status, rs.updated_at
      FROM recording_sessions rs
      JOIN songs s ON rs.song_id = s.id
      ORDER BY rs.updated_at DESC LIMIT 10
    `).all() as any[];

    recentSessions.forEach(session => {
      activities.push({
        id: `session-${session.id}`,
        type: session.status === 'completed' ? 'session_completed' : 'song_updated',
        title: session.status === 'completed' ? 'Session Completed' : 'Session Updated',
        description: `"${session.songTitle}" - ${session.date}`,
        timestamp: session.updated_at,
        icon: session.status === 'completed' ? '✅' : '🎙️',
      });
    });

    // Get recent takes
    const recentTakes = db.prepare(`
      SELECT t.id, t.rating, t.timestamp, s.title as songTitle
      FROM takes t
      JOIN recording_sessions rs ON t.session_id = rs.id
      JOIN songs s ON rs.song_id = s.id
      ORDER BY t.timestamp DESC LIMIT 10
    `).all() as any[];

    recentTakes.forEach(take => {
      activities.push({
        id: `take-${take.id}`,
        type: 'take_logged',
        title: 'Take Logged',
        description: `"${take.songTitle}" - ${'⭐'.repeat(take.rating)}`,
        timestamp: take.timestamp,
        icon: '🎤',
      });
    });
  }

  // Get recent beats
  if (type === 'all' || type === 'beats') {
    const recentBeats = db.prepare(`
      SELECT id, title, producer, favorite, created_at, updated_at FROM beats
      ORDER BY updated_at DESC LIMIT 10
    `).all() as any[];

    recentBeats.forEach(beat => {
      activities.push({
        id: `beat-${beat.id}`,
        type: beat.favorite ? 'beat_favorited' : 'beat_added',
        title: beat.favorite ? 'Beat Favorited' : 'Beat Added',
        description: `"${beat.title}" by ${beat.producer || 'Unknown'}`,
        timestamp: beat.updated_at,
        icon: beat.favorite ? '⭐' : '🎧',
      });
    });
  }

  // Sort by timestamp and limit
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return activities.slice(0, limit);
}

function getWeeklyProgress(db: any): WeeklyProgress[] {
  const weeks: WeeklyProgress[] = [];

  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekStartStr = weekStart.toISOString();
    const weekEndStr = weekEnd.toISOString();

    const songsCreated = db.prepare(`
      SELECT COUNT(*) as count FROM songs 
      WHERE created_at >= ? AND created_at < ?
    `).get(weekStartStr, weekEndStr) as { count: number };

    const sessionsCompleted = db.prepare(`
      SELECT COUNT(*) as count FROM recording_sessions 
      WHERE status = 'completed' AND updated_at >= ? AND updated_at < ?
    `).get(weekStartStr, weekEndStr) as { count: number };

    const takesLogged = db.prepare(`
      SELECT COUNT(*) as count FROM takes 
      WHERE timestamp >= ? AND timestamp < ?
    `).get(weekStartStr, weekEndStr) as { count: number };

    weeks.push({
      week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      songsCreated: songsCreated.count,
      sessionsCompleted: sessionsCompleted.count,
      takesLogged: takesLogged.count,
      lyricsWritten: 0, // Would need to track word count changes
    });
  }

  return weeks;
}

function calculateInsights(db: any): DashboardSummary['insights'] {
  // Most productive day
  const dayStats = db.prepare(`
    SELECT strftime('%w', date) as dayOfWeek, COUNT(*) as count
    FROM recording_sessions
    GROUP BY dayOfWeek
    ORDER BY count DESC
    LIMIT 1
  `).get() as { dayOfWeek: string; count: number } | undefined;

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mostProductiveDay = dayStats ? days[parseInt(dayStats.dayOfWeek)] : 'No data';

  // Average session length
  const avgSession = db.prepare(`
    SELECT AVG(duration) as avgDuration FROM recording_sessions WHERE duration > 0
  `).get() as { avgDuration: number | null };

  // Completion rate
  const totalSongs = db.prepare('SELECT COUNT(*) as count FROM songs').get() as { count: number };
  const releasedSongs = db.prepare("SELECT COUNT(*) as count FROM songs WHERE status = 'released'").get() as { count: number };
  const completionRate = totalSongs.count > 0 ? Math.round((releasedSongs.count / totalSongs.count) * 100) : 0;

  // Top collaborators
  const topCollabs = db.prepare(`
    SELECT c.name, COUNT(*) as sessionCount
    FROM song_collaborators sc
    JOIN collaborators c ON sc.collaborator_id = c.id
    GROUP BY c.id
    ORDER BY sessionCount DESC
    LIMIT 5
  `).all() as { name: string; sessionCount: number }[];

  return {
    mostProductiveDay,
    averageSessionLength: Math.round(avgSession.avgDuration || 0),
    completionRate,
    topCollaborators: topCollabs.map(c => c.name),
  };
}
