// 共读室备份与恢复增强版（/v1/coread-backup/*）
// 移植自 SullyOS bridge/coread-backup.mjs，适配回 coread 本体：
//  - db 访问走 coread 的 getDb/getDbPath；表结构按 coread lib/db.mjs 的列（含多读者 reader 与新读完状态列）
//  - 图片资产：coread 既有 data/book-images/<id>/ 目录 + backup_assets 表双轨，导出两路都收、恢复写回 backup_assets
//  - 相比旧 /v1/backup/*（lib/backup.mjs，保留不动）新增：list/delete、服务器文件快速通道（大备份轻量校验）、
//    导出落盘 data/backups/ 并返回受 owner-key 保护的下载 URL、bytes 字段、600MiB 上限
//  - 鉴权：全部端点要 x-owner-key（下载允许 ?key= 便于浏览器直接打开）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDb, getDbPath } from './db.mjs';
import { safeAssetName } from './backup.mjs';

export const MAX_BACKUP_BYTES = 600 * 1024 * 1024;      // 导出/服务器文件上限
export const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;       // 浏览器上传的备份文件上限（超过就走服务器上的备份文件恢复）

const TABLES = {
  books: 'id title total_paragraphs created_at cover_image',
  book_paragraphs: 'id book_id idx content',
  book_comments: 'id book_id paragraph_idx sel_start_idx sel_end_idx sel_end_para_idx selected_text from_who content created_at reply_to',
  book_progress: 'book_id reader page paragraph_offset updated_at last_opened_at finished_at reading_status first_finished_at last_finished_at',
  reading_daily: 'book_id book_title reading_date seconds updated_at',
  reading_record_notes: 'id book_id book_title reading_date from_who content created_at',
  reading_finished: 'book_id book_title finished_at created_at',
  reading_checkpoints: 'session_id book_id reading_date elapsed_ms start_min',
};
const NUMBERS = new Set('id book_id total_paragraphs idx paragraph_idx sel_start_idx sel_end_idx sel_end_para_idx reply_to page paragraph_offset seconds elapsed_ms start_min'.split(' '));
const previews = new Map();

function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }
function isValidDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) && Number.isFinite(Date.parse(s)); }

function exportDir() {
  const dir = path.join(path.dirname(getDbPath()), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function imagesDir(bookId) { return path.join(path.dirname(getDbPath()), 'book-images', String(bookId)); }

function settingsOnly(settings = {}) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) invalid('settings 格式不对');
  for (const [key, value] of Object.entries(settings)) {
    if (!key.startsWith('coread-') || key.length > 60) invalid('未知设置项');
    if (typeof value !== 'string' || value.length > 100) invalid('设置值非法');
  }
  return settings;
}

function snapshot(db) {
  return Object.fromEntries(Object.entries(TABLES).map(([table, columns]) => {
    const cols = columns.split(' ').join(',');
    // 带 book_id 的表过滤孤儿行（书已删但行残留的历史数据，备份没意义还会过不了校验）
    const orphanFilter = ['book_comments', 'book_progress', 'reading_checkpoints', 'reading_daily'].includes(table)
      ? ' WHERE book_id IN (SELECT id FROM books)' : '';
    return [table, db.prepare(`SELECT ${cols} FROM ${table}${orphanFilter} ORDER BY rowid`).all()];
  }));
}
function snapshotBooks(db) { return db.prepare('SELECT id FROM books ORDER BY id').all(); }

function collectAssets(db) {
  const assets = [];
  let bytes = 0;
  const restoredIds = JSON.parse(db.prepare('SELECT value FROM config WHERE key = ?').get('backup_asset_mode')?.value || '[]');
  for (const book of snapshotBooks(db)) {
    const stored = db.prepare('SELECT name, data FROM backup_assets WHERE book_id = ?').all(book.id);
    const names = new Set(stored.map(a => a.name));
    const dir = imagesDir(book.id);
    // 恢复过的书库只认事务写入的 backup_assets；目录只是导出时的来源
    if (!restoredIds.includes(book.id) && fs.existsSync(dir)) {
      if (fs.lstatSync(dir).isSymbolicLink()) invalid('图片目录不能是软链');
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !safeAssetName(entry.name) || names.has(entry.name)) continue;
        const file = path.join(dir, entry.name);
        if (fs.statSync(file).size > 8 * 1024 * 1024) invalid('单张图片超过 8 MiB');
        stored.push({ name: entry.name, data: fs.readFileSync(file) });
      }
    }
    for (const asset of stored) {
      bytes += Math.ceil(asset.data.length * 4 / 3);
      if (bytes > MAX_BACKUP_BYTES) invalid('备份超过 600 MiB');
      assets.push({ book_id: book.id, name: asset.name, base64: Buffer.from(asset.data).toString('base64') });
    }
  }
  return assets;
}

function revision(db) {
  const h = crypto.createHash('sha256').update(JSON.stringify(snapshot(db)));
  for (const row of db.prepare('SELECT book_id, name, length(data) AS bytes FROM backup_assets ORDER BY book_id, name').all()) {
    h.update(`${row.book_id}/${row.name}/${row.bytes}`);
  }
  const restoredIds = JSON.parse(db.prepare('SELECT value FROM config WHERE key = ?').get('backup_asset_mode')?.value || '[]');
  for (const book of snapshotBooks(db)) {
    const dir = imagesDir(book.id);
    if (restoredIds.includes(book.id) || !fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) h.update(`${book.id}/${f}`);
  }
  return h.digest('hex');
}

function counts(data, assets) {
  return {
    books: data.books.length, paragraphs: data.book_paragraphs.length, comments: data.book_comments.length,
    readingDays: new Set(data.reading_daily.map(r => r.reading_date)).size,
    readingSeconds: Math.round(data.reading_daily.reduce((s, r) => s + (r.seconds || 0), 0)),
    coversAndImages: assets.length,
  };
}

export function exportBackup(settings = {}) {
  settingsOnly(settings);
  const db = getDb(true);
  try {
    const data = snapshot(db);
    const assets = collectAssets(db);
    const backup = { schemaVersion: 2, app: 'coread', createdAt: new Date().toISOString(), counts: counts(data, assets), data, assets, settings };
    validateBackup(backup);
    return backup;
  } finally { db.close(); }
}

export function validateBackup(input) {
  const b = input;
  if (b?.schemaVersion !== 2 || b?.app !== 'coread') invalid('不支持的备份版本（只认本共读室导出的 v2）');
  if (Buffer.byteLength(JSON.stringify(b)) > MAX_BACKUP_BYTES) invalid('备份超过 600 MiB');
  if (!b.data || Object.keys(b.data).length !== Object.keys(TABLES).length) invalid('备份缺表');
  let rows = 0;
  for (const [table, columns] of Object.entries(TABLES)) {
    const allowed = columns.split(' ');
    if (!Array.isArray(b.data[table])) invalid(`缺表: ${table}`);
    for (const row of b.data[table]) {
      if (++rows > 2000000) invalid('行数过多');
      if (!row || typeof row !== 'object' || Array.isArray(row) || allowed.some(k => !(k in row))) invalid(`行格式不对: ${table}`);
      for (const [key, value] of Object.entries(row)) {
        if (!allowed.includes(key)) invalid('出现未知列');
        if (value === null) continue;
        if (NUMBERS.has(key)) {
          if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`数字列非法: ${key}`);
        } else if (typeof value !== 'string' || value.length > 2 * 1024 * 1024) invalid(`文本列非法: ${key}`);
        if (['reading_date', 'finished_at'].includes(key) && !isValidDate(value)) invalid('日期非法');
      }
    }
  }
  const books = new Set(b.data.books.map(r => r.id));
  if (books.size !== b.data.books.length || b.data.books.some(r => !Number.isSafeInteger(r.id) || r.id < 1)) invalid('书籍 id 非法');
  const paragraphs = new Set();
  for (const row of b.data.book_paragraphs) {
    if (!books.has(row.book_id) || row.idx === null || typeof row.content !== 'string') invalid('段落非法');
    const key = `${row.book_id}:${row.idx}`;
    if (paragraphs.has(key)) invalid('段落 idx 重复');
    paragraphs.add(key);
  }
  for (const row of [...b.data.book_comments, ...b.data.book_progress, ...b.data.reading_checkpoints]) if (!books.has(row.book_id)) invalid('孤儿数据');
  if (!Array.isArray(b.assets) || b.assets.length > 10000) invalid('资产非法');
  const assets = new Set();
  for (const asset of b.assets) {
    if (!asset || Object.keys(asset).sort().join(',') !== 'base64,book_id,name' || !books.has(asset.book_id) || !safeAssetName(asset.name)) invalid('资产路径不安全');
    if (typeof asset.base64 !== 'string' || asset.base64.length > 12 * 1024 * 1024) invalid('图片编码非法');
    const bytes = Buffer.from(asset.base64, 'base64');
    if (bytes.length > 8 * 1024 * 1024) invalid('图片超 8 MiB');
    if (/\.svg$/i.test(asset.name) && /<\s*(script|foreignObject)|\bon\w+\s*=|(?:href|src)\s*=\s*['"]\s*(?:https?:|\/\/|data:|javascript:)|<!ENTITY/i.test(bytes.toString('utf8'))) invalid('SVG 含活性内容');
    const key = `${asset.book_id}:${asset.name}`;
    if (assets.has(key)) invalid('图片重复');
    assets.add(key);
  }
  for (const book of b.data.books) if (book.cover_image && !assets.has(`${book.id}:${book.cover_image}`)) invalid('封面缺失');
  // 主键/非空约束预检（不落库）
  const db = getDb(true);
  try {
    for (const [table, list] of Object.entries(b.data)) {
      const schema = db.prepare(`PRAGMA table_info(${table})`).all();
      const primary = schema.filter(c => c.pk).map(c => c.name);
      const required = schema.filter(c => c.notnull).map(c => c.name);
      const seen = new Set();
      for (const row of list) {
        const key = JSON.stringify(primary.map(k => row[k]));
        if (primary.some(k => row[k] == null) || seen.has(key)) invalid('主键缺失或重复');
        if (required.some(k => row[k] == null)) invalid('必填字段缺失');
        seen.add(key);
      }
    }
  } finally { db.close(); }
  return { ...counts(b.data, b.assets), createdAt: b.createdAt, schemaVersion: b.schemaVersion };
}

export function previewBackup(backup) {
  const summary = validateBackup(backup);
  const now = Date.now();
  for (const [key, value] of previews) if (value.expires < now) previews.delete(key);
  if (previews.size >= 2) invalid('先关掉现有预览或等五分钟');
  const token = crypto.randomUUID();
  const db = getDb(true);
  try { previews.set(token, { backup: JSON.stringify(backup), revision: revision(db), expires: now + 5 * 60000 }); }
  finally { db.close(); }
  return { token, ...summary };
}

// 大备份快速通道（服务器上自己导出的文件）：轻量结构校验，不逐行深检、不重复序列化，
// preview 只记文件路径（几百 MB 级备份完整深检会把进程内存打爆——SullyOS 侧 2026-09-20 实测 502 过）
function lightValidateFileBackup(b) {
  if (b?.schemaVersion !== 2 || b?.app !== 'coread') invalid('不支持的备份版本（只认本共读室导出的 v2）');
  if (!b.data || Object.keys(b.data).length !== Object.keys(TABLES).length) invalid('备份缺表');
  for (const t of Object.keys(TABLES)) if (!Array.isArray(b.data[t])) invalid(`缺表: ${t}`);
  if (!Array.isArray(b.assets)) invalid('资产非法');
  if (!b.counts || typeof b.counts.books !== 'number') invalid('缺统计');
  return { ...counts(b.data, b.assets), createdAt: b.createdAt, schemaVersion: b.schemaVersion };
}

export function previewBackupFile(filePath) {
  const backup = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const summary = lightValidateFileBackup(backup);
  const now = Date.now();
  for (const [key, value] of previews) if (value.expires < now) previews.delete(key);
  if (previews.size >= 2) invalid('先关掉现有预览或等五分钟');
  const token = crypto.randomUUID();
  const db = getDb(true);
  try { previews.set(token, { backupFile: filePath, revision: revision(db), expires: now + 5 * 60000 }); }
  finally { db.close(); }
  return { token, ...summary };
}

export function restoreBackup(token, confirmed) {
  const preview = previews.get(token);
  if (confirmed !== true || !preview || preview.expires < Date.now()) invalid('需要有效预览和明确确认');
  // preview 可能存的是序列化备份（小上传）或服务器文件路径（大备份快速通道）
  const backup = preview.backupFile ? JSON.parse(fs.readFileSync(preview.backupFile, 'utf8')) : JSON.parse(preview.backup);
  const db = getDb();
  try {
    db.transaction(() => {
      if (revision(db) !== preview.revision) invalid('预览后数据有变动，请重新预览');
      for (const table of Object.keys(TABLES)) db.prepare(`DELETE FROM ${table}`).run();
      for (const [table, columns] of Object.entries(TABLES)) {
        const keys = columns.split(' ');
        const insert = db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`);
        for (const row of backup.data[table]) insert.run(...keys.map(key => row[key]));
      }
      // 资产回写进 backup_assets（coread 既有机制：恢复过的书以表内 blob 为准，见 /v1/book-images 与导出路径）
      db.prepare('DELETE FROM backup_assets').run();
      const insertAsset = db.prepare('INSERT INTO backup_assets (book_id, name, data) VALUES (?, ?, ?)');
      for (const asset of backup.assets) insertAsset.run(asset.book_id, asset.name, Buffer.from(asset.base64, 'base64'));
      // 派生缓存全部作废：浏览器分页表清掉，书库代际轮换让前端放弃本地未同步时长
      db.prepare("DELETE FROM config WHERE key LIKE 'browser_pagination_v1:%'").run();
      const set = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
      set.run('backup_asset_mode', JSON.stringify(backup.data.books.map(book => book.id)));
      set.run('portable_settings', JSON.stringify(backup.settings || {}));
      set.run('library_generation', crypto.randomUUID());
    }).immediate();
    previews.delete(token);
    return { ok: true, counts: counts(backup.data, backup.assets), settings: backup.settings, generation: db.prepare('SELECT value FROM config WHERE key = ?').get('library_generation').value };
  } finally { db.close(); }
}

// 路由处理：挂进 lib/routes.mjs。全部端点（含下载）都要 owner key。
export async function handleCoreadBackupRequest(req, res, { json, readRawBody, ownerKey }) {
  if (!req.url?.startsWith('/v1/coread-backup/')) return false;
  const send = (status, body) => json(res, status, body);
  const urlObj = new URL(req.url, 'http://localhost');
  const key = req.headers['x-owner-key'] || urlObj.searchParams.get('key') || '';

  // GET /v1/coread-backup/file/<name>?key=... — 下载已导出的备份文件（浏览器 window.open 可用 ?key=）
  const fileMatch = urlObj.pathname.match(/^\/v1\/coread-backup\/file\/(.+)$/);
  if (req.method === 'GET' && fileMatch) {
    if (!ownerKey || key !== ownerKey) { send(403, { error: 'owner_key_required', message: '只有彤宝能下载备份。' }); return true; }
    const fname = path.basename(decodeURIComponent(fileMatch[1]));
    if (!/^coread-backup-[\dTZ-]+\.json$/.test(fname)) { send(400, { error: '文件名非法' }); return true; }
    const fp = path.join(exportDir(), fname);
    if (!fs.existsSync(fp)) { send(404, { error: '备份文件不存在' }); return true; }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Content-Length': fs.statSync(fp).size,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(fp).pipe(res);
    return true;
  }

  if (!ownerKey || key !== ownerKey) { send(403, { error: 'owner_key_required', message: '只有彤宝能用备份与恢复。' }); return true; }
  if (req.method !== 'POST') { send(405, { error: 'method_not_allowed' }); return true; }
  try {
    if (Number(req.headers['content-length']) > MAX_UPLOAD_BYTES) invalid('上传超过 64 MiB——大备份请直接用服务器上的导出文件恢复');
    const raw = await readRawBody(req);
    if (raw.length > MAX_UPLOAD_BYTES) invalid('上传超过 64 MiB——大备份请直接用服务器上的导出文件恢复');
    let body = {};
    if (raw.length) { try { body = JSON.parse(raw.toString('utf8')); } catch { invalid('JSON 非法'); } }

    if (urlObj.pathname === '/v1/coread-backup/export') {
      const backup = exportBackup(body.settings || {});
      // 落盘到 data/backups/，返回受保护的下载链接（UI 只存服务器不弹下载，链接备 curl/浏览器用）
      const fname = `coread-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const fpath = path.join(exportDir(), fname);
      fs.writeFileSync(fpath, JSON.stringify(backup));
      send(200, { ok: true, file: fname, url: `/v1/coread-backup/file/${fname}?key=${ownerKey}`, bytes: fs.statSync(fpath).size, counts: backup.counts, createdAt: backup.createdAt });
      return true;
    }
    if (urlObj.pathname === '/v1/coread-backup/list') {
      const files = fs.readdirSync(exportDir()).filter(f => /^coread-backup-[\dTZ-]+\.json$/.test(f))
        .map(f => { const st = fs.statSync(path.join(exportDir(), f)); return { file: f, bytes: st.size, mtime: st.mtime.toISOString() }; })
        .sort((a, b) => b.mtime.localeCompare(a.mtime)).slice(0, 10);
      send(200, { ok: true, files });
      return true;
    }
    if (urlObj.pathname === '/v1/coread-backup/delete') {
      const fname = path.basename(String(body.file || ''));
      if (!/^coread-backup-[\dTZ-]+\.json$/.test(fname)) invalid('文件名非法');
      fs.unlinkSync(path.join(exportDir(), fname));
      send(200, { ok: true });
      return true;
    }
    if (urlObj.pathname === '/v1/coread-backup/preview') {
      // body.backup 直接传备份 JSON（≤64MiB 全量深检），或 body.file 引用服务器上已导出的文件名（大备份快速通道）
      if (typeof body.file === 'string') {
        const fname = path.basename(body.file);
        if (!/^coread-backup-[\dTZ-]+\.json$/.test(fname)) invalid('文件名非法');
        const fp = path.join(exportDir(), fname);
        const st = fs.statSync(fp);
        if (st.size > MAX_BACKUP_BYTES) invalid('备份超过 600 MiB');
        send(200, previewBackupFile(fp));
        return true;
      }
      send(200, previewBackup(body.backup));
      return true;
    }
    if (urlObj.pathname === '/v1/coread-backup/restore') {
      send(200, restoreBackup(body.token, body.confirmed));
      return true;
    }
    send(404, { error: 'unknown backup endpoint' });
  } catch (e) { send(e.status || 500, { error: e.message || '备份操作失败，原数据未动' }); }
  return true;
}
