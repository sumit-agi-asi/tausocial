import { promises as fs } from 'node:fs';
import path from 'node:path';
import { seedData } from './seed';
import { StorageData } from './models';

const defaultPath = path.resolve(__dirname, '..', 'data', 'data.json');

export class JsonStorage {
  constructor(private readonly filePath = process.env.TAUSOCIAL_DATA_PATH ?? defaultPath) {}

  private async ensureFile(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.write(seedData);
    }
  }

  async read(): Promise<StorageData> {
    await this.ensureFile();
    const raw = await fs.readFile(this.filePath, 'utf8');
    const parsed = JSON.parse(raw) as StorageData;
    return {
      users: parsed.users ?? [],
      posts: parsed.posts ?? []
    };
  }

  async write(data: StorageData): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
