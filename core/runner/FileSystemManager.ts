/**
 * FileSystemManager - Safe file system operations for WebContainer
 */

import type { WebContainerInstance, FileSystemTree, FileSystemEntry } from './types.js';

/**
 * Manager for file system operations within WebContainer
 */
export class FileSystemManager {
  private container: WebContainerInstance;

  constructor(container: WebContainerInstance) {
    this.container = container;
  }

  /**
   * Mount a complete file system tree
   */
  public async mountFiles(files: FileSystemTree): Promise<void> {
    try {
      await this.container.mount(files);
    } catch (error) {
      throw new Error(`Failed to mount files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a single file
   */
  public async createFile(path: string, content: string): Promise<void> {
    try {
      await this.container.fs.writeFile(path, content);
    } catch (error) {
      throw new Error(`Failed to create file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read a file
   */
  public async readFile(path: string): Promise<string> {
    try {
      return await this.container.fs.readFile(path, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a directory
   */
  public async createDirectory(path: string): Promise<void> {
    try {
      await this.container.fs.mkdir(path, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List directory contents
   */
  public async listDirectory(path: string): Promise<FileSystemEntry[]> {
    try {
      const entries = await this.container.fs.readdir(path, { withFileTypes: true });
      return entries.map(entry => {
        const dirent = entry as import('@webcontainer/api').DirEnt<string>;
        return {
          name: dirent.name,
          type: dirent.isDirectory() ? 'directory' : 'file',
          size: 0 // WebContainer's DirEnt doesn't have size property
        };
      });
    } catch (error) {
      throw new Error(`Failed to list directory ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file or directory
   */
  public async delete(path: string): Promise<void> {
    try {
      await this.container.fs.rm(path, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to delete ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file exists
   */
  public async fileExists(path: string): Promise<boolean> {
    try {
      await this.container.fs.readFile(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create package.json for Node.js projects
   */
  public async createPackageJson(config: {
    name: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  }): Promise<void> {
    const packageJson = {
      name: config.name,
      version: config.version || '1.0.0',
      type: 'module',
      dependencies: config.dependencies || {},
      devDependencies: config.devDependencies || {},
      scripts: config.scripts || {}
    };

    await this.createFile('package.json', JSON.stringify(packageJson, null, 2));
  }

  /**
   * Create a basic HTML file
   */
  public async createHtmlFile(title: string, content: string): Promise<void> {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body>
    ${content}
</body>
</html>`;

    await this.createFile('index.html', html);
  }

  /**
   * Get file system tree for a simple project
   */
  public getSimpleProjectTree(
    name: string,
    mainFile: string,
    mainContent: string,
    includeHtml: boolean = false
  ): FileSystemTree {
    const tree: FileSystemTree = {
      'package.json': {
        file: {
          contents: JSON.stringify({
            name,
            version: '1.0.0',
            type: 'module',
            scripts: {
              start: 'node ' + mainFile,
              dev: 'node --watch ' + mainFile
            }
          }, null, 2)
        }
      },
      [mainFile]: {
        file: {
          contents: mainContent
        }
      }
    };

    if (includeHtml) {
      tree['index.html'] = {
        file: {
          contents: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
</head>
<body>
    <h1>${name}</h1>
    <div id="output">Loading...</div>
    <script type="module" src="./${mainFile}"></script>
</body>
</html>`
        }
      };
    }

    return tree;
  }
}