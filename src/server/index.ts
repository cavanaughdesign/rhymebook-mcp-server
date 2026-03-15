import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppTool, registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path, { normalize, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { registerLyricLabTools } from '../tools/lyric-lab.js';
import { registerSessionTrackerTools } from '../tools/session-tracker.js';
import { registerBeatExplorerTools } from '../tools/beat-explorer.js';
import { registerDashboardTools } from '../tools/dashboard.js';
import { registerAudioProcessingTools } from '../tools/audio-processing.js';
import { getDatabase, closeDatabase } from '../db/database.js';
import { getBeat } from '../db/operations.js';
import { getBeatsLibraryPath } from '../db/beats-library.js';
import { logger, logError, logInfo, logWarn } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCE_MIME_TYPE = 'text/html';

// Create MCP server
function createServer(): McpServer {
  // Initialize database
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

  // Register UI resource
  registerAppResource(
    server,
    'ui://rhymebook/app.html',
    'ui://rhymebook/app.html',
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const htmlPath = path.join(__dirname, '../ui/index.html');
      const html = await fs.readFile(htmlPath, 'utf-8');
      return {
        contents: [
          { uri: 'ui://rhymebook/app.html', mimeType: RESOURCE_MIME_TYPE, text: html }
        ]
      };
    }
  );

  return server;
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const useStdio = args.includes('--stdio');

  if (useStdio) {
    // Stdio transport for desktop clients like Claude Desktop
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logInfo('RhymeBook MCP Server running on stdio', 'server');
  } else {
    // Streamable HTTP transport for web-based hosts
    const app = express();

    // CORS configuration for production
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

    app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
      credentials: true,
      maxAge: 86400, // 24 hours
    }));

    app.use(express.json({ limit: '1mb' })); // Limit JSON payload size

    // Simple in-memory rate limiter
    const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
    const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
    const RATE_LIMIT_MAX = 100; // Max requests per window

    function rateLimiter(req: Request, res: Response, next: NextFunction): void {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();

      let record = rateLimitMap.get(ip);

      if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
        rateLimitMap.set(ip, record);
      } else {
        record.count++;
      }

      // Set rate limit headers
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

    // Clean up old rate limit records periodically
    setInterval(() => {
      const now = Date.now();
      for (const [ip, record] of rateLimitMap.entries()) {
        if (now > record.resetTime) {
          rateLimitMap.delete(ip);
        }
      }
    }, 60000); // Clean every minute

    // Global error handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logError('Unhandled error', 'server', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // MCP endpoint with rate limiting
    app.post('/mcp', rateLimiter, async (req, res) => {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      res.on('close', () => {
        transport.close();
        server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    // Audio file serving endpoint with rate limiting and path traversal protection
    app.get('/audio/:beatId', rateLimiter, async (req: Request, res: Response) => {
      try {
        const { beatId } = req.params;

        // Validate beatId format (alphanumeric with hyphens only)
        if (!/^[a-zA-Z0-9-]+$/.test(beatId)) {
          res.status(400).json({ error: 'Invalid beat ID format' });
          return;
        }

        const beat = getBeat(beatId);

        if (!beat || !beat.file_path) {
          res.status(404).json({ error: 'Beat not found or no file path' });
          return;
        }

        // Security: Validate path is within allowed library directory
        const libraryPath = getBeatsLibraryPath();
        const filePath = beat.file_path;

        // Normalize and resolve paths to prevent traversal
        const normalizedFilePath = normalize(resolve(filePath));
        const normalizedLibraryPath = normalize(resolve(libraryPath));

        // Ensure the file is within the library directory
        if (!normalizedFilePath.startsWith(normalizedLibraryPath + path.sep) &&
            normalizedFilePath !== normalizedLibraryPath) {
          console.warn(`Path traversal attempt blocked: ${filePath}`);
          res.status(403).json({ error: 'Access denied: file outside library' });
          return;
        }

        // Check file exists (async)
        try {
          await fs.access(normalizedFilePath);
        } catch {
          res.status(404).json({ error: 'Audio file not found on disk' });
          return;
        }

        // Get file stats (async)
        const stat = await fs.stat(normalizedFilePath);

        // Validate it's a file, not a directory
        if (!stat.isFile()) {
          res.status(400).json({ error: 'Invalid file path' });
          return;
        }

        // Validate file size (max 100MB)
        const MAX_FILE_SIZE = 100 * 1024 * 1024;
        if (stat.size > MAX_FILE_SIZE) {
          res.status(413).json({ error: 'File too large' });
          return;
        }

        const fileSize = stat.size;
        const ext = path.extname(normalizedFilePath).toLowerCase();

        // Validate file extension
        const allowedExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'];
        if (!allowedExtensions.includes(ext)) {
          res.status(400).json({ error: 'Unsupported file type' });
          return;
        }

        // Determine content type
        const contentTypes: Record<string, string> = {
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.flac': 'audio/flac',
          '.aac': 'audio/aac',
          '.ogg': 'audio/ogg',
          '.m4a': 'audio/mp4',
          '.wma': 'audio/x-ms-wma',
        };

        const contentType = contentTypes[ext] || 'audio/mpeg';

        // Handle range requests for seeking
        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

          // Validate range
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
            logError('Stream error', 'audio-streaming', err);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Error streaming file' });
            }
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
            logError('Stream error', 'audio-streaming', err);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Error streaming file' });
            }
          });
          stream.pipe(res);
        }
      } catch (error) {
        logError('Error serving audio', 'audio-streaming', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    // Static file serving for UI
    app.use('/ui', express.static(path.join(__dirname, '../ui')));

    const port = process.env.PORT || 3001;
    const server = app.listen(port, () => {
      console.log(`RhymeBook MCP Server running on http://localhost:${port}`);
      console.log(`MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`Audio endpoint: http://localhost:${port}/audio/:beatId`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      server.close(() => {
        console.log('HTTP server closed.');

        // Close database connection
        try {
          closeDatabase();
          logInfo('Database connection closed', 'server');
        } catch (err) {
          logError('Error closing database', 'server', err);
        }

        console.log('Graceful shutdown complete.');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logError('Forced shutdown after timeout', 'server');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logError('Uncaught Exception', 'server', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logError('Unhandled Rejection', 'server', { promise, reason });
    });
  }
}

main().catch((error) => {
  logError('Fatal error', 'server', error);
  process.exit(1);
});
