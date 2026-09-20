/**
 * Persistence: device store, markdown export, exact import.
 * Imports from src/config and src/engine only; nothing imports back.
 */
export { localStorageStore, memoryStore, DEFAULT_KEY, type Store, type StorageLike } from './store';
export { exportMarkdown, type ExportFile } from './export';
export { importMarkdown, lastJsonBlock, type ImportResult } from './import';
