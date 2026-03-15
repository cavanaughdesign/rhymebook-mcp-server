# RhymeBook MCP Server Configuration Guide

This guide covers all configuration options for the RhymeBook MCP Server.

## 📋 Table of Contents

- [Claude Desktop](#claude-desktop)
- [VS Code](#vs-code)
- [HTTP Mode](#http-mode)
- [Environment Variables](#environment-variables)
- [Database Location](#database-location)
- [Beats Library](#beats-library)

---

## Claude Desktop

### Windows

**Config Location:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "rhymebook": {
      "command": "node",
      "args": ["C:\\Users\\YourUsername\\rhymebook-mcp-server\\dist\\server\\index.js", "--stdio"]
    }
  }
}
```

### macOS

**Config Location:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "rhymebook": {
      "command": "node",
      "args": ["/Users/yourusername/rhymebook-mcp-server/dist/server/index.js", "--stdio"]
    }
  }
}
```

### Linux

**Config Location:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "rhymebook": {
      "command": "node",
      "args": ["/home/yourusername/rhymebook-mcp-server/dist/server/index.js", "--stdio"]
    }
  }
}
```

### With Environment Variables

```json
{
  "mcpServers": {
    "rhymebook": {
      "command": "node",
      "args": ["/path/to/rhymebook-mcp-server/dist/server/index.js", "--stdio"],
      "env": {
        "PORT": "3001",
        "ALLOWED_ORIGINS": "http://localhost:3000,http://localhost:5173"
      }
    }
  }
}
```

### Multiple MCP Servers

```json
{
  "mcpServers": {
    "rhymebook": {
      "command": "node",
      "args": ["/path/to/rhymebook-mcp-server/dist/server/index.js", "--stdio"]
    },
    "other-server": {
      "command": "node",
      "args": ["/path/to/other-server/dist/index.js"]
    }
  }
}
```

---

## VS Code

### Settings Location

**Windows:** `%APPDATA%\Code\User\settings.json`
**macOS:** `~/Library/Application Support/Code/User/settings.json`
**Linux:** `~/.config/Code/User/settings.json`

### Configuration

```json
{
  "mcp.servers": {
    "rhymebook": {
      "command": "node",
      "args": ["${workspaceFolder}/dist/server/index.js", "--stdio"]
    }
  }
}
```

### With Workspace Variable

```json
{
  "mcp.servers": {
    "rhymebook": {
      "command": "node",
      "args": ["C:\\Users\\YourUsername\\rhymebook-mcp-server\\dist\\server\\index.js", "--stdio"]
    }
  }
}
```

---

## HTTP Mode

For web-based hosts or when you want to run the server separately:

### Start the Server

```bash
# Start in HTTP mode
npm start

# Or with custom port
PORT=3002 npm start
```

### Configuration

```json
{
  "mcpServers": {
    "rhymebook-http": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

### With Custom Port

```json
{
  "mcpServers": {
    "rhymebook-http": {
      "url": "http://localhost:3002/mcp"
    }
  }
}
```

---

## Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | HTTP server port | `3001` | `3002` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:3000,http://localhost:3001,http://localhost:5173` | `http://localhost:3000,https://myapp.com` |

### Setting in Claude Desktop

```json
{
  "mcpServers": {
    "rhymebook": {
      "command": "node",
      "args": ["/path/to/dist/server/index.js", "--stdio"],
      "env": {
        "PORT": "3002",
        "ALLOWED_ORIGINS": "http://localhost:3000,https://myapp.com"
      }
    }
  }
}
```

---

## Database Location

The SQLite database is automatically created at:

- **Windows:** `%USERPROFILE%\.rhymebook\rhymebook.db`
- **macOS:** `~/.rhymebook/rhymebook.db`
- **Linux:** `~/.rhymebook/rhymebook.db`

### Backup

```bash
# Windows
copy "%USERPROFILE%\.rhymebook\rhymebook.db" "backup\rhymebook.db"

# macOS/Linux
cp ~/.rhymebook/rhymebook.db backup/rhymebook.db
```

### Restore

```bash
# Windows
copy "backup\rhymebook.db" "%USERPROFILE%\.rhymebook\rhymebook.db"

# macOS/Linux
cp backup/rhymebook.db ~/.rhymebook/rhymebook.db
```

---

## Beats Library

The beats library path is stored in the database settings table.

### Default Location

- **Windows:** `%USERPROFILE%\.rhymebook\beats\`
- **macOS:** `~/.rhymebook/beats/`
- **Linux:** `~/.rhymebook/beats/`

### Setting Custom Path

Use the `set-library-path` tool or the Library Settings button in the UI.

### Supported Formats

- MP3, WAV, FLAC, AAC, OGG, M4A, WMA

---

## 🔧 Troubleshooting

### Server Won't Start

1. Check Node.js version: `node --version` (must be 18+)
2. Rebuild: `npm run build`
3. Check port availability: `netstat -an | grep 3001`

### Claude Desktop Won't Connect

1. Verify path in config is correct
2. Check Node.js is in PATH
3. Restart Claude Desktop
4. Check logs: `%APPDATA%\Claude\logs\`

### Database Errors

1. Check database file exists
2. Verify file permissions
3. Delete and recreate: `rm ~/.rhymebook/rhymebook.db`

### Audio Won't Play

1. Verify beat has file path in database
2. Check file exists on disk
3. Verify file format is supported
4. Check server logs for errors

---

## 📞 Support

For issues or questions:
- Check the README.md file
- Review the source code in `src/` directory
- File an issue on the project repository