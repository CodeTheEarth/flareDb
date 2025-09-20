class Mutex {
  constructor() {
    this._queue = [];
    this._locked = false;
  }

  lock() {
    return new Promise(resolve => {
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
      next(this._unlock.bind(this));
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
}

export default Mutex