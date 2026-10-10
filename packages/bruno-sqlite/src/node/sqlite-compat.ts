import BetterSqlite3 from 'better-sqlite3';
import type { DatabaseSync as NativeDatabase, DatabaseSyncOptions, StatementSync } from 'node:sqlite';

const bindings = (args: unknown[]): unknown[] => args.map((arg) => {
  if (ArrayBuffer.isView(arg)) return Buffer.from(arg.buffer, arg.byteOffset, arg.byteLength);
  if (arg && typeof arg === 'object') {
    return Object.fromEntries(Object.entries(arg).map(([key, value]) => [
      key.replace(/^[:@$]/, ''),
      ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : value
    ]));
  }
  return arg;
}).filter((arg) => !(arg && typeof arg === 'object' && !ArrayBuffer.isView(arg) && Object.keys(arg).length === 0));

const row = (value: unknown): Record<string, unknown> | undefined => {
  if (value === undefined) return undefined;
  const result = Object.create(null);
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = Buffer.isBuffer(item) ? new Uint8Array(item) : item;
  }
  return result;
};

class LegacyStatement {
  constructor(private statement: BetterSqlite3.Statement) {}

  setReadBigInts(enabled: boolean): void {
    this.statement.safeIntegers(enabled);
  }

  run(...args: unknown[]): BetterSqlite3.RunResult {
    return this.statement.run(...bindings(args));
  }

  get(...args: unknown[]): Record<string, unknown> | undefined {
    return row(this.statement.get(...bindings(args)));
  }

  all(...args: unknown[]): Record<string, unknown>[] {
    return this.statement.all(...bindings(args)).map((value) => row(value)!);
  }

  *iterate(...args: unknown[]): IterableIterator<Record<string, unknown>> {
    for (const value of this.statement.iterate(...bindings(args))) yield row(value)!;
  }
}

class LegacyDatabase {
  private database: BetterSqlite3.Database;

  constructor(path: string, options: DatabaseSyncOptions = {}) {
    if (options.open === false) throw new Error('Deferred database opening is not supported by the Win7 backend');
    this.database = new BetterSqlite3(path, {
      readonly: options.readOnly ?? false,
      fileMustExist: options.readOnly ?? false,
      timeout: 0
    });
    try {
      this.database.pragma(`foreign_keys = ${options.enableForeignKeyConstraints === false ? 'OFF' : 'ON'}`);
    } catch (err) {
      this.database.close();
      throw err;
    }
  }

  exec(sql: string): void {
    this.database.exec(sql);
  }

  prepare(sql: string): StatementSync {
    return new LegacyStatement(this.database.prepare(sql)) as unknown as StatementSync;
  }

  close(): void {
    this.database.close();
  }
}

const native = process.env.BRUNO_SQLITE_BACKEND === 'legacy'
  ? undefined
  : process.getBuiltinModule?.('node:sqlite');

// Keep the native backend on modern Node; Electron 22 loads the ABI-matched addon.
export const DatabaseSync = (native?.DatabaseSync ?? LegacyDatabase) as typeof NativeDatabase;
