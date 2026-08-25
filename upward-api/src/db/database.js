import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';
import { config } from '../config.js';

sqlite3.verbose();

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new sqlite3.Database(config.dbPath);

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');
});

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onResult(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

export function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

export async function withTransaction(fn) {
  await run('BEGIN IMMEDIATE');
  try {
    const result = await fn();
    await run('COMMIT');
    return result;
  } catch (err) {
    await run('ROLLBACK').catch(() => {});
    throw err;
  }
}

export async function migrate() {
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  await exec(await fs.promises.readFile(schemaPath, 'utf8'));
}
