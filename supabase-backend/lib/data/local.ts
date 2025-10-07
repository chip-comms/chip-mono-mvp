/**
 * Local JSON Data Adapter
 * 
 * I/O LAYER: Node.js specific, will need rewriting for Deno/Supabase.
 * Implements the DataAdapter interface using JSON files.
 */

import fs from 'fs/promises';
import path from 'path';
import type { DataAdapter, Recording, Intelligence } from '../types';

export class LocalDataAdapter implements DataAdapter {
  private recordingsFile: string;
  private intelligenceDir: string;

  constructor(
    dataDir: string = 'data'
  ) {
    this.recordingsFile = path.join(dataDir, 'recordings.json');
    this.intelligenceDir = path.join(dataDir, 'intelligence');
  }

  /**
   * Initialize data storage (create files/dirs if needed)
   */
  async initialize(): Promise<void> {
    try {
      // Create intelligence directory
      await fs.mkdir(this.intelligenceDir, { recursive: true });

      // Create empty recordings file if it doesn't exist
      try {
        await fs.access(this.recordingsFile);
      } catch {
        await fs.writeFile(this.recordingsFile, '[]');
      }
    } catch (error) {
      console.error('Failed to initialize data storage:', error);
      throw error;
    }
  }

  // ============================================================================
  // Recordings
  // ============================================================================

  async getRecordings(): Promise<Recording[]> {
    try {
      const data = await fs.readFile(this.recordingsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to read recordings:', error);
      return [];
    }
  }

  async getRecording(id: string): Promise<Recording | null> {
    const recordings = await this.getRecordings();
    return recordings.find(r => r.id === id) || null;
  }

  async saveRecording(recording: Recording): Promise<void> {
    try {
      const recordings = await this.getRecordings();
      recordings.push(recording);
      await fs.writeFile(
        this.recordingsFile,
        JSON.stringify(recordings, null, 2)
      );
    } catch (error) {
      console.error('Failed to save recording:', error);
      throw new Error(`Failed to save recording: ${error}`);
    }
  }

  async updateRecording(
    id: string,
    updates: Partial<Recording>
  ): Promise<void> {
    try {
      const recordings = await this.getRecordings();
      const index = recordings.findIndex(r => r.id === id);

      if (index === -1) {
        throw new Error(`Recording ${id} not found`);
      }

      recordings[index] = { ...recordings[index], ...updates };
      await fs.writeFile(
        this.recordingsFile,
        JSON.stringify(recordings, null, 2)
      );
    } catch (error) {
      console.error('Failed to update recording:', error);
      throw new Error(`Failed to update recording: ${error}`);
    }
  }

  async deleteRecording(id: string): Promise<void> {
    try {
      const recordings = await this.getRecordings();
      const filtered = recordings.filter(r => r.id !== id);
      await fs.writeFile(
        this.recordingsFile,
        JSON.stringify(filtered, null, 2)
      );
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw new Error(`Failed to delete recording: ${error}`);
    }
  }

  // ============================================================================
  // Intelligence
  // ============================================================================

  async getIntelligence(recordingId: string): Promise<Intelligence | null> {
    const filePath = path.join(this.intelligenceDir, `${recordingId}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveIntelligence(intelligence: Intelligence): Promise<void> {
    const filePath = path.join(
      this.intelligenceDir,
      `${intelligence.recordingId}.json`
    );

    try {
      await fs.writeFile(filePath, JSON.stringify(intelligence, null, 2));
    } catch (error) {
      console.error('Failed to save intelligence:', error);
      throw new Error(`Failed to save intelligence: ${error}`);
    }
  }

  async deleteIntelligence(recordingId: string): Promise<void> {
    const filePath = path.join(this.intelligenceDir, `${recordingId}.json`);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as any).code !== 'ENOENT') {
        console.error('Failed to delete intelligence:', error);
        throw new Error(`Failed to delete intelligence: ${error}`);
      }
    }
  }
}

