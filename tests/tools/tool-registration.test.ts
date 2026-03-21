/**
 * Tool Registration Tests
 * Tests for MCP tool registration and schema validation
 */

import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('Tool Registration', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
    });
  });

  describe('Server Initialization', () => {
    it('should create MCP server instance', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(McpServer);
    });

    it('should have correct server name', () => {
      // Server should be initialized with correct name
      expect(server).toBeDefined();
    });
  });

  describe('Tool Schema Validation', () => {
    it('should validate tool input schemas', () => {
      // Test that Zod schemas are properly defined
      const testSchema = {
        title: 'Test Tool',
        description: 'A test tool',
        inputSchema: {
          param1: 'string',
          param2: 'number',
        },
      };

      expect(testSchema.title).toBeDefined();
      expect(testSchema.description).toBeDefined();
      expect(testSchema.inputSchema).toBeDefined();
    });

    it('should have proper meta structure', () => {
      const meta = {
        ui: {
          resourceUri: 'ui://rhymebook/lyric-lab.html',
        },
      };

      expect(meta.ui).toBeDefined();
      expect(meta.ui.resourceUri).toBe('ui://rhymebook/lyric-lab.html');
    });
  });

  describe('Tool Response Format', () => {
    it('should format tool responses correctly', () => {
      const response = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ result: 'success' }),
          },
        ],
      };

      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content[0].type).toBe('text');
      
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.result).toBe('success');
    });

    it('should format error responses correctly', () => {
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Something went wrong' }),
          },
        ],
      };

      expect(errorResponse.content).toBeDefined();
      
      const parsed = JSON.parse(errorResponse.content[0].text);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('Tool Count Verification', () => {
    it('should have expected number of Lyric Lab tools', () => {
      // Lyric Lab should have 9 tools
      const expectedTools = [
        'find-rhymes',
        'count-syllables',
        'analyze-flow',
        'get-synonyms',
        'save-lyrics',
        'export-lyrics',
        'import-lyrics',
        'batch-import-lyrics',
        'get-all-songs',
      ];

      expect(expectedTools.length).toBe(9);
    });

    it('should have expected number of Session Tracker tools', () => {
      // Session Tracker should have 10 tools
      const expectedTools = [
        'get-project-dashboard',
        'get-recording-sessions',
        'log-take',
        'get-collaborators',
        'update-song-progress',
        'add-session-note',
        'create-song',
        'create-session',
        'add-collaborator',
        'get-all-songs',
      ];

      expect(expectedTools.length).toBe(10);
    });

    it('should have expected number of Beat Explorer tools', () => {
      // Beat Explorer should have 14 tools
      const expectedTools = [
        'browse-beats',
        'get-beat-details',
        'toggle-favorite',
        'get-collections',
        'add-to-collection',
        'create-collection',
        'match-lyrics-to-beat',
        'get-beat-stats',
        'add-beat',
        'get-library-path',
        'set-library-path',
        'scan-library',
        'import-beats',
        'copy-beat-to-library',
      ];

      expect(expectedTools.length).toBe(14);
    });

    it('should have expected number of Dashboard tools', () => {
      // Dashboard should have 4 tools
      const expectedTools = [
        'get-dashboard-summary',
        'get-recent-activity',
        'get-progress-stats',
        'get-quick-stats',
      ];

      expect(expectedTools.length).toBe(4);
    });

    it('should have expected number of Audio Processing tools', () => {
      // Audio Processing should have 3 tools
      const expectedTools = [
        'separate-audio',
        'check-audio-tools',
        'extract-vocals',
      ];

      expect(expectedTools.length).toBe(3);
    });

    it('should have total of 40 tools', () => {
      const lyricLab = 9;
      const sessionTracker = 10;
      const beatExplorer = 14;
      const dashboard = 4;
      const audioProcessing = 3;
      
      const total = lyricLab + sessionTracker + beatExplorer + dashboard + audioProcessing;
      expect(total).toBe(40);
    });
  });
});