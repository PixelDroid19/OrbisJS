/**
 * FileWatcher - Manages file and directory watching
 */

import type { WatchOptions } from './types.js';

export class FileWatcher {
  private watchedFiles: Map<string, WatchOptions> = new Map();
  private watchedDirectories: Map<string, WatchOptions> = new Map();
  private ignorePatterns: string[];
  private watchPatterns: string[];

  constructor(watchPatterns: string[] = [], ignorePatterns: string[] = []) {
    this.watchPatterns = watchPatterns;
    this.ignorePatterns = ignorePatterns;
  }

  /**
   * Watch a specific file for changes
   */
  public watchFile(filePath: string, options: WatchOptions = {}): void {
    this.watchedFiles.set(filePath, options);
    console.log(`👁️ Watching file: ${filePath}`);
  }

  /**
   * Stop watching a specific file
   */
  public unwatchFile(filePath: string): void {
    this.watchedFiles.delete(filePath);
    console.log(`👁️‍🗨️ Stopped watching file: ${filePath}`);
  }

  /**
   * Watch a directory for changes
   */
  public watchDirectory(dirPath: string, options: WatchOptions = {}): void {
    const watchOptions = { 
      ...options, 
      recursive: options.recursive !== false // Default to true
    };
    this.watchedDirectories.set(dirPath, watchOptions);
    console.log(`👁️ Watching directory: ${dirPath} (recursive: ${watchOptions.recursive})`);
  }

  /**
   * Stop watching a directory
   */
  public unwatchDirectory(dirPath: string): void {
    this.watchedDirectories.delete(dirPath);
    console.log(`👁️‍🗨️ Stopped watching directory: ${dirPath}`);
  }

  /**
   * Check if a file should be ignored
   */
  public shouldIgnoreFile(filePath: string): boolean {
    // Check against ignore patterns
    for (const pattern of this.ignorePatterns) {
      if (this.matchesPattern(filePath, pattern)) {
        return true;
      }
    }

    // Check if file matches watch patterns (if specified)
    if (this.watchPatterns.length > 0) {
      let matches = false;
      for (const pattern of this.watchPatterns) {
        if (this.matchesPattern(filePath, pattern)) {
          matches = true;
          break;
        }
      }
      if (!matches) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a file is being watched
   */
  public isFileWatched(filePath: string): boolean {
    // Direct file watch
    if (this.watchedFiles.has(filePath)) {
      return true;
    }

    // Check directory watches
    for (const [dirPath, options] of this.watchedDirectories) {
      if (this.isFileInDirectory(filePath, dirPath, options.recursive)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all watched files
   */
  public getWatchedFiles(): Map<string, WatchOptions> {
    return new Map(this.watchedFiles);
  }

  /**
   * Get all watched directories
   */
  public getWatchedDirectories(): Map<string, WatchOptions> {
    return new Map(this.watchedDirectories);
  }

  /**
   * Update ignore patterns
   */
  public setIgnorePatterns(patterns: string[]): void {
    this.ignorePatterns = patterns;
  }

  /**
   * Update watch patterns
   */
  public setWatchPatterns(patterns: string[]): void {
    this.watchPatterns = patterns;
  }

  /**
   * Clear all watches
   */
  public clearAll(): void {
    this.watchedFiles.clear();
    this.watchedDirectories.clear();
    console.log('🗑️ All file watches cleared');
  }

  /**
   * Private: Check if file matches a pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Private: Check if file is in directory
   */
  private isFileInDirectory(filePath: string, dirPath: string, recursive: boolean = true): boolean {
    const normalizedFilePath = filePath.replace(/\\/g, '/');
    let normalizedDirPath = dirPath.replace(/\\/g, '/');
    
    // Ensure directory path ends with '/' for proper matching
    if (!normalizedDirPath.endsWith('/')) {
      normalizedDirPath += '/';
    }
    
    if (!normalizedFilePath.startsWith(normalizedDirPath)) {
      return false;
    }

    if (!recursive) {
      // Check if file is directly in the directory (not in subdirectories)
      const relativePath = normalizedFilePath.substring(normalizedDirPath.length);
      return !relativePath.includes('/');
    }

    return true;
  }
}