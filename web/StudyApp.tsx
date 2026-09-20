
import React, { useState, useEffect, useCallback, useRef, startTransition, useLayoutEffect, useMemo } from 'react';
import './vendor-hyalite.js';
import { useOS } from './context/OSContext';
import { fetchBooks, fetchBookDetail, fetchBookSlice, addBookComment, deleteBookComment, updateBookProgress, uploadBookFile, exportBook, deleteBook, fetchBookToc, fetchRoomDoor, setRoomDoor, ROOM_OWNER_KEY } from './utils/bridgeApi';
import { fetchBookComments } from './utils/bridgeApi';
import { pickMultipleFiles } from './utils/nativeImagePicker';

function themeColors(h: number, s: number, l: number) {
    const primary = `hsl(${h}, ${s}%, ${l}%)`;
    const primaryLight = `hsl(${h}, ${s}%, 92%)`;
    const primaryBg = `hsl(${h}, ${Math.max(s - 5, 0)}%, 96%)`;
    const primaryBorder = `hsla(${h}, ${s}%, ${l}%, 0.18)`;
    const primaryDark = `hsl(${h}, ${s}%, ${Math.max(l - 18, 20)}%)`;
    const warmAccent = `hsl(${(h + 30) % 360}, ${Math.min(s + 10, 80)}%, 72%)`;
    const warmBg = `hsl(${(h + 30) % 360}, ${Math.min(s + 10, 80)}%, 94%)`;
    const grad1 = `hsl(${h}, ${Math.max(s - 5, 0)}%, 94%)`;
    const grad2 = `hsl(${(h + 20) % 360}, ${Math.max(s - 8, 0)}%, 92%)`;
    const grad3 = `hsl(${(h + 40) % 360}, ${Math.max(s - 12, 0)}%, 95%)`;
    const shenColor = `hsl(${h}, ${Math.min(s + 5, 60)}%, ${Math.max(l - 5, 35)}%)`;
    const shenBg = `hsl(${h}, ${Math.min(s + 5, 60)}%, 93%)`;
    const tongColor = `hsl(${(h + 150) % 360}, 45%, 55%)`;
    const tongBg = `hsl(${(h + 150) % 360}, 35%, 93%)`;
    const shenHL = `hsla(${h}, ${Math.min(s + 10, 55)}%, 82%, 0.5)`;
    const tongHL = `hsla(340, 50%, 82%, 0.5)`;
    return { primary, primaryLight, primaryBg, primaryBorder, primaryDark, warmAccent, warmBg, grad1, grad2, grad3, shenColor, shenBg, tongColor, tongBg, shenHL, tongHL };
}

interface Book { id: number; title: string; total_paragraphs: number; created_at: string; current_page: number | null; comment_count: number; cover_image?: string | null; last_opened_at?: string | null; reading_status?: string | null; status?: string | null; first_finished_at?: string | null; last_finished_at?: string | null; }
interface Paragraph { idx: number; content: string; }
interface Comment { id: number; book_id: number; paragraph_idx: number; sel_end_para_idx: number | null; sel_start_idx: number | null; sel_end_idx: number | null; selected_text: string | null; from_who: string; content: string; created_at: string; reply_to: number | null; }
interface PageBreak { paraIndex: number; offset: number; }
interface PageFragment extends Paragraph { sourceIdx: number; startOffset: number; endOffset: number; isPartialStart: boolean; isPartialEnd: boolean; }
interface ReplyNotice {
    id: number;
    paragraph_idx: number;
    content: string;
    from_who?: string;
    created_at?: string;
    reply_to?: number | null;
    parent_id?: number | null;
    parent_from?: string;
    parent_content?: string;
    sel_start_idx?: number | null;
    sel_end_idx?: number | null;
    selected_text?: string | null;
    parent_paragraph_idx?: number | null;
    parent_sel_start_idx?: number | null;
    parent_sel_end_idx?: number | null;
    parent_selected_text?: string | null;
}

const BOOK_COVERS = [
    'linear-gradient(145deg, rgba(204,209,231,0.86), rgba(244,246,250,0.76))',
    'linear-gradient(145deg, rgba(231,201,213,0.86), rgba(250,244,247,0.76))',
    'linear-gradient(145deg, rgba(199,221,225,0.86), rgba(246,250,250,0.76))',
    'linear-gradient(145deg, rgba(214,225,207,0.86), rgba(248,250,245,0.76))',
    'linear-gradient(145deg, rgba(232,216,192,0.86), rgba(251,248,242,0.76))',
    'linear-gradient(145deg, rgba(212,203,230,0.86), rgba(248,246,251,0.76))',
];

const STUDY_THEME_CSS = `
.xiaowo-study {
    color: #41394f;
}
.xiaowo-study button {
    transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
}
.xiaowo-study button:active {
    transform: scale(0.98);
}
`;

// 共读室重设计 v1（2026-09-17，视觉/动效唯一权威来源 mockups/shelf-menu-mockup.html）
const INK = 'hsl(40, 8%, 16%)';
const INK2 = 'hsl(40, 5%, 48%)';
const COREAD_POP_CSS = `
.xiaowo-study {
    /* 高阻尼弹簧 ζ=0.85（无回弹、重阻尼稳态缓动，310ms 收定），弹出类控件共用 */
    --spring-pop: linear(0, 0.0086 2.8%, 0.032 5.6%, 0.0666 8.3%, 0.1095 11.1%, 0.1584 13.9%, 0.2111 16.7%, 0.266 19.4%, 0.3217 22.2%, 0.3772 25%, 0.4315 27.8%, 0.484 30.6%, 0.5343 33.3%, 0.5818 36.1%, 0.6265 38.9%, 0.6681 41.7%, 0.7066 44.4%, 0.742 47.2%, 0.7743 50%, 0.8037 52.8%, 0.8303 55.6%, 0.8542 58.3%, 0.8756 61.1%, 0.8946 63.9%, 0.9114 66.7%, 0.9262 69.4%, 0.9392 72.2%, 0.9504 75%, 0.9602 77.8%, 0.9686 80.6%, 0.9758 83.3%, 0.9819 86.1%, 0.9871 88.9%, 0.9913 91.7%, 0.9949 94.4%, 0.9978 97.2%, 1);
}
@keyframes crPopScale { from { transform: scale(0.90); border-radius: 24px; } to { transform: scale(1); border-radius: 18px; } }
@keyframes crFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes crItemIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes crDotsOut { to { opacity: 0; transform: scale(0.7); } }
@keyframes crDotsIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
@keyframes crPopClose { from { transform: scale(1); opacity: 1; border-radius: 18px; } to { transform: scale(0.95); opacity: 0; border-radius: 22px; } }
.xiaowo-study .cr-pop-anim { animation: crPopScale 310ms var(--spring-pop) both, crFade 110ms cubic-bezier(0.23, 1, 0.32, 1) both; }
.xiaowo-study .cr-pop-closing { animation: crPopClose 170ms cubic-bezier(0.23, 1, 0.32, 1) both; }
.xiaowo-study .cr-item-in { animation: crItemIn 190ms cubic-bezier(0.23, 1, 0.32, 1) both; }
.xiaowo-study .cr-dots-out { animation: crDotsOut 140ms cubic-bezier(0.23, 1, 0.32, 1) both; }
.xiaowo-study .cr-dots-in { animation: crDotsIn 160ms cubic-bezier(0.23, 1, 0.32, 1) 60ms both; }
/* 老 WebView 不支持 linear() 弹簧时回退 220ms 强 ease-out（鸿蒙兼容补，mockup 未覆盖） */
@supports not (animation-timing-function: linear(0, 1)) {
    .xiaowo-study .cr-pop-anim { animation: crPopScale 220ms cubic-bezier(0.23, 1, 0.32, 1) both, crFade 110ms cubic-bezier(0.23, 1, 0.32, 1) both; }
}
/* 面板内原地展开：grid 叠层双视图同格，容器高度由 JS 锁当前层 */
.xiaowo-study .cr-views { display: grid; grid-template-columns: minmax(0, 1fr); }
.xiaowo-study .cr-view { grid-area: 1 / 1; min-width: 0; }
.xiaowo-study .cr-view-detail { opacity: 0; visibility: hidden; }
.xiaowo-study .cr-show-detail .cr-view-list { opacity: 0; visibility: hidden; }
.xiaowo-study .cr-show-detail .cr-view-detail { opacity: 1; visibility: visible; }
/* 减弱动态：保留透明度过渡，去掉位移/缩放/弹簧 */
@media (prefers-reduced-motion: reduce) {
    .xiaowo-study .cr-pop-anim { animation: crFade 150ms ease-out both; }
    .xiaowo-study .cr-pop-closing { animation: crFade 150ms ease-out both reverse; }
    .xiaowo-study .cr-item-in { animation: none; }
    .xiaowo-study .cr-dots-out, .xiaowo-study .cr-dots-in { animation: crFade 150ms ease-out both reverse; }
}
/* ===== 内页重设计 v1（SPEC-v1.md 2026-09-17）：底部抽屉 + 遮罩 + ≡ 浮层菜单 ===== */
.xiaowo-study { --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1); --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1); }
@keyframes crMenuPop { from { transform: scale(0.90); } to { transform: scale(1); } }
@keyframes crMenuClose { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
.xiaowo-study .cr-rmenu-anim { animation: crMenuPop 310ms var(--spring-pop) both, crFade 110ms var(--ease-out-strong) both; }
.xiaowo-study .cr-rmenu-closing { animation: crMenuClose 170ms var(--ease-out-strong) both; }
@keyframes crSheetIn { from { transform: translateY(104%); } to { transform: translateY(0); } }
@keyframes crSheetOut { from { transform: translateY(0); } to { transform: translateY(104%); } }
.xiaowo-study .cr-sheet-in { animation: crSheetIn 320ms var(--ease-drawer) both; }
.xiaowo-study .cr-sheet-out { animation: crSheetOut 220ms var(--ease-out-strong) both; }
.xiaowo-study .cr-scrim-in { animation: crFade 200ms ease-out both; }
.xiaowo-study .cr-scrim-out { animation: crFade 180ms ease-out both reverse; }
@media (prefers-reduced-motion: reduce) {
    .xiaowo-study .cr-sheet-in { animation: crFade 150ms ease-out both; }
    .xiaowo-study .cr-sheet-out { animation: crFade 150ms ease-out both reverse; }
}
/* 阅读统计放射图：扇叶 stagger 淡入展开（lieflat-charts L10 Radial Patchwork 节奏） */
.xiaowo-study .cr-pw-in { animation: crFade 300ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
    .xiaowo-study .cr-pw-in { animation: none; }
}
/* ===== 入场动效补全（彤彤 2026-09-18 全界面扫描）：瞬现面板/控件的进场桥接，全部复用 --ease-out-strong =====
   cr-rise-in：底部浮层（批注浮层/批注输入/回复弹窗）淡入+上浮 10px；cr-pop-sm-c：居中 pill pop（带 translateX(-50%)）；
   cr-shelf-in：书架网格 26ms 交错入场；计时行走 inline opacity/visibility 过渡（常驻占位不增删行，避免分页重排） */
@keyframes crRiseIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes crPopSmC { from { opacity: 0; transform: translateX(-50%) scale(0.92); } to { opacity: 1; transform: translateX(-50%) scale(1); } }
@keyframes crShelfIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.xiaowo-study .cr-rise-in { animation: crRiseIn 190ms var(--ease-out-strong) both; }
.xiaowo-study .cr-pop-sm-c { animation: crPopSmC 170ms var(--ease-out-strong) both; }
.xiaowo-study .cr-shelf-in { animation: crShelfIn 240ms var(--ease-out-strong) both; }
@media (prefers-reduced-motion: reduce) {
    .xiaowo-study .cr-rise-in, .xiaowo-study .cr-pop-sm-c, .xiaowo-study .cr-shelf-in { animation: crFade 150ms ease-out both; }
}
`;

// ===== 阅读钟（移植 coread PR：只要在读就累计时长，与「阅读钟」显示开关无关；checkpoint 是 session 累计值，重试/乱序安全）=====
const READING_CKPT_PREFIX = 'coread-checkpoint:';
const READING_LEASE = 'coread-reader-owner';
function localDay(time: number): string {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// 跨本地日界切分（含 DST 日），不做活跃度/点击判定
function splitDays(start: number, end: number): { date: string; ms: number }[] {
    const parts: { date: string; ms: number }[] = [];
    while (start < end) {
        const next = new Date(start);
        next.setHours(24, 0, 0, 0);
        const stop = Math.min(end, next.getTime());
        parts.push({ date: localDay(start), ms: stop - start });
        start = stop;
    }
    return parts;
}
class ReadingClock {
    days = new Map<string, number>();
    last: number | null = null;
    total = 0;
    constructor(public session: string, public bookId: number, public startMin: number, public persist: (v: any) => void) {}
    resume(now: number) { if (this.last === null) this.last = now; }
    sample(now: number) {
        if (this.last === null) return;
        const start = this.last;
        this.last = now;
        // 挂起的 JS 运行时无法证明前台时长；睡眠 gap 永不算进阅读时间
        if (now <= start || now - start > 5000) return;
        for (const part of splitDays(start, now)) {
            const elapsed = (this.days.get(part.date) || 0) + part.ms;
            this.persist({ session_id: this.session, book_id: this.bookId, reading_date: part.date, elapsed_ms: elapsed, start_min: this.startMin });
            this.days.set(part.date, elapsed);
            this.total += part.ms;
        }
    }
    pause(now: number) { this.sample(now); this.last = null; }
}
// 计时小字：mm:ss（过小时 h:mm:ss），等宽数字不跳格
function fmtClock(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}
function fmtDuration(seconds: number): string {
    const s = Math.floor(seconds || 0);
    return s >= 3600 ? `${Math.floor(s / 3600)} 小时 ${Math.floor(s % 3600 / 60)} 分` : s >= 60 ? `${Math.floor(s / 60)} 分` : `${s} 秒`;
}

const READER_PAGE_PADDING = '56px 28px calc(24px + env(safe-area-inset-bottom))';
const READER_VERTICAL_PADDING_STATIC = 88;
function getSafeAreaBottom(): number {
    if (typeof document === 'undefined') return 0;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;bottom:0;left:0;width:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
    const h = probe.offsetHeight;
    document.body.removeChild(probe);
    return h;
}
const READER_HORIZONTAL_PADDING = 56;
const PARA_GAP = 18;
const CHAPTER_GAP_TOP = 40;
const CHAPTER_GAP_BOTTOM = 28;

// 大书（n2c6hp v4）：不做窗口化——与小书同构的全局连续视觉分页。
// 超阈值的书首开走渐进分页：分块测量（块间让出主线程不卡UI）+ 完成后写分页缓存，
// 之后打开走缓存秒开。页码/跳转/翻页体验与小书完全一致。
const PROGRESSIVE_MEASURE_THRESHOLD = 15000;
const PARA_FETCH_CHUNK = 10000;
const MEASURE_CHUNK = 1500;

// 目录行高（窗口化渲染用，固定行高才能按滚动位置直接换算可视窗口）
const TOC_ROW_H = 44;

// 后手优化：缓存miss时先分当前位置±PROVISIONAL_WIN段立即可读，全书分页后台补全
const PROVISIONAL_WIN = 2500;

// 分页缓存主存迁 IndexedDB：大书分页结果几百KB起，localStorage(5-10MB)写不下
// 或被WebView清理→每次重开都重分页（彤宝v2.2.21实测toast"无分页缓存"）。
// localStorage 只作 IDB 不可用时的后手兜底（沉哥建议、彤宝批准直接加进本版）。
const idbOpen = (): Promise<IDBDatabase | null> => new Promise((resolve) => {
    try {
        const req = indexedDB.open('study-reader-cache', 2);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('pagebreaks')) db.createObjectStore('pagebreaks');
            if (!db.objectStoreNames.contains('paragraphs')) db.createObjectStore('paragraphs');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    } catch { resolve(null); }
});
const idbGet = (key: string): Promise<string | null> =>
    idbOpen().then(db => new Promise<string | null>((resolve) => {
        if (!db) return resolve(null);
        try {
            const req = db.transaction('pagebreaks', 'readonly').objectStore('pagebreaks').get(key);
            req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
            req.onerror = () => resolve(null);
        } catch { resolve(null); }
    }));
const idbSet = (key: string, value: string): Promise<boolean> =>
    idbOpen().then(db => new Promise<boolean>((resolve) => {
        if (!db) return resolve(false);
        try {
            const tx = db.transaction('pagebreaks', 'readwrite');
            tx.objectStore('pagebreaks').put(value, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
        } catch { resolve(false); }
    }));
const idbDel = (key: string): Promise<void> =>
    idbOpen().then(db => new Promise<void>((resolve) => {
        if (!db) return resolve();
        try {
            const tx = db.transaction('pagebreaks', 'readwrite');
            tx.objectStore('pagebreaks').delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch { resolve(); }
    }));
const idbGetParas = (key: string): Promise<string | null> =>
    idbOpen().then(db => new Promise<string | null>((resolve) => {
        if (!db) return resolve(null);
        try {
            const req = db.transaction('paragraphs', 'readonly').objectStore('paragraphs').get(key);
            req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
            req.onerror = () => resolve(null);
        } catch { resolve(null); }
    }));
const idbSetParas = (key: string, value: string): Promise<boolean> =>
    idbOpen().then(db => new Promise<boolean>((resolve) => {
        if (!db) return resolve(false);
        try {
            const tx = db.transaction('paragraphs', 'readwrite');
            tx.objectStore('paragraphs').put(value, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
        } catch { resolve(false); }
    }));
const idbDelParas = (key: string): Promise<void> =>
    idbOpen().then(db => new Promise<void>((resolve) => {
        if (!db) return resolve();
        try {
            const tx = db.transaction('paragraphs', 'readwrite');
            tx.objectStore('paragraphs').delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch { resolve(); }
    }));

const StudyApp: React.FC = () => {
    const { closeApp, bridgeConfig, theme, addToast, registerBackHandler } = useOS();
    const c = themeColors(theme.hue ?? 245, theme.saturation ?? 25, theme.lightness ?? 65);

    const [mode, setMode] = useState<'shelf' | 'reading'>('shelf');
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [activeBook, setActiveBook] = useState<Book | null>(null);
    const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    // 大书首开渐进分页进度（0~1），非 null 时 loading 显示百分比
    const [paginateProgress, setPaginateProgress] = useState<number | null>(null);
    const [pageBreaks, setPageBreaks] = useState<PageBreak[]>([{ paraIndex: 0, offset: 0 }]);
    const [pageFragments, setPageFragments] = useState<PageFragment[]>([]);
    const [readingLoading, setReadingLoading] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);
    const [allParas, setAllParas] = useState<Paragraph[]>([]);
    const [allComments, setAllComments] = useState<Comment[]>([]);
    const [pageHeight, setPageHeight] = useState(0);
    const [readerSize, setReaderSize] = useState({ width: 0, height: 0 });
    const savedParaIdxRef = useRef<number | null>(null);
    const currentParaIdxRef = useRef<number | null>(null);
    // 后手优化：临时页表覆盖的段落区间（非null=全书分页仍在后台补全，窗外跳转先拦住）
    const provisionalRangeRef = useRef<{ from: number; to: number } | null>(null);

    const [commentingIdx, setCommentingIdx] = useState<number | null>(null);
    const [commentText, setCommentText] = useState('');
    const [selectedText, setSelectedText] = useState('');
    const [selRange, setSelRange] = useState<{ startPara: number; endPara: number; start: number; end: number } | null>(null);
    const [activeComments, setActiveComments] = useState<Comment[]>([]);
    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
    const [newReplies, setNewReplies] = useState<ReplyNotice[]>([]);
    const [showReplies, setShowReplies] = useState(false);
    const dismissedIdRef = useRef(0);
    const [returnPoint, setReturnPoint] = useState<{ page: number; paraIdx: number | null } | null>(null);
    const [floatingBar, setFloatingBar] = useState<{ startPara: number; endPara: number; text: string; start: number; end: number } | null>(null);

    const [showToc, setShowToc] = useState(false);
    const [tocChapters, setTocChapters] = useState<{ idx: number; page: number; title: string }[]>([]);
    const tocListRef = useRef<HTMLDivElement>(null);
    // 目录窗口化：滚动位置与视口高（只渲染可视区±缓冲，几千章不全量挂DOM）
    const [tocScrollTop, setTocScrollTop] = useState(0);
    const [tocViewH, setTocViewH] = useState(0);
    const commentsRef = useRef<Comment[]>([]);
    const allCommentsRef = useRef<Comment[]>([]);
    const suppressPageJumpRef = useRef(false);
    const replyPageRef = useRef<number | null>(null);

    const [showUpload, setShowUpload] = useState(false);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadText, setUploadText] = useState('');
    const [pdfBase64, setPdfBase64] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null); // 二进制直传用（task-1788590635271-unsysy）
    const [uploadFileName, setUploadFileName] = useState('');
    const [fileReading, setFileReading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);                              // 批量删除确认（玻璃窗，替换系统原生 confirm）
    // 备份与恢复（水无月 coread PR 移植到 SullyOS 桥，彤彤 2026-09-20）
    const [backupBusy, setBackupBusy] = useState(false);
    const [backupFiles, setBackupFiles] = useState<{ file: string; bytes: number; mtime: string }[] | null>(null);  // null=恢复列表未展开
    const [restorePreview, setRestorePreview] = useState<{ token: string; counts: any; label: string } | null>(null);
    const restoreFileRef = useRef<HTMLInputElement>(null);
    const [editMode, setEditMode] = useState(false);
    const [selectedBooks, setSelectedBooks] = useState<Set<number>>(new Set());
    const [showMenu, setShowMenu] = useState(false);
    const [manageAction, setManageAction] = useState<'delete' | 'cache' | null>(null);
    const [doorLocked, setDoorLocked] = useState(false);
    const batchFileRef = useRef<HTMLInputElement>(null);
    // 重设计 v1：⋯ 菜单 / + 面板的展开层（原地 morph 的功能页）与弹出相位
    const [menuDetail, setMenuDetail] = useState<'records' | 'manage' | 'backup' | null>(null);
    const [panelDetail, setPanelDetail] = useState<'file' | 'text' | null>(null);
    const [menuPhase, setMenuPhase] = useState<'closed' | 'anim' | 'open' | 'closing'>('closed');
    const [panelPhase, setPanelPhase] = useState<'closed' | 'anim' | 'open' | 'closing'>('closed');
    const menuRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [readerFontSize, setReaderFontSize] = useState(() => parseInt(localStorage.getItem('coread-font-size') || '14', 10));
    const [showFontPanel, setShowFontPanel] = useState(false);
    const [readerBrightness, setReaderBrightness] = useState(() => parseInt(localStorage.getItem('coread-brightness') || '100', 10));
    const [readerNightMode, setReaderNightMode] = useState(() => localStorage.getItem('coread-night-mode') === 'true');
    // coread 移植保留（彤彤点名不许丢）：人类/AI 双方改名，默认对齐 SullyOS 的 彤宝/沉。
    // 批注作者名、isShen 判色、回复提醒的兜底名全部走这两个值。
    const [humanName, setHumanName] = useState(() => localStorage.getItem('coread-human-name') || '彤宝');
    const [aiName, setAiName] = useState(() => localStorage.getItem('coread-ai-name') || '沉');
    const isAiAuthor = (who: string) => { const w = String(who || ''); const lw = w.toLowerCase(); return w === '沉' || lw === 'seth' || lw === 'ai' || (!!aiName && lw === aiName.toLowerCase()); };
    const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
    // 内页重设计 v1（SPEC-v1.md）：右下 ≡ 浮层菜单 + 玻璃抽屉族
    const [readerMenuPhase, setReaderMenuPhase] = useState<'closed' | 'anim' | 'open' | 'closing'>('closed');
    const [sheetPhase, setSheetPhase] = useState<'closed' | 'open' | 'closing'>('closed');       // 阅读设置抽屉
    const [tocPhase, setTocPhase] = useState<'closed' | 'open' | 'closing'>('closed');           // 目录抽屉
    const [allNotesPhase, setAllNotesPhase] = useState<'closed' | 'open' | 'closing'>('closed'); // 所有批注抽屉
    const [lockPhase, setLockPhase] = useState<'closed' | 'open' | 'closing'>('closed');         // 关门上锁抽屉（书架层）
    const [lockIntent, setLockIntent] = useState(true); // true=要关门 false=要开门
    const [readingClock, setReadingClock] = useState(() => localStorage.getItem('coread-reading-clock') === 'true');
    const [clockSeconds, setClockSeconds] = useState(0);                                              // 本次阅读秒数（仅显示层；计时本身不受开关影响）
    const [statsPhase, setStatsPhase] = useState<'closed' | 'open' | 'closing'>('closed');            // 阅读统计抽屉
    const [statsScope, setStatsScope] = useState<'global' | 'book'>('global');                        // 统计范围：首页⋯=全局 / 书内≡=本书
    const openStatsDrawer = (scope: 'global' | 'book') => {
        setStatsScope(scope);
        setStatsPhase('open');
        setStatsCaption(false);
        setStatsOpenSeq(s => s + 1);
        setReadingStatsLoading(true);
        const base = bridgeConfig.url.replace(/\/+$/, '');
        fetch(`${base}/v1/reading-stats?today=${localDay(Date.now())}`, { headers: bridgeConfig.key ? { 'Authorization': `Bearer ${bridgeConfig.key}` } : {} })
            .then(r => r.json()).then(d => setReadingStats(d)).catch(() => setReadingStats(null))
            .finally(() => setReadingStatsLoading(false));
    };
    const closeStatsDrawer = () => { setStatsPhase('closing'); setTimeout(() => setStatsPhase(p => p === 'closing' ? 'closed' : p), 240); };
    const [statsCaption, setStatsCaption] = useState(false);                                          // 图表说明文字：默认隐藏，点图表才显示（彤彤 2026-09-18）
    const [statsOpenSeq, setStatsOpenSeq] = useState(0);                                              // 每次打开统计抽屉 +1：内容区 remount，保证扇叶 stagger 动效每次都播（彤彤 2026-09-19 实机反馈看不到动效）
    const [readingStats, setReadingStats] = useState<any>(null);
    const [readingStatsLoading, setReadingStatsLoading] = useState(false);
    const openReaderMenu = () => { setReaderMenuPhase('anim'); setTimeout(() => setReaderMenuPhase(p => p === 'anim' ? 'open' : p), 330); };
    const closeReaderMenu = () => { setReaderMenuPhase('closing'); setTimeout(() => setReaderMenuPhase(p => p === 'closing' ? 'closed' : p), 180); };

    // 旧底栏已退役（SPEC §8）：点正文先收批注弹窗，否则唤醒/收起≡浮钮（默认隐藏不挡字）
    const [fabVisible, setFabVisible] = useState(false);
    const toggleBar = () => {
        if (activeComments.length > 0) setActiveComments([]);
        else setFabVisible(v => !v);
    };
    // 点按翻页（彤彤 2026-09-18）：左30%上一页/右30%下一页/中间唤浮钮，coread PR#1同款
    const [tapTurn, setTapTurn] = useState(() => localStorage.getItem('coread-tap-turn') === 'true');
    const suppressTapRef = useRef(false);
    const handleReaderTap = (e: React.MouseEvent<HTMLDivElement>) => {
        if (suppressTapRef.current) { suppressTapRef.current = false; return; }
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, textarea, select, [role="button"]')) return;
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim()) return;
        if (!tapTurn) { toggleBar(); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
        if (pos < 0.3) goPage(-1);
        else if (pos > 0.7) goPage(1);
        else toggleBar();
    };

    useEffect(() => { if (bridgeConfig.key) loadBooks(); else setLoading(false); }, []);

    // hyalite液态玻璃：真折射透镜（彤宝定的两组参数），非Chromium自动回退CSS雾面
    useEffect(() => {
        const H = (window as any).Hyalite;
        if (!H || !H.supported()) return;
        const shelf = H.watch(document.body, '.hy-shelf', { bevel: 37, thickness: 59, slope: 2.7, shade: 0.46, rim: 1.76, edgeW: 8, sat: 0.86, edge: 0.32, blur: 1, dispersion: 1.6, light: -140, smooth: 1 });
        const reader = H.watch(document.body, '.hy-reader', { bevel: 73, thickness: 41, slope: 1.4, shade: 0.2, rim: 0.36, edgeW: 3, sat: 0.9, edge: 0.1, blur: 4, dispersion: 2.5, light: -150, smooth: 1.25 });
        return () => { shelf.stop(); reader.stop(); };
    }, []);

    useEffect(() => {
        return registerBackHandler(() => {
            // Consume Android back from the visible top layer before leaving the reader/app.
            if (lockPhase !== 'closed') {
                if (lockPhase !== 'closing') {
                    setLockPhase('closing');
                    setTimeout(() => setLockPhase(p => p === 'closing' ? 'closed' : p), 240);
                }
                return true;
            }
            if (replyingTo) {
                setReplyingTo(null);
                setCommentingIdx(null);
                setCommentText('');
                return true;
            }
            if (commentingIdx !== null) {
                setCommentingIdx(null);
                setCommentText('');
                setSelectedText('');
                setSelRange(null);
                return true;
            }
            if (panelDetail) {
                if (!uploading) setPanelDetail(null);
                return true;
            }
            if (sheetPhase !== 'closed') {
                if (sheetPhase !== 'closing') {
                    setSheetPhase('closing');
                    setTimeout(() => setSheetPhase(p => p === 'closing' ? 'closed' : p), 240);
                }
                return true;
            }
            if (allNotesPhase !== 'closed') {
                if (allNotesPhase !== 'closing') {
                    setAllNotesPhase('closing');
                    setTimeout(() => setAllNotesPhase(p => p === 'closing' ? 'closed' : p), 240);
                }
                return true;
            }
            if (showToc) {
                if (tocPhase !== 'closing') {
                    setTocPhase('closing');
                    setTimeout(() => {
                        setShowToc(false);
                        setTocPhase('closed');
                    }, 240);
                }
                return true;
            }
            // 统计抽屉开着时右滑只关抽屉（彤彤 2026-09-19：本书统计右滑会漏出总统计——抽屉没接管返回，下层的阅读页先被退掉了）
            if (statsPhase !== 'closed') {
                if (statsPhase === 'open') closeStatsDrawer();
                return true;
            }
            if (showReplies) { setShowReplies(false); return true; }
            if (confirmDelete !== null) { setConfirmDelete(null); return true; }
            if (confirmBatchDelete) { setConfirmBatchDelete(false); return true; }
            if (restorePreview) { setRestorePreview(null); return true; }
            if (floatingBar) {
                setFloatingBar(null);
                window.getSelection()?.removeAllRanges();
                return true;
            }
            if (activeComments.length > 0) { setActiveComments([]); return true; }
            if (readerMenuPhase !== 'closed') {
                if (readerMenuPhase !== 'closing') {
                    setReaderMenuPhase('closing');
                    setTimeout(() => setReaderMenuPhase(p => p === 'closing' ? 'closed' : p), 180);
                }
                return true;
            }
            if (menuDetail) { setMenuDetail(null); return true; }
            if (menuPhase !== 'closed') { setShowMenu(false); return true; }
            if (panelPhase !== 'closed') {
                if (!uploading) setShowUpload(false);
                return true;
            }
            if (editMode) {
                setEditMode(false);
                setSelectedBooks(new Set());
                setManageAction(null);
                return true;
            }
            if (activeBook) { setActiveBook(null); setMode('shelf'); return true; }
            return false;
        });
    }, [activeBook, activeComments, allNotesPhase, commentingIdx, confirmDelete, confirmBatchDelete, restorePreview, editMode, floatingBar, lockPhase, menuDetail, menuPhase, panelDetail, panelPhase, readerMenuPhase, replyingTo, sheetPhase, showReplies, showToc, statsPhase, tocPhase, uploading, registerBackHandler]);

    // Real-time comment sync — low-priority update, no flash
    useEffect(() => { commentsRef.current = comments; }, [comments]);
    useEffect(() => { allCommentsRef.current = allComments; }, [allComments]);

    const lastCommentIds = useRef('');
    useEffect(() => {
        if (mode !== 'reading' || !activeBook) return;
        const interval = setInterval(async () => {
            try {
                // 大书：detail 接口会在后端对全书重算章节分页，改用 slice 按当前页段落范围拉批注
                const isBig = (activeBook.total_paragraphs || 0) > PROGRESSIVE_MEASURE_THRESHOLD;
                const d = isBig && pageBreaks.length > 0 && allParas.length > 0
                    ? await fetchBookSlice(bridgeConfig, activeBook.id, Number(allParas[pageBreaks[page - 1]?.paraIndex ?? 0]?.idx ?? 0), Math.max(1, (page < pageBreaks.length ? pageBreaks[page].paraIndex : allParas.length) - (pageBreaks[page - 1]?.paraIndex ?? 0) + 1))
                    : await fetchBookDetail(bridgeConfig, activeBook.id, page, Math.max(12, Math.min(28, Math.floor(((window.innerHeight || 700) - 120) / 26))));
                if (d.comments) {
                    const newIds = d.comments.map((c: any) => c.id).join(',');
                    if (newIds !== lastCommentIds.current) {
                        lastCommentIds.current = newIds;
                        startTransition(() => {
                            const mergeComments = (prev: Comment[]) => {
                                const merged = new Map(prev.map(c => [c.id, c]));
                                d.comments.forEach((cmt: Comment) => {
                                    const tempDup = Array.from(merged.values()).find(c => c.id !== cmt.id && c.content === cmt.content && c.from_who === cmt.from_who && c.paragraph_idx === cmt.paragraph_idx && c.reply_to === cmt.reply_to && Math.abs(new Date(c.created_at).getTime() - new Date(cmt.created_at).getTime()) < 10000);
                                    if (tempDup) {
                                        for (const [, v] of merged) { if (v.reply_to === tempDup.id) v.reply_to = cmt.id; }
                                        merged.delete(tempDup.id);
                                    }
                                    merged.set(cmt.id, cmt);
                                });
                                return Array.from(merged.values());
                            };
                            setAllComments(mergeComments);
                            setComments(mergeComments);
                        });
                    }
                }
            } catch {}
        }, 3000);
        return () => clearInterval(interval);
    }, [mode, activeBook?.id, page, pageBreaks, allParas]);

    // Poll for new replies from 沉
    useEffect(() => {
        if (mode !== 'reading' || !activeBook) return;
        dismissedIdRef.current = parseInt(localStorage.getItem(`book-${activeBook.id}-last-seen`) || '0');
        const check = async () => {
            try {
                const lastSeen = parseInt(localStorage.getItem(`book-${activeBook.id}-last-seen`) || '0');
                const base = bridgeConfig.url.replace(/\/+$/, '');
                const r = await fetch(`${base}/v1/books/${activeBook.id}/new-replies?since=${lastSeen}`, {
                    headers: bridgeConfig.key ? { 'Authorization': `Bearer ${bridgeConfig.key}` } : {},
                });
                if (r.ok) {
                    const d = await r.json();
                    const filtered = (d.replies || []).filter((r: any) => r.id > dismissedIdRef.current);
                    setNewReplies(filtered.length ? filtered : []);
                }
            } catch {}
        };
        check();
        const interval = setInterval(check, 5000);
        return () => clearInterval(interval);
    }, [mode, activeBook?.id]);

    const dismissReplies = () => {
        if (activeBook && newReplies.length) {
            const maxId = Math.max(...newReplies.map(r => r.id));
            dismissedIdRef.current = maxId;
            localStorage.setItem(`book-${activeBook.id}-last-seen`, String(maxId));
        }
        setNewReplies([]);
        setShowReplies(false);
    };

    // 翻到最后一页自动标读完（对齐 coread，彤彤 2026-09-20 补缺；每本书每次开书最多一次，已读完不重复打）
    const autoFinishRef = useRef<number | null>(null);
    useEffect(() => {
        if (mode !== 'reading' || !activeBook || !bridgeConfig.url) return;
        if (totalPages <= 1 || page < totalPages) return;
        if (autoFinishRef.current === activeBook.id) return;
        if ((activeBook as any)?.reading_status === 'finished') return;
        autoFinishRef.current = activeBook.id;
        fetch(`${bridgeConfig.url}/v1/books/${activeBook.id}/finish`, { method: 'POST' }).catch(() => {});
    }, [mode, activeBook, page, totalPages, bridgeConfig.url]);

    // ===== 阅读钟计时（彤彤 2026-09-18：「阅读钟」开关只管显不显示，后台时长照常累计）=====
    // 前台心跳 1s；挂起/失焦/切后台立即 pause；checkpoint 先落 localStorage，每 5s 补发服务器，断网不丢
    useEffect(() => {
        const bookId = activeBook?.id || null;
        const reading = mode === 'reading' && !!bookId && !readingLoading && allParas.length > 0;
        setClockSeconds(0);
        if (!reading || !bookId || !bridgeConfig.url) return;
        const base = bridgeConfig.url.replace(/\/+$/, '');
        const headers: any = { 'Content-Type': 'application/json', ...(bridgeConfig.key ? { 'Authorization': `Bearer ${bridgeConfig.key}` } : {}) };
        let generation = localStorage.getItem('coread-library-generation');
        let invalidated = false;
        fetch(`${base}/v1/reading-state`, { headers }).then(r => r.json()).then(state => {
            if (generation && generation !== state.generation) { invalidated = true; return; }
            generation = state.generation;
            localStorage.setItem('coread-library-generation', generation!);
        }).catch(() => {});
        // 先补发本地滞留的 checkpoint（上次断网/杀进程留下的）
        const flush = async () => {
            const keys = Object.keys(localStorage).filter(k => k.startsWith(READING_CKPT_PREFIX));
            for (const key of keys) {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                try {
                    const value = JSON.parse(raw);
                    const r = await fetch(`${base}/v1/books/${value.book_id}/reading-time`, { method: 'POST', headers, body: JSON.stringify(value) });
                    if (r.status === 409) { invalidated = true; return; }
                    // 旧请求在途期间不抹掉更新的 checkpoint
                    if (r.ok && localStorage.getItem(key) === raw) localStorage.removeItem(key);
                } catch { /* 留在本地，下个心跳再补 */ }
            }
        };
        void flush();
        const now0 = Date.now();
        const owner = (crypto as any).randomUUID?.() || `${now0}-${Math.random().toString(36).slice(2)}`;
        const startMin = new Date(now0).getHours() * 60 + new Date(now0).getMinutes();
        const clock = new ReadingClock(owner, bookId, startMin, (value) => {
            try { localStorage.setItem(`${READING_CKPT_PREFIX}${owner}:${value.reading_date}`, JSON.stringify({ ...value, generation })); } catch {}
        });
        let active = false;
        let ticks = 0;
        const pause = () => {
            clock.pause(Date.now());
            setClockSeconds(Math.round(clock.total / 1000));
            active = false;
            try { if (JSON.parse(localStorage.getItem(READING_LEASE) || 'null')?.owner === owner) localStorage.removeItem(READING_LEASE); } catch {}
            void flush();
        };
        const tick = () => {
            if (invalidated || document.visibilityState !== 'visible' || !document.hasFocus()) { pause(); return; }
            try {
                const now = Date.now();
                const lease = JSON.parse(localStorage.getItem(READING_LEASE) || 'null');
                // 另一个窗口持有阅读租约时，本窗口不计时（防双开双计）
                if (lease && lease.owner !== owner && lease.until > now) { clock.last = null; active = false; return; }
                localStorage.setItem(READING_LEASE, JSON.stringify({ owner, until: now + 2500 }));
                if (!active) { clock.resume(now); active = true; }
                clock.sample(now);
                setClockSeconds(Math.round(clock.total / 1000));
                if (++ticks % 5 === 0) void flush();
            } catch { clock.last = null; active = false; }
        };
        const onVis = () => (document.visibilityState === 'visible' ? tick() : pause());
        tick();
        const timer = window.setInterval(tick, 1000);
        document.addEventListener('visibilitychange', onVis);
        window.addEventListener('blur', pause);
        window.addEventListener('focus', tick);
        window.addEventListener('pagehide', pause);
        window.addEventListener('pageshow', tick);
        window.addEventListener('online', tick);
        return () => {
            clearInterval(timer); pause();
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('blur', pause);
            window.removeEventListener('focus', tick);
            window.removeEventListener('pagehide', pause);
            window.removeEventListener('pageshow', tick);
            window.removeEventListener('online', tick);
        };
    }, [mode, activeBook?.id, readingLoading, allParas.length > 0, bridgeConfig.url, bridgeConfig.key]);

    const findPageForParaIdx = (paraIdx: number, maxPages = totalPages, charOffset = 0) => {
        const targetParaIdx = Number(paraIdx);
        const targetOffset = Number(charOffset) || 0;
        let paraIndex = allParas.findIndex(p => Number(p.idx) === targetParaIdx);
        if (paraIndex < 0) paraIndex = allParas.findIndex(p => Number(p.idx) >= targetParaIdx);
        if (paraIndex < 0) return -1;

        const lastPage = Math.min(maxPages, pageBreaks.length) - 1;
        // 二分：breaks 按 (paraIndex, offset) 单调递增；大书目录几千章逐个换算页码，线性扫会卡
        let lo = 0, hi = lastPage, ans = 0;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const br = pageBreaks[mid];
            if (br.paraIndex < paraIndex || (br.paraIndex === paraIndex && br.offset <= targetOffset)) { ans = mid; lo = mid + 1; }
            else hi = mid - 1;
        }
        return ans;
    };

    // 统一跳段入口：按全书视觉分页表定位段落所在页
    const jumpToParagraph = (idx: number, charOffset = 0) => {
        // 后台补全分页中：临时页表只覆盖当前位置附近，窗外目标等全书分页完成再跳
        const pr = provisionalRangeRef.current;
        if (pr) {
            const tpi = allParas.findIndex(p => Number(p.idx) >= Number(idx));
            if (tpi < 0 || tpi < pr.from || tpi >= pr.to) { addToast?.('全书分页后台补全中，完成后再跳'); return; }
        }
        const tp = findPageForParaIdx(idx, totalPages, charOffset);
        if (tp >= 0) setPage(tp + 1);
    };

    const resolveNoticeTarget = (notice: ReplyNotice, pool: Comment[]) => {
        const existing = pool.find(c => c.id === notice.id);
        const replyTo = notice.reply_to ?? notice.parent_id ?? existing?.reply_to ?? null;
        const parent = replyTo ? pool.find(c => c.id === replyTo) : null;
        const target = parent || existing;
        const fallbackPara = Number(notice.parent_paragraph_idx ?? notice.paragraph_idx);
        const fallbackOffset = Number(notice.parent_sel_start_idx ?? notice.sel_start_idx);
        return {
            existing,
            replyTo,
            parent,
            paraIdx: Number(target?.paragraph_idx ?? fallbackPara),
            offset: Number.isFinite(Number(target?.sel_start_idx)) ? Number(target?.sel_start_idx) : (Number.isFinite(fallbackOffset) ? fallbackOffset : 0),
        };
    };

    const rememberReturnPoint = () => {
        setReturnPoint(prev => prev || { page, paraIdx: currentParaIdxRef.current ?? paragraphs[0]?.idx ?? null });
    };

    const returnToReadingPosition = () => {
        if (!returnPoint) return;
        setActiveComments([]);
        setShowReplies(false);
        if (returnPoint.paraIdx != null) jumpToParagraph(returnPoint.paraIdx);
        else setPage(Math.max(1, Math.min(totalPages, returnPoint.page)));
        setReturnPoint(null);
    };

    const openReplyNotice = (notice: ReplyNotice) => {
        rememberReturnPoint();
        setShowReplies(false);
        const pool = Array.from(new Map([...allCommentsRef.current, ...commentsRef.current].map(c => [c.id, c])).values());
        const { existing, replyTo, parent, paraIdx: targetParaIdx, offset: targetOffset } = resolveNoticeTarget(notice, pool);
        jumpToParagraph(targetParaIdx, targetOffset);
        const noticeComment: Comment = existing || {
            id: notice.id,
            book_id: activeBook?.id ?? 0,
            paragraph_idx: targetParaIdx,
            sel_end_para_idx: null,
            sel_start_idx: targetOffset,
            sel_end_idx: notice.parent_sel_end_idx ?? notice.sel_end_idx ?? null,
            selected_text: notice.parent_selected_text ?? notice.selected_text ?? null,
            from_who: notice.from_who || aiName,
            content: notice.content,
            created_at: notice.created_at || new Date().toISOString(),
            reply_to: replyTo,
        };
        const thread = parent
            ? [parent, ...pool.filter(c => c.reply_to === parent.id || c.id === noticeComment.id)]
            : [noticeComment];
        setActiveComments(thread.some(c => c.id === noticeComment.id) ? thread : [...thread, noticeComment]);
        if (!existing) {
            setComments(prev => prev.some(c => c.id === noticeComment.id) ? prev : [...prev, noticeComment]);
            setAllComments(prev => prev.some(c => c.id === noticeComment.id) ? prev : [...prev, noticeComment]);
        }
    };

    // Selection change listener for floating annotation bar
    useEffect(() => {
        if (mode !== 'reading') return;
        const findPara = (n: Node): HTMLElement | null => {
            let el: HTMLElement | null = (n.nodeType === Node.TEXT_NODE ? n.parentElement : n) as HTMLElement;
            while (el && !(el as any).dataset?.paraIdx) el = el.parentElement;
            return el;
        };
        const handler = () => {
            const sel = window.getSelection();
            if (!sel || !sel.toString().trim() || sel.rangeCount === 0) { setFloatingBar(null); return; }
            const range = sel.getRangeAt(0);
            const startEl = findPara(range.startContainer);
            const endEl = findPara(range.endContainer);
            if (!startEl || !endEl) { setFloatingBar(null); return; }

            const startPara = parseInt((startEl as any).dataset.paraIdx);
            const endPara = parseInt((endEl as any).dataset.paraIdx);
            const text = sel.toString().trim();
            try {
                const pre1 = document.createRange();
                pre1.selectNodeContents(startEl);
                pre1.setEnd(range.startContainer, range.startOffset);
                const startBase = parseInt((startEl as any).dataset.fragStart || '0');
                const endBase = parseInt((endEl as any).dataset.fragStart || '0');
                const startOff = startBase + pre1.toString().length;

                let endOff: number;
                if (startPara === endPara) {
                    endOff = startOff + text.length;
                } else {
                    const pre2 = document.createRange();
                    pre2.selectNodeContents(endEl);
                    pre2.setEnd(range.endContainer, range.endOffset);
                    endOff = endBase + pre2.toString().length;
                }
                setFloatingBar({ startPara, endPara, text, start: startOff, end: endOff });
            } catch { setFloatingBar(null); }
        };
        document.addEventListener('selectionchange', handler);
        return () => document.removeEventListener('selectionchange', handler);
    }, [mode]);

    const loadBooks = async () => {
        setLoading(true); setError('');
        try { const d = await fetchBooks(bridgeConfig); setBooks(d.books || []); }
        catch (e: any) { setError(e.message); }
        setLoading(false);
        loadDoor();
    };

    // 关门锁状态（彤宝 2026-08-06 防沉迷）：锁上后哥哥侧无法开门读书
    const loadDoor = async () => {
        try { const d = await fetchRoomDoor(bridgeConfig); setDoorLocked(!!d.locked); } catch {}
    };

    // 系统confirm弹窗换半屏玻璃抽屉（SPEC-v1 §6，工单task-1789656188891-dunluk）
    const toggleDoor = () => {
        setLockIntent(!doorLocked);
        setLockPhase('open');
        setShowMenu(false);
    };
    const closeLockDrawer = () => { setLockPhase('closing'); setTimeout(() => setLockPhase(p => p === 'closing' ? 'closed' : p), 240); };
    const confirmDoor = async () => {
        try {
            const d = await setRoomDoor(bridgeConfig, lockIntent);
            setDoorLocked(!!d.locked);
            addToast?.(d.locked ? '已关门上锁 🔒' : '已开门 🔓');
        } catch (e: any) { addToast?.(`操作失败: ${e.message}`); }
        closeLockDrawer();
    };

    const openBook = async (book: Book) => {
        if (!localStorage.getItem('pagebreaks-cache-fixed-v1')) { try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('pagebreaks-')) localStorage.removeItem(k); } localStorage.setItem('pagebreaks-cache-fixed-v1', '1'); } catch {} }
        // 彤彤前端阅读位置用本机同步锚点（task-1789841576546-9e9u0t）：localStorage 即时可读，不等批注/分页请求；
        // 后端 tongbao 行仅作迁移兜底，绝不读哥哥的后端独立进度
        let frontProgress = book.current_page ?? 0;
        try { const saved = localStorage.getItem(`coread-front-progress-v1-${book.id}`); if (saved !== null && Number.isFinite(Number(saved))) frontProgress = Math.max(0, Number(saved)); } catch {}
        savedParaIdxRef.current = frontProgress;
        setActiveBook(book); setMode('reading');
        if (bridgeConfig.url) { fetch(`${bridgeConfig.url}/v1/books/${book.id}/open`, { method: 'POST' }).catch(() => {}); }
        setReadingLoading(true);
        setPage(1); setTotalPages(1); setPageBreaks([{ paraIndex: 0, offset: 0 }]); setPageFragments([]); setPaginateProgress(null);
        setParagraphs([]); setComments([]); setAllParas([]); setAllComments([]);
        currentParaIdxRef.current = null;
        provisionalRangeRef.current = null;
        if (bridgeConfig.url) {
            const bookTitle = book.title?.replace(/\s*\(.*?\)\s*/g, '').trim();
            fetch(`${bridgeConfig.url}/v1/reading-wishlist`).then(r => r.json()).then(res => {
                const match = (res.items || []).find((w: any) => w.status === 'want' && w.title?.trim() === bookTitle);
                if (match) {
                    fetch(`${bridgeConfig.url}/v1/reading-wishlist`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: match.id, title: match.title, author: match.author, reason: match.reason, status: 'reading' }),
                    }).catch(() => {});
                }
            }).catch(() => {});
        }
        try {
            const totalParas = Math.max(1, book.total_paragraphs || 0);
            const paraCacheKey = `paras-v1-${book.id}`;
            let cacheHit = false;
            const commentCacheKey = `comments-v1-${book.id}`;
            try {
                const cached = await idbGetParas(paraCacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed.totalParas === totalParas && Array.isArray(parsed.paragraphs) && parsed.paragraphs.length > 0) {
                        setAllParas(parsed.paragraphs);
                        const cachedComments = await idbGetParas(commentCacheKey);
                        let comments = cachedComments ? JSON.parse(cachedComments) : [];
                        try {
                            const fresh = await fetchBookComments(bridgeConfig, book.id);
                            comments = fresh.comments || [];
                            idbSetParas(commentCacheKey, JSON.stringify(comments)).catch(() => {});
                        } catch {}
                        setAllComments(comments);
                        setComments(comments);
                        cacheHit = true;
                    }
                }
            } catch {}
            if (!cacheHit) {
                const rawParas: Paragraph[] = [];
                const fetchedComments: Comment[] = [];
                const seenCommentIds = new Set<number>();
                for (let start = 0; start < totalParas; start += PARA_FETCH_CHUNK) {
                    const d = await fetchBookSlice(bridgeConfig, book.id, start, PARA_FETCH_CHUNK);
                    rawParas.push(...(d.paragraphs || []));
                    for (const cmt of (d.comments || []) as Comment[]) {
                        if (!seenCommentIds.has(cmt.id)) { seenCommentIds.add(cmt.id); fetchedComments.push(cmt); }
                    }
                    if ((d.paragraphs || []).length < PARA_FETCH_CHUNK) break;
                }
                const isEpubJunk = (s: string) => /^(1UR057|Cover|封面|插图|导航|书名页|制作信息|Contents|[A-Z0-9]{3,10}(-\d+)?)$/.test(s.trim());
                const allP: Paragraph[] = rawParas.filter((p: Paragraph) => !isEpubJunk(p.content));
                const tocRe = /^(#\s*)?目录$/;
                const chRe = /^(第[\d一二三四五六七八九十百千万]+[章节回部篇]|序章|序$|终章|后记|尾声|附录|解说)/;
                let tocZone = false;
                const filtered = allP.filter(p => {
                    const t = p.content.trim();
                    if (tocRe.test(t)) { tocZone = true; return false; }
                    if (tocZone) { if (chRe.test(t) || t === '') return false; tocZone = false; }
                    return true;
                });
                setAllParas(filtered);
                setAllComments(fetchedComments);
                setComments(fetchedComments);
                if (filtered.length === 0) setReadingLoading(false);
                idbSetParas(paraCacheKey, JSON.stringify({ paragraphs: filtered, totalParas })).catch(() => {});
                idbSetParas(`comments-v1-${book.id}`, JSON.stringify(fetchedComments)).catch(() => {});
            }
        } catch (e: any) { addToast?.(`加载失败: ${e.message}`); setReadingLoading(false); }
        fetchBookToc(bridgeConfig, book.id).then(d => setTocChapters(d.chapters || [])).catch(() => {});
    };

    useLayoutEffect(() => {
        if (mode !== 'reading' || !contentRef.current) return;
        const el = contentRef.current;
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const width = Math.round(el.clientWidth);
                const height = Math.max(0, Math.round(el.clientHeight - READER_VERTICAL_PADDING_STATIC - getSafeAreaBottom()));
                setReaderSize(prev => {
                    if (prev.width === width && prev.height === height) return prev;
                    if (prev.height > 0 && height < prev.height * 0.8 && width === prev.width) return prev;
                    return { width, height };
                });
            });
        };
        update();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
        ro?.observe(el);
        window.addEventListener('resize', update);
        return () => {
            cancelAnimationFrame(frame);
            ro?.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [mode]);

    const readerContentWidth = Math.max(1, readerSize.width - READER_HORIZONTAL_PADDING);

    // 同书只存一份分页缓存，value里带测量时的尺寸，读取时容差校验。
    // 不能把精确像素拼进key：手机WebView每次打开视口差±几px，key永远miss，
    // 导致每次进书全书重新measure（彤宝2026-06-10报的"分页卡好一会儿"）。
    const paginationCacheKey = activeBook ? `pagebreaks-v3-${activeBook.id}-fs${readerFontSize}` : '';
    const imgHeightCache = useRef<Map<string, number>>(new Map());

    const buildMeasureBlock = (para: Paragraph, sourceIdx: number, start: number, end: number) => {
        const heading = isHeading(para.content);
        const chapterTitle = isChapterStart(para.content);
        const outer = document.createElement('div');
        outer.style.marginTop = `${chapterTitle && start === 0 && sourceIdx > 0 ? CHAPTER_GAP_TOP : 0}px`;
        outer.style.marginBottom = `${chapterTitle ? CHAPTER_GAP_BOTTOM : PARA_GAP}px`;

        const imgMatch = para.content.match(/^\[IMG:([^\]]+)\]$/);
        if (imgMatch && start === 0) {
            const imgMaxH = Math.floor(readerSize.height * 0.6);
            const cachedH = imgHeightCache.current.get(imgMatch[1]);
            const h = cachedH ? Math.min(cachedH, imgMaxH) : imgMaxH;
            const imgEl = document.createElement('div');
            imgEl.style.height = `${h}px`;
            imgEl.style.width = '100%';
            outer.appendChild(imgEl);
        } else {
            const displayText = stripHeading(para.content).slice(start, end);
            const inner = document.createElement('div');
            inner.textContent = displayText || ' ';
            inner.style.fontSize = `${chapterTitle ? readerFontSize + 4 : para.content.trim().startsWith('# ') ? readerFontSize + 3 : para.content.trim().startsWith('## ') ? readerFontSize + 2 : readerFontSize}px`;
            inner.style.lineHeight = String(chapterTitle ? 2.2 : 1.85);
            inner.style.letterSpacing = `${chapterTitle ? 1 : 0.3}px`;
            inner.style.textIndent = heading || chapterTitle || start > 0 ? '0' : '1.5em';
            inner.style.fontWeight = String(chapterTitle ? 800 : heading ? 700 : 400);
            inner.style.textAlign = chapterTitle ? 'center' : '';
            inner.style.whiteSpace = 'pre-wrap';
            // 长连写英文/串（版权行、邮箱串）必须允许折断，渲染层同款（彤彤 2026-09-20 实机：字超出右缘）
            inner.style.overflowWrap = 'anywhere';
            inner.style.wordBreak = 'break-word';
            outer.appendChild(inner);
        }


        return outer;
    };

    useEffect(() => {
        if (mode !== 'reading' || !measureRef.current || allParas.length === 0 || readerContentWidth <= 1 || readerSize.height <= 0) return;
        let cancelled = false;
        const run = async () => {
            await (document.fonts as any)?.ready?.catch(() => {});
            await new Promise<void>(r => requestAnimationFrame(() => r()));
            if (cancelled || !measureRef.current) return;

            if (activeBook && allParas.length <= PROGRESSIVE_MEASURE_THRESHOLD) {
                const imgParas = allParas.filter(p => /^\[IMG:([^\]]+)\]$/.test(p.content));
                const loadPromises = imgParas.map(p => {
                    const m = p.content.match(/^\[IMG:([^\]]+)\]$/);
                    if (!m || imgHeightCache.current.has(m[1])) return Promise.resolve();
                    return new Promise<void>(resolve => {
                        const img = new Image();
                        img.onload = () => {
                            const maxW = readerContentWidth;
                            const maxH = Math.floor(readerSize.height * 0.6);
                            const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
                            imgHeightCache.current.set(m![1], img.naturalHeight * scale);
                            resolve();
                        };
                        img.onerror = () => resolve();
                        img.src = `${bridgeConfig.url}/v1/book-images/${activeBook!.id}/${m[1]}`;
                    });
                });
                await Promise.all(loadPromises);
            }
            if (cancelled || !measureRef.current) return;

            const measurer = measureRef.current;
            measurer.innerHTML = '';
            measurer.style.width = `${readerContentWidth}px`;
            const maxHeight = readerSize.height;
            setPageHeight(maxHeight);
            const progressive = allParas.length > PROGRESSIVE_MEASURE_THRESHOLD;
            provisionalRangeRef.current = null;

            // 后手优化判定（彤宝2026-08-06：首开等约1分钟太久）——缓存miss且锚点够靠后时，
            // 先快速分当前位置±PROVISIONAL_WIN段的临时页立即可读，全书分页随后照常从0跑完后替换
            const anchorIdx0 = savedParaIdxRef.current ?? currentParaIdxRef.current ?? allParas[0]?.idx ?? 0;
            const anchorPi0 = allParas.findIndex(p => p.idx >= anchorIdx0);
            const useProvisional = progressive && !suppressPageJumpRef.current && anchorPi0 > PROVISIONAL_WIN;

            // Try cache first（IndexedDB 主存；localStorage 里的旧缓存读出后迁移进IDB）
            if (paginationCacheKey) {
                try {
                    let cached = await idbGet(paginationCacheKey);
                    if (cancelled) return;
                    if (!cached) {
                        cached = localStorage.getItem(paginationCacheKey);
                        if (cached) idbSet(paginationCacheKey, cached);
                    }
                    if (cached) {
                        const { breaks: cachedBreaks, paraCount, width: cw, height: ch } = JSON.parse(cached);
                        // 尺寸容差：宽±2px严格（影响断行）；高±80px宽松——高度只影响每页容量/页尾留白，
                        // 大书重测要约1分钟，手机WebView每次打开视口抖几十px不该触发重分页
                        const sizeOk = typeof cw === 'number' && typeof ch === 'number'
                            && Math.abs(cw - readerContentWidth) <= 2 && Math.abs(ch - readerSize.height) <= 80;
                        if (sizeOk && paraCount === allParas.length && Array.isArray(cachedBreaks) && cachedBreaks.length > 0) {
                            setPageBreaks(cachedBreaks);
                            setTotalPages(Math.max(1, cachedBreaks.length));
                            if (!suppressPageJumpRef.current) {
                                const anchorIdx = savedParaIdxRef.current ?? currentParaIdxRef.current ?? allParas[0]?.idx ?? 0;
                                const pi = allParas.findIndex(p => p.idx >= anchorIdx);
                                let targetPage = 0;
                                if (pi >= 0) { for (let i = cachedBreaks.length - 1; i >= 0; i--) if (cachedBreaks[i].paraIndex <= pi) { targetPage = i; break; } }
                                setPage(Math.max(1, Math.min(cachedBreaks.length, targetPage + 1)));
                                if (pi >= 0) currentParaIdxRef.current = allParas[pi]?.idx ?? currentParaIdxRef.current;
                            }
                            savedParaIdxRef.current = null;
                            setReadingLoading(false);
                            return;
                        }
                        // 排查期：有缓存但没命中时告知原因（确认修复后可移除）
                        if (progressive) {
                            addToast?.(`分页缓存未命中(宽${cw}→${readerContentWidth} 高${ch}→${readerSize.height} 段${paraCount}→${allParas.length})`);
                        }
                    } else if (progressive) {
                        addToast?.(useProvisional ? '无分页缓存，先打开当前位置，后台补全全书' : '无分页缓存，将完整分页一次');
                    }
                } catch {}
            }

            const breaks: PageBreak[] = [{ paraIndex: 0, offset: 0 }];

            // 连续排版 → 每块一次 layout，之后几何读取走缓存（layout 干净时读 rect 零 reflow）。
            // 旧算法逐段试塞，每段一次同步reflow，几千段=首开十几秒。
            // 切点全部落在行边界，所以续段在下一页重排时断行不变，几何坐标保持连续。
            // 大书（>PROGRESSIVE_MEASURE_THRESHOLD 段）分块挂载测量：块间让出主线程并更新进度，
            // 避免十几万段一次性 append 的内存峰值与长时间卡死；跨块用锚点段对齐逻辑纵坐标。
            const chapterTopGap = (i: number) =>
                isChapterStart(allParas[i].content) && i > 0 ? CHAPTER_GAP_TOP : 0;

            const measureRange = document.createRange();

            let blocks: HTMLElement[] = [];
            let blockRects: DOMRect[] = [];
            let chunkBase = 0;    // 当前块首段的数组下标
            let blockOffset = 0;  // 锚点段占位（1）或无（0）
            let rectShift = 0;    // 逻辑纵坐标 = DOM rect 读数 + rectShift
            let chunkEnd = 0;     // 当前块末段下标（不含）

            const blockIdx = (i: number) => i - chunkBase + blockOffset;
            const rectBottom = (i: number) => blockRects[blockIdx(i)].bottom + rectShift;
            const rectTop = (i: number) => blockRects[blockIdx(i)].top + rectShift;

            // 挂载 [from, from+MEASURE_CHUNK) 的测量块；anchorIdx=上一块末段（保留在容器顶做新旧坐标系对齐）
            const mountChunk = (from: number, anchorIdx: number | null, anchorLogicalBottom: number | null) => {
                measurer.innerHTML = '';
                blocks = [];
                if (anchorIdx != null && anchorIdx >= 0 && anchorIdx < from) {
                    const t0 = stripHeading(allParas[anchorIdx].content);
                    blocks.push(buildMeasureBlock(allParas[anchorIdx], anchorIdx, 0, t0.length));
                }
                blockOffset = blocks.length;
                const to = Math.min(allParas.length, from + MEASURE_CHUNK);
                for (let i = from; i < to; i++) {
                    const t = stripHeading(allParas[i].content);
                    blocks.push(buildMeasureBlock(allParas[i], i, 0, t.length));
                }
                for (const b of blocks) measurer.appendChild(b);
                blockRects = blocks.map(b => b.getBoundingClientRect());
                chunkBase = from;
                if (anchorIdx != null && anchorLogicalBottom != null && blockRects.length > 0) {
                    rectShift = anchorLogicalBottom - blockRects[0].bottom;
                }
            };

            const innerTextNode = (i: number): Text | null => {
                const inner = blocks[blockIdx(i)]?.firstElementChild;
                const node = inner?.firstChild;
                return node && node.nodeType === Node.TEXT_NODE ? (node as Text) : null;
            };

            // 前o个字符的包络底（逻辑纵坐标，单调递增），layout干净时读rect零reflow
            const bottomAt = (textNode: Text, o: number) => {
                measureRange.setStart(textNode, 0);
                measureRange.setEnd(textNode, Math.min(o, textNode.length));
                return measureRange.getBoundingClientRect().bottom + rectShift;
            };
            // 排满到limitY的最大行尾offset；一行都放不下返回0
            const lineCut = (i: number, limitY: number): number => {
                const textNode = innerTextNode(i);
                if (!textNode || textNode.length === 0) return 0;
                const len = textNode.length;
                if (bottomAt(textNode, len) <= limitY) return len;
                let lo = 1, hi = len, best = 0;
                while (lo <= hi) {
                    const mid = (lo + hi) >> 1;
                    if (bottomAt(textNode, mid) <= limitY) { best = mid; lo = mid + 1; }
                    else hi = mid - 1;
                }
                return best;
            };

            // 段 i 不在已挂载块内时换块：保留 i-1 段做锚点，逻辑纵坐标无缝接续；大书块间让出主线程
            const ensureChunk = async (i: number): Promise<boolean> => {
                if (i >= allParas.length || i < chunkEnd) return true;
                const anchorLogicalBottom = i > 0 ? rectBottom(i - 1) : 0;
                if (progressive) {
                    setPaginateProgress(Math.min(0.99, i / allParas.length));
                    await new Promise<void>(r => setTimeout(r, 0));
                    if (cancelled || !measureRef.current) return false;
                }
                mountChunk(i, i > 0 ? i - 1 : null, anchorLogicalBottom);
                chunkEnd = i + blocks.length - blockOffset;
                return true;
            };

            // 后手优化：临时页只按段界切（不做段中切分），与最终页表允许有出入，很快会被全书分页替换
            let provisionalShown = false;
            if (useProvisional) {
                const wFrom = anchorPi0 - PROVISIONAL_WIN;
                const wTo = Math.min(allParas.length, anchorPi0 + PROVISIONAL_WIN);
                const wb: PageBreak[] = [{ paraIndex: wFrom, offset: 0 }];
                let i = wFrom;
                let wCursor = 0;
                let wGuard = 0;
                while (i < wTo && wGuard++ < 10000) {
                    if (i >= chunkEnd) {
                        mountChunk(i, i > wFrom ? i - 1 : null, i > wFrom ? rectBottom(i - 1) : 0);
                        chunkEnd = i + blocks.length - blockOffset;
                        if (i === wFrom) wCursor = rectTop(wFrom) - chapterTopGap(wFrom);
                        await new Promise<void>(r => setTimeout(r, 0)); // 块间让出主线程
                        if (cancelled || !measureRef.current) return;
                        continue;
                    }
                    const limitY = wCursor + maxHeight + 1;
                    let pageHasContent = false;
                    while (i < chunkEnd && i < wTo) {
                        if (i > wFrom && isChapterStart(allParas[i].content) && pageHasContent) break;
                        if (rectBottom(i) <= limitY) { i++; pageHasContent = true; continue; }
                        // 整段/图片放不下：空页硬放（防死循环），否则推下一页
                        if (!pageHasContent) { i++; }
                        break;
                    }
                    if (i >= wTo || i >= chunkEnd) continue;
                    if (wb[wb.length - 1].paraIndex === i) break; // 没推进，防死循环
                    wb.push({ paraIndex: i, offset: 0 });
                    wCursor = rectTop(i) - chapterTopGap(i);
                }
                if (wb.length > 1) {
                    provisionalShown = true;
                    provisionalRangeRef.current = { from: wFrom, to: wTo };
                    setPageBreaks(wb);
                    setTotalPages(Math.max(1, wb.length));
                    let tp = 0;
                    for (let k = wb.length - 1; k >= 0; k--) { if (wb[k].paraIndex <= anchorPi0) { tp = k; break; } }
                    setPage(tp + 1);
                    savedParaIdxRef.current = null; // 锚点已用掉，全书分页完成时按实时阅读位置重映射
                    setReadingLoading(false); // 立即可读；全书分页下面照常跑
                }
            }

            let pi = 0, off = 0;
            mountChunk(0, null, null);
            chunkEnd = blocks.length;
            let cursorY = blocks.length ? rectTop(0) - chapterTopGap(0) : 0;
            if (progressive) setPaginateProgress(0);
            let guard = 0;
            while (pi < allParas.length && guard++ < 100000) {
                if (!(await ensureChunk(pi))) return;
                const limitY = cursorY + maxHeight + 1; // +1对齐旧算法的subpixel容差
                let pageHasContent = false;
                while (pi < chunkEnd && pi < allParas.length) {
                    const isImg = /^\[IMG:[^\]]+\]$/.test(allParas[pi].content);
                    if (off === 0 && pi > 0 && isChapterStart(allParas[pi].content) && pageHasContent) break;
                    if (rectBottom(pi) <= limitY) {
                        pi++; off = 0; pageHasContent = true; continue;
                    }
                    if (isImg) {
                        // 图片不可拆；单独成页也放不下就硬放（imgMaxH≤0.6页高，实际必放得下）
                        if (!pageHasContent) { pi++; off = 0; pageHasContent = true; }
                        break;
                    }
                    const cut = lineCut(pi, limitY);
                    if (cut <= off) break; // 一行都进不来，整段推下页
                    if (cut >= (innerTextNode(pi)?.length ?? 0)) { // 文本全放下了（块底差subpixel）
                        pi++; off = 0; pageHasContent = true; continue;
                    }
                    // widow control: 段从头开始且只塞得下<4字且页内已有内容 → 整段推下页
                    if (off === 0 && cut < 4 && pageHasContent) break;
                    off = cut;
                    pageHasContent = true;
                    break;
                }
                if (pi >= allParas.length) break;
                if (pi >= chunkEnd) continue; // 块用完但页未填满：换块（ensureChunk）后继续填当前页
                const last = breaks[breaks.length - 1];
                if (last.paraIndex === pi && last.offset === off) break; // 没推进，防死循环
                breaks.push({ paraIndex: pi, offset: off });
                if (off > 0) {
                    // 段中切点：下一页顶=切点字符所在行的top
                    const textNode = innerTextNode(pi)!;
                    measureRange.setStart(textNode, Math.min(off, textNode.length));
                    measureRange.setEnd(textNode, Math.min(off + 1, textNode.length));
                    cursorY = measureRange.getBoundingClientRect().top + rectShift;
                } else {
                    cursorY = rectTop(pi) - chapterTopGap(pi);
                }
            }
            measurer.innerHTML = ''; // 测量节点用完即清

            if (cancelled) return;
            provisionalRangeRef.current = null; // 最终页表替换临时页表，解除窗外跳转拦截
            setPageBreaks(breaks);
            setTotalPages(Math.max(1, breaks.length));
            if (paginationCacheKey) {
                const payload = JSON.stringify({
                    breaks, paraCount: allParas.length,
                    width: readerContentWidth, height: readerSize.height,
                });
                // 清掉v1时代的旧key（pagebreaks-id 和带尺寸的 pagebreaks-id-w-h），防localStorage堆积
                try {
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                        const k = localStorage.key(i);
                        if (k && k.startsWith('pagebreaks-') && !k.startsWith('pagebreaks-v3-')) localStorage.removeItem(k);
                    }
                } catch {}
                // 主存 IndexedDB（配额足够，大书几百KB没问题）；写成功后清掉 localStorage 旧副本释放配额
                const idbOk = await idbSet(paginationCacheKey, payload);
                if (cancelled) return;
                if (idbOk) {
                    try { localStorage.removeItem(paginationCacheKey); } catch {}
                } else {
                    // 后手：IDB 不可用（隐私模式/老WebView）退回 localStorage；
                    // 配额满（大书缓存约几百KB，多本累计可能超限）则清掉其它书的分页缓存重试一次
                    try {
                        localStorage.setItem(paginationCacheKey, payload);
                    } catch {
                        try {
                            for (let i = localStorage.length - 1; i >= 0; i--) {
                                const k = localStorage.key(i);
                                if (k && k.startsWith('pagebreaks-') && k !== paginationCacheKey) localStorage.removeItem(k);
                            }
                            localStorage.setItem(paginationCacheKey, payload);
                        } catch {}
                    }
                }
            }
            if (!suppressPageJumpRef.current) {
                const anchorIdx = savedParaIdxRef.current ?? currentParaIdxRef.current ?? allParas[0]?.idx ?? 0;
                const targetPage = (() => {
                    const pi = allParas.findIndex(p => p.idx >= anchorIdx);
                    if (pi < 0) return 0;
                    for (let i = breaks.length - 1; i >= 0; i--) if (breaks[i].paraIndex <= pi) return i;
                    return 0;
                })();
                setPage(Math.max(1, Math.min(breaks.length, targetPage + 1)));
            }
            savedParaIdxRef.current = null;
            setPaginateProgress(null);
            setReadingLoading(false);
            if (provisionalShown) addToast?.('全书分页已完成');
        };
        run();
        return () => { cancelled = true; };
    }, [mode, allParas, readerContentWidth, readerSize.height, readerFontSize]);

    useEffect(() => {
        if (allParas.length === 0 || pageBreaks.length === 0) {
            setPageFragments([]);
            setParagraphs([]);
            setComments([]);
            return;
        }
        if (page > pageBreaks.length && !suppressPageJumpRef.current) {
            setPage(pageBreaks.length);
            return;
        }
        const start = pageBreaks[page - 1] || { paraIndex: 0, offset: 0 };
        const end = page < pageBreaks.length ? pageBreaks[page] : { paraIndex: allParas.length, offset: 0 };
        const fragments: PageFragment[] = [];
        for (let i = start.paraIndex; i < end.paraIndex || (i === end.paraIndex && end.offset > 0); i++) {
            const para = allParas[i];
            if (!para) continue;
            const text = stripHeading(para.content);
            const from = i === start.paraIndex ? start.offset : 0;
            const to = i === end.paraIndex ? end.offset : text.length;
            if (to <= from) continue;
            fragments.push({ ...para, content: text.slice(from, to), sourceIdx: i, startOffset: from, endOffset: to, isPartialStart: from > 0, isPartialEnd: to < text.length });
        }
        setPageFragments(fragments);
        const visibleParas = fragments.map(f => allParas[f.sourceIdx]).filter(Boolean);
        setParagraphs(visibleParas);
        setComments(allComments);
        currentParaIdxRef.current = visibleParas[0]?.idx ?? null;
        if (activeBook && visibleParas.length > 0 && savedParaIdxRef.current === null) {
            try { localStorage.setItem(`coread-front-progress-v1-${activeBook.id}`, String(visibleParas[0].idx)); } catch {}
            updateBookProgress(bridgeConfig, activeBook.id, visibleParas[0].idx).catch(() => {});
        }
    }, [page, pageBreaks, allParas, allComments, activeBook?.id]);

    // 翻到全书末（非懒加载=最后一页；懒加载=最后窗口末子页）时把愿望单标记为读完
    const markWishlistDone = () => {
        if (!activeBook || !bridgeConfig.url) return;
        const bookTitle = activeBook.title?.replace(/\s*\(.*?\)\s*/g, '').trim();
        fetch(`${bridgeConfig.url}/v1/reading-wishlist`).then(r => r.json()).then(res => {
            const match = (res.items || []).find((w: any) => w.status === 'reading' && w.title?.trim() === bookTitle);
            if (match) {
                fetch(`${bridgeConfig.url}/v1/reading-wishlist`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: match.id, title: match.title, author: match.author, reason: match.reason, status: 'done' }),
                }).catch(() => {});
            }
        }).catch(() => {});
    };

    const goPage = (delta: number) => {
        if (!activeBook) return;
        const next = Math.max(1, Math.min(totalPages, page + delta));
        if (next !== page) {
            setActiveComments([]); setCommentingIdx(null); setSelRange(null); setFloatingBar(null);
            setPage(next);
            if (next === totalPages && totalPages > 1) markWishlistDone();
        }
    };

    const startAnnotation = () => {
        replyPageRef.current = page;
        if (!floatingBar) return;
        setSelRange({ startPara: floatingBar.startPara, endPara: floatingBar.endPara, start: floatingBar.start, end: floatingBar.end });
        setSelectedText(floatingBar.text);
        setCommentingIdx(floatingBar.startPara);
        setFloatingBar(null);
        window.getSelection()?.removeAllRanges();
    };

    const handleAddComment = async () => {
        if (!activeBook || commentingIdx === null || !commentText.trim()) return;
        try {
            const result = await addBookComment(bridgeConfig, activeBook.id, {
                paragraph_idx: commentingIdx, content: commentText.trim(), from_who: humanName,
                selected_text: selectedText || undefined,
                sel_start_idx: selRange ? selRange.start : undefined,
                sel_end_idx: selRange ? selRange.end : undefined,
                sel_end_para_idx: selRange && selRange.endPara !== selRange.startPara ? selRange.endPara : undefined,
                reply_to: replyingTo?.id || undefined,
            } as any);
            const newComment: Comment = {
                id: result?.id ?? Date.now(), book_id: activeBook.id, paragraph_idx: commentingIdx,
                sel_start_idx: selRange?.start ?? null, sel_end_idx: selRange?.end ?? null,
                sel_end_para_idx: selRange && selRange.endPara !== selRange.startPara ? selRange.endPara : null,
                selected_text: selectedText || null, from_who: humanName,
                content: commentText.trim(), created_at: new Date().toISOString(), reply_to: replyingTo?.id ?? null,
            };
            const pageToRestore = replyPageRef.current ?? page;
            replyPageRef.current = null;
            suppressPageJumpRef.current = true;
            setCommentText(''); setSelectedText(''); setSelRange(null); setReplyingTo(null);
            setActiveComments([]); setCommentingIdx(null);
            setComments(prev => [...prev, newComment]);
            setAllComments(prev => { const u = [...prev, newComment]; if (activeBook) idbSetParas(`comments-v1-${activeBook.id}`, JSON.stringify(u)).catch(() => {}); return u; });
            setPage(pageToRestore);
            setTimeout(() => { suppressPageJumpRef.current = false; }, 500);
        } catch (e: any) { addToast?.(`批注失败: ${e.message}`); }
    };

    const handleDeleteComment = async (cmt: Comment) => {
        try {
            await deleteBookComment(bridgeConfig, cmt.id);
            setComments(prev => prev.filter(x => x.id !== cmt.id));
            setAllComments(prev => { const u = prev.filter(x => x.id !== cmt.id); if (activeBook) idbSetParas(`comments-v1-${activeBook.id}`, JSON.stringify(u)).catch(() => {}); return u; });
            setActiveComments(prev => prev.filter(x => x.id !== cmt.id));
        } catch (e: any) { addToast?.(`删除失败: ${e.message}`); }
    };

    const handleExport = () => {
        if (!activeBook) return;
        const base = bridgeConfig.url.replace(/\/+$/, '');
        window.open(`${base}/v1/books/${activeBook.id}/export?format=epub`, '_blank');
    };

    const handleDeleteBook = async (bookId: number) => {
        try {
            await deleteBook(bridgeConfig, bookId);
            setConfirmDelete(null); loadBooks();
            addToast?.('已删除');
        } catch (e: any) { addToast?.(`删除失败: ${e.message}`); }
    };

    const jumpToChapter = (chapter: { idx: number; page: number; title: string }) => {
        if (!activeBook) return;
        setTocPhase('closing'); setTimeout(() => { setShowToc(false); setTocPhase('closed'); }, 240);
        setActiveComments([]); setCommentingIdx(null); setSelRange(null); setFloatingBar(null);
        const targetIdx = chapter.idx ?? chapter.page;
        jumpToParagraph(targetIdx);
    };

    // 当前阅读位置所在章：最后一个起始页不超过当前页的章（彤宝：目录要能定位当前章，不用从头划）
    const currentChapterIdx = useMemo(() => {
        let cur = -1;
        for (let i = 0; i < tocChapters.length; i++) {
            const ch = tocChapters[i];
            const pg = findPageForParaIdx(ch.idx ?? ch.page);
            if ((pg >= 0 ? pg + 1 : ch.page) <= page) cur = i;
            else break;
        }
        return cur;
    }, [tocChapters, page, pageBreaks, allParas]);

    // 打开目录时把当前章滚动到列表中央（窗口化后按钮按需渲染，不能scrollIntoView，直接算scrollTop）
    useEffect(() => {
        if (!showToc) return;
        const el = tocListRef.current;
        if (!el) return;
        setTocViewH(el.clientHeight);
        setTocScrollTop(el.scrollTop);
        if (currentChapterIdx >= 0) {
            el.scrollTop = Math.max(0, (currentChapterIdx + 0.5) * TOC_ROW_H - el.clientHeight / 2);
        }
    }, [showToc, currentChapterIdx]);

    // 全量上传二进制化（彤彤 2026-09-19，task-1789825421696-3w00z5）：所有类型都走 octet-stream 直传；
    // 文本类在客户端先 TextDecoder(utf8 fatal→gbk 回退) 解码再 TextEncoder 重编码，保证到服务端的永远是 UTF-8 字节（GBK 老书在这里转码），服务端按 UTF-8 解即可，中文不乱码
    const textToUtf8Blob = (text: string) => new Blob([new TextEncoder().encode(text)]);
    const fileToUtf8Blob = async (file: File) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let text: string;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
        catch { text = new TextDecoder('gbk').decode(bytes); }
        return textToUtf8Blob(text);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const name = file.name.replace(/\.(pdf|txt|md|epub)$/i, '');
        if (!uploadTitle) setUploadTitle(name);
        setUploadFileName(file.name);
        // 二进制直传：所有类型 File 原样留着，文本类上传时再规整 UTF-8
        setUploadFile(file); setPdfBase64(''); setUploadText('');
        setFileReading(false);
    };

    const uploadBatch = async (files: File[]) => {
        if (!files.length) return;
        setUploading(true);
        let ok = 0, fail = 0;
        for (const file of files) {
            const ext = file.name.toLowerCase().split('.').pop();
            if (!['epub', 'pdf', 'txt', 'md'].includes(ext || '')) { fail++; addToast?.(`跳过不支持的格式: ${file.name}`); continue; }
            try {
                const title = file.name.replace(/\.(pdf|txt|md|epub)$/i, '');
                // 全量二进制直传：epub/pdf 原始字节，txt/md 规整 UTF-8（修掉 base64→atob 中文必乱码的旧路径）
                const body = (ext === 'txt' || ext === 'md') ? await fileToUtf8Blob(file) : file;
                await uploadBookFile(bridgeConfig, body, title, ext!);
                ok++;
                addToast?.(`已上传 ${ok}/${files.length}: ${title}`);
            } catch { fail++; addToast?.(`上传失败: ${file.name}`); }
        }
        addToast?.(fail ? `完成：${ok}成功，${fail}失败` : `全部${ok}本上传成功`);
        setUploading(false);
        setShowUpload(false);
        loadBooks();
    };

    const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        await uploadBatch(files);
    };

    // Android WebView 的 input multiple 不多选（task-1789818457210-l5g3qp）：原生走 FilePicker SAF 选择器，web 回退隐藏 input
    const openBatchUpload = async () => {
        const files = await pickMultipleFiles(['application/epub+zip', 'application/zip']);
        if (files === null) batchFileRef.current?.click();
        else await uploadBatch(files);
    };

    const handleUpload = async () => {
        if (!uploadTitle.trim()) { addToast?.('请输入书名'); return; }
        if (fileReading) { addToast?.('文件读取中，请稍候…'); return; }
        if (!uploadText && !uploadFile) {
            addToast?.(uploadFileName ? '文件读取失败，请重新选择文件' : '请选择文件或粘贴文本');
            return;
        }
        setUploading(true);
        try {
            if (uploadFile) {
                // 二进制直传：epub/pdf 原始字节直接做 body，txt/md 规整 UTF-8 后直发
                const ext = uploadFileName.toLowerCase().split('.').pop() || 'txt';
                const fmt = ['epub', 'pdf', 'txt', 'md'].includes(ext) ? ext : 'txt';
                const body = (fmt === 'txt' || fmt === 'md') ? await fileToUtf8Blob(uploadFile) : uploadFile;
                await uploadBookFile(bridgeConfig, body, uploadTitle.trim(), fmt);
            } else {
                // 粘贴文本：TextEncoder → UTF-8 字节二进制直传
                await uploadBookFile(bridgeConfig, textToUtf8Blob(uploadText), uploadTitle.trim(), 'txt');
            }
            setPanelDetail(null); setShowUpload(false); setUploadTitle(''); setUploadText(''); setPdfBase64(''); setUploadFile(null); setUploadFileName('');
            addToast?.('上传成功');
            loadBooks();
        } catch (e: any) { addToast?.(`上传失败: ${e.message}`); }
        setUploading(false);
    };

    const backToShelf = () => {
        setMode('shelf'); setActiveBook(null); setParagraphs([]); setComments([]);
        setActiveComments([]); setSelRange(null); setFloatingBar(null); setShowToc(false); setTocChapters([]);
        setReturnPoint(null);
        loadBooks();
    };

    const commentsForPara = (idx: number) => comments.filter(x => {
        if (x.sel_start_idx == null) return x.paragraph_idx === idx;
        const endPara = x.sel_end_para_idx ?? x.paragraph_idx;
        return x.paragraph_idx <= idx && idx <= endPara;
    });
    const stripHeading = (s: string) => s.replace(/^#+\s*/, '');
    const isHeading = (s: string) => s.trim().startsWith('#');
    const isChapterStart = (s: string) => {
        const trimmed = s.trim();
        const plain = stripHeading(trimmed).trim();
        const isChapter = /^(chapter|book|part|volume|prologue|epilogue)\b/i.test(plain)
            || /^\u7b2c[\d\s\w\u4e00-\u9fff]{1,20}[\u7ae0\u8282\u5377\u90e8\u7bc7\u56de]/.test(plain)
            || /^\u7b2c\d+\u7ae0/.test(trimmed);
        if (isChapter) return true;
        const heading = trimmed.match(/^(#{1,6})\s+/);
        return !!(heading && heading[1].length <= 2);
    };

    const renderHighlighted = (text: string, paraIdx: number, highlights: Comment[]) => {
        const positioned = highlights
            .filter(h => h.sel_start_idx != null && h.sel_end_idx != null && h.sel_start_idx! < text.length)
            .sort((a, b) => a.sel_start_idx! - b.sel_start_idx!);
        if (positioned.length === 0) return text;

        const parts: React.ReactNode[] = [];
        let lastEnd = 0;
        for (const h of positioned) {
            const start = Math.max(h.sel_start_idx!, lastEnd);
            const end = Math.min(h.sel_end_idx!, text.length);
            if (start >= end) continue;
            if (start > lastEnd) parts.push(<React.Fragment key={`t${paraIdx}-${lastEnd}`}>{text.slice(lastEnd, start)}</React.Fragment>);

            const isShen = isAiAuthor(h.from_who);
            const hlBg = isShen ? c.shenHL : c.tongHL;
            const dotColor = isShen ? c.shenColor : c.tongColor;

            const showDot = h.paragraph_idx === paraIdx;
            const hStart = start, hEnd = end;
            parts.push(
                <span key={`h${h.id}-${paraIdx}`}
                    onClick={(e) => {
                        if (window.getSelection()?.toString().trim()) return;
                        e.stopPropagation();
                        const overlapping = positioned.filter(x => {
                            const xs = Math.max(x.sel_start_idx!, 0), xe = Math.min(x.sel_end_idx!, text.length);
                            return xs < hEnd && xe > hStart;
                        });
                        const allReplies: Comment[] = [];
                        const findReplies = (ids: number[]) => { const found = comments.filter(r => r.reply_to && ids.includes(r.reply_to)); if (found.length) { allReplies.push(...found); findReplies(found.map(f => f.id)); } };
                        findReplies(overlapping.map(o => o.id));
                        const withReplies = [...overlapping, ...allReplies];
                        setActiveComments(prev => prev.length > 0 && prev[0]?.id === overlapping[0]?.id ? [] : withReplies);
                    }}
                    style={{
                        backgroundImage: `linear-gradient(${hlBg}, ${hlBg})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '100% 62%',
                        backgroundPosition: '0 72%',
                        borderRadius: 3,
                        position: 'relative',
                        cursor: 'pointer',
                        textDecorationLine: 'none',
                        padding: 0,
                        lineHeight: 'inherit',
                        boxDecorationBreak: 'clone',
                        WebkitBoxDecorationBreak: 'clone',
                    } as React.CSSProperties}>
                    {showDot && <span style={{ position: 'absolute', top: -2, left: -2, width: 7, height: 7, borderRadius: '50%', background: dotColor, boxShadow: `0 0 3px ${dotColor}60`, pointerEvents: 'none' }} />}
                    {text.slice(start, end)}
                </span>
            );
            lastEnd = end;
        }
        if (lastEnd < text.length) parts.push(<React.Fragment key={`t${paraIdx}-${lastEnd}`}>{text.slice(lastEnd)}</React.Fragment>);
        return <>{parts}</>;
    };

    const btnBase: React.CSSProperties = {
        background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(18px) saturate(1.05)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.05)',
        border: `1px solid ${c.primaryBorder}`, borderRadius: 14,
        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    };

    // ===== 重设计 v1：玻璃弹出层（⋯ 菜单 / + 面板）的相位机与原地展开 =====
    // showMenu/showUpload 是"开合意图"（现有 handler 里 setShowUpload(false) 也能带上收起动画），
    // phase 驱动 CSS 动画类：anim=弹出动画中 open=稳定 closing=收起中
    useEffect(() => {
        let t: ReturnType<typeof setTimeout> | null = null;
        if (showMenu) {
            if (menuPhase === 'closed' || menuPhase === 'closing') setMenuPhase('anim');
            else if (menuPhase === 'anim') t = setTimeout(() => setMenuPhase('open'), 330);
        } else {
            if (menuPhase === 'anim' || menuPhase === 'open') setMenuPhase('closing');
            else if (menuPhase === 'closing') t = setTimeout(() => { setMenuPhase('closed'); setMenuDetail(null); }, 180);
        }
        return () => { if (t) clearTimeout(t); };
    }, [showMenu, menuPhase]);
    useEffect(() => {
        let t: ReturnType<typeof setTimeout> | null = null;
        if (showUpload) {
            if (panelPhase === 'closed' || panelPhase === 'closing') setPanelPhase('anim');
            else if (panelPhase === 'anim') t = setTimeout(() => setPanelPhase('open'), 330);
        } else {
            if (panelPhase === 'anim' || panelPhase === 'open') setPanelPhase('closing');
            else if (panelPhase === 'closing') t = setTimeout(() => setPanelPhase('closed'), 180);
        }
        return () => { if (t) clearTimeout(t); };
    }, [showUpload, panelPhase]);

    // 原地展开/收回：参数照 mockup demoExpand/demoCollapse（高度 240/220ms cubic-bezier(0.77,0,0.175,1)，
    // 旧层 100ms 淡出，新层延迟 80/60ms 200ms 浮入）；grid 叠层取 max，容器须显式锁当前层高度
    const POP_EASE_INOUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
    const POP_EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
    const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const viewsOf = (cEl: HTMLDivElement | null) => ({
        c: cEl,
        list: cEl?.querySelector('.cr-view-list') as HTMLElement | null,
        detail: cEl?.querySelector('.cr-view-detail') as HTMLElement | null,
    });
    const lockPopHeight = (cEl: HTMLDivElement | null) => {
        const { c: el, list } = viewsOf(cEl);
        if (el && list) el.style.height = `${list.offsetHeight + 10}px`;
    };
    const settlePop = (cEl: HTMLDivElement | null, expanded: boolean) => {
        const { c: el, list, detail } = viewsOf(cEl);
        if (!el || !list || !detail) return;
        el.classList.toggle('cr-show-detail', expanded);
        el.style.height = `${(expanded ? detail : list).offsetHeight + 10}px`;
        el.getAnimations({ subtree: true }).forEach(a => a.cancel());
    };
    const expandPop = (cEl: HTMLDivElement | null) => {
        const { c: el, list, detail } = viewsOf(cEl);
        if (!el || !list || !detail) return;
        if (reducedMotion()) { settlePop(cEl, true); return; }
        const h1 = el.offsetHeight, h2 = detail.offsetHeight + 10;
        el.animate([{ height: `${h1}px` }, { height: `${h2}px` }], { duration: 240, easing: POP_EASE_INOUT, fill: 'both' });
        list.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: 'ease-out', fill: 'both' });
        detail.animate(
            [{ opacity: 0, transform: 'translateY(4px)', visibility: 'visible' },
             { opacity: 1, transform: 'translateY(0)', visibility: 'visible' }],
            { duration: 200, delay: 80, easing: POP_EASE_OUT, fill: 'both' });
        window.setTimeout(() => settlePop(cEl, true), 290);
    };
    const collapsePop = (cEl: HTMLDivElement | null) => {
        const { c: el, list, detail } = viewsOf(cEl);
        if (!el || !list || !detail) return;
        if (reducedMotion()) { settlePop(cEl, false); return; }
        const h1 = el.offsetHeight, h2 = list.offsetHeight + 10;
        el.animate([{ height: `${h1}px` }, { height: `${h2}px` }], { duration: 220, easing: POP_EASE_INOUT, fill: 'both' });
        // 详情内容陪缩到最后（彤彤 2026-09-20：100ms 就淡出会留下一帧高玻璃空壳）；交叉淡化——详情慢出、列表晚进
        detail.animate([{ opacity: 1, visibility: 'visible' }, { opacity: 0, visibility: 'visible' }], { duration: 180, easing: 'ease-out', fill: 'both' });
        list.animate(
            [{ opacity: 0, transform: 'translateY(4px)', visibility: 'visible' },
             { opacity: 1, transform: 'translateY(0)', visibility: 'visible' }],
            { duration: 180, delay: 100, easing: POP_EASE_OUT, fill: 'both' });
        window.setTimeout(() => settlePop(cEl, false), 280);
    };
    // 打开时锁列表层高度；detail 由 React 渲染后在 layout effect 里做高度 morph
    useLayoutEffect(() => { if (menuPhase === 'anim') lockPopHeight(menuRef.current); }, [menuPhase]);
    useLayoutEffect(() => { if (panelPhase === 'anim') lockPopHeight(panelRef.current); }, [panelPhase]);
    // 整窗关闭起手先落回列表层（彤彤 2026-09-20：误点外面关窗时，弹窗还锁着详情层高度，空一截高的玻璃再缩进去）
    useLayoutEffect(() => { if (menuPhase === 'closing') settlePop(menuRef.current, false); }, [menuPhase]);
    useLayoutEffect(() => { if (panelPhase === 'closing') settlePop(panelRef.current, false); }, [panelPhase]);
    useLayoutEffect(() => { if (menuDetail) expandPop(menuRef.current); }, [menuDetail]);
    // 恢复备份列表展开/收起时平滑 morph 高度（彤彤 2026-09-20：瞬跳一卡一顿）；打断时从当前高度重起，reduced motion 直接落位
    useLayoutEffect(() => {
        if (menuPhase !== 'open' || menuDetail !== 'backup') return;
        const { c: el, detail } = viewsOf(menuRef.current);
        if (!el || !detail) return;
        if (reducedMotion()) { settlePop(menuRef.current, true); return; }
        const h1 = el.offsetHeight, h2 = detail.offsetHeight + 10;
        if (h1 === h2) return;
        el.getAnimations().forEach(a => a.cancel());
        el.animate([{ height: `${h1}px` }, { height: `${h2}px` }], { duration: 220, easing: POP_EASE_INOUT, fill: 'both' });
        window.setTimeout(() => settlePop(menuRef.current, true), 230);
    }, [backupFiles, menuDetail, menuPhase]);
    // 整窗关闭才重置展开态（彤彤 2026-09-20：返回列表层途中重置会把内容从动画里拽出来，造成卡顿）
    useEffect(() => { if (menuPhase === 'closed') { setBackupFiles(null); setRestorePreview(null); } }, [menuPhase]);
    const openMenuDetail = (d: 'records' | 'manage' | 'backup') => { setBackupFiles(null); lockPopHeight(menuRef.current); setMenuDetail(d); };
    const openPanelDetail = (d: 'file' | 'text') => { setShowUpload(false); setPanelDetail(d); };
    const closeMenuDetail = () => { collapsePop(menuRef.current); window.setTimeout(() => setMenuDetail(null), 110); };
    const closePanelDetail = () => { if (!uploading) setPanelDetail(null); };

    // 阅读记录：复用现有 books 数据（last_opened_at + 进度），无新接口
    const readRecords = useMemo(() => [...books]
        .filter(b => b.last_opened_at || (b.current_page && b.total_paragraphs > 0))
        .sort((a, b) => new Date((b.last_opened_at || b.created_at).replace(' ', 'T')).getTime() - new Date((a.last_opened_at || a.created_at).replace(' ', 'T')).getTime())
        .slice(0, 8), [books]);
    const fmtRecTime = (s?: string | null) => {
        if (!s) return '';
        const d = new Date(s.replace(' ', 'T'));
        if (isNaN(d.getTime())) return '';
        const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
        if (d.getTime() >= dayStart.getTime()) return `今天 ${hhmm}`;
        if (d.getTime() >= dayStart.getTime() - 86400000) return `昨天 ${hhmm}`;
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    };

    // iOS26 液态玻璃圆钮（38px，参数照 mockup .btn）
    const glassBtn: React.CSSProperties = {
        width: 38, height: 38, borderRadius: '50%', padding: 0,
        background: 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(22px) saturate(1.8)', WebkitBackdropFilter: 'blur(22px) saturate(1.8)',
        border: '1px solid rgba(255,255,255,0.75)',
        boxShadow: '0 2px 10px rgba(60,55,45,0.10), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: INK,
    };
    // 菜单/面板共用雾面玻璃质感（mockup .menu/.panel）
    const glassPop: React.CSSProperties = {
        position: 'absolute', right: 20, zIndex: 20, overflow: 'hidden', boxSizing: 'border-box',
        borderRadius: 18, padding: 5,
        background: 'linear-gradient(rgba(255,255,255,0.20), rgba(255,255,255,0) 40%), rgba(252,252,252,0.50)',
        backdropFilter: 'var(--hyalite, blur(48px) saturate(1.8))', WebkitBackdropFilter: 'var(--hyalite, blur(48px) saturate(1.8))',
        boxShadow: 'var(--hyalite-edge, 0 0 0 0 transparent), 0 16px 50px rgba(60,55,45,0.14), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.28)',
        border: '1px solid rgba(255,255,255,0.7)',
    };
    // 展开层：返回头 / 输入框 / 文件选择 / CTA（mockup .vd-head/.vd-input/.vd-file/.vd-cta）
    const vdHead: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px 6px', cursor: 'pointer', color: INK };
    const vdInput: React.CSSProperties = { display: 'block', width: 'calc(100% - 22px)', margin: '2px 11px 8px', padding: '8px 11px', borderRadius: 11, border: '1px solid hsla(245,15%,55%,0.25)', background: 'rgba(255,255,255,0.55)', fontSize: 13, color: INK, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
    const vdFile: React.CSSProperties = { display: 'block', width: 'calc(100% - 22px)', margin: '0 11px 8px', padding: '9px 11px', borderRadius: 11, border: '1px dashed hsla(245,15%,55%,0.4)', background: 'rgba(255,255,255,0.35)', fontSize: 12, color: INK2, textAlign: 'center', lineHeight: 1.5, whiteSpace: 'normal', overflowWrap: 'anywhere', boxSizing: 'border-box', cursor: 'pointer' };
    const vdCta: React.CSSProperties = { display: 'block', width: 'calc(100% - 22px)', margin: '0 11px 6px', padding: '9px 0', borderRadius: 12, border: 'none', background: INK, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };

    // 备份与恢复 handlers（服务端 /v1/coread-backup/*，x-owner-key 鉴权）
    // 备份时间显示转本机时区（彤彤 2026-09-20：列表显示的是服务器 UTC 凌晨3点）
    const fmtBackupTime = (iso: string) => { const d = new Date(iso); if (isNaN(d.getTime())) return iso; const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
    const backupHeaders = { 'Content-Type': 'application/json', 'x-owner-key': ROOM_OWNER_KEY };
    const doBackupExport = async () => {
        if (backupBusy) return;
        setBackupBusy(true);
        try {
            const settings = {
                'coread-font-size': localStorage.getItem('coread-font-size') || '',
                'coread-brightness': localStorage.getItem('coread-brightness') || '',
                'coread-night-mode': localStorage.getItem('coread-night-mode') || '',
                'coread-reading-clock': localStorage.getItem('coread-reading-clock') || '',
                'coread-tap-turn': localStorage.getItem('coread-tap-turn') || '',
                'coread-human-name': localStorage.getItem('coread-human-name') || '',
                'coread-ai-name': localStorage.getItem('coread-ai-name') || '',
            };
            const r = await fetch(`${bridgeConfig.url}/v1/coread-backup/export`, { method: 'POST', headers: backupHeaders, body: JSON.stringify({ settings }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || d.message || `导出失败 ${r.status}`);
            // 彤彤 2026-09-20：导出=存档到服务器，永远不弹下载
            addToast?.(`已存到服务器（${(d.bytes / 1048576).toFixed(0)}MB），在「恢复备份」里能看到`);
        } catch (e: any) { addToast?.(e.message || '导出失败'); }
        setBackupBusy(false);
    };
    const doBackupList = async () => {
        if (backupFiles !== null) { setBackupFiles(null); return; }
        try {
            const r = await fetch(`${bridgeConfig.url}/v1/coread-backup/list`, { method: 'POST', headers: backupHeaders, body: '{}' });
            const d = await r.json();
            setBackupFiles(d.files || []);
        } catch { addToast?.('读备份列表失败'); }
    };
    const doBackupPreview = async (payload: any, label: string) => {
        if (backupBusy) return;
        setBackupBusy(true);
        try {
            const r = await fetch(`${bridgeConfig.url}/v1/coread-backup/preview`, { method: 'POST', headers: backupHeaders, body: JSON.stringify(payload) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || `预检失败 ${r.status}`);
            setRestorePreview({ token: d.token, counts: d, label });
        } catch (e: any) { addToast?.(e.message || '预检失败'); }
        setBackupBusy(false);
    };
    const doBackupRestore = async () => {
        if (!restorePreview) return;
        const token = restorePreview.token;
        setRestorePreview(null);
        setBackupBusy(true);
        try {
            const r = await fetch(`${bridgeConfig.url}/v1/coread-backup/restore`, { method: 'POST', headers: backupHeaders, body: JSON.stringify({ token, confirmed: true }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || `恢复失败 ${r.status}`);
            // 恢复后本地派生缓存全部作废：分页/本机锚点清 localStorage，段落/页表整个 IDB 库删除重建（对齐 coread 代际轮换语义，防吃到旧内容缓存）
            try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && (k.startsWith('pagebreaks-') || k.startsWith('coread-front-progress-'))) localStorage.removeItem(k); } } catch {}
            try { indexedDB.deleteDatabase('study-reader-cache'); } catch {}
            addToast?.(`恢复完成：${d.counts.books} 本书回来了`);
            loadBooks();
        } catch (e: any) { addToast?.(e.message || '恢复失败'); }
        setBackupBusy(false);
    };
    const onRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        if (f.size > 60 * 1024 * 1024) { addToast?.('备份文件太大，改用服务器上已有的备份恢复'); return; }
        try { await doBackupPreview({ backup: JSON.parse(await f.text()) }, f.name); }
        catch { addToast?.('备份文件读不出来，是有效的备份 JSON 吗？'); }
    };

    // 统一雾面玻璃确认窗（彤彤 2026-09-20 定稿：删除用「窗口」、关门用「抽屉」；窗口类尺寸对齐上传窗口——left/right 12、顶 92、圆角 24，不再一个大一个小）
    const glassConfirm = ({ title, desc, confirmText, onConfirm, onCancel }: { title: string; desc?: string; confirmText: string; onConfirm: () => void; onCancel: () => void }) => (
        <>
            <div onClick={onCancel} style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(30,26,20,0.24)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
            <div className="hy-shelf cr-rise-in" onClick={(e) => e.stopPropagation()} style={{
                position: 'absolute', left: 12, right: 12, top: 'calc(92px + env(safe-area-inset-top))', zIndex: 31, boxSizing: 'border-box',
                borderRadius: 24, padding: '18px 18px 14px', textAlign: 'center',
                background: 'linear-gradient(rgba(255,255,255,0.26), rgba(255,255,255,0) 42%), rgba(252,252,252,0.62)',
                backdropFilter: 'var(--hyalite, blur(48px) saturate(1.8))', WebkitBackdropFilter: 'var(--hyalite, blur(48px) saturate(1.8))',
                boxShadow: 'var(--hyalite-edge, 0 0 0 0 transparent), 0 18px 52px rgba(60,55,45,0.18), inset 0 1px 0 rgba(255,255,255,0.96)',
                border: '1px solid rgba(255,255,255,0.82)',
            }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>{title}</div>
                {desc && <div style={{ fontSize: 12, color: INK2, marginTop: 6, lineHeight: 1.6 }}>{desc}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button onClick={onCancel} style={{ flex: 1, padding: '10px 0', borderRadius: 14, border: '1px solid rgba(60,55,45,0.15)', background: 'rgba(255,255,255,0.55)', fontSize: 13, color: INK2, cursor: 'pointer' }}>取消</button>
                    <button onClick={onConfirm} style={{ flex: 1, padding: '10px 0', borderRadius: 14, border: 'none', background: INK, fontSize: 13, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{confirmText}</button>
                </div>
            </div>
        </>
    );

    return (
        <div className="xiaowo-study" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: mode === 'reading' ? (readerNightMode ? '#1a1a1a' : '#fffcf3') : 'linear-gradient(145deg, #fbf9f6, #f5f1ee)', position: 'relative', overflow: 'hidden', filter: mode === 'reading' && readerBrightness < 100 ? `brightness(${readerBrightness / 100})` : undefined }}>
            <style>{`${STUDY_THEME_CSS}\n${COREAD_POP_CSS}\n@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>
            {mode !== 'reading' && <>
                <div style={{ position: 'absolute', top: -70, right: -40, width: 210, height: 210, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,234,224,0.35), transparent 68%)', pointerEvents: 'none', filter: 'blur(12px)', opacity: 0.7 }} />
                <div style={{ position: 'absolute', bottom: 70, left: -70, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,241,238,0.4), transparent 68%)', pointerEvents: 'none', filter: 'blur(12px)', opacity: 0.65 }} />
            </>}

            {/* Header — shelf always shows; reading mode header slides with toolbar */}
            {mode === 'shelf' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 'calc(52px + env(safe-area-inset-top))', paddingLeft: 20, paddingRight: 20, paddingBottom: 12, flexShrink: 0 }}>
                    <button onClick={closeApp} style={glassBtn}>
                        <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M10.5 3.5L5.5 8.5L10.5 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <span style={{ fontSize: 17, fontWeight: 600, color: INK, flex: 1, letterSpacing: '-0.01em' }}>共读室</span>
                    {editMode && selectedBooks.size > 0 && (
                        <button onClick={async () => {
                            if (manageAction === 'delete') {
                                setConfirmBatchDelete(true);   // 系统原生 confirm 太丑，换雾面玻璃窗（彤彤 2026-09-19）
                                return;
                            } else if (manageAction === 'cache') {
                                for (const id of selectedBooks) { try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('pagebreaks-') && k.includes(`-${id}-fs`)) localStorage.removeItem(k); } } catch {} idbDel(`pagebreaks-v3-${id}`); idbDelParas(`paras-v1-${id}`); idbDelParas(`comments-v1-${id}`); }
                                addToast?.(`已清除 ${selectedBooks.size} 本书的缓存`);
                            }
                            setSelectedBooks(new Set()); setEditMode(false); setManageAction(null);
                        }} style={{ ...glassBtn, width: 'auto', borderRadius: 19, padding: '0 14px', background: INK, border: 'none' }}>
                            <span style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>{manageAction === 'delete' ? `删除${selectedBooks.size}` : `清除${selectedBooks.size}`}</span>
                        </button>
                    )}
                    {editMode ? (
                        <button onClick={() => { setEditMode(false); setSelectedBooks(new Set()); setManageAction(null); }} style={{ ...glassBtn, width: 'auto', borderRadius: 19, padding: '0 14px' }}>
                            <span style={{ fontSize: 12, color: INK2, fontWeight: 600 }}>取消</span>
                        </button>
                    ) : (
                        <button onClick={() => setShowMenu(true)}
                            className={menuPhase === 'anim' ? 'cr-dots-out' : menuPhase === 'closing' ? 'cr-dots-in' : ''}
                            style={{ ...glassBtn, visibility: menuPhase === 'open' ? 'hidden' : undefined }}>
                            <svg width="17" height="17" viewBox="0 0 17 17" fill="currentColor"><circle cx="3.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="13.5" cy="8.5" r="1.5"/></svg>
                        </button>
                    )}
                    <button onClick={() => setShowUpload(true)} style={glassBtn}>
                        <span style={{ fontSize: 20, fontWeight: 300, lineHeight: 1, transform: 'translateY(-1px)' }}>+</span>
                    </button>
                </div>
            ) : (
                <>
                    {/* Persistent book title — always visible, small grey text */}
                    <div style={{
                        paddingTop: 'calc(12px + env(safe-area-inset-top))', paddingLeft: 20, paddingRight: 20, paddingBottom: 6, textAlign: 'center', flexShrink: 0,
                        background: readerNightMode ? '#1a1a1a' : '#fffcf3',
                    }}>
                        <div style={{ fontSize: 11, color: readerNightMode ? '#666' : '#aaa', letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {activeBook?.title || ''}
                        </div>
                        {/* 本次阅读计时：常驻占位只切显隐——若随开关增删这行，正文高度变化会触发分页重排（彤宝2026-09-18实机踩的坑）；显隐带 160ms 淡入淡出 */}
                        <div style={{ fontSize: 11, color: readerNightMode ? '#666' : '#aaa', letterSpacing: 0.5, marginTop: 2, fontVariantNumeric: 'tabular-nums', visibility: readingClock ? 'visible' : 'hidden', opacity: readingClock ? 1 : 0, transition: 'opacity 160ms ease-out, visibility 160ms ease-out' }}>
                            本次阅读 {fmtClock(clockSeconds)}
                        </div>
                    </div>
                    {/* 合上回书架 ×（SPEC §8）：常显在阅读页右上角 */}
                    <button onClick={backToShelf} style={{
                        position: 'absolute', top: 'calc(8px + env(safe-area-inset-top))', right: 12, zIndex: 15,
                        width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: readerNightMode ? 'rgba(255,255,255,0.10)' : 'rgba(60,55,45,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: readerNightMode ? '#999' : '#8a857b',
                    }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    </button>
                </>
            )}

            {/* 关门锁横幅：锁定期书架顶部提示 */}
            {doorLocked && mode === 'shelf' && (
                <div style={{ margin: '0 20px 8px', padding: '8px 14px', borderRadius: 12, background: '#fff7ed', border: '1px solid #fed7aa', fontSize: 12, color: '#c2410c', textAlign: 'center', flexShrink: 0 }}>
                    🔒 共读室已关门 — 哥哥进不来，去 ⋯ 菜单开门
                </div>
            )}

            {/* Content */}
            <div ref={contentRef} style={{
                flex: 1, overflow: mode === 'reading' ? 'hidden' : 'auto', position: 'relative',
                padding: mode === 'reading' ? '0' : '8px 20px 32px',
                background: mode === 'reading' ? (readerNightMode ? '#1a1a1a' : '#fffcf3') : 'transparent',
            }} className="no-scrollbar study-scroll-container"
                onClick={(e) => { if (mode === 'reading') handleReaderTap(e); else if (activeComments.length) setActiveComments([]); }}
                onTouchStart={mode === 'reading' ? (e) => {
                    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
                } : undefined}
                onTouchEnd={mode === 'reading' ? (e) => {
                    if (!touchStart.current) return;
                    const dx = e.changedTouches[0].clientX - touchStart.current.x;
                    const dy = e.changedTouches[0].clientY - touchStart.current.y;
                    const dt = Date.now() - touchStart.current.t;
                    touchStart.current = null;
                    if (dt > 500 || Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 60) return;
                    // 滑动翻页后触屏会补发一次合成click，压掉免得点按翻页再翻一页
                    suppressTapRef.current = true;
                    setTimeout(() => { suppressTapRef.current = false; }, 350);
                    if (dx < -60) goPage(1);
                    else if (dx > 60) goPage(-1);
                } : undefined}>

                {!bridgeConfig.key ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#bbb' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg, ${c.primaryLight}, ${c.warmBg})`, margin: '0 auto 16px' }} />
                        <div style={{ fontSize: 14 }}>配置 Bridge 后显示</div>
                    </div>
                ) : loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb', fontSize: 14 }}>加载中...</div>
                ) : error ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ fontSize: 13, color: '#e88', marginBottom: 12 }}>{error}</div>
                        <button onClick={loadBooks} style={{ background: 'none', border: `1px solid ${c.primaryBorder}`, borderRadius: 12, padding: '8px 20px', fontSize: 12, color: c.primary, cursor: 'pointer' }}>重试</button>
                    </div>
                ) : mode === 'shelf' ? (
                    <>
                        {books.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#bbb' }}>
                                <div style={{ width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg, ${c.primaryLight}, ${c.warmBg})`, margin: '0 auto 16px' }} />
                                <div style={{ fontSize: 14, marginBottom: 6 }}>书架空空的</div>
                                <div style={{ fontSize: 12, color: '#ccc' }}>点右上角 + 上传一本书</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                {[...books].sort((a, b) => {
                                    const act = (x: any) => Math.max(
                                        x.last_opened_at ? new Date(x.last_opened_at.replace(' ', 'T')).getTime() : 0,
                                        x.created_at ? new Date(x.created_at.replace(' ', 'T')).getTime() : 0,
                                    );
                                    const d = act(b) - act(a);
                                    return d !== 0 ? d : b.id - a.id;
                                }).map((book, i) => {
                                    // current_page存的是当前页首段的段落idx（updateBookProgress上报visibleParas[0].idx），
                                    // 不是页码——旧公式×10是"每页10段"时代的遗产，短段落的书直接爆到100%（9/17医生书案）
                                    const progress = book.current_page && book.total_paragraphs > 0
                                        ? Math.round((book.current_page / book.total_paragraphs) * 100) : 0;
                                    return (
                                        <div key={book.id} className="cr-shelf-in" style={{ position: 'relative', animationDelay: `${Math.min(i, 11) * 26}ms` }}>
                                            <button onClick={() => {
                                                if (editMode) {
                                                    setSelectedBooks(prev => { const s = new Set(prev); s.has(book.id) ? s.delete(book.id) : s.add(book.id); return s; });
                                                } else openBook(book);
                                            }} style={{
                                                background: 'none', padding: 0, border: 'none', cursor: 'pointer',
                                                textAlign: 'left', display: 'flex', flexDirection: 'column', width: '100%',
                                            }}>
                                                <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: '4px 12px 12px 4px', overflow: 'hidden', position: 'relative', background: book.cover_image ? '#f0ebe3' : BOOK_COVERS[i % BOOK_COVERS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '3px 3px 12px rgba(0,0,0,0.18), inset -2px 0 4px rgba(0,0,0,0.05)', borderLeft: `4px solid ${book.cover_image ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.08)'}`, opacity: editMode && selectedBooks.has(book.id) ? 0.6 : 1, transition: 'opacity 180ms ease-out' }}>
                                                    {editMode && (
                                                        <div className="cr-item-in" style={{ position: 'absolute', top: 6, left: 8, width: 22, height: 22, borderRadius: '50%', background: selectedBooks.has(book.id) ? INK : 'rgba(255,255,255,0.7)', border: `2px solid ${selectedBooks.has(book.id) ? INK : 'rgba(0,0,0,0.2)'}`, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {selectedBooks.has(book.id) && <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>✓</span>}
                                                        </div>
                                                    )}
                                                    {book.cover_image ? (
                                                        <img src={`${bridgeConfig.url}/v1/book-images/${book.id}/${book.cover_image}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <span style={{ fontSize: 22, fontWeight: 800, color: 'rgba(60,55,48,0.35)', padding: 8, textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-all' }}>{book.title.slice(0, 4)}</span>
                                                    )}
                                                    {(book as any).status === 'finished' && (
                                                        <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(255,255,255,0.85)', borderRadius: 8, padding: '1px 6px', fontSize: 9, fontWeight: 700, color: '#7a9e7e' }}>
                                                            读完
                                                        </div>
                                                    )}
                                                    {book.comment_count > 0 && (
                                                        <div style={{ position: 'absolute', top: (book as any).status === 'finished' ? 24 : 6, right: 6, background: 'rgba(255,255,255,0.8)', borderRadius: 8, padding: '1px 6px', fontSize: 9, fontWeight: 700, color: c.primaryDark }}>
                                                            {book.comment_count}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ padding: '8px 2px 0', overflow: 'hidden' }}>
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: INK, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as any}>{book.title}</div>
                                                    {/* iOS 图书式：不画进度条，书名下方左对齐小灰字（未读不显示） */}
                                                    {progress > 0 && (
                                                        <div style={{ padding: '2px 2px 0', fontSize: 10, fontWeight: 500, color: INK2, letterSpacing: '0.01em' }}>已读 {Math.min(progress, 100)}%</div>
                                                    )}
                                                </div>
                                            </button>
                                            {!editMode && (
                                                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(book.id); }}
                                                    style={{ position: 'absolute', top: 4, left: 8, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span style={{ color: 'white', fontSize: 12, lineHeight: 1 }}>×</span>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    /* Reading Mode — immersive, no card border */
                    <>
                        {readingLoading ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb', fontSize: 14 }}>
                                {paginateProgress != null ? (
                                    <>
                                        <div style={{ marginBottom: 12 }}>大书首次打开需要分页一次，之后秒开</div>
                                        {/* SPEC §8：加载条废掉默认紫，日夜走ink色系 */}
                                        <div style={{ width: 180, height: 4, borderRadius: 2, background: readerNightMode ? 'rgba(255,255,255,0.18)' : 'rgba(60,55,45,0.16)', margin: '0 auto 8px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 2, width: `${Math.round(paginateProgress * 100)}%`, background: readerNightMode ? '#ccc' : 'hsl(40,8%,16%)', transition: 'width 0.2s ease' }} />
                                        </div>
                                        <div style={{ fontSize: 12, color: '#ccc' }}>{Math.round(paginateProgress * 100)}%</div>
                                    </>
                                ) : '加载中...'}
                            </div>
                        ) : allParas.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 14 }}>这一页没有内容</div>
                        ) : (
                            <div data-page-content style={{ padding: READER_PAGE_PADDING, minHeight: pageHeight || undefined, boxSizing: 'border-box', overflow: 'hidden' }}>
                                {pageFragments.map((frag, visibleIndex) => {
                                    const original = allParas[frag.sourceIdx] || frag;
                                    const heading = isHeading(original.content) && !frag.isPartialStart;
                                    const chapterTitle = isChapterStart(original.content) && !frag.isPartialStart;
                                    const rawInline = commentsForPara(frag.idx).filter(x => x.sel_start_idx != null && x.sel_end_idx != null);
                                    const inlineComments = rawInline.map(h => {
                                        const endPara = h.sel_end_para_idx ?? h.paragraph_idx;
                                        let s = h.sel_start_idx!, e = h.sel_end_idx!;
                                        if (h.paragraph_idx === frag.idx && endPara === frag.idx) { /* single para */ }
                                        else if (h.paragraph_idx === frag.idx) { e = frag.endOffset; }
                                        else if (endPara === frag.idx) { s = frag.startOffset; }
                                        else { s = frag.startOffset; e = frag.endOffset; }
                                        return { ...h, sel_start_idx: s - frag.startOffset, sel_end_idx: e - frag.startOffset };
                                    }).filter(h => h.sel_end_idx! > 0 && h.sel_start_idx! < frag.content.length);

                                    const blockComments = commentsForPara(frag.idx).filter(x => (x.sel_start_idx == null || x.sel_end_idx == null) && x.paragraph_idx === frag.idx && !frag.isPartialStart);

                                    const imgMatch = frag.content.match(/^\[IMG:([^\]]+)\]$/);
                                    if (imgMatch && activeBook) {
                                        const imgUrl = `${bridgeConfig.url}/v1/book-images/${activeBook.id}/${imgMatch[1]}`;
                                        return (
                                            <div key={`${frag.idx}-${frag.startOffset}-${frag.endOffset}`} style={{ marginBottom: PARA_GAP, textAlign: 'center' }}>
                                                <img src={imgUrl} alt="" style={{ maxWidth: '100%', maxHeight: `${Math.floor(readerSize.height * 0.6)}px`, objectFit: 'contain', display: 'block', margin: '0 auto', borderRadius: 8 }} />
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={`${frag.idx}-${frag.startOffset}-${frag.endOffset}`} style={{ marginBottom: chapterTitle ? CHAPTER_GAP_BOTTOM : PARA_GAP, marginTop: chapterTitle && visibleIndex > 0 ? CHAPTER_GAP_TOP : 0 }}>
                                            <div data-para-idx={frag.idx} data-frag-start={frag.startOffset} data-frag-end={frag.endOffset} style={{
                                                fontSize: chapterTitle ? readerFontSize + 4 : original.content.trim().startsWith('# ') ? readerFontSize + 3 : original.content.trim().startsWith('## ') ? readerFontSize + 2 : readerFontSize,
                                                lineHeight: chapterTitle ? 2.2 : 1.85, color: readerNightMode ? (heading ? '#ddd' : '#ccc') : (heading ? '#222' : '#333'),
                                                letterSpacing: chapterTitle ? 1 : 0.3, textIndent: (heading || chapterTitle || frag.isPartialStart) ? 0 : '1.5em',
                                                fontWeight: chapterTitle ? 800 : heading ? 700 : 400, marginBottom: heading ? 4 : 0,
                                                textAlign: chapterTitle ? 'center' : undefined,
                                                userSelect: 'text', WebkitUserSelect: 'text', whiteSpace: 'pre-wrap',
                                                overflowWrap: 'anywhere', wordBreak: 'break-word',   // 长连写串允许折断，与分页测量器保持一致
                                            } as any}>
                                                {renderHighlighted(frag.content, frag.idx, inlineComments)}
                                            </div>

                                            {blockComments.length > 0 && (
                                                <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    {blockComments.filter(x => !x.reply_to).map(cmt => {
                                                        const isShen = isAiAuthor(cmt.from_who);
                                                        const color = isShen ? c.shenColor : c.tongColor;
                                                        return (
                                                            <span key={cmt.id} onClick={(e) => { e.stopPropagation(); const allR: Comment[] = []; const findR = (ids: number[]) => { const f = comments.filter(r => r.reply_to && ids.includes(r.reply_to)); if (f.length) { allR.push(...f); findR(f.map(x => x.id)); } }; findR([cmt.id]); setActiveComments(prev => prev.length > 0 && prev[0]?.id === cmt.id ? [] : [cmt, ...allR]); }}
                                                                style={{ width: 8, height: 8, borderRadius: '50%', background: color, cursor: 'pointer', display: 'inline-block', opacity: 0.7 }} />
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
                {mode === 'reading' && (
                    <div ref={measureRef} aria-hidden style={{
                        position: 'absolute',
                        top: -99999,
                        left: 0,
                        width: readerContentWidth,
                        visibility: 'hidden',
                        pointerEvents: 'none',
                        zIndex: -1,
                        boxSizing: 'border-box',
                        whiteSpace: 'normal',
                    }} />
                )}
            </div>

            {/* Floating annotation bar — appears when text is selected */}
            {floatingBar && mode === 'reading' && commentingIdx === null && (
                <div className="cr-pop-sm-c" style={{
                    position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                    background: readerNightMode ? '#ebe8e1' : 'hsl(40,8%,16%)', borderRadius: 20, padding: '10px 24px',
                    boxShadow: readerNightMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.15)', zIndex: 25, cursor: 'pointer',
                }}
                    onPointerDown={(e) => { e.preventDefault(); startAnnotation(); }}>
                    <span style={{ color: readerNightMode ? '#222' : '#fff', fontSize: 13, fontWeight: 600 }}>添加批注</span>
                </div>
            )}

            {mode === 'reading' && commentingIdx !== null && !replyingTo && (
                <div onClick={(e) => e.stopPropagation()} className="cr-rise-in" style={{
                    position: 'absolute', left: 16, right: 16, bottom: 20, zIndex: 32,
                    background: readerNightMode ? 'rgba(38,38,38,.62)' : 'rgba(252,252,252,.45)',
                    backdropFilter: 'blur(40px) saturate(1.8)', WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
                    borderRadius: 24, padding: 16,
                    border: readerNightMode ? '1px solid rgba(255,255,255,.07)' : '1px solid rgba(60,55,45,.08)',
                    boxShadow: readerNightMode ? '0 -4px 32px rgba(0,0,0,0.25)' : '0 -4px 32px rgba(0,0,0,0.08)',
                }}>
                    {selectedText && (
                        <div style={{ fontSize: 12, color: readerNightMode ? '#888' : '#777', fontStyle: 'italic', marginBottom: 10, padding: '8px 10px', background: readerNightMode ? 'rgba(255,255,255,.06)' : 'rgba(60,55,45,.05)', borderRadius: 12, lineHeight: 1.5, maxHeight: 96, overflow: 'auto' }} className="no-scrollbar">
                            {selectedText.length > 160 ? selectedText.slice(0, 160) + '...' : selectedText}
                        </div>
                    )}
                    <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="写下你的想法..."
                        style={{ width: '100%', minHeight: 72, border: 'none', background: 'transparent', fontSize: 14, color: readerNightMode ? '#ddd' : 'hsl(40,8%,22%)', resize: 'none', outline: 'none', lineHeight: 1.6 }} autoFocus />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                        <button onClick={() => { setCommentingIdx(null); setCommentText(''); setSelectedText(''); setSelRange(null); }}
                            style={{ background: 'none', border: `1px solid ${readerNightMode ? 'rgba(255,255,255,.1)' : 'rgba(60,55,45,.1)'}`, borderRadius: 12, padding: '7px 16px', fontSize: 12, color: readerNightMode ? '#888' : '#999', cursor: 'pointer' }}>取消</button>
                        <button onClick={handleAddComment}
                            style={{ background: readerNightMode ? '#ebe8e1' : 'hsl(40,8%,16%)', border: 'none', borderRadius: 12, padding: '7px 18px', fontSize: 12, color: readerNightMode ? '#222' : '#fff', cursor: 'pointer', fontWeight: 600, opacity: commentText.trim() ? 1 : 0.5 }}>保存</button>
                    </div>
                </div>
            )}

            {/* Note popup — shows all overlapping annotations (玻璃浮层，SPEC §5) */}
            {activeComments.length > 0 && (
                <div onClick={(e) => e.stopPropagation()} style={{
                    position: 'absolute', bottom: 20, left: 16, right: 16,
                    background: readerNightMode ? 'rgba(38,38,38,.62)' : 'rgba(252,252,252,.45)',
                    backdropFilter: 'blur(40px) saturate(1.8)',
                    WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
                    borderRadius: 24, padding: '16px 20px',
                    border: readerNightMode ? '1px solid rgba(255,255,255,.07)' : '1px solid rgba(60,55,45,.08)',
                    boxShadow: readerNightMode ? '0 -4px 32px rgba(0,0,0,0.25)' : '0 -4px 32px rgba(0,0,0,0.08)',
                    zIndex: 20, maxHeight: '50vh', overflow: 'auto',
                }} className="no-scrollbar cr-rise-in">
                    <button onClick={() => setActiveComments([])} style={{ position: 'absolute', top: 10, right: 14, background: 'none', border: 'none', fontSize: 18, color: readerNightMode ? '#666' : '#ccc', cursor: 'pointer', lineHeight: 1, zIndex: 1 }}>×</button>
                    {(() => {
                        const topLevel = activeComments.filter(ac => !ac.reply_to);
                        const replies = activeComments.filter(ac => ac.reply_to);
                        const inkColor = readerNightMode ? '#ccc' : 'hsl(40,8%,16%)';
                        const subColor = readerNightMode ? '#888' : '#999';
                        const dividerColor = readerNightMode ? 'rgba(255,255,255,.08)' : 'rgba(60,55,45,.08)';
                        const renderComment = (ac: Comment, indent: boolean) => {
                            const isShen = isAiAuthor(ac.from_who);
                            return (
                                <div key={ac.id} style={{ marginLeft: indent ? 28 : 0, marginBottom: 12, paddingBottom: 12, borderBottom: indent ? 'none' : `1px solid ${dividerColor}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: inkColor }}>{ac.from_who}</span>
                                        <span style={{ fontSize: 10, color: subColor }}>{ac.created_at?.slice(0, 16).replace('T', ' ')}</span>
                                    </div>
                                    {ac.selected_text && (
                                        <div style={{ fontSize: 12, color: subColor, fontStyle: 'italic', padding: '8px 12px', marginBottom: 10, background: readerNightMode ? 'rgba(255,255,255,.06)' : 'rgba(60,55,45,.05)', borderRadius: 12, lineHeight: 1.5 }}>
                                            {ac.selected_text}
                                        </div>
                                    )}
                                    <div style={{ fontSize: 14, color: readerNightMode ? '#ddd' : 'hsl(40,8%,22%)', lineHeight: 1.7, marginBottom: 8 }}>{ac.content}</div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                        <button onClick={() => { replyPageRef.current = page; setReplyingTo(ac); setCommentingIdx(ac.paragraph_idx); setCommentText(''); }} style={{ background: 'none', border: `1px solid ${dividerColor}`, borderRadius: 10, padding: '4px 14px', fontSize: 11, color: inkColor, cursor: 'pointer' }}>回复</button>
                                        {!isShen && (
                                            <button onClick={() => handleDeleteComment(ac)} style={{ background: 'none', border: `1px solid ${readerNightMode ? 'rgba(255,100,100,.2)' : 'rgba(200,100,100,.2)'}`, borderRadius: 10, padding: '4px 14px', fontSize: 11, color: readerNightMode ? '#c88' : '#d88', cursor: 'pointer' }}>删除</button>
                                        )}
                                    </div>
                                </div>
                            );
                        };
                        const renderThread = (parent: Comment, depth: number) => (
                            <React.Fragment key={parent.id}>
                                {renderComment(parent, depth > 0)}
                                {replies.filter(r => r.reply_to === parent.id).map(r => renderThread(r, depth + 1))}
                            </React.Fragment>
                        );
                        return topLevel.map(ac => renderThread(ac, 0));
                    })()}
                    {replyingTo && (
                        <div style={{ marginTop: 8, padding: '10px 12px', background: readerNightMode ? 'rgba(255,255,255,.06)' : 'rgba(60,55,45,.04)', borderRadius: 14, border: `1px solid ${readerNightMode ? 'rgba(255,255,255,.08)' : 'rgba(60,55,45,.08)'}` }}>
                            <div style={{ fontSize: 11, color: readerNightMode ? '#888' : '#999', marginBottom: 6 }}>回复 {replyingTo.from_who}：{replyingTo.content.slice(0, 30)}{replyingTo.content.length > 30 ? '…' : ''}</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="写回复…" style={{ flex: 1, border: `1px solid ${readerNightMode ? 'rgba(255,255,255,.1)' : 'rgba(60,55,45,.1)'}`, borderRadius: 10, padding: '6px 12px', fontSize: 13, outline: 'none', background: readerNightMode ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.6)', color: readerNightMode ? '#ddd' : '#333' }} onKeyDown={e => e.key === 'Enter' && handleAddComment()} />
                                <button onClick={handleAddComment} style={{ background: readerNightMode ? '#ebe8e1' : 'hsl(40,8%,16%)', color: readerNightMode ? '#222' : '#fff', border: 'none', borderRadius: 10, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>发送</button>
                                <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: `1px solid ${readerNightMode ? 'rgba(255,255,255,.1)' : 'rgba(60,55,45,.1)'}`, borderRadius: 10, padding: '6px 10px', fontSize: 12, color: readerNightMode ? '#888' : '#999', cursor: 'pointer' }}>×</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 跳回图标（彤宝点菜：很小的圆形图标内含返回箭头+旁边页数，整块可点）：跳批注后左上角出现，点了跳回原进度并消失 */}
            {mode === 'reading' && returnPoint && (
                <button onClick={(e) => { e.stopPropagation(); returnToReadingPosition(); }} className="cr-item-in" style={{
                    position: 'absolute', top: 'calc(8px + env(safe-area-inset-top))', left: 12, zIndex: 28,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <span style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: readerNightMode ? 'rgba(255,255,255,0.85)' : 'rgba(40,36,28,0.72)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: readerNightMode ? '#222' : '#fff',
                        boxShadow: readerNightMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(40,35,25,0.22)',
                    }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.8 2.6L2.4 5l2.4 2.4M2.4 5h4.4a2.8 2.8 0 012.8 2.8v1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: readerNightMode ? '#aaa' : 'hsl(40,8%,16%)', lineHeight: 1 }}>{returnPoint.page}</span>
                </button>
            )}

            {/* 新批注小胶囊（SPEC-v1 §5）：署名跟随写批注的人，谁写的就是谁·批注 */}
            {mode === 'reading' && newReplies.length > 0 && !showReplies && (
                <div onClick={(e) => { e.stopPropagation(); setShowReplies(true); }} style={{
                    position: 'absolute', bottom: 39, right: 70, zIndex: 17,
                    background: readerNightMode ? 'rgba(38,38,38,0.65)' : 'linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0) 40%), rgba(252,252,252,0.55)',
                    backdropFilter: 'blur(22px) saturate(1.8)', WebkitBackdropFilter: 'blur(22px) saturate(1.8)',
                    border: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.07)' : 'rgba(60,55,45,0.08)'}`,
                    borderRadius: 999, padding: '8px 14px',
                    boxShadow: readerNightMode ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(40,35,25,0.15)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    animation: 'crRiseIn 190ms cubic-bezier(0.23, 1, 0.32, 1) both, pulse 2s ease-in-out 190ms infinite',
                    transition: 'bottom 0.3s ease',
                }}>
                    <span style={{ color: readerNightMode ? '#ddd' : INK, fontSize: 12, fontWeight: 600 }}>
                        {(() => { const names = [...new Set(newReplies.map(r => r.from_who).filter(Boolean))]; const who = names.length === 0 ? '新' : names.length === 1 ? names[0] : `${names[0]} 等`; return `${who} · ${newReplies.length} 条新批注`; })()}
                    </span>
                </div>
            )}

            {/* 批注回复弹窗（SPEC-v1 §5）：玻璃壳，点遮罩任意处收起 */}
            {showReplies && newReplies.length > 0 && (
                <>
                    <div style={{ position: 'absolute', inset: 0, zIndex: 29 }} onClick={(e) => { e.stopPropagation(); setShowReplies(false); }} />
                    <div onClick={(e) => e.stopPropagation()} style={{
                        position: 'absolute', bottom: 20, right: 16, left: 16, zIndex: 30, borderRadius: 24,
                        background: readerNightMode ? 'rgba(38,38,38,0.75)' : 'linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0) 40%), rgba(252,252,252,0.72)',
                        backdropFilter: 'blur(40px) saturate(1.8)', WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
                        border: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.07)' : 'rgba(60,55,45,0.08)'}`,
                        padding: '16px 18px',
                        boxShadow: readerNightMode ? '0 -4px 32px rgba(0,0,0,0.5)' : '0 -4px 32px rgba(40,35,25,0.14), inset 0 1px 0 rgba(255,255,255,0.5)', maxHeight: '55vh', overflow: 'auto',
                    }} className="no-scrollbar cr-rise-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: readerNightMode ? '#ddd' : INK }}>最新批注回复</span>
                            <button onClick={dismissReplies} style={{ background: readerNightMode ? 'rgba(255,255,255,0.10)' : 'rgba(60,55,45,0.08)', border: 'none', borderRadius: 999, padding: '5px 14px', fontSize: 11, color: readerNightMode ? '#999' : INK2, cursor: 'pointer' }}>已读</button>
                        </div>
                        {newReplies.map(r => (
                            <div key={r.id} onClick={() => openReplyNotice(r)} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.07)' : 'rgba(60,55,45,0.08)'}`, cursor: 'pointer' }}>
                                {r.parent_content && (
                                    <div style={{ fontSize: 11, color: readerNightMode ? '#888' : INK2, marginBottom: 6, padding: '4px 10px', background: readerNightMode ? 'rgba(255,255,255,0.05)' : 'rgba(60,55,45,0.05)', borderRadius: 8, borderLeft: `2px solid ${readerNightMode ? 'rgba(255,255,255,0.18)' : 'rgba(60,55,45,0.20)'}` }}>
                                        {r.parent_from}: {r.parent_content.length > 40 ? r.parent_content.slice(0, 40) + '...' : r.parent_content}
                                    </div>
                                )}
                                <div style={{ fontSize: 12, fontWeight: 600, color: readerNightMode ? '#ddd' : INK, marginBottom: 3 }}>{r.from_who || aiName} · 批注</div>
                                <div style={{ fontSize: 13, color: readerNightMode ? '#ccc' : 'hsl(40,6%,30%)', lineHeight: 1.6 }}>{r.content}</div>
                                <div style={{ fontSize: 10, color: readerNightMode ? '#777' : '#aaa', marginTop: 4 }}>{(() => { const pg = findPageForParaIdx(r.paragraph_idx, totalPages, r.sel_start_idx ?? 0); return pg >= 0 ? `p${pg + 1}` : (r as any).page ? `p${(r as any).page}` : ''; })()} · 点开定位到原文</div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* 阅读页底部Chrome（SPEC §8）：旧滑出底栏已整条退役，只留页码+右下≡ */}
            {mode === 'reading' && (
                <>
                    {/* Page number — always visible at bottom center */}
                    <div style={{
                        position: 'absolute', bottom: 12, left: 0, right: 0,
                        textAlign: 'center', fontSize: 11, color: '#bbb', zIndex: 5,
                        pointerEvents: 'none',
                    }}>
                        {page} / {totalPages} 页
                    </div>

                    {/* ≡ 浮钮（SPEC-v1 §2）：雾面玻璃，菜单开时隐身 */}
                    <button onClick={(e) => { e.stopPropagation(); openReaderMenu(); }} style={{
                        position: 'absolute', right: 16, bottom: 30, width: 44, height: 44, borderRadius: '50%', zIndex: 18,
                        background: readerNightMode ? 'rgba(40,40,40,0.55)' : 'rgba(255,255,255,0.5)',
                        backdropFilter: 'blur(22px) saturate(1.8)', WebkitBackdropFilter: 'blur(22px) saturate(1.8)',
                        border: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.08)' : 'rgba(60,55,45,0.10)'}`,
                        boxShadow: readerNightMode ? '0 2px 10px rgba(0,0,0,0.4)' : '0 2px 10px rgba(60,55,45,0.10), inset 0 1px 0 rgba(255,255,255,0.55)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        color: readerNightMode ? '#ddd' : INK,
                        visibility: readerMenuPhase === 'closed' ? 'visible' : 'hidden',
                        opacity: fabVisible ? 1 : 0, pointerEvents: fabVisible ? 'auto' : 'none',
                        transition: 'opacity 180ms ease',
                    }}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 5h12M3 9h12M3 13h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                    </button>

                    {/* 浮层菜单：三行（目录/阅读设置/阅读钟开关）+ 三小块（所有批注/导出/阅读钟统计） */}
                    {readerMenuPhase !== 'closed' && (
                        <>
                            <div style={{ position: 'absolute', inset: 0, zIndex: 19 }} onClick={(e) => { e.stopPropagation(); closeReaderMenu(); }} />
                            <div onClick={(e) => e.stopPropagation()}
                                className={'hy-reader ' + (readerMenuPhase === 'anim' ? 'cr-rmenu-anim' : readerMenuPhase === 'closing' ? 'cr-rmenu-closing' : '')}
                                style={{
                                    position: 'absolute', right: 8, bottom: 44, width: 196, zIndex: 20, borderRadius: 24,
                                    background: readerNightMode ? 'rgba(38,38,38,0.6)' : 'linear-gradient(rgba(255,255,255,0.28), rgba(255,255,255,0) 40%), rgba(252,252,252,0.36)',
                                    backdropFilter: 'var(--hyalite, blur(56px) saturate(1.8))', WebkitBackdropFilter: 'var(--hyalite, blur(56px) saturate(1.8))',
                                    boxShadow: 'var(--hyalite-edge, 0 0 0 0 transparent), ' + (readerNightMode ? '0 16px 50px rgba(0,0,0,0.5)' : '0 16px 50px rgba(60,55,45,0.14), inset 0 1px 0 rgba(255,255,255,0.5)'),
                                    border: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.07)' : 'rgba(60,55,45,0.08)'}`,
                                    padding: 6, transformOrigin: 'calc(100% - 30px) calc(100% + 8px)',
                                }}>
                                {(() => {
                                    const mInk = readerNightMode ? '#ddd' : INK;
                                    const mInk2 = readerNightMode ? '#888' : INK2;
                                    const mIcon = readerNightMode ? 'rgba(255,255,255,0.7)' : 'rgba(40,36,28,0.72)';
                                    const rowSt: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '9px 12px', borderRadius: 16, cursor: 'pointer' };
                                    const labelSt: React.CSSProperties = { fontSize: 14, color: mInk, flex: 1, letterSpacing: '-0.01em' };
                                    const pct = totalPages > 1 ? Math.max(1, Math.round((page / totalPages) * 100)) : 1;
                                    return (
                                        <>
                                            <div style={rowSt} onClick={() => { closeReaderMenu(); setTocPhase('open'); setShowToc(true); }}>
                                                <span style={labelSt}>目录<span style={{ fontSize: 11, color: mInk2, marginLeft: 6 }}>· {pct}%</span></span>
                                                <svg width="17" height="17" viewBox="0 0 17 17" fill="none" style={{ color: mIcon, flexShrink: 0 }}><path d="M3 4.5h11M3 8.5h11M3 12.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                            </div>
                                            <div style={rowSt} onClick={() => { closeReaderMenu(); setSheetPhase('open'); }}>
                                                <span style={labelSt}>阅读设置</span>
                                                <svg width="17" height="17" viewBox="0 0 17 17" fill="none" style={{ color: mIcon, flexShrink: 0 }}><path d="M3 12.5V4.8c0-.4.4-.8.8-.8H8v8.5H3.8c-.4 0-.8-.4-.8-.8zM14 12.5V4.8c0-.4-.4-.8-.8-.8H9v8.5h4.2c.4 0 .8-.4.8-.8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                                            </div>
                                            <div style={rowSt} onClick={() => { const v = !readingClock; setReadingClock(v); localStorage.setItem('coread-reading-clock', String(v)); }}>
                                                <span style={labelSt}>阅读钟</span>
                                                <span style={{
                                                    width: 40, height: 24, borderRadius: 12, position: 'relative', flexShrink: 0,
                                                    background: readingClock ? (readerNightMode ? 'rgba(221,221,221,0.85)' : INK) : (readerNightMode ? 'rgba(255,255,255,0.16)' : 'rgba(60,55,45,0.14)'),
                                                    transition: 'background 180ms cubic-bezier(0.23,1,0.32,1)',
                                                }}>
                                                    <span style={{
                                                        position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%',
                                                        background: readingClock && readerNightMode ? '#333' : readerNightMode ? '#ddd' : '#fff',
                                                        boxShadow: '0 1px 4px rgba(40,35,25,0.25)',
                                                        transform: readingClock ? 'translateX(16px)' : 'translateX(0)',
                                                        transition: 'transform 180ms cubic-bezier(0.23,1,0.32,1)',
                                                    }} />
                                                </span>
                                            </div>
                                            <div style={{ height: 0.5, background: readerNightMode ? 'rgba(255,255,255,0.12)' : 'hsla(40,10%,40%,0.16)', margin: '4px 12px' }} />
                                            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '6px 8px' }}>
                                                <div title="所有批注" onClick={() => { closeReaderMenu(); setAllNotesPhase('open'); }} style={{ width: 46, height: 36, borderRadius: 14, background: readerNightMode ? 'rgba(255,255,255,0.08)' : 'rgba(60,55,45,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mInk, cursor: 'pointer' }}>
                                                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="2.6" y="3.2" width="11.8" height="9.4" rx="2.8" stroke="currentColor" strokeWidth="1.3"/><path d="M5.6 6.6h5.8M5.6 9.3h3.8" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round"/></svg>
                                                </div>
                                                <div title="导出文本" onClick={() => { closeReaderMenu(); handleExport(); }} style={{ width: 46, height: 36, borderRadius: 14, background: readerNightMode ? 'rgba(255,255,255,0.08)' : 'rgba(60,55,45,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mInk, cursor: 'pointer' }}>
                                                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M8.5 9.8V2.5M8.5 2.5L6.2 4.8M8.5 2.5l2.3 2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.3 8.6v2.9a2.2 2.2 0 002.2 2.2h6a2.2 2.2 0 002.2-2.2V8.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                                                </div>
                                                <div title="本书统计" onClick={() => { closeReaderMenu(); openStatsDrawer('book'); }} style={{ width: 46, height: 36, borderRadius: 14, background: readerNightMode ? 'rgba(255,255,255,0.08)' : 'rgba(60,55,45,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mInk, cursor: 'pointer' }}>
                                                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="5.7" stroke="currentColor" strokeWidth="1.3"/><path d="M8.5 5.3v3.2l2.3 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </>
                    )}

                    {/* 阅读设置抽屉（SPEC-v1 §3）：玻璃壳，亮度/字号/日夜间 */}
                    {sheetPhase !== 'closed' && (
                        <>
                            <div className={sheetPhase === 'closing' ? 'cr-scrim-out' : 'cr-scrim-in'}
                                onClick={(e) => { e.stopPropagation(); setSheetPhase('closing'); setTimeout(() => setSheetPhase(p => p === 'closing' ? 'closed' : p), 240); }}
                                style={{ position: 'absolute', inset: 0, zIndex: 25, background: readerNightMode ? 'rgba(0,0,0,0.5)' : 'rgba(30,26,20,0.35)' }} />
                            <div onClick={(e) => e.stopPropagation()}
                                className={sheetPhase === 'closing' ? 'cr-sheet-out' : 'cr-sheet-in'}
                                style={{
                                    position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 26, borderRadius: 24,
                                    background: readerNightMode ? 'rgba(38,38,38,0.65)' : 'linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0) 40%), rgba(252,252,252,0.5)',
                                    backdropFilter: 'blur(40px) saturate(1.8)', WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
                                    boxShadow: readerNightMode ? '0 -8px 40px rgba(0,0,0,0.5)' : '0 -8px 40px rgba(40,35,25,0.18), inset 0 1px 0 rgba(255,255,255,0.5)',
                                    border: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.07)' : 'rgba(60,55,45,0.08)'}`,
                                    padding: '16px 16px 18px',
                                }}>
                                {(() => {
                                    const sInk = readerNightMode ? '#ddd' : INK;
                                    const sInk2 = readerNightMode ? '#888' : INK2;
                                    const briPct = (readerBrightness - 30) / 70;
                                    return (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                                                <span style={{ fontSize: 15, fontWeight: 700, color: sInk }}>阅读设置</span>
                                                <button onClick={() => { setSheetPhase('closing'); setTimeout(() => setSheetPhase(p => p === 'closing' ? 'closed' : p), 240); }}
                                                    style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: '50%', background: readerNightMode ? 'rgba(255,255,255,0.10)' : 'rgba(60,55,45,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: readerNightMode ? '#999' : INK2, cursor: 'pointer' }}>
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                                                </button>
                                            </div>
                                            {/* 亮度滑杆：视觉自绘（圆头轨道+白knob），交互原生 range 覆盖 */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '0 4px' }}>
                                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: sInk2, flexShrink: 0 }}><circle cx="7" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.2"/><path d="M7 1.5v1.3M7 11.2v1.3M1.5 7h1.3M11.2 7h1.3M3.2 3.2l.9.9M9.9 9.9l.9.9M10.8 3.2l-.9.9M4.1 9.9l-.9.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                                                <div style={{ position: 'relative', flex: 1, height: 22, display: 'flex', alignItems: 'center' }}>
                                                    <div style={{ position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 999, background: readerNightMode ? 'rgba(255,255,255,0.18)' : 'rgba(60,55,45,0.16)' }}>
                                                        <div style={{ width: `${briPct * 100}%`, height: '100%', borderRadius: 999, background: readerNightMode ? '#ccc' : INK }} />
                                                    </div>
                                                    <div style={{ position: 'absolute', left: `calc((100% - 20px) * ${briPct})`, width: 20, height: 20, borderRadius: '50%', background: readerNightMode ? '#ddd' : '#fff', boxShadow: '0 1px 5px rgba(40,35,25,0.25)', pointerEvents: 'none' }} />
                                                    <input type="range" min={30} max={100} step={1} value={readerBrightness}
                                                        onChange={e => { const v = parseInt(e.target.value, 10); setReaderBrightness(v); localStorage.setItem('coread-brightness', String(v)); }}
                                                        style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', margin: 0 }} />
                                                </div>
                                                <svg width="17" height="17" viewBox="0 0 17 17" fill="none" style={{ color: sInk2, flexShrink: 0 }}><circle cx="8.5" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.3"/><path d="M8.5 1.5v1.7M8.5 13.8v1.7M1.5 8.5h1.7M13.8 8.5h1.7M3.5 3.5l1.2 1.2M12.3 12.3l1.2 1.2M13.5 3.5l-1.2 1.2M4.7 12.3l-1.2 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                                            </div>
                                            {/* 字号分段：整根胶囊 */}
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, borderRadius: 999, overflow: 'hidden', border: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.12)' : 'rgba(60,55,45,0.12)'}`, background: readerNightMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)' }}>
                                                <button onClick={() => { const v = Math.max(12, readerFontSize - 1); setReaderFontSize(v); localStorage.setItem('coread-font-size', String(v)); }}
                                                    style={{ flex: 1, padding: '9px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: sInk }}>
                                                    A<span style={{ fontSize: 10, verticalAlign: 'super' }}>−</span>
                                                </button>
                                                <span style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, color: sInk, textAlign: 'center', minWidth: 40, borderLeft: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.12)' : 'rgba(60,55,45,0.12)'}`, borderRight: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.12)' : 'rgba(60,55,45,0.12)'}` }}>
                                                    {readerFontSize}
                                                </span>
                                                <button onClick={() => { const v = Math.min(22, readerFontSize + 1); setReaderFontSize(v); localStorage.setItem('coread-font-size', String(v)); }}
                                                    style={{ flex: 1, padding: '9px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: sInk }}>
                                                    A<span style={{ fontSize: 10, verticalAlign: 'super' }}>+</span>
                                                </button>
                                            </div>
                                            {/* 日间/夜间胶囊：图标13px+gap5 → 右垫9px 补偿让字眼正居中（SPEC §3） */}
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button onClick={() => { setReaderNightMode(false); localStorage.setItem('coread-night-mode', 'false'); }}
                                                    style={{ flex: 1, padding: '9px 18px 9px 0', borderRadius: 999, border: `1.5px solid ${!readerNightMode ? INK : (readerNightMode ? 'rgba(255,255,255,0.12)' : 'rgba(60,55,45,0.10)')}`, background: !readerNightMode ? 'rgba(60,55,45,0.07)' : 'transparent', cursor: 'pointer', fontSize: 13, color: !readerNightMode ? INK : (readerNightMode ? '#888' : INK2), fontWeight: !readerNightMode ? 600 : 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ display: 'block', flexShrink: 0 }}><circle cx="6.5" cy="6.5" r="2.4" stroke="currentColor" strokeWidth="1.2"/><path d="M6.5 1.4v1M6.5 10.6v1M1.4 6.5h1M10.6 6.5h1M2.9 2.9l.7.7M9.4 9.4l.7.7M10.1 2.9l-.7.7M3.6 9.4l-.7.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>日间
                                                </button>
                                                <button onClick={() => { setReaderNightMode(true); localStorage.setItem('coread-night-mode', 'true'); }}
                                                    style={{ flex: 1, padding: '9px 18px 9px 0', borderRadius: 999, border: `1.5px solid ${readerNightMode ? '#aaa' : 'rgba(60,55,45,0.10)'}`, background: readerNightMode ? 'rgba(255,255,255,0.10)' : 'transparent', cursor: 'pointer', fontSize: 13, color: readerNightMode ? '#eee' : INK2, fontWeight: readerNightMode ? 600 : 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ display: 'block', flexShrink: 0 }}><path d="M11.4 6.9A4.9 4.9 0 1 1 6.1 1.6 3.8 3.8 0 0 0 11.4 6.9z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>夜间
                                                </button>
                                            </div>
                                            {/* 翻页方式：微信读书款分段滑块，白thumb回弹（彤彤 2026-09-18） */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: sInk, flexShrink: 0 }}>翻页</span>
                                                <div style={{ position: 'relative', flex: 1, height: 34, borderRadius: 999, background: readerNightMode ? 'rgba(255,255,255,0.08)' : 'rgba(60,55,45,0.08)', display: 'flex' }}>
                                                    <div style={{
                                                        position: 'absolute', top: 3, bottom: 3, width: 'calc(50% - 3px)',
                                                        left: tapTurn ? '50%' : 3,
                                                        borderRadius: 999, background: readerNightMode ? '#3a3a3a' : '#fff',
                                                        boxShadow: '0 1px 6px rgba(40,35,25,0.22)',
                                                        transition: 'left .42s cubic-bezier(0.34, 1.65, 0.5, 1)',
                                                    }} />
                                                    {([['滑动', false], ['点按', true]] as [string, boolean][]).map(([label, val]) => (
                                                        <button key={label} onClick={() => { setTapTurn(val); localStorage.setItem('coread-tap-turn', String(val)); }}
                                                            style={{
                                                                flex: 1, position: 'relative', zIndex: 1, background: 'none', border: 'none', cursor: 'pointer',
                                                                fontSize: 13, color: tapTurn === val ? sInk : sInk2,
                                                                fontWeight: tapTurn === val ? 700 : 400,
                                                                transition: 'color .25s, font-weight .25s',
                                                            }}>{label}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* 名字设置（coread 移植保留，彤彤点名不许丢）：批注作者名随改随存 */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: sInk, flexShrink: 0 }}>名字</span>
                                                <input value={humanName} onChange={e => { setHumanName(e.target.value); localStorage.setItem('coread-human-name', e.target.value); }}
                                                    placeholder="我的名字"
                                                    style={{ flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 12, border: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.12)' : 'rgba(60,55,45,0.12)'}`, background: readerNightMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)', fontSize: 13, color: sInk, outline: 'none' }} />
                                                <input value={aiName} onChange={e => { setAiName(e.target.value); localStorage.setItem('coread-ai-name', e.target.value); }}
                                                    placeholder="AI 的名字"
                                                    style={{ flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 12, border: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.12)' : 'rgba(60,55,45,0.12)'}`, background: readerNightMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)', fontSize: 13, color: sInk, outline: 'none' }} />
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ⋯ 收纳菜单（重设计 v1）：雾面玻璃，从 ⋯ 按钮 morph 出来，右缘与 + 右缘对齐 */}
            {menuPhase !== 'closed' && (
                <>
                    {/* 点窗外两级退出：功能页 → 退回列表层；列表层 → 整窗收回 */}
                    <div style={{ position: 'absolute', inset: 0, zIndex: 19 }}
                        onClick={() => { if (menuDetail) closeMenuDetail(); else setShowMenu(false); }} />
                    <div ref={menuRef}
                        className={'hy-shelf ' + (menuPhase === 'anim' ? 'cr-pop-anim' : menuPhase === 'closing' ? 'cr-pop-closing' : '')}
                        style={{ ...glassPop, width: 'min(200px, 58vw)', top: 'calc(88px + env(safe-area-inset-top))', transformOrigin: 'calc(100% - 67px) -17px' }}>
                        <div className="cr-views">
                            <div className="cr-view cr-view-list">
                                {([
                                    { key: 'records' as const, label: '阅读统计', icon: <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8.5 5v3.5l2.4 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
                                    { key: 'manage' as const, label: '管理书籍', icon: <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="3" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="2.5" y="7.5" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="2.5" y="12" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg> },
                                    { key: 'backup' as const, label: '备份与恢复', icon: <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M4.5 12.5a3 3 0 01-.6-5.94A4.2 4.2 0 0112.3 7a2.8 2.8 0 01-.3 5.5H4.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M8.5 8.5v4M8.5 8.5L6.8 10.2M8.5 8.5l1.7 1.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                                ]).map((item, i) => (
                                    <div key={item.key} className={menuPhase === 'anim' ? 'cr-item-in' : ''}
                                        onClick={() => { if (item.key === 'records') { setShowMenu(false); openStatsDrawer('global'); } else openMenuDetail(item.key); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 13, cursor: 'pointer', color: INK, animationDelay: `${40 + i * 24}ms` }}>
                                        <span style={{ flexShrink: 0, opacity: 0.85, display: 'flex' }}>{item.icon}</span>
                                        <span style={{ fontSize: 14, flex: 1, letterSpacing: '-0.01em' }}>{item.label}</span>
                                        <span style={{ fontSize: 14, color: 'hsl(245,10%,72%)', fontWeight: 600 }}>›</span>
                                    </div>
                                ))}
                            </div>
                            <div className="cr-view cr-view-detail">
                                {menuDetail === 'manage' && (
                                    <>
                                        <div onClick={closeMenuDetail} style={vdHead}>
                                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ opacity: 0.85 }}><path d="M9.5 3L5 7.5L9.5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            <span style={{ fontSize: 14, fontWeight: 600, flex: 1, letterSpacing: '-0.01em' }}>管理书籍</span>
                                        </div>
                                        <div style={{ height: '0.5px', background: 'hsla(245,20%,40%,0.12)', margin: '4px 11px' }} />
                                        {([
                                            { key: 'delete' as const, label: '批量删除', desc: '选择书籍从书架移除' },
                                            { key: 'cache' as const, label: '清除分页缓存', desc: '选择书籍清除阅读缓存' },
                                        ]).map(item => (
                                            <div key={item.key} onClick={() => { setShowMenu(false); setManageAction(item.key); setEditMode(true); setSelectedBooks(new Set()); }}
                                                style={{ padding: '7px 11px', cursor: 'pointer' }}>
                                                <div style={{ fontSize: 13, color: INK }}>{item.label}</div>
                                                <div style={{ fontSize: 11, color: INK2, marginTop: 1 }}>{item.desc}</div>
                                            </div>
                                        ))}
                                        <div onClick={toggleDoor} style={{ padding: '7px 11px', cursor: 'pointer' }}>
                                            <div style={{ fontSize: 13, color: doorLocked ? '#16a34a' : '#ea580c' }}>{doorLocked ? '开门（解除锁定）' : '关门上锁'}</div>
                                            <div style={{ fontSize: 11, color: INK2, marginTop: 1 }}>{doorLocked ? '当前已关门：哥哥读不了书' : '锁上后哥哥无法开门读书，只有你能开'}</div>
                                        </div>
                                    </>
                                )}
                                {menuDetail === 'backup' && (
                                    <>
                                        <div onClick={closeMenuDetail} style={vdHead}>
                                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ opacity: 0.85 }}><path d="M9.5 3L5 7.5L9.5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            <span style={{ fontSize: 14, fontWeight: 600, flex: 1, letterSpacing: '-0.01em' }}>备份与恢复</span>
                                        </div>
                                        <div style={{ height: '0.5px', background: 'hsla(245,20%,40%,0.12)', margin: '4px 11px' }} />
                                        <div onClick={doBackupExport} style={{ padding: '7px 11px', cursor: 'pointer', opacity: backupBusy ? 0.5 : 1 }}>
                                            <div style={{ fontSize: 13, color: INK }}>{backupBusy ? '处理中…' : '导出备份'}</div>
                                            <div style={{ fontSize: 11, color: INK2, marginTop: 1 }}>书库+批注+进度+图片打包成文件</div>
                                        </div>
                                        <div onClick={doBackupList} style={{ padding: '7px 11px', cursor: 'pointer', opacity: backupBusy ? 0.5 : 1 }}>
                                            <div style={{ fontSize: 13, color: INK }}>恢复备份</div>
                                            <div style={{ fontSize: 11, color: INK2, marginTop: 1 }}>从已有备份恢复整个书库</div>
                                        </div>
                                        {backupFiles !== null && (
                                            <div style={{ margin: '0 11px 4px', padding: '4px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.4)' }}>
                                                {backupFiles.length === 0 && <div style={{ fontSize: 12, color: INK2, padding: '6px 0' }}>服务器上还没有备份，先点上面导出一份</div>}
                                                {backupFiles.map(f => (
                                                    <div key={f.file} style={{ display: 'flex', alignItems: 'center', borderBottom: '0.5px solid hsla(245,20%,40%,0.10)' }}>
                                                        <div onClick={() => doBackupPreview({ file: f.file }, fmtBackupTime(f.mtime))}
                                                            style={{ flex: 1, minWidth: 0, fontSize: 12, color: INK, padding: '6px 0', cursor: 'pointer', overflowWrap: 'anywhere' }}>
                                                            {fmtBackupTime(f.mtime)} · {(f.bytes / 1048576).toFixed(0)}MB
                                                        </div>
                                                        <div onClick={async () => {
                                                            // 单个删除（沉哥 2026-09-20：424MB/个，盘 78%）
                                                            try { await fetch(`${bridgeConfig.url}/v1/coread-backup/delete`, { method: 'POST', headers: backupHeaders, body: JSON.stringify({ file: f.file }) }); } catch {}
                                                            setBackupFiles(prev => prev ? prev.filter(x => x.file !== f.file) : prev);
                                                        }} style={{ flexShrink: 0, padding: '4px 6px', fontSize: 13, color: INK2, cursor: 'pointer' }}>×</div>
                                                    </div>
                                                ))}
                                                <div onClick={() => restoreFileRef.current?.click()} style={{ fontSize: 12, color: INK, padding: '6px 0', cursor: 'pointer' }}>从本机选择备份文件…</div>
                                            </div>
                                        )}
                                        <div onClick={async () => {
                                            // 修复旧书跳转（彤彤 2026-09-20）：调用服务端重建引擎；引擎（task-1789848213232-2cn65p）未上线时如实提示
                                            setShowMenu(false);
                                            try {
                                                const r = await fetch(`${bridgeConfig.url}/v1/books/repair-jumps`, { method: 'POST' });
                                                if (r.status === 404 || r.status === 501) { addToast?.('修复引擎还在路上（小1评估中），上线后这里直接可用'); return; }
                                                const d = await r.json();
                                                addToast?.(d.message || `修复完成：${d.repaired ?? 0} 本`);
                                                loadBooks();
                                            } catch { addToast?.('修复引擎还在路上（小1评估中），上线后这里直接可用'); }
                                        }} style={{ padding: '7px 11px', cursor: 'pointer' }}>
                                            <div style={{ fontSize: 13, color: INK }}>修复旧书跳转</div>
                                            <div style={{ fontSize: 11, color: INK2, marginTop: 1 }}>重建老书的标注点击跳转，不用重新传书</div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* + 上传面板（重设计 v1）：同款玻璃，top 50px 整个盖住 ⋯ 和 + 位置；条目接现有上传逻辑 */}
            {panelPhase !== 'closed' && (
                <>
                    <div style={{ position: 'absolute', inset: 0, zIndex: 19 }}
                        onClick={() => { if (!uploading) setShowUpload(false); }} />
                    <div ref={panelRef}
                        className={'hy-shelf ' + (panelPhase === 'anim' ? 'cr-pop-anim' : panelPhase === 'closing' ? 'cr-pop-closing' : '')}
                        style={{ ...glassPop, width: 'min(240px, 68vw)', top: 'calc(50px + env(safe-area-inset-top))', transformOrigin: 'calc(100% - 19px) 21px' }}>
                        <div className="cr-views">
                            <div className="cr-view cr-view-list">
                                {([
                                    { key: 'file' as const, label: '上传文件', sub: 'PDF / TXT / EPUB', icon: <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M8.5 11V4M8.5 4L5.8 6.7M8.5 4l2.7 2.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 11.5v1.2a1.8 1.8 0 001.8 1.8h7.4a1.8 1.8 0 001.8-1.8v-1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
                                    { key: 'text' as const, label: '粘贴文本成书', sub: '', icon: <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="3.5" y="3" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M6.2 3.2a2.3 2.3 0 014.6 0" stroke="currentColor" strokeWidth="1.4"/><path d="M6 8h5M6 11h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
                                    { key: 'batch' as const, label: '批量上传 EPUB', sub: '', icon: <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M8.5 2.8L14.5 6l-6 3.2L2.5 6l6-3.2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M2.5 9.2l6 3.2 6-3.2M2.5 12.4l6 3.2 6-3.2" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg> },
                                ]).map((item, i) => (
                                    <div key={item.key} className={panelPhase === 'anim' ? 'cr-item-in' : ''}
                                        onClick={() => { if (item.key === 'batch') void openBatchUpload(); else openPanelDetail(item.key); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 13, cursor: 'pointer', color: INK, animationDelay: `${40 + i * 24}ms` }}>
                                        <span style={{ flexShrink: 0, opacity: 0.85, display: 'flex' }}>{item.icon}</span>
                                        <span style={{ fontSize: 14, flex: 1, letterSpacing: '-0.01em' }}>{item.label}</span>
                                        {item.sub && <span style={{ fontSize: 11, color: INK2 }}>{item.sub}</span>}
                                    </div>
                                ))}
                            </div>
                            <div className="cr-view cr-view-detail">
                                {showUpload && panelDetail === 'file' && (
                                    <>
                                        <div onClick={closePanelDetail} style={vdHead}>
                                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ opacity: 0.85 }}><path d="M9.5 3L5 7.5L9.5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            <span style={{ fontSize: 14, fontWeight: 600, flex: 1, letterSpacing: '-0.01em' }}>上传文件</span>
                                        </div>
                                        <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="书名（可选，默认取文件名）" style={vdInput} />
                                        <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.epub" onChange={handleFileSelect} style={{ display: 'none' }} />
                                        <div onClick={() => fileInputRef.current?.click()} style={vdFile}>
                                            {uploadFileName ? (fileReading ? `读取中: ${uploadFileName}` : `已选: ${uploadFileName}`) : '选择文件（PDF / TXT / EPUB）'}
                                        </div>
                                        <button onClick={handleUpload} disabled={uploading} style={{ ...vdCta, opacity: uploading ? 0.6 : 1 }}>
                                            {uploading ? '上传中...' : '添加到书架'}
                                        </button>
                                    </>
                                )}
                                {showUpload && panelDetail === 'text' && (
                                    <>
                                        <div onClick={closePanelDetail} style={vdHead}>
                                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ opacity: 0.85 }}><path d="M9.5 3L5 7.5L9.5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            <span style={{ fontSize: 14, fontWeight: 600, flex: 1, letterSpacing: '-0.01em' }}>粘贴文本成书</span>
                                        </div>
                                        <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="书名" style={vdInput} />
                                        <textarea value={uploadText} onChange={e => { setUploadText(e.target.value); setPdfBase64(''); setUploadFileName(''); }}
                                            placeholder="粘贴文本内容...（段落之间用空行分隔）"
                                            style={{ ...vdInput, minHeight: 96, resize: 'vertical', lineHeight: 1.5 }} />
                                        <button onClick={handleUpload} disabled={uploading} style={{ ...vdCta, opacity: uploading ? 0.6 : 1 }}>
                                            {uploading ? '上传中...' : '添加到书架'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <input ref={batchFileRef} type="file" accept=".epub,.pdf,.txt,.md" multiple onChange={handleBatchUpload} style={{ display: 'none' }} />
                    </div>
                </>
            )}

            {/* File and text import forms live in a readable standalone glass window. */}
            {panelDetail && (
                <>
                    <div onClick={closePanelDetail} style={{
                        position: 'absolute', inset: 0, zIndex: 30,
                        background: 'rgba(30,26,20,0.24)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
                    }} />
                    <div className="hy-shelf cr-rise-in" onClick={(e) => e.stopPropagation()} style={{
                        position: 'absolute', left: 12, right: 12, top: 'calc(92px + env(safe-area-inset-top))', zIndex: 31,
                        maxHeight: 'calc(100% - 116px - env(safe-area-inset-top))', overflowY: 'auto', boxSizing: 'border-box',
                        borderRadius: 24, padding: '12px 5px 14px',
                        background: 'linear-gradient(rgba(255,255,255,0.26), rgba(255,255,255,0) 42%), rgba(252,252,252,0.62)',
                        backdropFilter: 'var(--hyalite, blur(48px) saturate(1.8))', WebkitBackdropFilter: 'var(--hyalite, blur(48px) saturate(1.8))',
                        boxShadow: 'var(--hyalite-edge, 0 0 0 0 transparent), 0 18px 52px rgba(60,55,45,0.18), inset 0 1px 0 rgba(255,255,255,0.96)',
                        border: '1px solid rgba(255,255,255,0.82)',
                    }}>
                        <div onClick={closePanelDetail} style={{ ...vdHead, padding: '8px 11px 12px' }}>
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ opacity: 0.85 }}><path d="M9.5 3L5 7.5L9.5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <span style={{ fontSize: 15, fontWeight: 700, flex: 1, letterSpacing: '-0.01em' }}>
                                {panelDetail === 'file' ? '上传文件' : '粘贴文本成书'}
                            </span>
                        </div>
                        {panelDetail === 'file' ? (
                            <>
                                <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="书名（可选，默认取文件名）" style={{ ...vdInput, fontSize: 14, padding: '11px 12px' }} />
                                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.epub" onChange={handleFileSelect} style={{ display: 'none' }} />
                                <div onClick={() => fileInputRef.current?.click()} style={{ ...vdFile, padding: '13px 12px', fontSize: 13 }}>
                                    {uploadFileName ? (fileReading ? `读取中: ${uploadFileName}` : `已选: ${uploadFileName}`) : '选择文件（PDF / TXT / EPUB）'}
                                </div>
                                <button onClick={handleUpload} disabled={uploading} style={{ ...vdCta, padding: '11px 0', opacity: uploading ? 0.6 : 1 }}>
                                    {uploading ? '上传中...' : '添加到书架'}
                                </button>
                            </>
                        ) : (
                            <>
                                <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="书名" style={{ ...vdInput, fontSize: 14, padding: '11px 12px' }} />
                                <textarea value={uploadText} onChange={e => { setUploadText(e.target.value); setPdfBase64(''); setUploadFileName(''); }}
                                    placeholder="粘贴文本内容...（段落之间用空行分隔）"
                                    style={{ ...vdInput, minHeight: 220, resize: 'vertical', lineHeight: 1.6, fontSize: 14 }} />
                                <button onClick={handleUpload} disabled={uploading} style={{ ...vdCta, padding: '11px 0', opacity: uploading ? 0.6 : 1 }}>
                                    {uploading ? '上传中...' : '添加到书架'}
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* 恢复备份确认（同删除窗的玻璃窗）+ 本机备份文件选择器 */}
            {restorePreview && glassConfirm({
                title: '恢复这个备份？',
                desc: `${restorePreview.label}：${restorePreview.counts.books} 本书 · ${restorePreview.counts.comments} 条批注 · ${Math.round((restorePreview.counts.readingSeconds || 0) / 60)} 分钟记录。现有书库会被替换成备份内容（哥哥的进度不动）。`,
                confirmText: '恢复',
                onCancel: () => setRestorePreview(null),
                onConfirm: doBackupRestore,
            })}
            <input ref={restoreFileRef} type="file" accept=".json,application/json" onChange={onRestoreFile} style={{ display: 'none' }} />

            {/* Delete confirmation（单本/批量统一雾面玻璃窗） */}
            {confirmDelete !== null && glassConfirm({
                title: '确认删除？',
                desc: '书籍和所有批注都会被删除',
                confirmText: '删除',
                onCancel: () => setConfirmDelete(null),
                onConfirm: () => handleDeleteBook(confirmDelete),
            })}
            {confirmBatchDelete && glassConfirm({
                title: `删除选中的 ${selectedBooks.size} 本书？`,
                desc: '书籍和所有批注都会被删除',
                confirmText: '删除',
                onCancel: () => setConfirmBatchDelete(false),
                onConfirm: async () => {
                    const ids = [...selectedBooks];
                    setConfirmBatchDelete(false);
                    for (const id of ids) { try { await fetch(`${bridgeConfig.url}/v1/books/${id}`, { method: 'DELETE' }); } catch {} }
                    addToast?.(`已删除 ${ids.length} 本`); loadBooks();
                    setSelectedBooks(new Set()); setEditMode(false); setManageAction(null);
                },
            })}

            {/* TOC overlay */}
            {showToc && (() => {
                const tInk = readerNightMode ? '#ddd' : INK;
                const tInk2 = readerNightMode ? '#888' : INK2;
                const tPaper = readerNightMode ? '#242424' : '#fffcf3';
                const tBorder = readerNightMode ? 'rgba(255,255,255,0.08)' : 'rgba(60,55,45,0.10)';
                const closeToc = () => { setTocPhase('closing'); setTimeout(() => { setShowToc(false); setTocPhase('closed'); }, 240); };
                return (
                <>
                    <div className={tocPhase === 'closing' ? 'cr-scrim-out' : 'cr-scrim-in'}
                        onClick={closeToc}
                        style={{ position: 'absolute', inset: 0, zIndex: 30, background: readerNightMode ? 'rgba(0,0,0,0.5)' : 'rgba(30,26,20,0.35)' }} />
                    {/* 目录抽屉（SPEC-v1 §4）：近全屏，贴死左/右/底边，仅顶部圆角24，实底纸色 */}
                    <div onClick={(e) => e.stopPropagation()}
                        className={tocPhase === 'closing' ? 'cr-sheet-out' : 'cr-sheet-in'}
                        style={{
                            position: 'absolute', left: 0, right: 0, bottom: 0, top: 56, zIndex: 31,
                            borderRadius: '24px 24px 0 0', background: tPaper,
                            boxShadow: readerNightMode ? '0 -8px 40px rgba(0,0,0,0.5)' : '0 -8px 40px rgba(40,35,25,0.18)',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        }}>
                        {/* 头部：书封（首字方块）+ 书名 + 页码 + 圆 × */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px 12px', borderBottom: `1px solid ${tBorder}`, flexShrink: 0 }}>
                            <div style={{ width: 34, height: 46, borderRadius: 6, flexShrink: 0, overflow: 'hidden', background: activeBook?.cover_image ? '#f0ebe3' : BOOK_COVERS[(activeBook?.id || 0) % BOOK_COVERS.length], border: `1px solid ${tBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: tInk2 }}>
                                {activeBook?.cover_image
                                    ? <img src={`${bridgeConfig.url}/v1/book-images/${activeBook.id}/${activeBook.cover_image}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : (activeBook?.title || '书').charAt(0)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: tInk, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeBook?.title || '目录'}</div>
                                <div style={{ fontSize: 12, color: tInk2, marginTop: 2 }}>第 {page} 页 · 共 {totalPages} 页</div>
                            </div>
                            <button onClick={closeToc} style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: readerNightMode ? 'rgba(255,255,255,0.10)' : 'rgba(60,55,45,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tInk2, cursor: 'pointer' }}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                            </button>
                        </div>
                        <div ref={tocListRef} onScroll={(e) => setTocScrollTop((e.target as HTMLDivElement).scrollTop)}
                            style={{ flex: 1, overflow: 'auto' }} className="no-scrollbar">
                        {(() => {
                            // 窗口化渲染：几千章全量挂DOM滑动会卡/出空白（彤宝实测），只渲染可视区±8行缓冲；
                            // 固定行高 TOC_ROW_H，用 spacer 撑出总高，行绝对定位
                            const viewH = tocViewH || 400;
                            const winStart = Math.max(0, Math.floor(tocScrollTop / TOC_ROW_H) - 8);
                            const winEnd = Math.min(tocChapters.length, Math.ceil((tocScrollTop + viewH) / TOC_ROW_H) + 8);
                            const rows = [];
                            for (let i = winStart; i < winEnd; i++) {
                                const ch = tocChapters[i];
                                // 目录页码与底部页码同源：按全书视觉分页表换算（后端章节分页坐标不同义）
                                const pg = findPageForParaIdx(ch.idx ?? ch.page);
                                const chPage = pg >= 0 ? pg + 1 : ch.page;
                                const isCurrent = i === currentChapterIdx;
                                rows.push(
                                    <button key={i} onClick={() => jumpToChapter(ch)} style={{
                                        position: 'absolute', top: i * TOC_ROW_H, left: 0, right: 0, height: TOC_ROW_H,
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0 18px', background: isCurrent ? (readerNightMode ? 'rgba(255,255,255,0.08)' : 'rgba(60,55,45,0.07)') : 'transparent',
                                        border: 'none', cursor: 'pointer', textAlign: 'left',
                                    }}>
                                        <span style={{ fontSize: 13, color: isCurrent ? tInk : (readerNightMode ? '#aaa' : 'hsl(40,6%,34%)'), fontWeight: isCurrent ? 700 : 400, flex: 1, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.title}</span>
                                        <span style={{ fontSize: 11, color: tInk2, marginLeft: 8, flexShrink: 0 }}>p.{chPage}</span>
                                    </button>
                                );
                            }
                            return <div style={{ position: 'relative', height: tocChapters.length * TOC_ROW_H }}>{rows}</div>;
                        })()}
                        </div>
                    </div>
                </>
                );
            })()}

            {/* 所有批注抽屉（SPEC-v1 §5）：本书全部批注列表，点条目跳到原文 */}
            {allNotesPhase !== 'closed' && (() => {
                const nInk = readerNightMode ? '#ddd' : INK;
                const nInk2 = readerNightMode ? '#888' : INK2;
                const nPaper = readerNightMode ? '#242424' : '#fffcf3';
                const nBorder = readerNightMode ? 'rgba(255,255,255,0.08)' : 'rgba(60,55,45,0.10)';
                const closeAllNotes = () => { setAllNotesPhase('closing'); setTimeout(() => setAllNotesPhase(p => p === 'closing' ? 'closed' : p), 240); };
                const sorted = [...allComments].filter(cm => !cm.reply_to).sort((a, b) => a.paragraph_idx - b.paragraph_idx);
                return (
                <>
                    <div className={allNotesPhase === 'closing' ? 'cr-scrim-out' : 'cr-scrim-in'}
                        onClick={closeAllNotes}
                        style={{ position: 'absolute', inset: 0, zIndex: 30, background: readerNightMode ? 'rgba(0,0,0,0.5)' : 'rgba(30,26,20,0.35)' }} />
                    <div onClick={(e) => e.stopPropagation()}
                        className={allNotesPhase === 'closing' ? 'cr-sheet-out' : 'cr-sheet-in'}
                        style={{
                            position: 'absolute', left: 0, right: 0, bottom: 0, top: 56, zIndex: 31,
                            borderRadius: '24px 24px 0 0', background: nPaper,
                            boxShadow: readerNightMode ? '0 -8px 40px rgba(0,0,0,0.5)' : '0 -8px 40px rgba(40,35,25,0.18)',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px 12px', borderBottom: `1px solid ${nBorder}`, flexShrink: 0 }}>
                            <div style={{ width: 34, height: 46, borderRadius: 6, flexShrink: 0, overflow: 'hidden', background: activeBook?.cover_image ? '#f0ebe3' : BOOK_COVERS[(activeBook?.id || 0) % BOOK_COVERS.length], border: `1px solid ${nBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: nInk2 }}>
                                {activeBook?.cover_image
                                    ? <img src={`${bridgeConfig.url}/v1/book-images/${activeBook.id}/${activeBook.cover_image}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : (activeBook?.title || '书').charAt(0)}
                            </div>
                            <span style={{ fontSize: 15, fontWeight: 700, color: nInk, flex: 1 }}>全部批注<span style={{ fontSize: 12, fontWeight: 400, color: nInk2, marginLeft: 8 }}>{sorted.length} 条</span></span>
                            <button onClick={closeAllNotes} style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: readerNightMode ? 'rgba(255,255,255,0.10)' : 'rgba(60,55,45,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: nInk2, cursor: 'pointer' }}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                            </button>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: '6px 0 20px' }} className="no-scrollbar">
                            {sorted.length === 0 ? (
                                <div style={{ padding: '28px 18px', fontSize: 13, color: nInk2, textAlign: 'center' }}>这本书还没有批注</div>
                            ) : sorted.map(cm => (
                                <div key={cm.id} onClick={() => { rememberReturnPoint(); closeAllNotes(); jumpToParagraph(cm.paragraph_idx); }}
                                    style={{ padding: '10px 18px', cursor: 'pointer', borderBottom: `1px solid ${readerNightMode ? 'rgba(255,255,255,0.05)' : 'rgba(60,55,45,0.06)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                        <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: readerNightMode ? 'rgba(255,255,255,0.10)' : 'rgba(60,55,45,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: nInk }}>{cm.from_who.charAt(0)}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: nInk }}>{cm.from_who} · 批注</span>
                                        <span style={{ fontSize: 11, color: nInk2, marginLeft: 'auto' }}>{fmtRecTime(cm.created_at)}</span>
                                    </div>
                                    {cm.selected_text && (
                                        <div style={{ fontSize: 12, color: nInk2, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cm.selected_text}</div>
                                    )}
                                    <div style={{ fontSize: 13, color: nInk, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{cm.content}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
                );
            })()}

            {/* ===== 阅读统计抽屉（彤彤 2026-09-18：统计 12 周；图表 = lieflat-charts L10 Radial Patchwork，扇叶 stagger 动效展开）=====
                每片扇叶 = 一次阅读 session；角度 = 几点开始读（24h 刻度环）；长短 = 读了多久；半透明叠加，越密色越深 */}
            {statsPhase !== 'closed' && (() => {
                const sInk = readerNightMode ? '#ddd' : INK;
                const sInk2 = readerNightMode ? '#888' : INK2;
                const sPaper = readerNightMode ? '#242424' : '#fffcf3';
                const sBorder = readerNightMode ? 'rgba(255,255,255,0.08)' : 'rgba(60,55,45,0.10)';
                const closeStats = () => { setStatsPhase('closing'); setTimeout(() => setStatsPhase(p => p === 'closing' ? 'closed' : p), 240); };
                // palm 椰林绿序数梯（彤彤 2026-09-19：参考图黄→绿渐变，不要明黄）：颜色 = 记录新旧，旧 = 麦黄 #F2D17E → 新 = 深绿 #43593B；透明度叠加仍编码密度
                const RAMP = readerNightMode
                    ? ['#F0EFE9', '#DDDBC9', '#C8CAA8', '#AFB885', '#92A763', '#7EA056', '#658D49', '#4F7D3E']   // 夜间暗底：麦黄白 → 深绿（palm DARK.DK8）
                    : ['#F2D17E', '#ACAD79', '#929960', '#77835A', '#5A7049', '#43593B'];                          // 日间：麦黄 → 棕榈深绿（palm RAMP6）
                const lerpHex = (a: string, b: string, t: number) => {
                    const px = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
                    const [r1c, g1c, b1c] = px(a), [r2c, g2c, b2c] = px(b);
                    const mm = (u: number, v: number) => Math.round(u + (v - u) * t).toString(16).padStart(2, '0');
                    return `#${mm(r1c, r2c)}${mm(g1c, g2c)}${mm(b1c, b2c)}`;
                };
                const rampAt = (t: number) => { const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1); const i = Math.min(RAMP.length - 2, Math.floor(x)); return lerpHex(RAMP[i], RAMP[i + 1], x - i); };
                const todayStroke = readerNightMode ? '#F2D17E' : '#D4A017';   // 琥珀只给「今天」这一个主角（palm：HERO 唯一强调位）
                const centerDot = RAMP[RAMP.length - 1];
                const rimStroke = readerNightMode ? 'rgba(255,255,255,0.22)' : 'rgba(88,64,46,0.32)';
                const rimLabel = readerNightMode ? '#888' : 'rgba(88,64,46,0.60)';
                // 近 12 周（84 天）session，按时间从早到晚排，动效顺着读书记录展开
                const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - 83);
                const bookScoped = statsScope === 'book' && !!activeBook;
                const sessions = ((readingStats?.sessions || []) as any[])
                    .filter(s => s.reading_date >= localDay(cutoff.getTime()) && Number(s.elapsed_ms) >= 60 * 1000)
                    .filter(s => !bookScoped || s.book_id === activeBook!.id)
                    .sort((a, b) => a.reading_date < b.reading_date ? -1 : a.reading_date > b.reading_date ? 1 : (a.start_min ?? 720) - (b.start_min ?? 720));
                const bookRow = bookScoped ? ((readingStats?.books || []) as any[]).find(b => b.id === activeBook!.id) : null;
                const bookToday = bookScoped ? ((readingStats?.by_day || []) as any[]).filter(d => d.book_id === activeBook!.id && d.reading_date === localDay(Date.now())).reduce((a, d) => a + Number(d.seconds || 0), 0) : 0;
                const bookDays = bookScoped ? new Set(((readingStats?.by_day || []) as any[]).filter(d => d.book_id === activeBook!.id).map(d => d.reading_date)).size : 0;
                const todayKey = localDay(Date.now());
                // 本书统计卡片版辅助（彤彤 2026-09-19，SPEC-v1 §8）：日期标签只读前端阅读时长统计
                const dayLabel = (d?: string) => { if (!d) return '—'; const [, m, dd] = d.split('-').map(Number); if (d === todayKey) return '今天'; if (d === localDay(Date.now() - 86400000)) return '昨天'; return `${m} 月 ${dd} 日`; };
                const firstReadLabel = (d?: string) => { if (!d) return ''; const [, m, dd] = d.split('-').map(Number); return `${m} 月 ${dd} 日起`; };
                const rnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
                const CX = 200, CY = 168;
                const pol = (r: number, deg: number): [number, number] => [CX + r * Math.cos(deg * Math.PI / 180), CY + r * Math.sin(deg * Math.PI / 180)];
                const sect = (r0: number, r1: number, a0: number, a1: number) => {
                    const [x0, y0] = pol(r1, a0), [x1, y1] = pol(r1, a1), [x2, y2] = pol(r0, a1), [x3, y3] = pol(r0, a0);
                    const large = a1 - a0 > 180 ? 1 : 0;
                    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r1} ${r1} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} A${r0} ${r0} 0 ${large} 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z`;
                };
                const wedges = sessions.map((s, i) => {
                    const mins = Number(s.elapsed_ms) / 60000;
                    const startMin = Number.isFinite(s.start_min) ? s.start_min : 12 * 60;
                    const a0 = -90 + (startMin / 60) * 15;                    // 角度 = 几点开始（1 小时 = 15°）
                    const sw = Math.max(2.5, Math.min(90, mins * 0.25));      // 扇宽 = 读了多久
                    const r1 = Math.min(134, 34 + Math.sqrt(mins) * 12);      // 半径 = √分钟（面积∝时长）
                    return { a0, sw, r1, key: `${s.reading_date}-${s.session_id || i}`, today: s.reading_date === todayKey, op: 0.12 + rnd(i, 6) * 0.13, fill: rampAt(sessions.length > 1 ? i / (sessions.length - 1) : 1) };
                });
                const summaryCard: React.CSSProperties = { flex: 1, borderRadius: 16, background: readerNightMode ? 'rgba(255,255,255,0.07)' : 'rgba(60,55,45,0.06)', padding: '12px 14px' };
                return (
                <>
                    <div className={statsPhase === 'closing' ? 'cr-scrim-out' : 'cr-scrim-in'}
                        onClick={closeStats}
                        style={{ position: 'absolute', inset: 0, zIndex: 30, background: readerNightMode ? 'rgba(0,0,0,0.5)' : 'rgba(30,26,20,0.35)' }} />
                    <div onClick={(e) => e.stopPropagation()}
                        className={statsPhase === 'closing' ? 'cr-sheet-out' : 'cr-sheet-in'}
                        style={{
                            position: 'absolute', left: 0, right: 0, bottom: 0, top: 56, zIndex: 31,
                            borderRadius: '24px 24px 0 0', background: sPaper,
                            boxShadow: readerNightMode ? '0 -8px 40px rgba(0,0,0,0.5)' : '0 -8px 40px rgba(40,35,25,0.18)',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px 12px', borderBottom: `1px solid ${sBorder}`, flexShrink: 0 }}>
                            {bookScoped && (
                                <div style={{ width: 34, height: 46, borderRadius: 6, flexShrink: 0, overflow: 'hidden', background: activeBook?.cover_image ? '#f0ebe3' : BOOK_COVERS[(activeBook?.id || 0) % BOOK_COVERS.length], border: `1px solid ${sBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: sInk2 }}>
                                    {activeBook?.cover_image
                                        ? <img src={`${bridgeConfig.url}/v1/book-images/${activeBook.id}/${activeBook.cover_image}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : (activeBook?.title || '书').charAt(0)}
                                </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: sInk, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookScoped ? (activeBook?.title || '本书统计') : '阅读统计'}</div>
                                <div style={{ fontSize: 12, color: sInk2, marginTop: 2 }}>{bookScoped ? '本书统计' : '全部书籍 · 近 12 周'}</div>
                            </div>
                            <button onClick={closeStats} style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: readerNightMode ? 'rgba(255,255,255,0.10)' : 'rgba(60,55,45,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: sInk2, cursor: 'pointer' }}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                            </button>
                        </div>
                        <div key={statsOpenSeq} style={{ flex: 1, overflow: 'auto', padding: '8px 18px 24px' }} className="no-scrollbar">
                            {readingStatsLoading ? (
                                <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: sInk2 }}>正在整理阅读足迹…</div>
                            ) : !readingStats ? (
                                <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: sInk2 }}>暂时读不到统计，稍后再试。</div>
                            ) : (
                                <>
                                    {bookScoped ? (
                                        <>
                                            {/* 本书统计卡片版（SPEC-v1 §8 / mockup .clock，彤彤 2026-09-19）：只放这一本——累计大数字 + 三行；无图表（按书按日数据后端没有，不编） */}
                                            <div className="cr-item-in" style={{ textAlign: 'center', padding: '14px 0 18px' }}>
                                                <div style={{ fontSize: 34, fontWeight: 700, color: sInk, letterSpacing: '-0.01em' }}>{fmtDuration(Number(bookRow?.total_seconds || 0))}</div>
                                                <div style={{ fontSize: 12, color: sInk2, marginTop: 4 }}>{bookRow ? `本书累计阅读 · ${firstReadLabel(bookRow.first_read_at)}` : '本书还没有阅读记录'}</div>
                                            </div>
                                            {[
                                                { k: '本次阅读', v: fmtClock(clockSeconds) },
                                                { k: '状态', v: Number(bookRow?.total_seconds || 0) > 0 ? '看过' : '没看过' },
                                                { k: '最近阅读', v: bookRow ? dayLabel(bookRow.last_read_at) : '—' },
                                            ].map((r, ri) => (
                                                <div key={r.k} className="cr-item-in" style={{ animationDelay: `${0.08 + ri * 0.06}s`, display: 'flex', alignItems: 'center', padding: '12px 4px', fontSize: 14, color: sInk, borderTop: ri === 0 ? `0.5px solid ${sBorder}` : 'none', borderBottom: `0.5px solid ${sBorder}` }}>
                                                    {r.k}<span style={{ marginLeft: 'auto', color: sInk2, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{r.v}</span>
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                    <>
                                    <div style={{ display: 'flex', gap: 8, margin: '8px 0 4px' }}>
                                        <div style={summaryCard}><div style={{ fontSize: 16, fontWeight: 700, color: sInk }}>{fmtDuration(bookScoped ? bookToday : readingStats.today_seconds)}</div><div style={{ fontSize: 11, color: sInk2, marginTop: 3 }}>今日</div></div>
                                        <div style={summaryCard}><div style={{ fontSize: 16, fontWeight: 700, color: sInk }}>{fmtDuration(bookScoped ? Number(bookRow?.total_seconds || 0) : readingStats.total_seconds)}</div><div style={{ fontSize: 11, color: sInk2, marginTop: 3 }}>累计</div></div>
                                        {bookScoped
                                            ? <div style={summaryCard}><div style={{ fontSize: 16, fontWeight: 700, color: sInk }}>{bookDays} 天</div><div style={{ fontSize: 11, color: sInk2, marginTop: 3 }}>读过天数</div></div>
                                            : <div style={summaryCard}><div style={{ fontSize: 16, fontWeight: 700, color: sInk }}>{readingStats.currentStreak || 0} 天</div><div style={{ fontSize: 11, color: sInk2, marginTop: 3 }}>连续阅读</div></div>}
                                    </div>
                                    {/* 说明文字默认隐藏，点图表切换显示（彤彤 2026-09-18）；viewBox 加高，文字落在刻度环下方不压 18 点刻度 */}
                                    <svg viewBox="0 0 400 352" onClick={() => setStatsCaption(v => !v)} style={{ width: '100%', display: 'block', marginTop: 4, cursor: 'pointer' }}>
                                        {/* 24h 刻度环：96 根发丝 tick + 00/06/12/18 */}
                                        {Array.from({ length: 96 }, (_, h) => {
                                            const a = -90 + h * 3.75;
                                            const [x1, y1] = pol(140, a);
                                            const [x2, y2] = pol(h % 4 === 0 ? 146 : 143, a);
                                            return <line key={`t${h}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={rimStroke} strokeWidth={h % 4 === 0 ? 1 : 0.5} className="cr-pw-in" style={{ animationDelay: `${h * 0.006}s` }} />;
                                        })}
                                        {[0, 6, 12, 18].map(h => {
                                            const [x, y] = pol(157, -90 + h * 15);
                                            return <text key={`l${h}`} x={x} y={y + 3} fontSize="8" fontWeight="700" fill={rimLabel} textAnchor="middle" className="cr-pw-in">{String(h).padStart(2, '0')}</text>;
                                        })}
                                        {/* 扇叶：颜色 = 新旧（麦黄→深绿），半透明叠加 = 密度，今日的琥珀描边 */}
                                        {wedges.map((w, i) => (
                                            <path key={w.key} d={sect(16, w.r1, w.a0, w.a0 + w.sw)} fill={w.fill} fillOpacity={w.op}
                                                className="cr-pw-in" style={{ animationDelay: `${0.2 + i * 0.022}s` }} />
                                        ))}
                                        {wedges.filter(w => w.today).map((w, k) => (
                                            <path key={`o${w.key}`} d={sect(16, w.r1, w.a0, w.a0 + w.sw)} fill="none" stroke={todayStroke} strokeWidth={1.1}
                                                className="cr-pw-in" style={{ animationDelay: `${1.2 + k * 0.15}s` }} />
                                        ))}
                                        <circle cx={CX} cy={CY} r={3} fill={centerDot} className="cr-pw-in" style={{ animationDelay: '1.3s' }} />
                                        {(statsCaption || !wedges.length) && (
                                            <text x={CX} y={346} fontSize="7.5" fontWeight="600" fill={rimLabel} textAnchor="middle" letterSpacing="1.2" className="cr-pw-in" style={{ animationDelay: '0s' }}>
                                                {wedges.length ? '角度 = 几点开始 · 长短 = 读了多久 · 黄→绿 = 旧→新 · 描边 = 今天' : '近 12 周还没有阅读记录'}
                                            </text>
                                        )}
                                    </svg>
                                    </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </>
                );
            })()}

            {/* 关门上锁抽屉（SPEC-v1 §6，工单task-1789656188891-dunluk）：替换系统原生confirm */}
            {lockPhase !== 'closed' && (() => {
                const lNight = readerNightMode;
                const lockRed = lNight ? 'hsl(9,50%,50%)' : 'hsl(9,52%,44%)';
                const badgeRed = lNight ? 'hsl(9,60%,62%)' : lockRed;
                return (
                <>
                    <div className={lockPhase === 'closing' ? 'cr-scrim-out' : 'cr-scrim-in'}
                        onClick={closeLockDrawer}
                        style={{ position: 'absolute', inset: 0, zIndex: 40, background: lNight ? 'rgba(0,0,0,0.4)' : 'rgba(30,26,20,0.24)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
                    <div onClick={(e) => e.stopPropagation()}
                        className={'hy-shelf ' + (lockPhase === 'closing' ? 'cr-sheet-out' : 'cr-sheet-in')}
                        style={{
                            position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 41,
                            borderRadius: '24px 24px 0 0',
                            // 雾面玻璃对齐上传窗口（彤彤 2026-09-19）：实底换玻璃材质，夜间用深色玻璃
                            background: lNight
                                ? 'linear-gradient(rgba(255,255,255,0.10), rgba(255,255,255,0) 42%), rgba(38,38,38,0.66)'
                                : 'linear-gradient(rgba(255,255,255,0.26), rgba(255,255,255,0) 42%), rgba(252,252,252,0.62)',
                            backdropFilter: 'var(--hyalite, blur(48px) saturate(1.8))', WebkitBackdropFilter: 'var(--hyalite, blur(48px) saturate(1.8))',
                            boxShadow: lNight
                                ? '0 -18px 52px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.14)'
                                : 'var(--hyalite-edge, 0 0 0 0 transparent), 0 -18px 52px rgba(60,55,45,0.18), inset 0 1px 0 rgba(255,255,255,0.96)',
                            border: lNight ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.82)',
                            borderBottom: 'none',
                            padding: '28px 24px calc(24px + env(safe-area-inset-bottom))', textAlign: 'center',
                        }}>
                        <div style={{ width: 58, height: 58, borderRadius: '50%', margin: '0 auto 14px', background: lNight ? 'hsla(9,50%,50%,0.14)' : 'hsla(9,52%,44%,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: badgeRed }}>
                            <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><rect x="5.5" y="11" width="15" height="10.5" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M8.5 11V8.2a4.5 4.5 0 019 0V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="13" cy="16.2" r="1.6" fill="currentColor"/></svg>
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: lNight ? '#ddd' : INK, marginBottom: 8 }}>{lockIntent ? '关门上锁？' : '开门？'}</div>
                        <div style={{ fontSize: 13, color: lNight ? '#888' : INK2, lineHeight: 1.6, marginBottom: 22 }}>{lockIntent ? '锁上后哥哥无法开门读书，只有你能开门。' : '哥哥就能继续读书了。'}</div>
                        <button onClick={confirmDoor} style={{ display: 'block', width: '100%', padding: '13px 0', borderRadius: 999, border: 'none', background: lockRed, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
                            {lockIntent ? '关门上锁' : '开门'}
                        </button>
                        <button onClick={closeLockDrawer} style={{ display: 'block', width: '100%', padding: '13px 0', borderRadius: 999, border: 'none', background: 'transparent', color: lNight ? '#888' : INK2, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                            取消
                        </button>
                    </div>
                </>
                );
            })()}
        </div>
    );
};

export default StudyApp;
