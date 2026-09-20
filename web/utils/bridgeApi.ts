// coread web 适配层：把 SullyOS utils/bridgeApi 的具名导出转成 coread api 的形状。
// SullyOS 侧每个函数第一参是 BridgeConfig；coread 同源直连，config 被忽略，
// 只保留签名兼容，让 StudyApp.tsx 可以原样移植。
import { api, ROOM_OWNER_KEY } from '../api';
import type { BridgeConfig } from '../context/OSContext';

export { ROOM_OWNER_KEY };

export const fetchBooks = (_config: BridgeConfig) => api.fetchBooks();
export const fetchBookDetail = (_config: BridgeConfig, bookId: number, page = 1, _perPage = 10) =>
    api.fetchBookDetail(bookId, page);
export const fetchBookSlice = (_config: BridgeConfig, bookId: number, startIdx = 0, count = 30) =>
    api.fetchBookSlice(bookId, startIdx, count);
export const fetchBookComments = (_config: BridgeConfig, bookId: number) =>
    api.fetchBookComments(bookId);
export const addBookComment = (_config: BridgeConfig, bookId: number, data: any) =>
    api.addBookComment(bookId, data);
export const deleteBookComment = (_config: BridgeConfig, commentId: number) =>
    api.deleteBookComment(commentId);
export const updateBookProgress = (_config: BridgeConfig, bookId: number, page: number) =>
    api.updateBookProgress(bookId, page);
export const uploadBookFile = (_config: BridgeConfig, file: Blob, title: string, format: string) =>
    api.uploadBookFile(file, title, format);
export const exportBook = (_config: BridgeConfig, bookId: number, format: 'epub' | 'md' = 'epub') =>
    api.exportBook(bookId, format);
export const deleteBook = (_config: BridgeConfig, bookId: number) => api.deleteBook(bookId);
export const fetchBookToc = (_config: BridgeConfig, bookId: number, _perPage = 10) =>
    api.fetchBookToc(bookId);
export const fetchRoomDoor = (_config: BridgeConfig) => api.fetchRoomDoor();
export const setRoomDoor = (_config: BridgeConfig, locked: boolean, note = '') =>
    api.setRoomDoor(locked, note);
