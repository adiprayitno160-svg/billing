declare module 'mikrotik' {
  class MikroTik {
    constructor(host: string);
    connect(): Promise<void>;
    login(username: string, password: string): Promise<void>;
    write(command: string | string[] | object, ...params: any[]): Promise<any>;
    close(): void;
  }
  
  export = MikroTik;
}
