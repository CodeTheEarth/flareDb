import { promises as fs } from "fs";
import crypto from "crypto";
import Mutex from "./mutex.js";
import { Collection } from "./collection.js";

class Flare {
  constructor(filename) {
    if (!filename || typeof filename !== "string") throw new Error("Filename must be a non-empty string");
    if (!filename.endsWith(".db")) throw new Error("Filename must end with .db");

    this.filename = filename;
    this.walFile = filename + ".wal";
    this.mutex = new Mutex();
    this.collections = {};
  }

  async init() {
    try {
      await fs.writeFile(this.filename, "", { flag: "a" });
      await fs.writeFile(this.walFile, "", { flag: "a" });
      await this._recoverFromWal();
    } catch (err) {
      throw new Error(`Failed to initialize DB: ${err.message}`);
    }
  }

  collection(name, schema) {
    if (!name || typeof name !== "string") {
      throw new Error("Collection name must be a non-empty string");
    }
    if (!schema || typeof schema !== "object") {
      throw new Error("Schema must be a valid object");
    }


    if (this.collections[name]) {
      return this.collections[name];
    }

    const col = new Collection(this, name, schema);
    this.collections[name] = col;
    return col;

    return col;
  }

  async _recoverFromWal() {
    try {
      const walData = await fs.readFile(this.walFile);
      if (walData.length) {
        await fs.appendFile(this.filename, walData);
        await fs.truncate(this.walFile, 0);
      }
    } catch (err) {
      throw new Error(`Failed to recover WAL: ${err.message}`);
    }
  }

  async put(key, value) {
    if (!key || typeof key !== "string") throw new Error("Key must be a non-empty string");
    return this.mutex.run(async () => {
      const valStr = JSON.stringify({ v: value, deleted: false });
      const keyBuf = Buffer.from(key);
      const valBuf = Buffer.from(valStr);

      const header = Buffer.alloc(8);
      header.writeUInt32LE(keyBuf.length, 0);
      header.writeUInt32LE(valBuf.length, 4);

      const record = Buffer.concat([header, keyBuf, valBuf]);

      try {
        await fs.appendFile(this.walFile, record);
        await fs.appendFile(this.filename, record);
        await fs.truncate(this.walFile, 0);
      } catch (err) {
        throw new Error(`Failed to put key "${key}": ${err.message}`);
      }
    });
  }

  async get(key) {
    if (!key || typeof key !== "string") throw new Error("Key must be a non-empty string");
    const fd = await fs.open(this.filename, "r");
    try {
      const stats = await fd.stat();
      let pos = 0;
      const buf = Buffer.alloc(8);

      while (pos < stats.size) {
        await fd.read(buf, 0, 8, pos);
        const keyLen = buf.readUInt32LE(0);
        const valLen = buf.readUInt32LE(4);
        const totalLen = 8 + keyLen + valLen;

        const keyBuf = Buffer.alloc(keyLen);
        await fd.read(keyBuf, 0, keyLen, pos + 8);
        const curKey = keyBuf.toString();

        if (curKey === key) {
          const valBuf = Buffer.alloc(valLen);
          await fd.read(valBuf, 0, valLen, pos + 8 + keyLen);
          const parsed = JSON.parse(valBuf.toString());
          return parsed.deleted ? null : parsed.v;
        }

        pos += totalLen;
      }

      return null;
    } catch (err) {
      throw new Error(`Failed to get key "${key}": ${err.message}`);
    } finally {
      await fd.close();
    }
  }

  async del(key) {
    if (!key || typeof key !== "string") throw new Error("Key must be a non-empty string");
    return this.mutex.run(async () => {
      const valStr = JSON.stringify({ v: null, deleted: true });
      const keyBuf = Buffer.from(key);
      const valBuf = Buffer.from(valStr);

      const header = Buffer.alloc(8);
      header.writeUInt32LE(keyBuf.length, 0);
      header.writeUInt32LE(valBuf.length, 4);

      const record = Buffer.concat([header, keyBuf, valBuf]);

      try {
        await fs.appendFile(this.walFile, record);
        await fs.appendFile(this.filename, record);
        await fs.truncate(this.walFile, 0);
      } catch (err) {
        throw new Error(`Failed to delete key "${key}": ${err.message}`);
      }
    });
  }

  async *scanCollection(name) {
    if (!name || typeof name !== "string") throw new Error("Collection name must be a non-empty string");

    const fd = await fs.open(this.filename, "r");
    try {
      const stats = await fd.stat();
      let pos = 0;
      const bufHeader = Buffer.alloc(8);

      while (pos < stats.size) {
        await fd.read(bufHeader, 0, 8, pos);
        const keyLen = bufHeader.readUInt32LE(0);
        const valLen = bufHeader.readUInt32LE(4);
        const totalLen = 8 + keyLen + valLen;

        const keyBuf = Buffer.alloc(keyLen);
        await fd.read(keyBuf, 0, keyLen, pos + 8);
        const key = keyBuf.toString();

        if (key.startsWith(name + ":")) {
          const valBuf = Buffer.alloc(valLen);
          await fd.read(valBuf, 0, valLen, pos + 8 + keyLen);
          const parsed = JSON.parse(valBuf.toString());
          if (!parsed.deleted) yield parsed.v;
        }

        pos += totalLen;
      }
    } catch (err) {
      throw new Error(`Failed to scan collection "${name}": ${err.message}`);
    } finally {
      await fd.close();
    }
  }
}

export default Flare;
