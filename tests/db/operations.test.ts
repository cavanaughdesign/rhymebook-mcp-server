/**
 * Database Operations Tests
 * Tests for CRUD operations on songs, sessions, beats, and collaborators
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createSong,
  getSong,
  getAllSongs,
  updateSong,
  deleteSong,
  getSongSections,
  saveSongSections,
  createCollaborator,
  getAllCollaborators,
  addCollaboratorToSong,
  getSongCollaboratorNames,
  createSession,
  getSession,
  getAllSessions,
  updateSessionStatus,
  addSessionNote,
  logTake,
  getSessionTakes,
  createBeat,
  getBeat,
  getAllBeats,
  toggleBeatFavorite,
  deleteBeat,
  createCollection,
  getAllCollections,
  addBeatToCollection,
  removeBeatFromCollection,
  getSetting,
  setSetting,
  getSongStats,
  getBeatStats,
} from '../../src/db/operations.js';
import { getDatabase, closeDatabase } from '../../src/db/database.js';

describe('Database Operations', () => {
  beforeEach(() => {
    // Initialize database for each test
    getDatabase();
  });

  afterEach(() => {
    // Clean up after each test
    closeDatabase();
  });

  describe('Songs', () => {
    it('should create a new song', () => {
      const song = createSong('Test Song', 'Test notes');
      
      expect(song).toBeDefined();
      expect(song.id).toBeDefined();
      expect(song.title).toBe('Test Song');
      expect(song.notes).toBe('Test notes');
      expect(song.status).toBe('writing');
      expect(song.progress).toBe(0);
    });

    it('should get a song by ID', () => {
      const created = createSong('Get Test Song');
      const retrieved = getSong(created.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Get Test Song');
    });

    it('should return null for non-existent song', () => {
      const song = getSong('non-existent-id');
      expect(song).toBeNull();
    });

    it('should get all songs', () => {
      createSong('Song 1');
      createSong('Song 2');
      createSong('Song 3');
      
      const songs = getAllSongs();
      expect(songs.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter songs by status', () => {
      const song1 = createSong('Writing Song');
      const song2 = createSong('Recording Song');
      
      updateSong(song2.id, { status: 'recording' });
      
      const writingSongs = getAllSongs('writing');
      const recordingSongs = getAllSongs('recording');
      
      expect(writingSongs.some(s => s.id === song1.id)).toBe(true);
      expect(recordingSongs.some(s => s.id === song2.id)).toBe(true);
    });

    it('should update a song', () => {
      const song = createSong('Original Title');
      const updated = updateSong(song.id, {
        title: 'Updated Title',
        status: 'recording',
        progress: 50,
        notes: 'Updated notes',
      });
      
      expect(updated).toBeDefined();
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.status).toBe('recording');
      expect(updated?.progress).toBe(50);
      expect(updated?.notes).toBe('Updated notes');
    });

    it('should delete a song', () => {
      const song = createSong('Delete Me');
      const deleted = deleteSong(song.id);
      
      expect(deleted).toBe(true);
      expect(getSong(song.id)).toBeNull();
    });

    it('should save and retrieve song sections', () => {
      const song = createSong('Section Test');
      const sections = [
        { type: 'verse', content: 'Verse 1 content' },
        { type: 'chorus', content: 'Chorus content' },
        { type: 'verse', content: 'Verse 2 content' },
      ];
      
      saveSongSections(song.id, sections);
      const retrieved = getSongSections(song.id);
      
      expect(retrieved.length).toBe(3);
      expect(retrieved[0].type).toBe('verse');
      expect(retrieved[0].content).toBe('Verse 1 content');
      expect(retrieved[1].type).toBe('chorus');
    });
  });

  describe('Collaborators', () => {
    it('should create a collaborator', () => {
      const collab = createCollaborator('DJ Shadow', 'producer', 'dj@email.com');
      
      expect(collab).toBeDefined();
      expect(collab.id).toBeDefined();
      expect(collab.name).toBe('DJ Shadow');
      expect(collab.role).toBe('producer');
      expect(collab.contact).toBe('dj@email.com');
    });

    it('should get all collaborators', () => {
      createCollaborator('Producer 1', 'producer');
      createCollaborator('Engineer 1', 'engineer');
      
      const collabs = getAllCollaborators();
      expect(collabs.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter collaborators by role', () => {
      createCollaborator('Producer 2', 'producer');
      createCollaborator('Engineer 2', 'engineer');
      
      const producers = getAllCollaborators('producer');
      const engineers = getAllCollaborators('engineer');
      
      expect(producers.every(c => c.role === 'producer')).toBe(true);
      expect(engineers.every(c => c.role === 'engineer')).toBe(true);
    });

    it('should add collaborator to song', () => {
      const song = createSong('Collab Song');
      const collab = createCollaborator('Feature Artist', 'feature');
      
      addCollaboratorToSong(song.id, collab.id);
      const collabNames = getSongCollaboratorNames(song.id);
      
      expect(collabNames).toContain('Feature Artist');
    });
  });

  describe('Recording Sessions', () => {
    it('should create a recording session', () => {
      const song = createSong('Session Song');
      const session = createSession(song.id, '2026-03-15', 'SoundWave Studios', 'Mike Mix');
      
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.song_id).toBe(song.id);
      expect(session.date).toBe('2026-03-15');
      expect(session.studio).toBe('SoundWave Studios');
      expect(session.engineer).toBe('Mike Mix');
      expect(session.status).toBe('scheduled');
    });

    it('should get a session by ID', () => {
      const song = createSong('Get Session Song');
      const created = createSession(song.id, '2026-03-16');
      const retrieved = getSession(created.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.song_title).toBe('Get Session Song');
    });

    it('should get all sessions', () => {
      const song = createSong('Multi Session Song');
      createSession(song.id, '2026-03-17');
      createSession(song.id, '2026-03-18');
      
      const sessions = getAllSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter sessions by song', () => {
      const song1 = createSong('Song A');
      const song2 = createSong('Song B');
      createSession(song1.id, '2026-03-19');
      createSession(song2.id, '2026-03-20');
      
      const song1Sessions = getAllSessions(song1.id);
      expect(song1Sessions.every(s => s.song_id === song1.id)).toBe(true);
    });

    it('should update session status', () => {
      const song = createSong('Status Song');
      const session = createSession(song.id, '2026-03-21');
      
      updateSessionStatus(session.id, 'completed');
      const updated = getSession(session.id);
      
      expect(updated?.status).toBe('completed');
    });

    it('should add session notes', () => {
      const song = createSong('Notes Song');
      const session = createSession(song.id, '2026-03-22');
      
      addSessionNote(session.id, 'Great session today');
      const updated = getSession(session.id);
      
      expect(updated?.notes).toContain('Great session today');
    });

    it('should log takes', () => {
      const song = createSong('Take Song');
      const session = createSession(song.id, '2026-03-23');
      
      const take = logTake(session.id, 5, 'Best take!', 48);
      
      expect(take).toBeDefined();
      expect(take.take_number).toBe(1);
      expect(take.rating).toBe(5);
      expect(take.notes).toBe('Best take!');
      expect(take.duration).toBe(48);
    });

    it('should get session takes', () => {
      const song = createSong('Takes Song');
      const session = createSession(song.id, '2026-03-24');
      
      logTake(session.id, 3, 'Take 1', 45);
      logTake(session.id, 4, 'Take 2', 50);
      logTake(session.id, 5, 'Take 3', 48);
      
      const takes = getSessionTakes(session.id);
      expect(takes.length).toBe(3);
      expect(takes[0].take_number).toBe(1);
      expect(takes[2].take_number).toBe(3);
    });
  });

  describe('Beats', () => {
    it('should create a beat', () => {
      const beat = createBeat({
        title: 'Test Beat',
        producer: 'Test Producer',
        file_path: '/path/to/beat.mp3',
        bpm: 140,
        key_signature: 'Am',
        duration: 180,
        energy: 75,
        favorite: false,
        genres: ['trap', 'hip-hop'],
        moods: ['dark', 'aggressive'],
        tags: ['808s', 'synth'],
      });
      
      expect(beat).toBeDefined();
      expect(beat.id).toBeDefined();
      expect(beat.title).toBe('Test Beat');
      expect(beat.bpm).toBe(140);
      expect(beat.key_signature).toBe('Am');
      expect(beat.genres).toContain('trap');
      expect(beat.moods).toContain('dark');
    });

    it('should get a beat by ID', () => {
      const created = createBeat({
        title: 'Get Test Beat',
        producer: '',
        file_path: null,
        bpm: 0,
        key_signature: '',
        duration: 0,
        energy: 50,
        favorite: false,
      });
      
      const retrieved = getBeat(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Get Test Beat');
    });

    it('should get all beats', () => {
      createBeat({
        title: 'Beat 1',
        producer: '',
        file_path: null,
        bpm: 120,
        key_signature: '',
        duration: 0,
        energy: 50,
        favorite: false,
      });
      
      const beats = getAllBeats();
      expect(beats.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter beats by BPM range', () => {
      createBeat({
        title: 'Slow Beat',
        producer: '',
        file_path: null,
        bpm: 80,
        key_signature: '',
        duration: 0,
        energy: 50,
        favorite: false,
      });
      
      createBeat({
        title: 'Fast Beat',
        producer: '',
        file_path: null,
        bpm: 160,
        key_signature: '',
        duration: 0,
        energy: 50,
        favorite: false,
      });
      
      const slowBeats = getAllBeats({ minBpm: 70, maxBpm: 90 });
      const fastBeats = getAllBeats({ minBpm: 150, maxBpm: 170 });
      
      expect(slowBeats.some(b => b.title === 'Slow Beat')).toBe(true);
      expect(fastBeats.some(b => b.title === 'Fast Beat')).toBe(true);
    });

    it('should toggle beat favorite', () => {
      const beat = createBeat({
        title: 'Fav Test Beat',
        producer: '',
        file_path: null,
        bpm: 0,
        key_signature: '',
        duration: 0,
        energy: 50,
        favorite: false,
      });
      
      const favorited = toggleBeatFavorite(beat.id);
      expect(favorited).toBe(true);
      
      const unfavorited = toggleBeatFavorite(beat.id);
      expect(unfavorited).toBe(false);
    });

    it('should delete a beat', () => {
      const beat = createBeat({
        title: 'Delete Me Beat',
        producer: '',
        file_path: null,
        bpm: 0,
        key_signature: '',
        duration: 0,
        energy: 50,
        favorite: false,
      });
      
      const deleted = deleteBeat(beat.id);
      expect(deleted).toBe(true);
      expect(getBeat(beat.id)).toBeNull();
    });
  });

  describe('Collections', () => {
    it('should create a collection', () => {
      const collection = createCollection('Test Collection');
      
      expect(collection).toBeDefined();
      expect(collection.id).toBeDefined();
      expect(collection.name).toBe('Test Collection');
      expect(collection.beat_count).toBe(0);
    });

    it('should get all collections', () => {
      createCollection('Collection 1');
      createCollection('Collection 2');
      
      const collections = getAllCollections();
      expect(collections.length).toBeGreaterThanOrEqual(2);
    });

    it('should add beat to collection', () => {
      const beat = createBeat({
        title: 'Collection Beat',
        producer: '',
        file_path: null,
        bpm: 0,
        key_signature: '',
        duration: 0,
        energy: 50,
        favorite: false,
      });
      
      const collection = createCollection('My Collection');
      addBeatToCollection(collection.id, beat.id);
      
      const updated = getAllCollections().find(c => c.id === collection.id);
      expect(updated?.beat_count).toBe(1);
    });

    it('should remove beat from collection', () => {
      const beat = createBeat({
        title: 'Remove Beat',
        producer: '',
        file_path: null,
        bpm: 0,
        key_signature: '',
        duration: 0,
        energy: 50,
        favorite: false,
      });
      
      const collection = createCollection('Remove Collection');
      addBeatToCollection(collection.id, beat.id);
      removeBeatFromCollection(collection.id, beat.id);
      
      const updated = getAllCollections().find(c => c.id === collection.id);
      expect(updated?.beat_count).toBe(0);
    });
  });

  describe('Settings', () => {
    it('should set and get settings', () => {
      setSetting('test_key', 'test_value');
      const value = getSetting('test_key');
      
      expect(value).toBe('test_value');
    });

    it('should return null for non-existent setting', () => {
      const value = getSetting('non_existent_key');
      expect(value).toBeNull();
    });

    it('should update existing setting', () => {
      setSetting('update_key', 'original_value');
      setSetting('update_key', 'updated_value');
      
      const value = getSetting('update_key');
      expect(value).toBe('updated_value');
    });
  });

  describe('Statistics', () => {
    it('should get song statistics', () => {
      createSong('Writing Song');
      const song2 = createSong('Recording Song');
      updateSong(song2.id, { status: 'recording', progress: 50 });
      
      const stats = getSongStats();
      
      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.writing).toBeGreaterThanOrEqual(1);
      expect(stats.recording).toBeGreaterThanOrEqual(1);
    });

    it('should get beat statistics', () => {
      createBeat({
        title: 'Stat Beat',
        producer: 'Test Producer',
        file_path: null,
        bpm: 140,
        key_signature: 'Am',
        duration: 180,
        energy: 75,
        favorite: true,
        genres: ['trap'],
        moods: ['dark'],
        tags: [],
      });
      
      const stats = getBeatStats();
      
      expect(stats.totalBeats).toBeGreaterThanOrEqual(1);
      expect(stats.favorites).toBeGreaterThanOrEqual(1);
      expect(stats.averageBpm).toBeGreaterThan(0);
    });
  });
});