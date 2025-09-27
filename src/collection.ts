import crypto from "crypto";
import Document from "./Document.js";
import Flare from "./index.js"; 

export class Collection {
  db: Flare;
  name: string;
  schema: Record<string, string>;

  constructor(db: Flare, name: string, schema: Record<string, string>) {
    if (!db) throw new Error("Collection must be attached to a Flare instance");
    if (!name || typeof name !== "string") throw new Error("Collection name must be a non-empty string");
    if (!schema || typeof schema !== "object") throw new Error("Collection schema must be an object");

    this.db = db;
    this.name = name;
    this.schema = schema;
  }

  _validate(doc: Record<string, any>) {
    if (!doc || typeof doc !== "object") {
      throw new Error("Document must be a non-null object");
    }
    for (const key in this.schema) {
      if (doc[key] === undefined) continue;
      if (typeof doc[key] !== this.schema[key]) {
        throw new Error(
          `Invalid type for "${key}". Expected "${this.schema[key]}", got "${typeof doc[key]}"`
        );
      }
    }
  }

  async put(doc: Record<string, any>, options: { upsert?: boolean; uniqueBy?: string[] } = {}): Promise<Document> {
    if (!doc || typeof doc !== "object") throw new Error("Document must be a non-null object");

    this._validate(doc);
    const { upsert = false, uniqueBy = [] } = options;

    if (upsert || uniqueBy.length > 0) {
      const query: Record<string, any> = {};
      for (const key of uniqueBy) {
        if (doc[key] !== undefined) query[key] = doc[key];
      }
      if (Object.keys(query).length > 0) {
        const existing = await this.findOne(query);
        if (existing) {
          // fix: convert Document to plain object before storing
          const updated = { ...existing, ...doc, updated_at: new Date().toISOString() };
          await this.db.put(`${this.name}:${existing._id}`, updated);
          return new Document(updated);
        }
      }
    }

    if (!doc._id) doc._id = crypto.randomUUID();
    if (!doc.created_at) doc.created_at = new Date().toISOString();

    await this.db.put(`${this.name}:${doc._id}`, doc);
    return new Document(doc);
  }

  async find(query: Record<string, any> = {}): Promise<Document[]> {
    if (typeof query !== "object") throw new Error("Query must be an object");

    const results: Document[] = [];
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
      if (match) results.push(new Document(doc));
    }
    return results;
  }

  async findOne(query: Record<string, any> = {}): Promise<Document | null> {
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
      if (match) return new Document(doc);
    }
    return null;
  }

  async updateOne(query: Record<string, any>, update: Record<string, any>): Promise<Document> {
    if (!query || typeof query !== "object") throw new Error("updateOne query must be an object");
    if (!update || typeof update !== "object") throw new Error("updateOne update must be an object");

    const doc = await this.findOne(query);
    if (!doc) throw new Error(`No document found for query: ${JSON.stringify(query)}`);

    const updated = { ...doc, ...update, updated_at: new Date().toISOString() }; // fix here
    this._validate(updated);
    await this.db.put(`${this.name}:${doc._id}`, updated);
    return new Document(updated);
  }

  async updateMany(query: Record<string, any>, update: Record<string, any>): Promise<Document[]> {
    if (!query || typeof query !== "object") throw new Error("updateMany query must be an object");
    if (!update || typeof update !== "object") throw new Error("updateMany update must be an object");

    const docs = await this.find(query);
    if (docs.length === 0) throw new Error(`No documents found for query: ${JSON.stringify(query)}`);

    const updated: Document[] = [];
    for (const doc of docs) {
      const u = { ...doc, ...update, updated_at: new Date().toISOString() }; // fix here
      this._validate(u);
      await this.db.put(`${this.name}:${doc._id}`, u);
      updated.push(new Document(u));
    }
    return updated;
  }

  async deleteOne(query: Record<string, any>): Promise<Document> {
    if (!query || typeof query !== "object") throw new Error("deleteOne query must be an object");

    const doc = await this.findOne(query);
    if (!doc) throw new Error(`No document found to delete for query: ${JSON.stringify(query)}`);

    await this.db.del(`${this.name}:${doc._id}`);
    return doc;
  }

  async deleteMany(query: Record<string, any>): Promise<number> {
    if (!query || typeof query !== "object") throw new Error("deleteMany query must be an object");

    const docs = await this.find(query);
    if (docs.length === 0) throw new Error(`No documents found to delete for query: ${JSON.stringify(query)}`);

    for (const doc of docs) {
      await this.db.del(`${this.name}:${doc._id}`);
    }
    return docs.length;
  }

  async clear(): Promise<number> {
    let count = 0;
    for await (const doc of this.db.scanCollection(this.name)) {
      await this.db.del(`${this.name}:${doc._id}`);
      count++;
    }
    return count;
  }
}
