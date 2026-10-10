import { DatabaseSync } from '../../src/node/sqlite-compat';

describe('SQLite backend compatibility', () => {
  let db: InstanceType<typeof DatabaseSync>;

  beforeEach(() => { db = new DatabaseSync(':memory:'); });
  afterEach(() => { db.close(); });

  it('preserves named bindings, null-prototype rows and blob values', () => {
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, data BLOB)');
    const inserted = db.prepare('INSERT INTO items VALUES (@id, @data)').run({
      '@id': 1, '@data': new Uint8Array([0, 255])
    });
    expect(Number(inserted.lastInsertRowid)).toBe(1);
    expect(Number(inserted.changes)).toBe(1);
    const item = db.prepare('SELECT * FROM items WHERE id = :id').get({ id: 1 });
    expect(Object.getPrototypeOf(item)).toBeNull();
    expect(item!.data).toEqual(new Uint8Array([0, 255]));
    expect(db.prepare('SELECT * FROM items').all({})).toHaveLength(1);
    expect([...db.prepare('SELECT * FROM items').iterate()]).toEqual([item]);
    expect(db.prepare('SELECT * FROM items WHERE id = ?').get(2)).toBeUndefined();
  });

  it('returns bigint integers only when requested', () => {
    const stmt = db.prepare('SELECT 9007199254740993 AS value');
    stmt.setReadBigInts(true);
    expect(stmt.get()!.value).toBe(9007199254740993n);
    stmt.setReadBigInts(false);
    expect(db.prepare('SELECT 1 AS value').get()!.value).toBe(1);
  });

  it('enforces foreign keys by default and rolls back transactions', () => {
    db.exec('CREATE TABLE parents (id INTEGER PRIMARY KEY); CREATE TABLE children (id INTEGER REFERENCES parents(id))');
    expect(() => db.prepare('INSERT INTO children VALUES (?)').run(1)).toThrow();
    db.exec('BEGIN; INSERT INTO parents VALUES (1); ROLLBACK;');
    expect(db.prepare('SELECT * FROM parents').all()).toEqual([]);
  });
});
