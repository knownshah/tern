import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'os';

export interface TestDirectory {
  path: string;
  writeFile: (relativePath: string, content: string) => Promise<string>;
  readFile: (relativePath: string) => Promise<string>;
  mkdir: (relativePath: string) => Promise<string>;
  exists: (relativePath: string) => Promise<boolean>;
  cleanup: () => Promise<void>;
}

export async function createTestDir(prefix = 'tern-test-'): Promise<TestDirectory> {
  const dirPath = await fs.mkdtemp(path.join(os.tmpdir(), prefix));

  return {
    path: dirPath,
    writeFile: async (relativePath: string, content: string) => {
      const fullPath = path.join(dirPath, relativePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf8');
      return fullPath;
    },
    readFile: async (relativePath: string) => {
      return fs.readFile(path.join(dirPath, relativePath), 'utf8');
    },
    mkdir: async (relativePath: string) => {
      const fullPath = path.join(dirPath, relativePath);
      await fs.mkdir(fullPath, { recursive: true });
      return fullPath;
    },
    exists: async (relativePath: string) => {
      try {
        await fs.access(path.join(dirPath, relativePath));
        return true;
      } catch {
        return false;
      }
    },
    cleanup: async () => {
      try {
        await fs.rm(dirPath, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    },
  };
}
