import { promises as fs } from "fs";
import path from "path";
import Mutex from "./mutex.js";

interface AOFEntry {
  op: "set" | "del";
  key: string;
  value?: any;
}

interface FlareCacheOptions {
  dir?: string;
}

export default class FlareCache {
  private store: Map<string, any>;
  private mutex: Mutex;
  private dir: string;
  private aofFile: string;

  constructor(options: FlareCacheOptions = {}) {
    this.store = new Map();
    this.mutex = new Mutex();

    this.dir = options.dir || path.join(process.cwd(), "flare");
    this.aofFile = path.join(this.dir, "aof.log");

    // auto-init without needing .init()
    this._init().catch((err) => {
      console.error("Init error:", err);
    });
  }

  private async _init() {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.access(this.aofFile).catch(() => fs.writeFile(this.aofFile, ""));
    await this._loadFromAOF();
  }

  async set(key: string, value: any): Promise<void> {
    await this.mutex.run(async () => {
      this.store.set(key, value);
      await this._append({ op: "set", key, value });
    });
  }

  get(key: string): any {
    return this.store.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.mutex.run(async () => {
      this.store.delete(key);
      await this._append({ op: "del", key });
    });
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  private async _append(entry: AOFEntry): Promise<void> {
    const json = JSON.stringify(entry);
    const data = Buffer.from(json, "utf-8");

    // prefix with length (4 bytes)
    const header = Buffer.alloc(4);
    header.writeUInt32LE(data.length, 0);

    await fs.appendFile(this.aofFile, Buffer.concat([header, data]));
  }

  private async _loadFromAOF(): Promise<void> {
    try {
      const file = await fs.readFile(this.aofFile);
      let offset = 0;

      while (offset < file.length) {
        if (offset + 4 > file.length) break;
        const len = file.readUInt32LE(offset);
        offset += 4;

        if (offset + len > file.length) break;
        const slice = file.slice(offset, offset + len);
        offset += len;

        try {
          const entry: AOFEntry = JSON.parse(slice.toString("utf-8"));
          if (entry.op === "set" && entry.value !== undefined) {
            this.store.set(entry.key, entry.value);
          }
          if (entry.op === "del") {
            this.store.delete(entry.key);
          }
        } catch {
          console.error("Corrupted AOF entry at offset", offset);
        }
      }
    } catch (err) {
      console.error("Failed to load AOF:", err);
    }
  }
}
