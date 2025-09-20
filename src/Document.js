import util from "util"

class Document {
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
}

export default Document