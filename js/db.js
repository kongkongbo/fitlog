/**
 * IndexedDB 数据层封装。
 * 浏览器与 Node（fake-indexeddb）共用：通过 init(indexedDB) 注入数据库实例。
 */
const DB_NAME = 'fitlog';
const DB_VERSION = 2;
const STORES = ['templates', 'plans', 'records', 'settings', 'drafts', 'schedules'];

let idbFactory = null;   // 注入的 indexedDB 工厂
let dbPromise = null;    // 打开的数据库连接（Promise）

/** 注入 indexedDB 实现并重置连接（测试时可注入 fake-indexeddb） */
export function init(factory) {
  idbFactory = factory;
  dbPromise = null;
}

function getFactory() {
  const f = idbFactory || (typeof indexedDB !== 'undefined' ? indexedDB : null);
  if (!f) throw new Error('IndexedDB 不可用，请先调用 init()');
  return f;
}

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = getFactory().open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeNames, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const store = transaction.objectStore(storeNames[0]);
    let result;
    const request = fn(store);
    if (request) {
      request.onsuccess = () => { result = request.result; };
    }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

export function getAll(store) {
  return tx([store], 'readonly', (s) => s.getAll());
}

export function get(store, id) {
  return tx([store], 'readonly', (s) => s.get(id));
}

export function put(store, value) {
  return tx([store], 'readwrite', (s) => s.put(value));
}

export function del(store, id) {
  return tx([store], 'readwrite', (s) => s.delete(id));
}

export function clearAll() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES, 'readwrite');
    for (const name of STORES) transaction.objectStore(name).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }));
}

export function exportAll() {
  return Promise.all(STORES.map((name) => getAll(name).then((items) => [name, items])))
    .then((entries) => Object.fromEntries(entries));
}

export function importAll(data) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES, 'readwrite');
    for (const name of STORES) {
      const store = transaction.objectStore(name);
      const items = Array.isArray(data[name]) ? data[name] : [];
      for (const item of items) store.put(item);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }));
}

export { STORES, DB_NAME };
