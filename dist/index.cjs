"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  FlareCache: () => FlareCache,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_fs2 = require("fs");
var import_path2 = __toESM(require("path"), 1);

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
var import_crypto = __toESM(require("crypto"), 1);

// src/Document.ts
var import_util = __toESM(require("util"), 1);
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
  [import_util.default.inspect.custom]() {
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
    if (!doc._id) doc._id = import_crypto.default.randomUUID();
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

// src/flareCache.ts
var import_fs = require("fs");
var import_path = __toESM(require("path"), 1);
var FlareCache = class {
  store;
  mutex;
  dir;
  aofFile;
  constructor(options = {}) {
    this.store = /* @__PURE__ */ new Map();
    this.mutex = new mutex_default();
    this.dir = options.dir || import_path.default.join(process.cwd(), "flare");
    this.aofFile = import_path.default.join(this.dir, "aof.log");
    this._init().catch((err) => {
      console.error("Init error:", err);
    });
  }
  async _init() {
    await import_fs.promises.mkdir(this.dir, { recursive: true });
    await import_fs.promises.access(this.aofFile).catch(() => import_fs.promises.writeFile(this.aofFile, ""));
    await this._loadFromAOF();
  }
  async set(key, value) {
    await this.mutex.run(async () => {
      this.store.set(key, value);
      await this._append({ op: "set", key, value });
    });
  }
  get(key) {
    return this.store.get(key);
  }
  async delete(key) {
    await this.mutex.run(async () => {
      this.store.delete(key);
      await this._append({ op: "del", key });
    });
  }
  keys() {
    return Array.from(this.store.keys());
  }
  async _append(entry) {
    const json = JSON.stringify(entry);
    const data = Buffer.from(json, "utf-8");
    const header = Buffer.alloc(4);
    header.writeUInt32LE(data.length, 0);
    await import_fs.promises.appendFile(this.aofFile, Buffer.concat([header, data]));
  }
  async _loadFromAOF() {
    try {
      const file = await import_fs.promises.readFile(this.aofFile);
      let offset = 0;
      while (offset < file.length) {
        if (offset + 4 > file.length) break;
        const len = file.readUInt32LE(offset);
        offset += 4;
        if (offset + len > file.length) break;
        const slice = file.slice(offset, offset + len);
        offset += len;
        try {
          const entry = JSON.parse(slice.toString("utf-8"));
          if (entry.op === "set" && entry.value !== void 0) {
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
    const dir = import_path2.default.resolve("./flare");
    this.filename = import_path2.default.join(dir, filename);
    this.walFile = this.filename + ".wal";
    this.mutex = new mutex_default();
    this.collections = {};
    this._ensureFiles().then(() => this._recoverFromWal());
  }
  async _ensureFiles() {
    try {
      await import_fs2.promises.mkdir(import_path2.default.dirname(this.filename), { recursive: true });
      await import_fs2.promises.writeFile(this.filename, "", { flag: "a" });
      await import_fs2.promises.writeFile(this.walFile, "", { flag: "a" });
    } catch (err) {
      throw new Error(`Failed to prepare DB files: ${err.message}`);
    }
  }
  async _recoverFromWal() {
    try {
      const walData = await import_fs2.promises.readFile(this.walFile);
      if (walData.length) {
        await import_fs2.promises.appendFile(this.filename, walData);
        await import_fs2.promises.truncate(this.walFile, 0);
      }
    } catch (err) {
      throw new Error(`Failed to recover WAL: ${err.message}`);
    }
  }
  collection(name, schema) {
    if (!name || typeof name !== "string")
      throw new Error("Collection name must be a non-empty string");
    if (!schema || typeof schema !== "object")
      throw new Error("Schema must be a valid object");
    if (this.collections[name]) {
      return this.collections[name];
    }
    const col = new Collection(this, name, schema);
    this.collections[name] = col;
    return col;
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
        await import_fs2.promises.appendFile(this.walFile, record);
        await import_fs2.promises.appendFile(this.filename, record);
        await import_fs2.promises.truncate(this.walFile, 0);
      } catch (err) {
        throw new Error(`Failed to put key "${key}": ${err.message}`);
      }
    });
  }
  async get(key) {
    if (!key || typeof key !== "string")
      throw new Error("Key must be a non-empty string");
    const fd = await import_fs2.promises.open(this.filename, "r");
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
        await import_fs2.promises.appendFile(this.walFile, record);
        await import_fs2.promises.appendFile(this.filename, record);
        await import_fs2.promises.truncate(this.walFile, 0);
      } catch (err) {
        throw new Error(`Failed to delete key "${key}": ${err.message}`);
      }
    });
  }
  async *scanCollection(name) {
    if (!name || typeof name !== "string")
      throw new Error("Collection name must be a non-empty string");
    const fd = await import_fs2.promises.open(this.filename, "r");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FlareCache
});
