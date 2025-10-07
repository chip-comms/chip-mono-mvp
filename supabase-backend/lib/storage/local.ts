/**
 * Local Filesystem Storage Adapter
 * 
 * I/O LAYER: Node.js specific, will need rewriting for Deno/Supabase.
 * Implements the StorageAdapter interface for local development.
 */

import fs from 'fs/promises';
import path from 'path';
import type { StorageAdapter } from '../types';

export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir: string = 'storage/uploads') {
    this.baseDir = baseDir;
  }

  /**
   * Initialize storage (create directories if needed)
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  /**
   * Save file to local filesystem
   */
  async saveFile(
    id: string,
    buffer: Uint8Array,
    contentType: string
  ): Promise<string> {
    const ext = this.getExtensionFromContentType(contentType);
    const filename = `${id}${ext}`;
    const filePath = path.join(this.baseDir, filename);

    try {
      await fs.writeFile(filePath, buffer);
      return filePath;
    } catch (error) {
      console.error('Failed to save file:', error);
      throw new Error(`Failed to save file: ${error}`);
    }
  }

  /**
   * Get file as Uint8Array
   */
  async getFile(filePath: string): Promise<Uint8Array> {
    try {
      const buffer = await fs.readFile(filePath);
      return new Uint8Array(buffer);
    } catch (error) {
      console.error('Failed to read file:', error);
      throw new Error(`Failed to read file: ${error}`);
    }
  }

  /**
   * Get file as ArrayBuffer (for AI APIs)
   */
  async getFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
    const buffer = await this.getFile(filePath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  }

  /**
   * Delete file from filesystem
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromContentType(contentType: string): string {
    const mapping: Record<string, string> = {
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/mp4': '.m4a',
    };
    return mapping[contentType] || '.bin';
  }

  /**
   * Get full path for a file ID
   */
  getFilePath(id: string, extension: string): string {
    return path.join(this.baseDir, `${id}${extension}`);
  }
}

