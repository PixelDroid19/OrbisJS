import { Buffer, LanguageType } from './types';
import { LanguageDetectionService } from './LanguageDetectionService';

export class BufferManager {
  private buffers: Map<string, Buffer> = new Map();
  private currentBufferId: string | null = null;
  private languageDetectionService: LanguageDetectionService;

  constructor() {
    this.languageDetectionService = new LanguageDetectionService();
  }

  createBuffer(id: string, language?: LanguageType, content?: string, filename?: string): Buffer {
    const detectedLanguage = language || this.languageDetectionService.detectLanguage(content || '', filename);
    const buffer: Buffer = {
      id,
      content: content || '',
      language: detectedLanguage,
      modified: false,
      path: filename,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.buffers.set(id, buffer);
    return buffer;
  }

  getBuffer(id: string): Buffer | undefined {
    return this.buffers.get(id);
  }

  updateBufferContent(id: string, content: string): boolean {
    const buffer = this.buffers.get(id);
    if (buffer) {
      buffer.content = content;
      buffer.modified = true;
      buffer.updatedAt = new Date();
      return true;
    }
    return false;
  }

  updateBufferLanguage(id: string, language: LanguageType): boolean {
    const buffer = this.buffers.get(id);
    if (buffer) {
      buffer.language = language;
      buffer.updatedAt = new Date();
      return true;
    }
    return false;
  }

  switchBuffer(id: string): boolean {
    if (this.buffers.has(id)) {
      this.currentBufferId = id;
      return true;
    }
    return false;
  }

  closeBuffer(id: string): boolean {
    const buffer = this.buffers.get(id);
    if (buffer) {
      this.buffers.delete(id);
      if (this.currentBufferId === id) {
        this.currentBufferId = null;
      }
      return true;
    }
    return false;
  }

  getCurrentBuffer(): Buffer | null {
    return this.currentBufferId ? this.buffers.get(this.currentBufferId) || null : null;
  }

  getCurrentBufferId(): string | null {
    return this.currentBufferId;
  }

  listBuffers(): Buffer[] {
    return Array.from(this.buffers.values());
  }

  hasBuffer(id: string): boolean {
    return this.buffers.has(id);
  }

  detectLanguageFromContent(id: string): LanguageType | null {
    const buffer = this.buffers.get(id);
    if (buffer) {
      return this.languageDetectionService.detectLanguage(buffer.content, buffer.path);
    }
    return null;
  }
}