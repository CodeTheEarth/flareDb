import util from "util";

class Document {
  [key: string]: any; 

  constructor(data: Record<string, any>) {
    Object.assign(this, data);
  }

  toJSON(): Record<string, any> {
    return { ...this };
  }

  toString(): string {
    return JSON.stringify(this, null, 2);
  }

  [util.inspect.custom](): Record<string, any> {
    return this.toJSON();
  }
}

export default Document;
