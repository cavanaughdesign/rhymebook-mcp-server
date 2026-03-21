import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppTool, registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path, { normalize, resolve } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { registerLyricLabTools } from '../tools/lyric-lab.js';
import { registerSessionTrackerTools } from '../tools/session-tracker.js';
import { registerBeatExplorerTools } from '../tools/beat-explorer.js';
import { registerDashboardTools } from '../tools/dashboard.js';
import { registerAudioProcessingTools } from '../tools/audio-processing.js';
import { getDatabase, closeDatabase } from '../db/database.js';
import { getBeat } from '../db/operations.js';
import { getBeatsLibraryPath } from '../db/beats-library.js';
import { logError, logInfo, logWarn } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCE_MIME_TYPE = 'text/html';

/**
 * Create and configure a single McpServer instance with all tools registered.
 * The server instance is reused across requests in HTTP mode (one per session).
 */
function createServer(): McpServer {
  // Initialize database on first call (idempotent)
  getDatabase();

  const server = new McpServer({
    name: 'rhymebook-mcp-server',
    version: '1.0.0',
  });

  // Register all tools
  registerLyricLabTools(server);
  registerSessionTrackerTools(server);
  registerBeatExplorerTools(server);
  registerDashboardTools(server);
  registerAudioProcessingTools(server);

  // Register all MCP App UI resources — each tool has its own bundled HTML file
  const uiResources = [
    { uri: 'ui://rhymebook/lyric-lab.html', file: 'lyric-lab.html' },
    { uri: 'ui://rhymebook/session-tracker.html', file: 'session-tracker.html' },
    { uri: 'ui://rhymebook/beat-explorer.html', file: 'beat-explorer.html' },
    { uri: 'ui://rhymebook/audio-player.html', file: 'audio-player.html' },
    { uri: 'ui://rhymebook/app.html', file: 'index.html' },
  ];

  for (const { uri, file } of uiResources) {
    registerAppResource(
      server,
      uri,
      uri,
      { mimeType: RESOURCE_MIME_TYPE },
      async () => {
        // Prefer the production bundle in dist/ui, fall back to dev source
        const distHtmlPath = path.resolve(__dirname, `../../dist/ui/${file}`);
        const fallbackHtmlPath = path.resolve(__dirname, `../ui/tools/${file}`);

        let htmlPathToUse = fallbackHtmlPath;
        try {
          await fs.access(distHtmlPath);
          htmlPathToUse = distHtmlPath;
          logInfo(`Serving bundled UI from ${distHtmlPath}`, 'server');
        } catch {
          try {
            await fs.access(fallbackHtmlPath);
            htmlPathToUse = fallbackHtmlPath;
            logInfo(`Serving UI from ${fallbackHtmlPath}`, 'server');
          } catch (err) {
            logError(`UI resource not found: ${file}`, 'server', err);
            throw new Error(`UI resource not found: ${file}`);
          }
        }

        const html = await fs.readFile(htmlPathToUse, 'utf-8');
        return {
          contents: [
            { uri, mimeType: RESOURCE_MIME_TYPE, text: html }
          ]
        };
      }
    );
  }

  return server;
}

// ---------------------------------------------------------------------------
// Shared audio + static-file Express app used in both stdio and HTTP modes.
// In stdio mode we spin up a lightweight sidecar HTTP server on a separate
// port solely to serve /audio/:beatId and /ui/* assets.  This is intentionally
// isolated from the MCP transport — the MCP server still communicates over
// stdio; this sidecar only serves binary assets that the UI iframe needs.
// ---------------------------------------------------------------------------
function createAssetApp(): express.Express {
  const assetApp = express();

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:5173',
      ];

  assetApp.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Range'],
    credentials: true,
    maxAge: 86400,
  }));

  // Audio file serving with path-traversal protection and range requests
  assetApp.get('/audio/:beatId', async (req: Request, res: Response) => {
    try {
      const { beatId } = req.params;

      if (!/^[a-zA-Z0-9-]+$/.test(beatId)) {
        res.status(400).json({ error: 'Invalid beat ID format' });
        return;
      }

      const beat = getBeat(beatId);
      if (!beat || !beat.file_path) {
        res.status(404).json({ error: 'Beat not found or no file path' });
        return;
      }

      const libraryPath = getBeatsLibraryPath();
      const normalizedFilePath = normalize(resolve(beat.file_path));
      const normalizedLibraryPath = normalize(resolve(libraryPath));

      if (
        !normalizedFilePath.startsWith(normalizedLibraryPath + path.sep) &&
        normalizedFilePath !== normalizedLibraryPath
      ) {
        logWarn(`Path traversal attempt blocked: ${beat.file_path}`, 'audio-server');
        res.status(403).json({ error: 'Access denied: file outside library' });
        return;
      }

      try {
        await fs.access(normalizedFilePath);
      } catch {
        res.status(404).json({ error: 'Audio file not found on disk' });
        return;
      }

      const stat = await fs.stat(normalizedFilePath);
      if (!stat.isFile()) {
        res.status(400).json({ error: 'Invalid file path' });
        return;
      }

      const MAX_FILE_SIZE = 100 * 1024 * 1024;
      if (stat.size > MAX_FILE_SIZE) {
        res.status(413).json({ error: 'File too large' });
        return;
      }

      const fileSize = stat.size;
      const ext = path.extname(normalizedFilePath).toLowerCase();
      const allowedExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'];
      if (!allowedExtensions.includes(ext)) {
        res.status(400).json({ error: 'Unsupported file type' });
        return;
      }

      const contentTypes: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.wma': 'audio/x-ms-wma',
      };
      const contentType = contentTypes[ext] ?? 'audio/mpeg';

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize || start > end) {
          res.status(416).json({ error: 'Range not satisfiable' });
          return;
        }

        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        });

        const stream = fsSync.createReadStream(normalizedFilePath, { start, end });
        stream.on('error', (err) => {
          logError('Stream error', 'audio-server', err);
          if (!res.headersSent) res.status(500).json({ error: 'Error streaming file' });
        });
        stream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        });

        const stream = fsSync.createReadStream(normalizedFilePath);
        stream.on('error', (err) => {
          logError('Stream error', 'audio-server', err);
          if (!res.headersSent) res.status(500).json({ error: 'Error streaming file' });
        });
        stream.pipe(res);
      }
    } catch (error) {
      logError('Error serving audio', 'audio-server', error);
      if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Static UI assets (dev mode only — production uses the bundled single-file UI)
  assetApp.use('/ui', express.static(path.join(__dirname, '../ui')));

  return assetApp;
}

// ---------------------------------------------------------------------------
// Graceful shutdown helper
// ---------------------------------------------------------------------------
function setupGracefulShutdown(
  httpServer: { close: (cb: () => void) => void },
  label: string,
): void {
  const gracefulShutdown = (signal: string) => {
    logInfo(`${signal} received. Starting graceful shutdown...`, label);

    httpServer.close(() => {
      logInfo('HTTP server closed.', label);
      try {
        closeDatabase();
        logInfo('Database connection closed.', label);
      } catch (err) {
        logError('Error closing database', label, err);
      }
      logInfo('Graceful shutdown complete.', label);
      process.exit(0);
    });

    setTimeout(() => {
      logError('Forced shutdown after timeout', label);
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    logError('Uncaught Exception', label, error);
    gracefulShutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logError('Unhandled Rejection', label, reason);
  });
}

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (shared between HTTP modes)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 100;

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) rateLimitMap.delete(ip);
  }
}, 60_000);

function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  let record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    rateLimitMap.set(ip, record);
  } else {
    record.count++;
  }

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - record.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

  if (record.count > RATE_LIMIT_MAX) {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    });
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const useStdio = args.includes('--stdio');

  if (useStdio) {
    // -----------------------------------------------------------------------
    // STDIO mode — used by Claude Desktop and any stdio-based MCP client.
    //
    // The MCP server communicates over stdin/stdout using JSON-RPC.
    // All logging must go to stderr only (logger.ts enforces this).
    //
    // We also start a sidecar HTTP server on ASSET_PORT (default 3002) to
    // serve audio files and UI assets.  The UI iframe calls /audio/:beatId
    // on this sidecar — it never touches the MCP stdio pipe.
    // -----------------------------------------------------------------------
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logInfo('RhymeBook MCP Server running on stdio', 'server');

    // Sidecar asset server for audio streaming in stdio mode
    const assetPort = parseInt(process.env.ASSET_PORT ?? '3002', 10);
    const assetApp = createAssetApp();
    const assetServer = assetApp.listen(assetPort, () => {
      logInfo(`Asset server (audio/UI) running on http://localhost:${assetPort}`, 'server');
    });

    setupGracefulShutdown(assetServer, 'stdio');

  } else {
    // -----------------------------------------------------------------------
    // HTTP Streamable Transport mode — used by web-based MCP clients, VS Code
    // MCP extension, Cursor, Windsurf, and any client that speaks HTTP MCP.
    //
    // Session management: one McpServer + StreamableHTTPServerTransport pair
    // per client session, keyed by Mcp-Session-Id header.  This preserves
    // per-session state (tool subscriptions, resource subscriptions, etc.)
    // across multiple requests from the same client — which is required by
    // the MCP Streamable HTTP spec.
    //
    // POST /mcp   — initialize a new session or send a JSON-RPC request
    // GET  /mcp   — open an SSE stream for server-initiated messages
    // DELETE /mcp — terminate a session
    // -----------------------------------------------------------------------

    // Session registry: sessionId -> { server, transport }
    const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

    const app = express();

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:5173',
        ];

    app.use(cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'Mcp-Session-Id'],
      exposedHeaders: ['Mcp-Session-Id'],
      credentials: true,
      maxAge: 86400,
    }));

    app.use(express.json({ limit: '1mb' }));

    // -- POST /mcp — create session or handle JSON-RPC request ---------------
    app.post('/mcp', rateLimiter, async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        let session = sessionId ? sessions.get(sessionId) : undefined;

        if (!session) {
          // New session: create server + transport pair and register them
          const newSessionId = randomUUID();
          const mcpServer = createServer();
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => newSessionId,
            onsessioninitialized: (id) => {
              sessions.set(id, { server: mcpServer, transport });
              logInfo(`Session initialized: ${id}`, 'http-transport');
            },
          });

          // Clean up when transport closes (client disconnect / session end)
          transport.onclose = () => {
            sessions.delete(newSessionId);
            logInfo(`Session closed: ${newSessionId}`, 'http-transport');
          };

          await mcpServer.connect(transport);
          session = { server: mcpServer, transport };

          // Set the session ID on the response before delegating
          res.setHeader('Mcp-Session-Id', newSessionId);
        }

        await session.transport.handleRequest(req, res, req.body);
      } catch (error) {
        logError('Error handling POST /mcp', 'http-transport', error);
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
      }
    });

    // -- GET /mcp — SSE stream for server-initiated messages (notifications) -
    app.get('/mcp', rateLimiter, async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId) {
          res.status(400).json({ error: 'Missing Mcp-Session-Id header' });
          return;
        }

        const session = sessions.get(sessionId);
        if (!session) {
          res.status(404).json({ error: 'Session not found' });
          return;
        }

        await session.transport.handleRequest(req, res);
      } catch (error) {
        logError('Error handling GET /mcp', 'http-transport', error);
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
      }
    });

    // -- DELETE /mcp — explicit session termination --------------------------
    app.delete('/mcp', rateLimiter, async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId) {
          res.status(400).json({ error: 'Missing Mcp-Session-Id header' });
          return;
        }

        const session = sessions.get(sessionId);
        if (!session) {
          res.status(404).json({ error: 'Session not found' });
          return;
        }

        await session.transport.handleRequest(req, res);
        sessions.delete(sessionId);
        logInfo(`Session terminated: ${sessionId}`, 'http-transport');
      } catch (error) {
        logError('Error handling DELETE /mcp', 'http-transport', error);
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Mount the shared audio + static-file routes on the same app
    const assetApp = createAssetApp();
    app.use(assetApp);

    // -- Global error handler MUST come after all routes ---------------------
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logError('Unhandled error', 'server', err);
      if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    });

    const port = parseInt(process.env.PORT ?? '3001', 10);
    const httpServer = app.listen(port, () => {
      logInfo(`RhymeBook MCP Server running on http://localhost:${port}`, 'server');
      logInfo(`MCP endpoint:   POST/GET/DELETE http://localhost:${port}/mcp`, 'server');
      logInfo(`Audio endpoint: GET  http://localhost:${port}/audio/:beatId`, 'server');
    });

    setupGracefulShutdown(httpServer, 'http');
  }
}

main().catch((error) => {
  logError('Fatal error', 'server', error);
  process.exit(1);
});