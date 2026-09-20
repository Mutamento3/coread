import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

let dbPath = null;

export function initDb(customPath) {
  dbPath = customPath || path.join(process.cwd(), 'data', 'coread.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      total_paragraphs INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      cover_image TEXT
    );
    CREATE TABLE IF NOT EXISTS book_paragraphs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      idx INTEGER NOT NULL,
      content TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS book_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      paragraph_idx INTEGER NOT NULL,
      sel_start_idx INTEGER,
      sel_end_idx INTEGER,
      sel_end_para_idx INTEGER,
      selected_text TEXT,
      from_who TEXT DEFAULT 'human',
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      reply_to INTEGER
    );
    CREATE TABLE IF NOT EXISTS book_progress (
      book_id INTEGER NOT NULL,
      reader TEXT NOT NULL DEFAULT 'default',
      page INTEGER DEFAULT 1,
      paragraph_offset INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT (datetime('now')),
      last_opened_at DATETIME,
      finished_at TEXT,
      reading_status TEXT,
      first_finished_at TEXT,
      last_finished_at TEXT,
      PRIMARY KEY (book_id, reader)
    );
    CREATE TABLE IF NOT EXISTS reading_daily (
      book_id INTEGER NOT NULL,
      book_title TEXT,
      reading_date TEXT NOT NULL,
      seconds INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT (datetime('now')),
      PRIMARY KEY (book_id, reading_date)
    );
    CREATE TABLE IF NOT EXISTS reading_record_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER,
      book_title TEXT,
      reading_date TEXT,
      from_who TEXT DEFAULT 'ai',
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS reading_finished (
      book_id INTEGER PRIMARY KEY,
      book_title TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS reading_checkpoints (
      session_id TEXT NOT NULL,
      book_id INTEGER NOT NULL,
      reading_date TEXT NOT NULL,
      elapsed_ms INTEGER NOT NULL,
      start_min INTEGER,
      PRIMARY KEY (session_id, reading_date)
    );
    CREATE TABLE IF NOT EXISTS backup_assets (
      book_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      data BLOB NOT NULL,
      PRIMARY KEY (book_id, name)
    );
  `);
  // 多读者迁移（沉哥定的方案）：book_progress 主键从 book_id 升级为 (book_id, reader)，
  // 旧行全部归入 reader='default'；老库缺 reader 列时整表重建，已有 reader 则只补状态列。
  const progressCols = db.prepare('PRAGMA table_info(book_progress)').all().map(c => c.name);
  if (!progressCols.includes('reader')) {
    db.exec(`
      CREATE TABLE book_progress_mig (
        book_id INTEGER NOT NULL,
        reader TEXT NOT NULL DEFAULT 'default',
        page INTEGER DEFAULT 1,
        paragraph_offset INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT (datetime('now')),
        last_opened_at DATETIME,
        finished_at TEXT,
        reading_status TEXT,
        first_finished_at TEXT,
        last_finished_at TEXT,
        PRIMARY KEY (book_id, reader)
      );
      INSERT INTO book_progress_mig (book_id, reader, page, paragraph_offset, updated_at, last_opened_at, finished_at)
        SELECT book_id, 'default', page, paragraph_offset, updated_at, last_opened_at, finished_at FROM book_progress;
      DROP TABLE book_progress;
      ALTER TABLE book_progress_mig RENAME TO book_progress;
    `);
  }
  try { db.exec('ALTER TABLE book_progress ADD COLUMN last_opened_at DATETIME'); } catch {}
  try { db.exec('ALTER TABLE book_progress ADD COLUMN finished_at TEXT'); } catch {}
  try { db.exec('ALTER TABLE book_progress ADD COLUMN paragraph_offset INTEGER DEFAULT 0'); } catch {}
  try { db.exec("ALTER TABLE book_progress ADD COLUMN reader TEXT NOT NULL DEFAULT 'default'"); } catch {}
  try { db.exec('ALTER TABLE book_progress ADD COLUMN reading_status TEXT'); } catch {}
  try { db.exec('ALTER TABLE book_progress ADD COLUMN first_finished_at TEXT'); } catch {}
  try { db.exec('ALTER TABLE book_progress ADD COLUMN last_finished_at TEXT'); } catch {}
  try { db.exec('ALTER TABLE reading_checkpoints ADD COLUMN start_min INTEGER'); } catch {}
  try { db.exec('ALTER TABLE reading_daily ADD COLUMN book_title TEXT'); } catch {}
  try { db.exec('ALTER TABLE reading_record_notes ADD COLUMN book_title TEXT'); } catch {}
  // from_who 归一迁移（沉哥复审 bug②：写入时刻的显示名冻在数据里，改名后新旧混乱）——AI 侧归 'ai'，其余归 'human'，幂等一次性
  try {
    const done = db.prepare("SELECT value FROM config WHERE key = 'who-normalized-v1'").get();
    if (!done) {
      const aiName = db.prepare("SELECT value FROM config WHERE key = 'ai_name'").get()?.value || '沉';
      db.prepare("UPDATE book_comments SET from_who = 'ai' WHERE lower(from_who) IN ('ai','seth') OR from_who = ? OR from_who = '沉'").run(aiName);
      db.prepare("UPDATE book_comments SET from_who = 'human' WHERE from_who NOT IN ('ai', 'human')").run();
      db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('who-normalized-v1', '1')").run();
    }
  } catch {}
  db.close();
}

export function getDb(readonly = false) {
  return new Database(dbPath, { readonly });
}

export function getDbPath() { return dbPath; }

export function getImageDir(bookId) {
  const dir = path.join(path.dirname(dbPath), 'book-images', String(bookId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
