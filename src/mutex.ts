class Mutex {
  private _queue: Array<(unlock: () => void) => void>;
  private _locked: boolean;

  constructor() {
    this._queue = [];
    this._locked = false;
  }

  lock(): Promise<() => void> {
    return new Promise((resolve: (unlock: () => void) => void) => {
      if (!this._locked) {
        this._locked = true;
        resolve(this._unlock.bind(this));
      } else {
        this._queue.push(resolve);
      }
    });
  }

  private _unlock(): void {
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      if (next) next(this._unlock.bind(this));
    } else {
      this._locked = false;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const unlock = await this.lock();
    try {
      return await fn();
    } finally {
      unlock();
    }
  }
}

export default Mutex;
