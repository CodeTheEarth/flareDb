// src/index.ts
import { promises as fs } from "fs";

// src/mutex.ts
var Mutex = class {
  _queue;
  _locked;
  constructor() {
    this._queue = [];
    this._locked = false;
  }
  lock() {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve(this._unlock.bind(this));
      } else {
        this._queue.push(resolve);
      }
    });
  }
  _unlock() {
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      if (next) next(this._unlock.bind(this));
    } else {
      this._locked = false;
    }
  }
  async run(fn) {
    const unlock = await this.lock();
    try {
      return await fn();
    } finally {
      unlock();
    }
  }
};
var mutex_default = Mutex;

// src/collection.ts
import crypto from "crypto";

// src/Document.ts
import util from "util";
var Document = class {
  constructor(data) {
    Object.assign(this, data);
  }
  toJSON() {
    return { ...this };
  }
  toString() {
    return JSON.stringify(this, null, 2);
  }
  [util.inspect.custom]() {
    return this.toJSON();
  }
};
var Document_default = Document;

// src/collection.ts
var Collection = class {
  db;
  name;
  schema;
  constructor(db, name, schema) {
    if (!db) throw new Error("Collection must be attached to a Flare instance");
    if (!name || typeof name !== "string") throw new Error("Collection name must be a non-empty string");
    if (!schema || typeof schema !== "object") throw new Error("Collection schema must be an object");
    this.db = db;
    this.name = name;
    this.schema = schema;
  }
  _validate(doc) {
    if (!doc || typeof doc !== "object") {
      throw new Error("Document must be a non-null object");
    }
    for (const key in this.schema) {
      if (doc[key] === void 0) continue;
      if (typeof doc[key] !== this.schema[key]) {
        throw new Error(
          `Invalid type for "${key}". Expected "${this.schema[key]}", got "${typeof doc[key]}"`
        );
      }
    }
  }
  async put(doc, options = {}) {
    if (!doc || typeof doc !== "object") throw new Error("Document must be a non-null object");
    this._validate(doc);
    const { upsert = false, uniqueBy = [] } = options;
    if (upsert || uniqueBy.length > 0) {
      const query = {};
      for (const key of uniqueBy) {
        if (doc[key] !== void 0) query[key] = doc[key];
      }
      if (Object.keys(query).length > 0) {
        const existing = await this.findOne(query);
        if (existing) {
          Object.assign(existing, doc, { updated_at: (/* @__PURE__ */ new Date()).toISOString() });
          await this.db.put(`${this.name}:${existing._id}`, existing);
          return new Document_default(existing);
        }
      }
    }
    if (!doc._id) doc._id = crypto.randomUUID();
    if (!doc.created_at) doc.created_at = (/* @__PURE__ */ new Date()).toISOString();
    await this.db.put(`${this.name}:${doc._id}`, doc);
    return new Document_default(doc);
  }
  async find(query = {}) {
    if (typeof query !== "object") throw new Error("Query must be an object");
    const results = [];
    for await (const doc of this.db.scanCollection(this.name)) {
      let match = true;
      for (const [qk, qv] of Object.entries(query)) {
        const docVal = doc[qk];
        if (typeof qv === "string" && typeof docVal === "string") {
          if (docVal.toLowerCase() !== qv.toLowerCase()) {
            match = false;
            break;
          }
        } else {
          if (docVal !== qv) {
            match = false;
            break;
          }
        }
      }
      if (match) results.push(new Document_default(doc));
    }
    return results;
  }
  async findOne(query = {}) {
    if (typeof query !== "object") throw new Error("Query must be an object");
    for await (const doc of this.db.scanCollection(this.name)) {
      let match = true;
      for (const [qk, qv] of Object.entries(query)) {
        const docVal = doc[qk];
        if (typeof qv === "string" && typeof docVal === "string") {
          if (docVal.toLowerCase() !== qv.toLowerCase()) {
            match = false;
            break;
          }
        } else {
          if (docVal !== qv) {
            match = false;
            break;
          }
        }
      }
      if (match) return new Document_default(doc);
    }
    return null;
  }
  async updateOne(query, update) {
    if (!query || typeof query !== "object") throw new Error("updateOne query must be an object");
    if (!update || typeof update !== "object") throw new Error("updateOne update must be an object");
    const doc = await this.findOne(query);
    if (!doc) throw new Error(`No document found for query: ${JSON.stringify(query)}`);
    Object.assign(doc, update, { updated_at: (/* @__PURE__ */ new Date()).toISOString() });
    this._validate(doc);
    await this.db.put(`${this.name}:${doc._id}`, doc);
    return new Document_default(doc);
  }
  async updateMany(query, update) {
    if (!query || typeof query !== "object") throw new Error("updateMany query must be an object");
    if (!update || typeof update !== "object") throw new Error("updateMany update must be an object");
    const docs = await this.find(query);
    if (docs.length === 0) throw new Error(`No documents found for query: ${JSON.stringify(query)}`);
    const updated = [];
    for (const doc of docs) {
      Object.assign(doc, update, { updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      this._validate(doc);
      await this.db.put(`${this.name}:${doc._id}`, doc);
      updated.push(new Document_default(doc));
    }
    return updated;
  }
  async deleteOne(query) {
    if (!query || typeof query !== "object") throw new Error("deleteOne query must be an object");
    const doc = await this.findOne(query);
    if (!doc) throw new Error(`No document found to delete for query: ${JSON.stringify(query)}`);
    await this.db.del(`${this.name}:${doc._id}`);
    return doc;
  }
  async deleteMany(query) {
    if (!query || typeof query !== "object") throw new Error("deleteMany query must be an object");
    const docs = await this.find(query);
    if (docs.length === 0) throw new Error(`No documents found to delete for query: ${JSON.stringify(query)}`);
    for (const doc of docs) {
      await this.db.del(`${this.name}:${doc._id}`);
    }
    return docs.length;
  }
  async clear() {
    let count = 0;
    for await (const doc of this.db.scanCollection(this.name)) {
      await this.db.del(`${this.name}:${doc._id}`);
      count++;
    }
    return count;
  }
};

// src/index.ts
var Flare2 = class {
  filename;
  walFile;
  mutex;
  collections;
  constructor(filename) {
    if (!filename || typeof filename !== "string")
      throw new Error("Filename must be a non-empty string");
    if (!filename.endsWith(".db"))
      throw new Error("Filename must end with .db");
    this.filename = filename;
    this.walFile = filename + ".wal";
    this.mutex = new mutex_default();
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
    if (!key || typeof key !== "string")
      throw new Error("Key must be a non-empty string");
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
    if (!key || typeof key !== "string")
      throw new Error("Key must be a non-empty string");
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
    if (!key || typeof key !== "string")
      throw new Error("Key must be a non-empty string");
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
    if (!name || typeof name !== "string")
      throw new Error("Collection name must be a non-empty string");
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
};
var index_default = Flare2;
export {
  index_default as default
};
