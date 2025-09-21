declare module "flaredb" {
  export default class Flare {
    constructor(filename: string);
    init(): Promise<void>;
    collection(name: string, schema: Record<string, string>): any;
    put(key: string, value: any): Promise<void>;
    get(key: string): Promise<any>;
    del(key: string): Promise<void>;
    scanCollection(name: string): AsyncGenerator<any>;
  }
}
