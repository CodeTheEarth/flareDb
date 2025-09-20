export class Collection {
  constructor(db, name, schema) {
    if (!db) throw new Error("Collection must be attached to a Flare instance");
    if (!name || typeof name !== "string") throw new Error("Collection name must be a non-empty string");
    if (!schema || typeof schema !== "object") throw new Error("Collection schema must be an object");

    this.db = db;
    this.name = name;
    this.schema = schema;
  }

  _validate(doc) {
    if (!doc || typeof doc !== "object") throw new Error("Document must be an object");

    for (const key in this.schema) {
      if (doc[key] === undefined) continue; // optional fields
      if (typeof doc[key] !== this.schema[key]) {
        throw new Error(
          `Invalid type for "${key}". Expected "${this.schema[key]}", got "${typeof doc[key]}"`
        );
      }
    }
  }

  async put(doc) {
    if (!doc || typeof doc !== "object") throw new Error("Document must be a non-null object");

    if (!doc._id) doc._id = crypto.randomUUID();
    if (!doc.created_at) doc.created_at = new Date().toISOString();

    this._validate(doc);
    await this.db.put(`${this.name}:${doc._id}`, doc);
    return doc;
  }

  async find(query = {}) {
    if (typeof query !== "object") throw new Error("Query must be an object");
    const results = [];
    for await (const doc of this.db.scanCollection(this.name)) {
      let match = true;
      for (const [qk, qv] of Object.entries(query)) {
        if (doc[qk] !== qv) {
          match = false;
          break;
        }
      }
      if (match) results.push(doc);
    }
    return results;
  }

  async findOne(query = {}) {
    if (typeof query !== "object") throw new Error("Query must be an object");
    for await (const doc of this.db.scanCollection(this.name)) {
      let match = true;
      for (const [qk, qv] of Object.entries(query)) {
        if (doc[qk] !== qv) {
          match = false;
          break;
        }
      }
      if (match) return doc;
    }
    return null;
  }
}