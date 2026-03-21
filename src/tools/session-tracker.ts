import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import {
  getAllSongs, getSong, createSong, updateSong, deleteSong, getSongStats,
  getAllSessions, getSession, createSession, updateSessionStatus, addSessionNote,
  logTake, getSessionTakes,
  getAllCollaborators, createCollaborator, addCollaboratorToSong,
} from "../db/operations.js";

export function registerSessionTrackerTools(server: McpServer): void {
  // Tool: Get Project Dashboard
  registerAppTool(
    server,
    "get-project-dashboard",
    {
      title: "Project Dashboard",
      description: "Get an overview of all music projects and their status",
      inputSchema: {
        filter: z.enum(["all", "writing", "recording", "mixing", "mastering", "released"]).optional().describe("Filter by status"),
      },
      _meta: {
        ui: {
          resourceUri: "ui://rhymebook/session-tracker.html",
        },
      },
    },
    async ({ filter }: { filter?: "all" | "writing" | "recording" | "mixing" | "mastering" | "released" }) => {
      const songs = getAllSongs(filter);
      const stats = getSongStats();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ 
              songs, 
              stats,
              uiLink: "http://localhost:3001/ui/tools/session-tracker.html",
              message: "For interactive session tracking with full UI, use the interactive tab or open: http://localhost:3001/ui/tools/session-tracker.html",
            }),
          },
        ],
      };
    }
  );

  // Tool: Get Recording Sessions
  registerAppTool(
    server,
    "get-recording-sessions",
    {
      title: "Recording Sessions",
      description: "List all recording sessions and their details",
      inputSchema: {
        songId: z.string().optional().describe("Filter by song ID"),
        status: z.enum(["all", "scheduled", "in-progress", "completed"]).optional().describe("Filter by status"),
      },
      _meta: {
        ui: {
          resourceUri: "ui://rhymebook/session-tracker.html",
        },
      },
    },
    async ({ songId, status }: { songId?: string; status?: "all" | "scheduled" | "in-progress" | "completed" }) => {
      const sessions = getAllSessions(songId, status);
      const totalTakes = sessions.reduce((sum, s) => sum + (s.takes?.length || 0), 0);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              sessions,
              totalSessions: sessions.length,
              totalTakes,
              uiLink: "http://localhost:3001/ui/tools/session-tracker.html",
              message: "For interactive session tracking with full UI, use the interactive tab or open: http://localhost:3001/ui/tools/session-tracker.html",
            }),
          },
        ],
      };
    }
  );

  // Tool: Log Take
  registerAppTool(
    server,
    "log-take",
    {
      title: "Log Take",
      description: "Log a new recording take for a session",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
        rating: z.number().min(1).max(5).describe("Rating from 1-5"),
        notes: z.string().describe("Notes about the take"),
        duration: z.number().describe("Duration in seconds"),
      },
      _meta: {
        ui: {
          resourceUri: "ui://rhymebook/session-tracker.html",
        },
      },
    },
    async ({ sessionId, rating, notes, duration }: { sessionId: string; rating: number; notes: string; duration: number }) => {
      const session = getSession(sessionId);
      if (!session) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Session not found" }) }],
        };
      }

      const take = logTake(sessionId, rating, notes, duration);
      const allTakes = getSessionTakes(sessionId);
      const bestTake = allTakes.reduce((best, t) => t.rating > best.rating ? t : best, allTakes[0]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              logged: true,
              take,
              totalTakes: allTakes.length,
              bestTake,
            }),
          },
        ],
      };
    }
  );

  // Tool: Get Collaborators
  registerAppTool(
    server,
    "get-collaborators",
    {
      title: "Collaborators",
      description: "Get all collaborators and their associated projects",
      inputSchema: {
        role: z.enum(["all", "artist", "producer", "engineer", "writer", "feature"]).optional().describe("Filter by role"),
      },
      _meta: {
        ui: {
          resourceUri: "ui://rhymebook/session-tracker.html",
        },
      },
    },
    async ({ role }: { role?: "all" | "artist" | "producer" | "engineer" | "writer" | "feature" }) => {
      const collabs = getAllCollaborators(role);
      const allCollabs = getAllCollaborators();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              collaborators: collabs,
              total: collabs.length,
              byRole: {
                producers: allCollabs.filter(c => c.role === "producer").length,
                engineers: allCollabs.filter(c => c.role === "engineer").length,
                features: allCollabs.filter(c => c.role === "feature").length,
                writers: allCollabs.filter(c => c.role === "writer").length,
              },
              uiLink: "http://localhost:3001/ui/tools/session-tracker.html",
              message: "For interactive session tracking with full UI, use the interactive tab or open: http://localhost:3001/ui/tools/session-tracker.html",
            }),
          },
        ],
      };
    }
  );

  // Tool: Update Song Progress
  registerAppTool(
    server,
    "update-song-progress",
    {
      title: "Update Song Progress",
      description: "Update the status and progress of a song",
      inputSchema: {
        songId: z.string().describe("Song ID"),
        status: z.enum(["writing", "recording", "mixing", "mastering", "released"]).optional().describe("New status"),
        progress: z.number().min(0).max(100).optional().describe("Progress percentage"),
        notes: z.string().optional().describe("Updated notes"),
      },
      _meta: {
        ui: {
          resourceUri: "ui://rhymebook/session-tracker.html",
        },
      },
    },
    async ({ songId, status, progress, notes }: { songId: string, status?: "writing" | "recording" | "mixing" | "mastering" | "released", progress?: number, notes?: string }) => {
      const song = updateSong(songId, { status, progress, notes });
      if (!song) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Song not found" }) }],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              updated: true,
              song,
              uiLink: "http://localhost:3001/ui/tools/session-tracker.html",
              message: "For interactive session tracking with full UI, use the interactive tab or open: http://localhost:3001/ui/tools/session-tracker.html",
            }),
          },
        ],
      };
    }
  );

  // Tool: Add Session Note
  registerAppTool(
    server,
    "add-session-note",
    {
      title: "Add Session Note",
      description: "Add notes or feedback to a recording session",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
        note: z.string().describe("Note content"),
      },
      _meta: {
        ui: {
          resourceUri: "ui://rhymebook/session-tracker.html",
        },
      },
    },
    async ({ sessionId, note }: { sessionId: string, note: string }) => {
      const session = getSession(sessionId);
      if (!session) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Session not found" }) }],
        };
      }

      addSessionNote(sessionId, note);
      const updatedSession = getSession(sessionId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              added: true,
              sessionId,
              notes: updatedSession?.notes,
              uiLink: "http://localhost:3001/ui/tools/session-tracker.html",
              message: "For interactive session tracking with full UI, use the interactive tab or open: http://localhost:3001/ui/tools/session-tracker.html",
            }),
          },
        ],
      };
    }
  );

  // Tool: Create New Song
  registerAppTool(
    server,
    "create-song",
    {
      title: "Create Song",
      description: "Create a new song project",
      inputSchema: {
        title: z.string().min(1).max(200).describe("Song title"),
        collaborators: z.array(z.string().max(100)).max(20).optional().describe("Collaborator names"),
        notes: z.string().max(5000).optional().describe("Initial notes"),
      },
      _meta: {
        ui: {
          resourceUri: "ui://rhymebook/session-tracker.html",
        },
      },
    },
    async ({ title, collaborators: collabNames, notes }: { title: string, collaborators?: string[], notes?: string }) => {
      const song = createSong(title, notes);
      const stats = getSongStats();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              created: true,
              song,
              totalSongs: stats.total,
              uiLink: "http://localhost:3001/ui/tools/session-tracker.html",
              message: "For interactive session tracking with full UI, use the interactive tab or open: http://localhost:3001/ui/tools/session-tracker.html",
            }),
          },
        ],
      };
    }
  );

  // Tool: Create Recording Session
  registerAppTool(
    server,
    "create-session",
    {
      title: "Create Recording Session",
      description: "Schedule a new recording session",
      inputSchema: {
        songId: z.string().describe("Song ID"),
        date: z.string().describe("Session date (YYYY-MM-DD)"),
        studio: z.string().optional().describe("Studio name"),
        engineer: z.string().optional().describe("Engineer name"),
      },
      _meta: {
        ui: {
          resourceUri: "ui://rhymebook/session-tracker.html",
        },
      },
    },
    async ({ songId, date, studio, engineer }: { songId: string, date: string, studio?: string, engineer?: string }) => {
      const song = getSong(songId);
      if (!song) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Song not found" }) }],
        };
      }

      const session = createSession(songId, date, studio, engineer);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              created: true,
              session,
              uiLink: "http://localhost:3001/ui/tools/session-tracker.html",
              message: "For interactive session tracking with full UI, use the interactive tab or open: http://localhost:3001/ui/tools/session-tracker.html",
            }),
          },
        ],
      };
    }
  );

  // Tool: Add Collaborator
  registerAppTool(
    server,
    "add-collaborator",
    {
      title: "Add Collaborator",
      description: "Add a new collaborator to the database",
      inputSchema: {
        name: z.string().describe("Collaborator name"),
        role: z.enum(["artist", "producer", "engineer", "writer", "feature"]).describe("Role"),
        contact: z.string().optional().describe("Contact info"),
        songId: z.string().optional().describe("Song ID to associate with"),
      },
      _meta: {
        ui: {
          resourceUri: "ui://rhymebook/session-tracker.html",
        },
      },
    },
    async ({ name, role, contact, songId }: { name: string, role: string, contact?: string, songId?: string }) => {
      const collab = createCollaborator(name, (role as any), contact);

      if (songId) {
        addCollaboratorToSong(songId, collab.id);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              created: true,
              collaborator: collab,
              uiLink: "http://localhost:3001/ui/tools/session-tracker.html",
              message: "For interactive session tracking with full UI, use the interactive tab or open: http://localhost:3001/ui/tools/session-tracker.html",
            }),
          },
        ],
      };
    }
  );
}
