var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/filesystem/dist/constants.js
var constants_exports = {};
__export(constants_exports, {
  BACKEND_STORAGE_KEY: () => BACKEND_STORAGE_KEY,
  IDB_DIRS_STORE: () => IDB_DIRS_STORE,
  IDB_FILES_STORE: () => IDB_FILES_STORE,
  IDB_NAME: () => IDB_NAME,
  IDB_VERSION: () => IDB_VERSION,
  OPFS_ROOT: () => OPFS_ROOT
});
var IDB_NAME, IDB_VERSION, IDB_FILES_STORE, IDB_DIRS_STORE, OPFS_ROOT, BACKEND_STORAGE_KEY;
var init_constants = __esm({
  "data/offline-tex-2026-11-08/deps/node_modules/@siglum/filesystem/dist/constants.js"() {
    IDB_NAME = "siglum_filesystem";
    IDB_VERSION = 1;
    IDB_FILES_STORE = "files";
    IDB_DIRS_STORE = "directories";
    OPFS_ROOT = "";
    BACKEND_STORAGE_KEY = "siglum-filesystem-backend";
  }
});

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/filesystem/dist/IndexedDBBackend.js
var IndexedDBBackend_exports = {};
__export(IndexedDBBackend_exports, {
  IndexedDBBackend: () => IndexedDBBackend,
  indexedDBBackend: () => indexedDBBackend
});
var IndexedDBBackend, indexedDBBackend;
var init_IndexedDBBackend = __esm({
  "data/offline-tex-2026-11-08/deps/node_modules/@siglum/filesystem/dist/IndexedDBBackend.js"() {
    init_constants();
    IndexedDBBackend = class {
      constructor(databaseName = IDB_NAME) {
        this.databaseName = databaseName;
        this.name = "indexeddb";
        this.dbPromise = null;
      }
      getDB() {
        if (!this.dbPromise) {
          this.dbPromise = this.initDB().catch((e) => {
            this.dbPromise = null;
            throw e;
          });
        }
        return this.dbPromise;
      }
      async initDB() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(this.databaseName, IDB_VERSION);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(IDB_FILES_STORE)) {
              const filesStore = db.createObjectStore(IDB_FILES_STORE, { keyPath: "path" });
              filesStore.createIndex("mtime", "mtime", { unique: false });
            }
            if (!db.objectStoreNames.contains(IDB_DIRS_STORE)) {
              db.createObjectStore(IDB_DIRS_STORE, { keyPath: "path" });
            }
          };
        });
      }
      normalizePath(path) {
        if (!path.startsWith("/")) {
          path = "/" + path;
        }
        if (path.length > 1 && path.endsWith("/")) {
          path = path.slice(0, -1);
        }
        return path.replace(/\/+/g, "/");
      }
      getParentPath(path) {
        const normalized = this.normalizePath(path);
        const lastSlash = normalized.lastIndexOf("/");
        if (lastSlash <= 0)
          return "/";
        return normalized.slice(0, lastSlash);
      }
      async readFile(path) {
        const db = await this.getDB();
        const normalized = this.normalizePath(path);
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([IDB_FILES_STORE], "readonly");
          const store = transaction.objectStore(IDB_FILES_STORE);
          const request = store.get(normalized);
          request.onsuccess = () => {
            const file = request.result;
            if (!file) {
              reject(new Error(`ENOENT: no such file: ${path}`));
              return;
            }
            if (file.isBinary) {
              const decoder = new TextDecoder();
              resolve(decoder.decode(file.content));
            } else {
              resolve(file.content);
            }
          };
          request.onerror = () => reject(request.error);
        });
      }
      async readBinary(path) {
        const db = await this.getDB();
        const normalized = this.normalizePath(path);
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([IDB_FILES_STORE], "readonly");
          const store = transaction.objectStore(IDB_FILES_STORE);
          const request = store.get(normalized);
          request.onsuccess = () => {
            const file = request.result;
            if (!file) {
              reject(new Error(`ENOENT: no such file: ${path}`));
              return;
            }
            if (file.isBinary) {
              resolve(file.content);
            } else {
              const encoder = new TextEncoder();
              resolve(encoder.encode(file.content));
            }
          };
          request.onerror = () => reject(request.error);
        });
      }
      async writeFile(path, content) {
        const db = await this.getDB();
        const normalized = this.normalizePath(path);
        const now = Date.now();
        const parentPath = this.getParentPath(normalized);
        if (parentPath !== "/") {
          const parentExists = await this.exists(parentPath);
          if (!parentExists) {
            await this.mkdir(parentPath);
          }
        }
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([IDB_FILES_STORE], "readwrite", { durability: "relaxed" });
          const store = transaction.objectStore(IDB_FILES_STORE);
          const getRequest = store.get(normalized);
          getRequest.onsuccess = () => {
            const existing = getRequest.result;
            const file = {
              path: normalized,
              content,
              isBinary: false,
              size: new Blob([content]).size,
              mtime: now,
              ctime: existing?.ctime ?? now
            };
            const putRequest = store.put(file);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          };
          getRequest.onerror = () => reject(getRequest.error);
        });
      }
      async writeBinary(path, content) {
        const db = await this.getDB();
        const normalized = this.normalizePath(path);
        const now = Date.now();
        const parentPath = this.getParentPath(normalized);
        if (parentPath !== "/") {
          const parentExists = await this.exists(parentPath);
          if (!parentExists) {
            await this.mkdir(parentPath);
          }
        }
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([IDB_FILES_STORE], "readwrite", { durability: "relaxed" });
          const store = transaction.objectStore(IDB_FILES_STORE);
          const getRequest = store.get(normalized);
          getRequest.onsuccess = () => {
            const existing = getRequest.result;
            const file = {
              path: normalized,
              content,
              isBinary: true,
              size: content.length,
              mtime: now,
              ctime: existing?.ctime ?? now
            };
            const putRequest = store.put(file);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          };
          getRequest.onerror = () => reject(getRequest.error);
        });
      }
      async deleteFile(path) {
        const db = await this.getDB();
        const normalized = this.normalizePath(path);
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([IDB_FILES_STORE], "readwrite");
          const store = transaction.objectStore(IDB_FILES_STORE);
          const request = store.delete(normalized);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      async exists(path) {
        const db = await this.getDB();
        const normalized = this.normalizePath(path);
        if (normalized === "/")
          return true;
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([IDB_FILES_STORE, IDB_DIRS_STORE], "readonly");
          const filesStore = transaction.objectStore(IDB_FILES_STORE);
          const dirsStore = transaction.objectStore(IDB_DIRS_STORE);
          const fileRequest = filesStore.get(normalized);
          fileRequest.onsuccess = () => {
            if (fileRequest.result) {
              resolve(true);
              return;
            }
            const dirRequest = dirsStore.get(normalized);
            dirRequest.onsuccess = () => resolve(!!dirRequest.result);
            dirRequest.onerror = () => reject(dirRequest.error);
          };
          fileRequest.onerror = () => reject(fileRequest.error);
        });
      }
      async stat(path) {
        const db = await this.getDB();
        const normalized = this.normalizePath(path);
        if (normalized === "/")
          return { size: 0, isDirectory: true, isFile: false, mtime: /* @__PURE__ */ new Date(0) };
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([IDB_FILES_STORE, IDB_DIRS_STORE], "readonly");
          const filesStore = transaction.objectStore(IDB_FILES_STORE);
          const dirsStore = transaction.objectStore(IDB_DIRS_STORE);
          const fileRequest = filesStore.get(normalized);
          fileRequest.onsuccess = () => {
            const file = fileRequest.result;
            if (file) {
              resolve({
                size: file.size,
                isDirectory: false,
                isFile: true,
                mtime: new Date(file.mtime)
              });
              return;
            }
            const dirRequest = dirsStore.get(normalized);
            dirRequest.onsuccess = () => {
              const dir = dirRequest.result;
              if (dir) {
                resolve({
                  size: 0,
                  isDirectory: true,
                  isFile: false,
                  mtime: new Date(dir.ctime)
                });
              } else {
                reject(new Error(`ENOENT: no such file or directory: ${path}`));
              }
            };
            dirRequest.onerror = () => reject(dirRequest.error);
          };
          fileRequest.onerror = () => reject(fileRequest.error);
        });
      }
      async mkdir(path) {
        const db = await this.getDB();
        const normalized = this.normalizePath(path);
        const parts = normalized.split("/").filter(Boolean);
        const pathsToCreate = [];
        let currentPath = "";
        for (const part of parts) {
          currentPath += "/" + part;
          pathsToCreate.push(currentPath);
        }
        if (pathsToCreate.length === 0)
          return;
        const existingPaths = await new Promise((resolve) => {
          const existing = /* @__PURE__ */ new Set();
          const transaction = db.transaction([IDB_DIRS_STORE], "readonly");
          const store = transaction.objectStore(IDB_DIRS_STORE);
          let pending = pathsToCreate.length;
          for (const p of pathsToCreate) {
            const request = store.get(p);
            request.onsuccess = () => {
              if (request.result)
                existing.add(p);
              pending--;
              if (pending === 0)
                resolve(existing);
            };
            request.onerror = () => {
              pending--;
              if (pending === 0)
                resolve(existing);
            };
          }
        });
        const missingPaths = pathsToCreate.filter((p) => !existingPaths.has(p));
        if (missingPaths.length === 0)
          return;
        const now = Date.now();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([IDB_DIRS_STORE], "readwrite", { durability: "relaxed" });
          const store = transaction.objectStore(IDB_DIRS_STORE);
          let pending = missingPaths.length;
          for (const p of missingPaths) {
            const dir = { path: p, ctime: now };
            const request = store.put(dir);
            request.onsuccess = () => {
              pending--;
              if (pending === 0)
                resolve();
            };
            request.onerror = () => reject(request.error);
          }
          transaction.onerror = () => reject(transaction.error);
        });
      }
      async rmdir(path, options) {
        const db = await this.getDB();
        const normalized = this.normalizePath(path);
        if (normalized === "/")
          throw new Error("Cannot remove root directory");
        const stats = await this.stat(normalized);
        if (!stats.isDirectory)
          throw new Error(`ENOTDIR: not a directory: ${path}`);
        const entries = await this.readdir(normalized);
        if (!options?.recursive && entries.length > 0) {
          throw new Error(`ENOTEMPTY: directory not empty: ${path}`);
        }
        if (options?.recursive) {
          for (const entry of entries) {
            if (entry.isDirectory) {
              await this.rmdir(entry.path, { recursive: true });
            } else {
              await this.deleteFile(entry.path);
            }
          }
        }
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([IDB_DIRS_STORE], "readwrite");
          const store = transaction.objectStore(IDB_DIRS_STORE);
          const request = store.delete(normalized);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      async readdir(path) {
        const db = await this.getDB();
        const normalized = this.normalizePath(path);
        const prefix = normalized === "/" ? "/" : normalized + "/";
        const keyRange = IDBKeyRange.bound(prefix, prefix + "\uFFFF", false, true);
        const entries = [];
        const seenNames = /* @__PURE__ */ new Set();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([IDB_FILES_STORE, IDB_DIRS_STORE], "readonly");
          const filesStore = transaction.objectStore(IDB_FILES_STORE);
          const filesRequest = filesStore.openCursor(keyRange);
          filesRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const file = cursor.value;
              const relativePath = file.path.slice(prefix.length);
              const slashIndex = relativePath.indexOf("/");
              const name = slashIndex === -1 ? relativePath : relativePath.slice(0, slashIndex);
              if (name && !seenNames.has(name) && slashIndex === -1) {
                seenNames.add(name);
                entries.push({
                  name,
                  path: file.path,
                  isDirectory: false
                });
              }
              cursor.continue();
            } else {
              const dirsStore = transaction.objectStore(IDB_DIRS_STORE);
              const dirsRequest = dirsStore.openCursor(keyRange);
              dirsRequest.onsuccess = (event2) => {
                const cursor2 = event2.target.result;
                if (cursor2) {
                  const dir = cursor2.value;
                  if (dir.path !== normalized) {
                    const relativePath = dir.path.slice(prefix.length);
                    const slashIndex = relativePath.indexOf("/");
                    const name = slashIndex === -1 ? relativePath : relativePath.slice(0, slashIndex);
                    if (name && !seenNames.has(name)) {
                      seenNames.add(name);
                      entries.push({
                        name,
                        path: prefix + name,
                        isDirectory: true
                      });
                    }
                  }
                  cursor2.continue();
                } else {
                  entries.sort((a, b) => {
                    if (a.isDirectory !== b.isDirectory) {
                      return a.isDirectory ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                  });
                  resolve(entries);
                }
              };
              dirsRequest.onerror = () => reject(dirsRequest.error);
            }
          };
          filesRequest.onerror = () => reject(filesRequest.error);
          transaction.onerror = () => reject(transaction.error);
        });
      }
      async rename(oldPath, newPath) {
        const content = await this.readBinary(oldPath);
        const stats = await this.stat(oldPath);
        if (stats.isDirectory) {
          throw new Error("Cannot rename directories with rename(), use recursive copy");
        }
        await this.writeBinary(newPath, content);
        await this.deleteFile(oldPath);
      }
      async copyFile(src, dest) {
        const content = await this.readBinary(src);
        await this.writeBinary(dest, content);
      }
      /**
       * Read multiple files in a single transaction (more efficient for batch reads)
       */
      async readBinaryBatch(paths) {
        const db = await this.getDB();
        const results = /* @__PURE__ */ new Map();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([IDB_FILES_STORE], "readonly");
          const store = transaction.objectStore(IDB_FILES_STORE);
          let pending = paths.length;
          if (pending === 0) {
            resolve(results);
            return;
          }
          for (const path of paths) {
            const normalized = this.normalizePath(path);
            const request = store.get(normalized);
            request.onsuccess = () => {
              const file = request.result;
              if (file) {
                if (file.isBinary) {
                  results.set(path, file.content);
                } else {
                  const encoder = new TextEncoder();
                  results.set(path, encoder.encode(file.content));
                }
              }
              pending--;
              if (pending === 0)
                resolve(results);
            };
            request.onerror = () => {
              pending--;
              if (pending === 0)
                resolve(results);
            };
          }
          transaction.onerror = () => reject(transaction.error);
        });
      }
      /**
       * Write multiple files with progress reporting
       * Uses batched transactions for efficiency
       */
      async writeBinaryBatch(entries, options = {}) {
        const { createParents = true, onProgress, concurrency = 20 } = options;
        const total = entries.length;
        let completed = 0;
        if (total === 0) {
          onProgress?.(0, 0);
          return;
        }
        if (createParents) {
          const dirsToCreate = /* @__PURE__ */ new Set();
          for (const { path } of entries) {
            const normalized = this.normalizePath(path);
            const parts = normalized.split("/").filter(Boolean);
            parts.pop();
            let currentPath = "";
            for (const part of parts) {
              currentPath += "/" + part;
              dirsToCreate.add(currentPath);
            }
          }
          for (const dir of dirsToCreate) {
            await this.mkdir(dir);
          }
        }
        const db = await this.getDB();
        const now = Date.now();
        for (let i = 0; i < entries.length; i += concurrency) {
          const batch = entries.slice(i, i + concurrency);
          await new Promise((resolve, reject) => {
            const transaction = db.transaction([IDB_FILES_STORE], "readwrite", { durability: "relaxed" });
            const store = transaction.objectStore(IDB_FILES_STORE);
            let pending = batch.length;
            for (const { path, content } of batch) {
              const normalized = this.normalizePath(path);
              const file = {
                path: normalized,
                content,
                isBinary: true,
                size: content.length,
                mtime: now,
                ctime: now
              };
              const request = store.put(file);
              request.onsuccess = () => {
                completed++;
                pending--;
                if (pending === 0)
                  resolve();
              };
              request.onerror = () => reject(request.error);
            }
            transaction.onerror = () => reject(transaction.error);
          });
          onProgress?.(completed, total);
        }
      }
    };
    indexedDBBackend = new IndexedDBBackend();
  }
});

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/filesystem/dist/OPFSBackend.js
var OPFSBackend_exports = {};
__export(OPFSBackend_exports, {
  OPFSBackend: () => OPFSBackend,
  opfsBackend: () => opfsBackend
});
var OPFSBackend, opfsBackend;
var init_OPFSBackend = __esm({
  "data/offline-tex-2026-11-08/deps/node_modules/@siglum/filesystem/dist/OPFSBackend.js"() {
    OPFSBackend = class _OPFSBackend {
      constructor(namespace) {
        this.name = "opfs";
        this.rootPromise = null;
        this.syncHandleCache = /* @__PURE__ */ new Map();
        this.namespace = namespace ?? _OPFSBackend.DEFAULT_NAMESPACE;
      }
      async getRoot() {
        if (!this.rootPromise) {
          this.rootPromise = (async () => {
            const opfsRoot = await navigator.storage.getDirectory();
            return opfsRoot.getDirectoryHandle(this.namespace, { create: true });
          })().catch((e) => {
            this.rootPromise = null;
            throw e;
          });
        }
        return this.rootPromise;
      }
      normalizePath(path) {
        let normalized = path;
        if (normalized.startsWith("/")) {
          normalized = normalized.slice(1);
        }
        if (normalized.endsWith("/") && normalized.length > 0) {
          normalized = normalized.slice(0, -1);
        }
        normalized = normalized.replace(/\/+/g, "/");
        return normalized;
      }
      getPathParts(path) {
        const normalized = this.normalizePath(path);
        if (!normalized)
          return [];
        return normalized.split("/");
      }
      async getDirectoryHandle(path, options = {}) {
        const root = await this.getRoot();
        const parts = this.getPathParts(path);
        let current = root;
        for (const part of parts) {
          current = await current.getDirectoryHandle(part, { create: options.create });
        }
        return current;
      }
      async getParentAndName(path, options = {}) {
        const parts = this.getPathParts(path);
        if (parts.length === 0) {
          throw new Error("Invalid path: root has no parent");
        }
        const name = parts.pop();
        const root = await this.getRoot();
        let parent = root;
        for (const part of parts) {
          parent = await parent.getDirectoryHandle(part, { create: options.createParents });
        }
        return { parent, name };
      }
      async getFileForRead(path) {
        try {
          const handle = await this.getFileHandle(path);
          return await handle.getFile();
        } catch (error) {
          if (error instanceof DOMException && error.name === "NotFoundError") {
            throw new Error("ENOENT: no such file or directory: " + path);
          }
          throw error;
        }
      }
      async readFile(path) {
        const file = await this.getFileForRead(path);
        return file.text();
      }
      async readBinary(path) {
        const file = await this.getFileForRead(path);
        return new Uint8Array(await file.arrayBuffer());
      }
      async writeFile(path, content) {
        const { parent, name } = await this.getParentAndName(path, { createParents: true });
        const fileHandle = await parent.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
      }
      async writeBinary(path, content) {
        const { parent, name } = await this.getParentAndName(path, { createParents: true });
        const fileHandle = await parent.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
      }
      async deleteFile(path) {
        try {
          const { parent, name } = await this.getParentAndName(path);
          await parent.removeEntry(name);
        } catch {
          throw new Error(`ENOENT: no such file or directory: ${path}`);
        }
      }
      async exists(path) {
        try {
          const parts = this.getPathParts(path);
          if (parts.length === 0) {
            return true;
          }
          const { parent, name } = await this.getParentAndName(path);
          try {
            await parent.getFileHandle(name);
            return true;
          } catch {
            try {
              await parent.getDirectoryHandle(name);
              return true;
            } catch {
              return false;
            }
          }
        } catch {
          return false;
        }
      }
      async stat(path) {
        const parts = this.getPathParts(path);
        if (parts.length === 0) {
          return {
            size: 0,
            isDirectory: true,
            isFile: false,
            mtime: /* @__PURE__ */ new Date(0)
          };
        }
        let parent;
        let name;
        try {
          ({ parent, name } = await this.getParentAndName(path));
        } catch {
          throw new Error(`ENOENT: no such file or directory: ${path}`);
        }
        try {
          const fileHandle = await parent.getFileHandle(name);
          const file = await fileHandle.getFile();
          return {
            size: file.size,
            isDirectory: false,
            isFile: true,
            mtime: new Date(file.lastModified)
          };
        } catch {
          try {
            await parent.getDirectoryHandle(name);
            return {
              size: 0,
              isDirectory: true,
              isFile: false,
              mtime: /* @__PURE__ */ new Date(0)
              // OPFS doesn't track directory mtime
            };
          } catch {
            throw new Error(`ENOENT: no such file or directory: ${path}`);
          }
        }
      }
      async mkdir(path) {
        await this.getDirectoryHandle(path, { create: true });
      }
      async rmdir(path, options) {
        const parts = this.getPathParts(path);
        if (parts.length === 0) {
          throw new Error("Cannot remove root directory");
        }
        const { parent, name } = await this.getParentAndName(path);
        await parent.removeEntry(name, { recursive: options?.recursive });
      }
      async readdir(path) {
        const dir = this.getPathParts(path).length === 0 ? await this.getRoot() : await this.getDirectoryHandle(path);
        const entries = [];
        const prefix = this.normalizePath(path);
        const pathPrefix = prefix ? "/" + prefix + "/" : "/";
        const dirAsIterable = dir;
        for await (const [name, handle] of dirAsIterable) {
          entries.push({
            name,
            path: pathPrefix + name,
            isDirectory: handle.kind === "directory"
          });
        }
        return entries.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      }
      async rename(oldPath, newPath) {
        const content = await this.readBinary(oldPath);
        await this.writeBinary(newPath, content);
        await this.deleteFile(oldPath);
      }
      async copyFile(src, dest) {
        const content = await this.readBinary(src);
        await this.writeBinary(dest, content);
      }
      /**
       * Get a file handle for direct access (useful for WASM)
       * This allows the WASM compiler to read files directly
       */
      async getFileHandle(path) {
        const { parent, name } = await this.getParentAndName(path);
        return parent.getFileHandle(name);
      }
      /**
       * Get a directory handle for direct access
       */
      async getDirectoryHandleForPath(path) {
        const parts = this.getPathParts(path);
        if (parts.length === 0) {
          return this.getRoot();
        }
        return this.getDirectoryHandle(path);
      }
      /**
       * Read multiple files in parallel (more efficient for batch reads)
       */
      async readBinaryBatch(paths) {
        const results = /* @__PURE__ */ new Map();
        const readPromises = paths.map(async (path) => {
          try {
            const data = await this.readBinary(path);
            return { path, data };
          } catch {
            return { path, data: null };
          }
        });
        const outcomes = await Promise.all(readPromises);
        for (const { path, data } of outcomes) {
          if (data) {
            results.set(path, data);
          }
        }
        return results;
      }
      /**
       * Write multiple files in parallel with directory handle caching
       * Significantly faster than individual writes for large batches
       */
      async writeBinaryBatch(entries, options = {}) {
        const { createParents = true, onProgress, concurrency = 20 } = options;
        const total = entries.length;
        let completed = 0;
        if (total === 0) {
          onProgress?.(0, 0);
          return;
        }
        const dirCache = /* @__PURE__ */ new Map();
        const root = await this.getRoot();
        dirCache.set("", root);
        const getOrCreateDir = async (dirPath) => {
          if (dirCache.has(dirPath)) {
            return dirCache.get(dirPath);
          }
          const parts = dirPath.split("/").filter((p) => p);
          let current = root;
          let currentPath = "";
          for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            if (dirCache.has(currentPath)) {
              current = dirCache.get(currentPath);
            } else {
              current = await current.getDirectoryHandle(part, { create: createParents });
              dirCache.set(currentPath, current);
            }
          }
          return current;
        };
        for (let i = 0; i < entries.length; i += concurrency) {
          const batch = entries.slice(i, i + concurrency);
          await Promise.all(batch.map(async ({ path, content }) => {
            const normalized = this.normalizePath(path);
            const parts = normalized.split("/").filter((p) => p);
            const fileName = parts.pop();
            const dirPath = parts.join("/");
            const dir = await getOrCreateDir(dirPath);
            const handle = await dir.getFileHandle(fileName, { create: true });
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            completed++;
          }));
          onProgress?.(completed, total);
        }
        dirCache.clear();
      }
      // ============================================================================
      // Sync Access Handle Methods (Worker-only, 100x faster I/O)
      // ============================================================================
      /**
       * Get or create a sync access handle for a file
       * Only works in Web Worker contexts
       *
       * IMPORTANT: Call closeSyncHandle() when done to release the lock
       */
      async getSyncAccessHandle(path) {
        const normalized = this.normalizePath(path);
        const cached = this.syncHandleCache.get(normalized);
        if (cached) {
          return cached;
        }
        const { parent, name } = await this.getParentAndName(path);
        const fileHandle = await parent.getFileHandle(name, { create: true });
        const syncHandle = await fileHandle.createSyncAccessHandle();
        this.syncHandleCache.set(normalized, syncHandle);
        return syncHandle;
      }
      /**
       * Synchronously read from a file using its sync access handle
       * Must call getSyncAccessHandle() first to open the handle
       *
       * @param path - File path
       * @param buffer - Buffer to read into
       * @param offset - Byte offset in file to start reading from
       * @returns Number of bytes read
       */
      readSync(path, buffer, offset = 0) {
        const normalized = this.normalizePath(path);
        const handle = this.syncHandleCache.get(normalized);
        if (!handle) {
          throw new Error(`No sync handle open for: ${path}. Call getSyncAccessHandle() first.`);
        }
        return handle.read(buffer, { at: offset });
      }
      /**
       * Synchronously write to a file using its sync access handle
       * Must call getSyncAccessHandle() first to open the handle
       *
       * @param path - File path
       * @param buffer - Data to write
       * @param offset - Byte offset in file to start writing at
       * @returns Number of bytes written
       */
      writeSync(path, buffer, offset = 0) {
        const normalized = this.normalizePath(path);
        const handle = this.syncHandleCache.get(normalized);
        if (!handle) {
          throw new Error(`No sync handle open for: ${path}. Call getSyncAccessHandle() first.`);
        }
        return handle.write(buffer, { at: offset });
      }
      /**
       * Flush pending writes to disk synchronously
       */
      flushSync(path) {
        const normalized = this.normalizePath(path);
        const handle = this.syncHandleCache.get(normalized);
        if (!handle) {
          throw new Error(`No sync handle open for: ${path}. Call getSyncAccessHandle() first.`);
        }
        handle.flush();
      }
      /**
       * Get the size of a file via its sync handle
       */
      getSizeSync(path) {
        const normalized = this.normalizePath(path);
        const handle = this.syncHandleCache.get(normalized);
        if (!handle) {
          throw new Error(`No sync handle open for: ${path}. Call getSyncAccessHandle() first.`);
        }
        return handle.getSize();
      }
      /**
       * Truncate a file via its sync handle
       */
      truncateSync(path, newSize) {
        const normalized = this.normalizePath(path);
        const handle = this.syncHandleCache.get(normalized);
        if (!handle) {
          throw new Error(`No sync handle open for: ${path}. Call getSyncAccessHandle() first.`);
        }
        handle.truncate(newSize);
      }
      /**
       * Close a sync access handle and remove from cache
       * MUST be called to release the file lock
       */
      closeSyncHandle(path) {
        const normalized = this.normalizePath(path);
        const handle = this.syncHandleCache.get(normalized);
        if (handle) {
          handle.close();
          this.syncHandleCache.delete(normalized);
        }
      }
      /**
       * Close all open sync handles
       * Call this when cleaning up the worker
       */
      closeAllSyncHandles() {
        for (const [_path, handle] of this.syncHandleCache) {
          try {
            handle.close();
          } catch {
          }
        }
        this.syncHandleCache.clear();
      }
      /**
       * Check if a sync handle is open for a path
       */
      hasSyncHandle(path) {
        const normalized = this.normalizePath(path);
        return this.syncHandleCache.has(normalized);
      }
      /**
       * Read entire file synchronously using a temporary sync handle
       * Convenience method that opens, reads, and closes the handle
       */
      async readBinarySync(path) {
        const handle = await this.getSyncAccessHandle(path);
        try {
          const size = handle.getSize();
          const buffer = new Uint8Array(size);
          handle.read(buffer, { at: 0 });
          return buffer;
        } finally {
          this.closeSyncHandle(path);
        }
      }
      /**
       * Write entire file synchronously using a temporary sync handle
       * Convenience method that opens, writes, and closes the handle
       */
      async writeBinarySync(path, content) {
        const { parent, name } = await this.getParentAndName(path, { createParents: true });
        await parent.getFileHandle(name, { create: true });
        const handle = await this.getSyncAccessHandle(path);
        try {
          handle.truncate(0);
          handle.write(content, { at: 0 });
          handle.flush();
        } finally {
          this.closeSyncHandle(path);
        }
      }
    };
    OPFSBackend.DEFAULT_NAMESPACE = "siglum-files";
    opfsBackend = new OPFSBackend();
  }
});

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/engine/src/project-paths.js
function normalizeProjectPath(path) {
  if (typeof path !== "string" || !path || /[\0\r\n\\]/.test(path)) {
    throw new Error("Invalid project file path");
  }
  const parts = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) throw new Error(`Project path escapes its root: ${path}`);
      parts.pop();
    } else parts.push(part);
  }
  if (!parts.length) throw new Error("Project file path must name a file");
  return parts.join("/");
}

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/filesystem/dist/FileSystemService.js
init_constants();

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/filesystem/dist/compression.js
async function compress(data) {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  const response = new Response(cs.readable);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
async function decompress(data) {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  const response = new Response(ds.readable);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
function estimateCompressionRatio(data) {
  const sampleSize = Math.min(1e3, data.length);
  const sample = data.slice(0, sampleSize);
  const byteFreq = new Uint32Array(256);
  for (let i = 0; i < sample.length; i++) {
    byteFreq[sample[i]]++;
  }
  let uniqueBytes = 0;
  for (let i = 0; i < 256; i++) {
    if (byteFreq[i] > 0)
      uniqueBytes++;
  }
  if (uniqueBytes < 50)
    return 0.3;
  if (uniqueBytes < 100)
    return 0.5;
  if (uniqueBytes < 150)
    return 0.7;
  return 0.9;
}
function shouldCompress(data, minSizeBytes = 1024) {
  if (data.length < minSizeBytes)
    return false;
  if (data[0] === 31 && data[1] === 139)
    return false;
  if (data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71)
    return false;
  if (data[0] === 255 && data[1] === 216)
    return false;
  if (data[0] === 37 && data[1] === 80 && data[2] === 68 && data[3] === 70)
    return false;
  const ratio = estimateCompressionRatio(data);
  return ratio < 0.8;
}
async function autoCompress(data) {
  if (!shouldCompress(data)) {
    return { data, compressed: false };
  }
  const compressed = await compress(data);
  if (compressed.length < data.length * 0.95) {
    return { data: compressed, compressed: true };
  }
  return { data, compressed: false };
}
async function autoDecompress(data) {
  if (data[0] === 31 && data[1] === 139) {
    return decompress(data);
  }
  return data;
}

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/filesystem/dist/FileSystemService.js
function isOPFSAvailable() {
  return typeof navigator !== "undefined" && "storage" in navigator && "getDirectory" in navigator.storage;
}
async function testOPFSWriteSupport() {
  const testFileName = `.opfs-write-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const root = await navigator.storage.getDirectory();
    const testFile = await root.getFileHandle(testFileName, { create: true });
    if (typeof testFile.createWritable !== "function") {
      try {
        await root.removeEntry(testFileName);
      } catch {
      }
      return false;
    }
    const writable = await testFile.createWritable();
    await writable.write("test");
    await writable.close();
    try {
      await root.removeEntry(testFileName);
    } catch {
    }
    return true;
  } catch (e) {
    console.warn("[FileSystem] OPFS write test failed:", e);
    return false;
  }
}
var cachedBestBackend = null;
var bestBackendPromise = null;
function savedBackend() {
  try {
    const value = localStorage.getItem(BACKEND_STORAGE_KEY);
    return value === "opfs" || value === "indexeddb" ? value : null;
  } catch {
    return null;
  }
}
function rememberBackend(backend, persist = true) {
  try {
    if (persist)
      localStorage.setItem(BACKEND_STORAGE_KEY, backend.name);
  } catch {
  }
  cachedBestBackend = backend;
  return backend;
}
function isLegacyDocument(path) {
  return /^\/[^/]+\.tex$/i.test(path);
}
async function hasIndexedDBProjectFiles() {
  if (typeof indexedDB === "undefined")
    return false;
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME);
    let missing = false;
    request.onupgradeneeded = () => {
      missing = true;
      request.transaction.abort();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => missing ? resolve(null) : reject(request.error);
  });
  if (!database)
    return false;
  try {
    if (!database.objectStoreNames.contains(IDB_FILES_STORE))
      return false;
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(IDB_FILES_STORE, "readonly");
      const request = transaction.objectStore(IDB_FILES_STORE).openKeyCursor();
      transaction.onabort = () => reject(transaction.error);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(false);
        } else if (typeof cursor.key === "string" && (cursor.key.startsWith("/src/") || isLegacyDocument(cursor.key))) {
          resolve(true);
        } else {
          cursor.continue();
        }
      };
    });
  } finally {
    database.close();
  }
}
function directoryEntries(directory) {
  return directory.values();
}
async function containsFiles(directory) {
  for await (const entry of directoryEntries(directory)) {
    if (entry.kind === "file" || await containsFiles(entry))
      return true;
  }
  return false;
}
async function openDirectory(root, name) {
  try {
    return await root.getDirectoryHandle(name);
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError")
      return null;
    throw error;
  }
}
async function detectDocumentBackend() {
  try {
    const root = await navigator.storage.getDirectory();
    const files = await openDirectory(root, "siglum-files");
    if (files) {
      for await (const entry of directoryEntries(files)) {
        if (entry.kind === "file" && isLegacyDocument(`/${entry.name}`))
          return "opfs";
        if (entry.kind === "directory" && entry.name === "src" && await containsFiles(entry))
          return "opfs";
      }
    }
    const git = await openDirectory(root, "siglum-git");
    if (git && await containsFiles(git))
      return "opfs";
    return await hasIndexedDBProjectFiles() ? "indexeddb" : "opfs";
  } catch {
    throw new Error("Your document storage is temporarily unavailable. Reload to try again.");
  }
}
async function hasExistingOPFSFiles() {
  try {
    const root = await navigator.storage.getDirectory();
    for (const name of ["siglum-files", "siglum-git"]) {
      try {
        const directory = await root.getDirectoryHandle(name);
        for await (const _entry of directoryEntries(directory))
          return true;
      } catch {
      }
    }
  } catch {
  }
  return false;
}
async function getBestBackend() {
  if (cachedBestBackend)
    return cachedBestBackend;
  if (bestBackendPromise)
    return bestBackendPromise;
  bestBackendPromise = (async () => {
    const previous = savedBackend();
    if (previous !== "indexeddb" && isOPFSAvailable()) {
      if (await testOPFSWriteSupport()) {
        const detected = await detectDocumentBackend();
        if (detected === "indexeddb") {
          const { indexedDBBackend: indexedDBBackend3 } = await Promise.resolve().then(() => (init_IndexedDBBackend(), IndexedDBBackend_exports));
          console.log("[FileSystem] Using IndexedDB backend for existing documents");
          return rememberBackend(indexedDBBackend3);
        }
        const { opfsBackend: opfsBackend2 } = await Promise.resolve().then(() => (init_OPFSBackend(), OPFSBackend_exports));
        console.log("[FileSystem] Using OPFS backend");
        return rememberBackend(opfsBackend2);
      }
      if (previous === "opfs" || await hasExistingOPFSFiles()) {
        throw new Error("Your document storage is temporarily unavailable. Reload to try again. Siglum has not switched storage or replaced your documents.");
      }
    } else if (previous === "opfs") {
      throw new Error("Your document storage is unavailable in this browser context. Reopen Siglum in the browser where you saved your documents.");
    }
    const { indexedDBBackend: indexedDBBackend2 } = await Promise.resolve().then(() => (init_IndexedDBBackend(), IndexedDBBackend_exports));
    console.log("[FileSystem] Using IndexedDB backend");
    return rememberBackend(indexedDBBackend2, previous === "indexeddb");
  })().catch((error) => {
    bestBackendPromise = null;
    throw error;
  });
  return bestBackendPromise;
}
async function getBackend(preference) {
  switch (preference) {
    case "opfs": {
      if (!isOPFSAvailable()) {
        throw new Error("OPFS is not available in this browser");
      }
      const { opfsBackend: opfsBackend2 } = await Promise.resolve().then(() => (init_OPFSBackend(), OPFSBackend_exports));
      return opfsBackend2;
    }
    case "indexeddb": {
      const { indexedDBBackend: indexedDBBackend2 } = await Promise.resolve().then(() => (init_IndexedDBBackend(), IndexedDBBackend_exports));
      return indexedDBBackend2;
    }
    case "auto":
    default:
      return getBestBackend();
  }
}
var FileSystemService = class {
  constructor() {
    this.mounts = [];
    this.eventHandlers = /* @__PURE__ */ new Set();
  }
  /**
   * Mount a backend at a specific path
   * More specific paths take precedence
   */
  mount(path, backend) {
    const normalizedPath = this.normalizeMountPath(path);
    this.mounts = this.mounts.filter((m) => m.path !== normalizedPath);
    this.mounts.push({ path: normalizedPath, backend });
    this.mounts.sort((a, b) => b.path.length - a.path.length);
  }
  /**
   * Mount with automatic backend selection
   *
   * @param path - Path to mount
   * @param options - Mount options (backend preference)
   * @returns The backend that was mounted
   *
   * @example
   * // Auto-select best backend (OPFS if available, else IndexedDB)
   * const backend = await fileSystem.mountAuto('/documents')
   *
   * // Force OPFS (throws if not available)
   * await fileSystem.mountAuto('/documents', { backend: 'opfs' })
   *
   * // Force IndexedDB
   * await fileSystem.mountAuto('/documents', { backend: 'indexeddb' })
   */
  async mountAuto(path, options = {}) {
    const preference = options.backend ?? "auto";
    let backend = await getBackend(preference);
    if (options.namespace) {
      if (backend.name === "opfs") {
        const { OPFSBackend: OPFSBackend2 } = await Promise.resolve().then(() => (init_OPFSBackend(), OPFSBackend_exports));
        backend = new OPFSBackend2(options.namespace);
      } else {
        const { IndexedDBBackend: IndexedDBBackend2 } = await Promise.resolve().then(() => (init_IndexedDBBackend(), IndexedDBBackend_exports));
        const { IDB_NAME: IDB_NAME2 } = await Promise.resolve().then(() => (init_constants(), constants_exports));
        backend = new IndexedDBBackend2(`${IDB_NAME2}-${options.namespace}`);
      }
    }
    this.mount(path, backend);
    return backend;
  }
  /**
   * Unmount a backend at a specific path
   */
  unmount(path) {
    const normalizedPath = this.normalizeMountPath(path);
    this.mounts = this.mounts.filter((m) => m.path !== normalizedPath);
  }
  /**
   * Get the backend for a given path
   */
  getBackendForPath(path) {
    const normalizedPath = this.normalizePath(path);
    for (const mount of this.mounts) {
      if (normalizedPath.startsWith(mount.path) || normalizedPath === mount.path.slice(0, -1)) {
        let relativePath = normalizedPath.slice(mount.path.length);
        if (!relativePath.startsWith("/")) {
          relativePath = "/" + relativePath;
        }
        return { backend: mount.backend, relativePath };
      }
    }
    throw new Error(`No filesystem mounted for path: ${path}`);
  }
  normalizePath(path) {
    if (!path.startsWith("/")) {
      path = "/" + path;
    }
    return path.replace(/\/+/g, "/");
  }
  normalizeMountPath(path) {
    let normalized = this.normalizePath(path);
    if (!normalized.endsWith("/")) {
      normalized += "/";
    }
    return normalized;
  }
  /**
   * Subscribe to filesystem events
   */
  subscribe(handler) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }
  emit(event) {
    this.eventHandlers.forEach((handler) => handler(event));
  }
  // File Operations
  async readFile(path) {
    const { backend, relativePath } = this.getBackendForPath(path);
    return backend.readFile(relativePath);
  }
  async readBinary(path, options) {
    const { backend, relativePath } = this.getBackendForPath(path);
    const data = await backend.readBinary(relativePath);
    if (options?.autoDecompress !== false) {
      return autoDecompress(data);
    }
    return data;
  }
  async writeFile(path, content, options) {
    const { backend, relativePath } = this.getBackendForPath(path);
    if (options?.createParents) {
      const parentPath = this.getParentPath(relativePath);
      if (parentPath !== "/") {
        await backend.mkdir(parentPath);
      }
    }
    const shouldEmit = !options?.silent && this.eventHandlers.size > 0;
    const existed = shouldEmit ? await backend.exists(relativePath) : false;
    await backend.writeFile(relativePath, content);
    if (shouldEmit) {
      this.emit({
        type: existed ? "file:modified" : "file:created",
        path: this.normalizePath(path)
      });
    }
  }
  async writeBinary(path, content, options) {
    const { backend, relativePath } = this.getBackendForPath(path);
    if (options?.createParents) {
      const parentPath = this.getParentPath(relativePath);
      if (parentPath !== "/") {
        await backend.mkdir(parentPath);
      }
    }
    let finalContent = content;
    if (options?.compress === true) {
      finalContent = await compress(content);
    } else if (options?.compress === "auto") {
      const result = await autoCompress(content);
      finalContent = result.data;
    }
    const shouldEmit = !options?.silent && this.eventHandlers.size > 0;
    const existed = shouldEmit ? await backend.exists(relativePath) : false;
    await backend.writeBinary(relativePath, finalContent);
    if (shouldEmit) {
      this.emit({
        type: existed ? "file:modified" : "file:created",
        path: this.normalizePath(path)
      });
    }
  }
  async deleteFile(path, options) {
    const { backend, relativePath } = this.getBackendForPath(path);
    await backend.deleteFile(relativePath);
    if (!options?.silent) {
      this.emit({ type: "file:deleted", path: this.normalizePath(path) });
    }
  }
  async exists(path) {
    try {
      const { backend, relativePath } = this.getBackendForPath(path);
      return backend.exists(relativePath);
    } catch {
      return false;
    }
  }
  async stat(path) {
    const { backend, relativePath } = this.getBackendForPath(path);
    return backend.stat(relativePath);
  }
  // Directory Operations
  async mkdir(path, options) {
    const { backend, relativePath } = this.getBackendForPath(path);
    await backend.mkdir(relativePath);
    if (!options?.silent) {
      this.emit({ type: "directory:created", path: this.normalizePath(path) });
    }
  }
  async rmdir(path, options) {
    const { backend, relativePath } = this.getBackendForPath(path);
    await backend.rmdir(relativePath, options);
    if (!options?.silent) {
      this.emit({ type: "directory:deleted", path: this.normalizePath(path) });
    }
  }
  async readdir(path) {
    const { backend, relativePath } = this.getBackendForPath(path);
    const entries = await backend.readdir(relativePath);
    const normalizedMountPath = this.normalizePath(path);
    return entries.map((entry) => ({
      ...entry,
      path: (normalizedMountPath === "/" ? "" : normalizedMountPath) + "/" + entry.name
    }));
  }
  // Utility Operations
  async rename(oldPath, newPath) {
    const oldBackend = this.getBackendForPath(oldPath);
    const newBackend = this.getBackendForPath(newPath);
    const source = this.normalizePath(oldPath);
    const destination = this.normalizePath(newPath);
    if (source === destination)
      return;
    const stats = await oldBackend.backend.stat(oldBackend.relativePath);
    if (stats.isDirectory) {
      if (oldBackend.relativePath === "/" || destination.startsWith(source + "/")) {
        throw new Error("EINVAL: cannot move a mounted root or a directory into itself");
      }
      if (await this.exists(destination))
        throw new Error(`EEXIST: destination already exists: ${destination}`);
      const copyDirectory = async (from, to) => {
        await this.mkdir(to, { silent: true });
        for (const entry of await this.readdir(from)) {
          const target = to + "/" + entry.name;
          if (entry.isDirectory)
            await copyDirectory(entry.path, target);
          else
            await this.copyFile(entry.path, target);
        }
      };
      await copyDirectory(source, destination);
      await this.rmdir(source, { recursive: true, silent: true });
      this.emit({ type: "directory:deleted", path: source });
      this.emit({ type: "directory:created", path: destination });
      return;
    }
    if (oldBackend.backend !== newBackend.backend) {
      const content = await oldBackend.backend.readBinary(oldBackend.relativePath);
      await newBackend.backend.writeBinary(newBackend.relativePath, content);
      await oldBackend.backend.deleteFile(oldBackend.relativePath);
    } else {
      await oldBackend.backend.rename(oldBackend.relativePath, newBackend.relativePath);
    }
    this.emit({ type: "file:deleted", path: this.normalizePath(oldPath) });
    this.emit({ type: "file:created", path: this.normalizePath(newPath) });
  }
  async copyFile(src, dest) {
    const srcBackend = this.getBackendForPath(src);
    const destBackend = this.getBackendForPath(dest);
    if (srcBackend.backend !== destBackend.backend) {
      const content = await srcBackend.backend.readBinary(srcBackend.relativePath);
      await destBackend.backend.writeBinary(destBackend.relativePath, content);
    } else {
      await srcBackend.backend.copyFile(srcBackend.relativePath, destBackend.relativePath);
    }
    this.emit({ type: "file:created", path: this.normalizePath(dest) });
  }
  getParentPath(path) {
    const normalized = this.normalizePath(path);
    const lastSlash = normalized.lastIndexOf("/");
    if (lastSlash <= 0)
      return "/";
    return normalized.slice(0, lastSlash);
  }
  /**
   * Get information about mounted filesystems
   */
  getMounts() {
    return this.mounts.map((m) => ({
      path: m.path,
      backend: m.backend.name
    }));
  }
  /**
   * Check if a path has a mounted backend
   */
  isMounted(path) {
    try {
      this.getBackendForPath(path);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Get the backend type for a given path
   * Returns 'opfs', 'indexeddb', or null if not mounted
   */
  getBackendType(path) {
    try {
      const { backend } = this.getBackendForPath(path);
      return backend.name;
    } catch {
      return null;
    }
  }
  /**
   * Read multiple files in a single batch operation
   * More efficient than individual reads for many small files
   *
   * @param paths - Array of file paths to read
   * @returns Map of path -> Uint8Array (missing files are omitted)
   */
  async readBinaryBatch(paths) {
    const results = /* @__PURE__ */ new Map();
    const pathsByBackend = /* @__PURE__ */ new Map();
    for (const path of paths) {
      try {
        const { backend, relativePath } = this.getBackendForPath(path);
        if (!pathsByBackend.has(backend)) {
          pathsByBackend.set(backend, []);
        }
        pathsByBackend.get(backend).push({ path, relativePath });
      } catch {
      }
    }
    for (const [backend, backendPaths] of pathsByBackend) {
      if ("readBinaryBatch" in backend && typeof backend.readBinaryBatch === "function") {
        const relativePaths = backendPaths.map((p) => p.relativePath);
        const batchResults = await backend.readBinaryBatch(relativePaths);
        for (const { path, relativePath } of backendPaths) {
          const data = batchResults.get(relativePath);
          if (data) {
            results.set(path, data);
          }
        }
      } else {
        const readPromises = backendPaths.map(async ({ path, relativePath }) => {
          try {
            const data = await backend.readBinary(relativePath);
            results.set(path, data);
          } catch {
          }
        });
        await Promise.all(readPromises);
      }
    }
    return results;
  }
  /**
   * Write multiple files in a single batch operation
   * Efficient for writing many files with progress reporting
   *
   * @param entries - Array of {path, content} entries to write
   * @param options - Batch write options including progress callback
   */
  async writeBinaryBatch(entries, options = {}) {
    const total = entries.length;
    if (total === 0) {
      options.onProgress?.(0, 0);
      return;
    }
    const entriesByBackend = /* @__PURE__ */ new Map();
    const mountPathByBackend = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      try {
        const { backend, relativePath } = this.getBackendForPath(entry.path);
        if (!entriesByBackend.has(backend)) {
          entriesByBackend.set(backend, []);
          const mount = this.mounts.find((m) => m.backend === backend);
          mountPathByBackend.set(backend, mount?.path || "/");
        }
        entriesByBackend.get(backend).push({ path: relativePath, content: entry.content });
      } catch {
      }
    }
    let completed = 0;
    for (const [backend, backendEntries] of entriesByBackend) {
      const startCompleted = completed;
      if (backend.writeBinaryBatch) {
        await backend.writeBinaryBatch(backendEntries, {
          ...options,
          onProgress: (c, _t) => {
            completed = startCompleted + c;
            options.onProgress?.(completed, total);
          }
        });
        completed = startCompleted + backendEntries.length;
      } else {
        const { createParents = true, concurrency = 20 } = options;
        for (let i = 0; i < backendEntries.length; i += concurrency) {
          const batch = backendEntries.slice(i, i + concurrency);
          await Promise.all(batch.map(async ({ path, content }) => {
            if (createParents) {
              const parentPath = this.getParentPath(path);
              if (parentPath !== "/") {
                await backend.mkdir(parentPath);
              }
            }
            await backend.writeBinary(path, content);
            completed++;
          }));
          options.onProgress?.(completed, total);
        }
      }
    }
    if (!options.silent && this.eventHandlers.size > 0) {
      for (const entry of entries) {
        this.emit({ type: "file:created", path: this.normalizePath(entry.path) });
      }
    }
  }
};
var fileSystem = new FileSystemService();

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/filesystem/dist/index.js
init_OPFSBackend();
init_constants();

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/engine/src/hash.js
var blake3Module = null;
var HASH_LENGTH = 8;
var SMALL_INPUT_THRESHOLD = 128;
var BLAKE3_OPTIONS = Object.freeze({ length: HASH_LENGTH });
function djb2Hash(content) {
  let hash = 5381 >>> 0;
  const len = content.length;
  for (let i = 0; i < len; i++) {
    hash = (hash * 33 ^ content.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
function hashSync(content) {
  if (content.length < SMALL_INPUT_THRESHOLD) {
    return djb2Hash(content);
  }
  if (blake3Module) {
    return blake3Module.hash(content, BLAKE3_OPTIONS).toString("hex");
  }
  return djb2Hash(content);
}

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/engine/src/storage.js
function getFileSystem() {
  return fileSystem;
}
var wasmCacheMounted = false;
var wasmCacheMounting = null;
async function ensureWasmCacheMounted() {
  if (wasmCacheMounted) return true;
  if (wasmCacheMounting) return wasmCacheMounting;
  const fs = getFileSystem();
  if (!fs) return false;
  wasmCacheMounting = (async () => {
    try {
      await fs.mountAuto("/wasm-cache");
      wasmCacheMounted = true;
      return true;
    } catch (e) {
      console.warn("Failed to mount wasm-cache filesystem:", e);
      return false;
    } finally {
      wasmCacheMounting = null;
    }
  })();
  return wasmCacheMounting;
}
var CTAN_CACHE_VERSION = 12;
var BUNDLE_CACHE_VERSION = 6;
var MANIFEST_CACHE_VERSION = 7;
var ctanCacheMounted = false;
var ctanCacheMounting = null;
async function ensureCtanCacheMounted() {
  if (ctanCacheMounted) return true;
  if (ctanCacheMounting) return ctanCacheMounting;
  const fs = getFileSystem();
  if (!fs) return false;
  ctanCacheMounting = (async () => {
    try {
      await fs.mountAuto("/ctan-cache");
      ctanCacheMounted = true;
      return true;
    } catch (e) {
      console.warn("Failed to mount ctan-cache filesystem:", e);
      return false;
    } finally {
      ctanCacheMounting = null;
    }
  })();
  return ctanCacheMounting;
}
async function getPackageMeta(packageName) {
  try {
    if (!await ensureCtanCacheMounted()) return null;
    const fs = getFileSystem();
    const content = await fs.readFile(`/ctan-cache/${packageName}.json`);
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}
async function savePackageMeta(packageName, meta) {
  try {
    if (!await ensureCtanCacheMounted()) return false;
    const fs = getFileSystem();
    const data = { name: packageName, ...meta, timestamp: Date.now() };
    await fs.writeFile(`/ctan-cache/${packageName}.json`, JSON.stringify(data), { createParents: true });
    return true;
  } catch (e) {
    return false;
  }
}
var manifestsMounted = false;
var manifestsMounting = null;
async function ensureManifestsMounted() {
  if (manifestsMounted) return true;
  if (manifestsMounting) return manifestsMounting;
  const fs = getFileSystem();
  if (!fs) return false;
  manifestsMounting = (async () => {
    try {
      await fs.mountAuto("/manifests", { namespace: "siglum-engine-manifests" });
      manifestsMounted = true;
      return true;
    } catch (e) {
      console.warn("Failed to mount manifests filesystem:", e);
      return false;
    } finally {
      manifestsMounting = null;
    }
  })();
  return manifestsMounting;
}
var texliveMounted = false;
var texliveMounting = null;
async function ensureTexliveMounted() {
  if (texliveMounted) return true;
  if (texliveMounting) return texliveMounting;
  const fs = getFileSystem();
  if (!fs) return false;
  texliveMounting = (async () => {
    try {
      await fs.mountAuto("/texlive");
      texliveMounted = true;
      return true;
    } catch (e) {
      console.warn("Failed to mount texlive filesystem:", e);
      return false;
    } finally {
      texliveMounting = null;
    }
  })();
  return texliveMounting;
}
var bundleCacheMounted = false;
var bundleCacheMounting = null;
async function ensureBundleCacheMounted() {
  if (bundleCacheMounted) return true;
  if (bundleCacheMounting) return bundleCacheMounting;
  const fs = getFileSystem();
  if (!fs) return false;
  bundleCacheMounting = (async () => {
    try {
      await fs.mountAuto("/bundle-cache");
      bundleCacheMounted = true;
      try {
        const versionStr = await fs.readFile("/bundle-cache/version");
        const version = parseInt(versionStr) || 0;
        if (version < BUNDLE_CACHE_VERSION) {
          if (version > 0) {
            console.log(`Bundle cache version upgrade (${version} \u2192 ${BUNDLE_CACHE_VERSION}), clearing...`);
          }
          await fs.rmdir("/bundle-cache", { recursive: true });
          await fs.mountAuto("/bundle-cache");
        }
      } catch (e) {
      }
      await fs.writeFile("/bundle-cache/version", String(BUNDLE_CACHE_VERSION));
      return true;
    } catch (e) {
      console.warn("Failed to mount bundle-cache filesystem:", e);
      return false;
    } finally {
      bundleCacheMounting = null;
    }
  })();
  return bundleCacheMounting;
}
async function getBundleFromCache(bundleName) {
  try {
    if (!await ensureBundleCacheMounted()) return null;
    const fs = getFileSystem();
    const data = await fs.readBinary(`/bundle-cache/bundles/${bundleName}.data`);
    return data?.buffer || null;
  } catch (e) {
    return null;
  }
}
async function saveBundleToCache(bundleName, data) {
  try {
    if (!await ensureBundleCacheMounted()) return false;
    const fs = getFileSystem();
    await fs.mkdir("/bundle-cache/bundles");
    let buffer = data;
    if (typeof SharedArrayBuffer !== "undefined" && data instanceof SharedArrayBuffer) {
      buffer = new ArrayBuffer(data.byteLength);
      new Uint8Array(buffer).set(new Uint8Array(data));
    }
    await fs.writeBinary(`/bundle-cache/bundles/${bundleName}.data`, new Uint8Array(buffer));
    return true;
  } catch (e) {
    console.warn(`Failed to save bundle ${bundleName}:`, e);
    return false;
  }
}
async function getManifestFromCache(name) {
  try {
    if (!await ensureManifestsMounted()) return null;
    const fs = getFileSystem();
    const content = await fs.readFile(`/manifests/${name}.json`);
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}
async function saveManifestToCache(name, data) {
  try {
    if (!await ensureManifestsMounted()) return false;
    const fs = getFileSystem();
    await fs.writeFile(`/manifests/${name}.json`, JSON.stringify(data), { createParents: true });
    return true;
  } catch (e) {
    return false;
  }
}
async function getManifestVersion() {
  try {
    if (!await ensureManifestsMounted()) return 0;
    const fs = getFileSystem();
    const content = await fs.readFile("/manifests/version");
    return parseInt(content) || 0;
  } catch (e) {
    return 0;
  }
}
async function saveManifestVersion(version) {
  try {
    if (!await ensureManifestsMounted()) return false;
    const fs = getFileSystem();
    await fs.writeFile("/manifests/version", String(version), { createParents: true });
    return true;
  } catch (e) {
    return false;
  }
}
var auxMemoryCache = /* @__PURE__ */ new Map();
var MAX_AUX_CACHE_SIZE = 20;
var auxCacheMounted = false;
var auxCacheMounting = null;
async function ensureAuxCacheMounted() {
  if (auxCacheMounted) return true;
  if (auxCacheMounting) return auxCacheMounting;
  const fs = getFileSystem();
  if (!fs) return false;
  auxCacheMounting = (async () => {
    try {
      await fs.mountAuto("/aux-cache");
      auxCacheMounted = true;
      return true;
    } catch (e) {
      console.warn("Failed to mount aux-cache filesystem:", e);
      return false;
    } finally {
      auxCacheMounting = null;
    }
  })();
  return auxCacheMounting;
}
async function getAuxCache(preambleHash) {
  if (auxMemoryCache.has(preambleHash)) {
    const value = auxMemoryCache.get(preambleHash);
    auxMemoryCache.delete(preambleHash);
    auxMemoryCache.set(preambleHash, value);
    return value;
  }
  try {
    if (!await ensureAuxCacheMounted()) return null;
    const fs = getFileSystem();
    const content = await fs.readFile(`/aux-cache/${preambleHash}.json`);
    const result = JSON.parse(content);
    if (result) {
      if (auxMemoryCache.size >= MAX_AUX_CACHE_SIZE) {
        const firstKey = auxMemoryCache.keys().next().value;
        auxMemoryCache.delete(firstKey);
      }
      auxMemoryCache.set(preambleHash, result);
    }
    return result;
  } catch (e) {
    return null;
  }
}
async function saveAuxCache(preambleHash, auxFiles) {
  const entry = { hash: preambleHash, files: auxFiles, timestamp: Date.now() };
  const exists = auxMemoryCache.has(preambleHash);
  if (exists) {
    auxMemoryCache.delete(preambleHash);
  } else if (auxMemoryCache.size >= MAX_AUX_CACHE_SIZE) {
    const firstKey = auxMemoryCache.keys().next().value;
    auxMemoryCache.delete(firstKey);
  }
  auxMemoryCache.set(preambleHash, entry);
  ensureAuxCacheMounted().then((mounted) => {
    if (!mounted) return;
    const fs = getFileSystem();
    fs.writeFile(`/aux-cache/${preambleHash}.json`, JSON.stringify(entry), { createParents: true }).catch(() => {
    });
  });
}
var docMemoryCache = /* @__PURE__ */ new Map();
var MAX_DOC_CACHE_SIZE = 10;
var docCacheMounted = false;
var docCacheMounting = null;
async function ensureDocCacheMounted() {
  if (docCacheMounted) return true;
  if (docCacheMounting) return docCacheMounting;
  const fs = getFileSystem();
  if (!fs) return false;
  docCacheMounting = (async () => {
    try {
      await fs.mountAuto("/doc-cache");
      docCacheMounted = true;
      return true;
    } catch (e) {
      console.warn("Failed to mount doc-cache filesystem:", e);
      return false;
    } finally {
      docCacheMounting = null;
    }
  })();
  return docCacheMounting;
}
async function getCachedPdf(docHash, engine) {
  const key = docHash + "_" + engine;
  if (docMemoryCache.has(key)) {
    const value = docMemoryCache.get(key);
    docMemoryCache.delete(key);
    docMemoryCache.set(key, value);
    return value;
  }
  try {
    if (!await ensureDocCacheMounted()) return null;
    const fs = getFileSystem();
    const pdfData = await fs.readBinary(`/doc-cache/${key}.pdf`);
    if (pdfData) {
      if (docMemoryCache.size >= MAX_DOC_CACHE_SIZE) {
        const firstKey = docMemoryCache.keys().next().value;
        docMemoryCache.delete(firstKey);
      }
      docMemoryCache.set(key, pdfData);
    }
    return pdfData || null;
  } catch (e) {
    return null;
  }
}
async function saveCachedPdf(docHash, engine, pdfData) {
  const key = docHash + "_" + engine;
  const exists = docMemoryCache.has(key);
  if (exists) {
    docMemoryCache.delete(key);
  } else if (docMemoryCache.size >= MAX_DOC_CACHE_SIZE) {
    const firstKey = docMemoryCache.keys().next().value;
    docMemoryCache.delete(firstKey);
  }
  docMemoryCache.set(key, pdfData);
  ensureDocCacheMounted().then((mounted) => {
    if (!mounted) return;
    const fs = getFileSystem();
    fs.writeBinary(`/doc-cache/${key}.pdf`, pdfData, { createParents: true }).catch(() => {
    });
  });
}
function getFmtPath(fmtKey) {
  return `fmt-cache/${fmtKey}.fmt`;
}
async function clearCTANCache() {
  try {
    if (!await ensureCtanCacheMounted()) return false;
    const fs = getFileSystem();
    await fs.rmdir("/ctan-cache", { recursive: true });
    ctanCacheMounted = false;
    await ensureCtanCacheMounted();
    return true;
  } catch (e) {
    return false;
  }
}
var MEMORY_SNAPSHOT_VERSION = 1;
var MEMORY_SNAPSHOT_PATH = "/wasm-cache/memory-snapshot.bin";
var MEMORY_SNAPSHOT_META_PATH = "/wasm-cache/memory-snapshot-meta.json";
var snapshotSaveInProgress = false;
async function saveWasmMemorySnapshot(memoryOrSnapshot, metadata = {}) {
  if (snapshotSaveInProgress) {
    console.log("Memory snapshot save already in progress, skipping");
    return false;
  }
  snapshotSaveInProgress = true;
  try {
    if (!await ensureWasmCacheMounted()) {
      console.warn("Cannot save memory snapshot - filesystem not available");
      return false;
    }
    const snapshot = memoryOrSnapshot instanceof Uint8Array ? memoryOrSnapshot : new Uint8Array(memoryOrSnapshot.buffer);
    const byteLength = snapshot.byteLength;
    const fs = getFileSystem();
    await fs.writeBinary(MEMORY_SNAPSHOT_PATH, snapshot, { createParents: true, silent: true });
    const metaData = {
      byteLength,
      metadata,
      timestamp: Date.now(),
      version: MEMORY_SNAPSHOT_VERSION
    };
    await fs.writeFile(MEMORY_SNAPSHOT_META_PATH, JSON.stringify(metaData), { silent: true });
    console.log(`Saved WASM memory snapshot (${(byteLength / 1024 / 1024).toFixed(1)}MB)`);
    return true;
  } catch (e) {
    console.warn("Failed to save memory snapshot:", e);
    return false;
  } finally {
    snapshotSaveInProgress = false;
  }
}

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/engine/src/bundles.js
async function decompress2(compressed, format = "gzip") {
  if (format === "none") {
    return compressed;
  }
  const ds = new DecompressionStream(format);
  const blob = new Blob([compressed]);
  const stream = blob.stream().pipeThrough(ds);
  return await new Response(stream).arrayBuffer();
}
var BundleManager = class {
  /**
   * @param {BundleManagerOptions} [options] - Manager options
   */
  constructor(options = {}) {
    this.bundleBase = options.bundleBase || "packages/bundles";
    this.cachePrefix = (this.bundleBase.match(/\/releases\/(tl2026-[a-f0-9]{16})(?:\/|$)/)?.[1] || "tl2026-r1") + "-";
    this.bundleCache = /* @__PURE__ */ new Map();
    this.fileManifest = null;
    this.packageMap = null;
    this.sourceCommands = /* @__PURE__ */ new Map();
    this.bundleDeps = null;
    this.packageDeps = null;
    this.bundleRegistry = null;
    this.bytesDownloaded = 0;
    this.cacheHitCount = 0;
    this.onLog = options.onLog || (() => {
    });
    this.onProgress = options.onProgress || (() => {
    });
  }
  /**
   * Compute a hash for bundle versioning based on manifest entries
   * Uses the file paths and sizes to detect changes
   */
  getBundleHash(bundleName) {
    if (!this.fileManifest) return null;
    const bundleFiles = Object.entries(this.fileManifest).filter(([_, info]) => info.bundle === bundleName).sort(([a], [b]) => a.localeCompare(b)).map(([path, info]) => `${path}:${info.size}`).join("|");
    let hash = 0;
    for (let i = 0; i < bundleFiles.length; i++) {
      const char = bundleFiles.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
  /**
   * Load bundle manifests from cache or server.
   * @returns {Promise<Object>} File manifest
   */
  async loadManifest() {
    if (this.fileManifest) return this.fileManifest;
    const cachedVersion = await getManifestVersion();
    if (cachedVersion === MANIFEST_CACHE_VERSION) {
      const [manifest, bundlesData2] = await Promise.all([
        getManifestFromCache(this.cachePrefix + "file-manifest"),
        getManifestFromCache(this.cachePrefix + "bundles")
      ]);
      if (manifest && bundlesData2) {
        this.onLog("Manifests loaded from cache");
        this.fileManifest = manifest;
        this._initFromBundlesData(bundlesData2);
        return this.fileManifest;
      }
    }
    const [manifestRes, bundlesRes] = await Promise.all([
      fetch(`${this.bundleBase}/file-manifest.json`),
      fetch(`${this.bundleBase}/bundles.json`)
    ]);
    this.fileManifest = await manifestRes.json();
    const bundlesData = await bundlesRes.json();
    this._initFromBundlesData(bundlesData);
    try {
      await Promise.all([
        saveManifestToCache(this.cachePrefix + "file-manifest", this.fileManifest),
        saveManifestToCache(this.cachePrefix + "bundles", bundlesData),
        saveManifestVersion(MANIFEST_CACHE_VERSION)
      ]);
      this.onLog("Manifests saved to cache");
    } catch (e) {
    }
    return this.fileManifest;
  }
  _initFromBundlesData(bundlesData) {
    this.bundleRegistry = new Set(Object.keys(bundlesData.bundles || {}));
    this.packageMap = bundlesData.packages || {};
    this.sourceCommands = new Map(Object.entries(bundlesData.sourceCommands || {}));
    this.bundleDeps = {
      engines: bundlesData.engines || {},
      bundles: {},
      deferred: bundlesData.deferred || []
    };
    for (const [name, info] of Object.entries(bundlesData.bundles || {})) {
      if (info.requires && info.requires.length > 0) {
        this.bundleDeps.bundles[name] = { requires: info.requires };
      }
    }
  }
  _addSourceCommandPackages(source, packages) {
    if (![...this.sourceCommands.keys()].some((command) => source.includes("\\" + command))) return;
    for (const [, command] of source.matchAll(/\\([A-Za-z@]+|[^\r\n])|%[^\r\n]*/g)) {
      const required = this.sourceCommands.get(command);
      if (Array.isArray(required)) {
        for (const pkg of required) packages.add(pkg);
      }
    }
  }
  /**
   * Load bundle dependency information.
   * @returns {Promise<Object>} Bundle dependencies
   */
  async loadBundleDeps() {
    if (!this.bundleDeps) {
      await this.loadManifest();
    }
    if (!this.packageDeps) {
      const cachedVersion = await getManifestVersion();
      if (cachedVersion === MANIFEST_CACHE_VERSION) {
        const packageDeps = await getManifestFromCache(this.cachePrefix + "package-deps");
        if (packageDeps) {
          this.packageDeps = packageDeps;
          return this.bundleDeps;
        }
      }
      try {
        const packageDepsRes = await fetch(`${this.bundleBase}/package-deps.json`).catch(() => null);
        if (packageDepsRes?.ok) {
          this.packageDeps = await packageDepsRes.json();
          try {
            await saveManifestToCache(this.cachePrefix + "package-deps", this.packageDeps);
          } catch (e) {
          }
        }
      } catch (e) {
      }
    }
    return this.bundleDeps;
  }
  /**
   * Check if a bundle exists in the registry.
   * @param {string} bundleName - Bundle name
   * @returns {boolean}
   */
  bundleExists(bundleName) {
    return this.bundleRegistry?.has(bundleName) ?? false;
  }
  /**
   * Resolve packages to their required bundles.
   * @param {string[]} packages - Package names
   * @param {string} [engine] - Engine name
   * @returns {string[]} Bundle names
   */
  resolveBundles(packages, engine = "xelatex") {
    const bundles = /* @__PURE__ */ new Set();
    const resolved = /* @__PURE__ */ new Set();
    const engineDeps = this.bundleDeps?.engines?.[engine];
    if (engineDeps?.required) {
      for (const b of engineDeps.required) {
        if (this.bundleExists(b)) bundles.add(b);
      }
    }
    const addBundle = (bundleName) => {
      if (resolved.has(bundleName)) return;
      resolved.add(bundleName);
      if (!this.bundleExists(bundleName)) return;
      bundles.add(bundleName);
      const bundleInfo = this.bundleDeps?.bundles?.[bundleName];
      if (bundleInfo?.requires) {
        for (const dep of bundleInfo.requires) {
          addBundle(dep);
        }
      }
    };
    const resolvePackage = (pkg) => {
      if (resolved.has("pkg:" + pkg)) return;
      resolved.add("pkg:" + pkg);
      const bundleName = this.packageMap?.[pkg];
      if (bundleName) {
        addBundle(bundleName);
      }
      const pkgDeps = this.packageDeps?.[pkg] || [];
      for (const dep of pkgDeps) {
        resolvePackage(dep);
      }
    };
    for (const pkg of packages) {
      resolvePackage(pkg);
    }
    return [...bundles].filter((b) => this.bundleExists(b));
  }
  /**
   * Extract packages from LaTeX source and resolve to bundles.
   * @param {string} source - LaTeX source
   * @param {string} [engine] - Engine name
   * @returns {{packages: string[], bundles: string[]}}
   */
  checkPackages(source, engine = "xelatex") {
    const packages = /* @__PURE__ */ new Set();
    const usePackageRegex = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
    let match;
    while ((match = usePackageRegex.exec(source)) !== null) {
      const pkgList = match[1].split(",").map((p) => p.trim());
      for (const pkg of pkgList) packages.add(pkg);
    }
    const docclassMatch = source.match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/);
    if (docclassMatch) {
      packages.add(docclassMatch[1]);
    }
    const requireRegex = /\\RequirePackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
    while ((match = requireRegex.exec(source)) !== null) {
      const pkgList = match[1].split(",").map((p) => p.trim());
      for (const pkg of pkgList) packages.add(pkg);
    }
    this._addSourceCommandPackages(source, packages);
    const bundles = this.resolveBundles([...packages], engine);
    return { packages: [...packages], bundles };
  }
  /**
   * Pre-scan source to identify packages needing CTAN fetch.
   * Expands detected packages with known dependencies from packageDeps.
   * Scans additionalFiles for multi-file documents.
   *
   * @param {string} source - Main LaTeX source
   * @param {string} engine - Engine (pdflatex, xelatex, etc.)
   * @param {Object} additionalFiles - Optional map of filename → content
   * @param {string} [mainFile] - Main source path from the virtual project root
   * @param {string[]} [plannedBundles] - Bundles already selected from the main source
   * @returns {{ bundledPackages: string[], ctanPackages: string[], additionalBundles: string[] }}
   */
  prescanForCtanPackages(source, engine = "pdflatex", additionalFiles = {}, mainFile = "document.tex", plannedBundles = this.checkPackages(source, engine).bundles) {
    const packages = /* @__PURE__ */ new Set();
    const extensions = /* @__PURE__ */ new Map();
    const mainPath = normalizeProjectPath(mainFile);
    const directory = mainPath.includes("/") ? mainPath.slice(0, mainPath.lastIndexOf("/") + 1) : "";
    const localFiles = new Set(Object.keys(additionalFiles).map(normalizeProjectPath));
    const addPackage = (pkg, extension) => {
      packages.add(pkg);
      if (!extensions.has(pkg)) extensions.set(pkg, /* @__PURE__ */ new Set());
      extensions.get(pkg).add(extension);
    };
    const isLocal = (pkg) => [...extensions.get(pkg) || [".sty"]].every((extension) => {
      try {
        const path = (pkg.startsWith("/") ? pkg : directory + pkg) + extension;
        return localFiles.has(normalizeProjectPath(path));
      } catch {
        return false;
      }
    });
    const extractPackages = (content) => {
      return content.split(",").map((p) => p.trim()).filter((p) => p);
    };
    const scanSource = (text) => {
      const usePackageRegex = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
      let match;
      while ((match = usePackageRegex.exec(text)) !== null) {
        for (const pkg of extractPackages(match[1])) addPackage(pkg, ".sty");
      }
      const requireRegex = /\\RequirePackage(?:WithOptions)?(?:\[[^\]]*\])?\{([^}]+)\}/g;
      while ((match = requireRegex.exec(text)) !== null) {
        for (const pkg of extractPackages(match[1])) addPackage(pkg, ".sty");
      }
      const docclassMatch = text.match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/);
      if (docclassMatch) {
        addPackage(docclassMatch[1], ".cls");
      }
      const loadClassRegex = /\\LoadClass(?:WithOptions)?(?:\[[^\]]*\])?\{([^}]+)\}/g;
      while ((match = loadClassRegex.exec(text)) !== null) {
        addPackage(match[1].trim(), ".cls");
      }
      this._addSourceCommandPackages(text, packages);
    };
    scanSource(source);
    const texFiles = Object.entries(additionalFiles).filter(([f]) => /\.(tex|sty|cls|clo|def|cfg)$/i.test(f));
    if (texFiles.length > 0) {
      const decoder = new TextDecoder();
      for (const [, content] of texFiles) {
        const text = typeof content === "string" ? content : decoder.decode(content);
        scanSource(text);
      }
    }
    const expanded = new Set(packages);
    const visited = /* @__PURE__ */ new Set();
    const expandDeps = (pkg) => {
      if (visited.has(pkg) || isLocal(pkg)) return;
      visited.add(pkg);
      const deps = this.packageDeps?.packages?.[pkg] || [];
      for (const dep of deps) {
        if (!dep || dep.startsWith("#") || dep.startsWith("\\")) continue;
        expanded.add(dep);
        expandDeps(dep);
      }
    };
    for (const pkg of packages) {
      expandDeps(pkg);
    }
    const directBundles = new Set(plannedBundles);
    const externalPackages = [...expanded].filter((pkg) => !isLocal(pkg));
    const additionalBundles = this.resolveBundles(externalPackages, engine).filter((bundle) => !directBundles.has(bundle));
    const bundledPackages = [];
    const ctanPackages = [];
    for (const pkg of externalPackages) {
      const bundleName = this.packageMap?.[pkg];
      if (bundleName && this.bundleExists(bundleName)) {
        bundledPackages.push(pkg);
      } else {
        ctanPackages.push(pkg);
      }
    }
    return { bundledPackages, ctanPackages, additionalBundles };
  }
  /**
   * Load a bundle by name.
   * @param {string} bundleName - Bundle name
   * @returns {Promise<ArrayBuffer>} Bundle data
   */
  async loadBundle(bundleName) {
    if (this.bundleCache.has(bundleName)) {
      return this.bundleCache.get(bundleName);
    }
    const cached = await getBundleFromCache(this.cachePrefix + bundleName);
    if (cached) {
      this.onLog(`  From cache: ${bundleName}`);
      this.bundleCache.set(bundleName, cached);
      this.cacheHitCount++;
      return cached;
    }
    const url = `${this.bundleBase}/${bundleName}.data.gz`;
    this.onLog(`  Fetching: ${bundleName}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${bundleName}: ${response.status}`);
    const compressed = await response.arrayBuffer();
    this.bytesDownloaded += compressed.byteLength;
    const contentEncoding = response.headers.get("Content-Encoding");
    const format = contentEncoding === "br" ? "none" : "gzip";
    const decompressed = await decompress2(compressed, format);
    this.bundleCache.set(bundleName, decompressed);
    saveBundleToCache(this.cachePrefix + bundleName, decompressed);
    return decompressed;
  }
  /**
   * Load multiple bundles in parallel.
   * @param {string[]} bundleNames - Bundle names
   * @returns {Promise<Object<string, ArrayBuffer>>} Map of bundle data
   */
  async loadBundles(bundleNames) {
    const bundleData = {};
    await Promise.all(bundleNames.map(async (name) => {
      try {
        bundleData[name] = await this.loadBundle(name);
      } catch (e) {
        this.onLog(`Failed to load bundle ${name}: ${e.message}`);
      }
    }));
    return bundleData;
  }
  /**
   * Get bundle loading statistics.
   * @returns {{bytesDownloaded: number, cacheHits: number, bundlesCached: number}}
   */
  getStats() {
    return {
      bytesDownloaded: this.bytesDownloaded,
      cacheHits: this.cacheHitCount,
      bundlesCached: this.bundleCache.size
    };
  }
  /**
   * Clear in-memory bundle cache to free RAM. Filesystem cache is preserved.
   */
  clearCache() {
    this.bundleCache.clear();
    this.onLog("Bundle memory cache cleared");
  }
  /**
   * Preload all required bundles for an engine.
   * @param {string} [engine] - Engine name
   * @returns {Promise<void>}
   */
  async preloadEngine(engine = "pdflatex") {
    await this.loadBundleDeps();
    const engineDeps = this.bundleDeps?.engines?.[engine];
    if (!engineDeps?.required) return;
    this.onLog(`Preloading ${engine} bundles...`);
    await this.loadBundles(engineDeps.required);
    this.onLog(`Preload complete: ${engineDeps.required.length} bundles loaded`);
  }
};
function detectEngine(source) {
  if (source.includes("\\usepackage{fontspec}") || source.includes("\\usepackage{unicode-math}") || source.includes("\\setmainfont") || source.includes("\\setsansfont") || source.includes("\\setmonofont")) {
    return "xelatex";
  }
  return "pdflatex";
}
function extractFontNames(source, additionalFiles = {}) {
  const names = /* @__PURE__ */ new Set();
  const directRegex = /\\(?:setmainfont|setsansfont|setmonofont|setmathfont|setromanfont|fontspec)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
  const newFontRegex = /\\newfontf(?:ace|amily)\s*(?:\[[^\]]*\])?\s*\\[A-Za-z@]+\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
  const looksLikeFile = (n) => /[\\/]/.test(n) || /\.(otf|ttf|ttc|pfb|pfa)$/i.test(n);
  const scan = (text) => {
    let m;
    for (const re of [directRegex, newFontRegex]) {
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        const name = m[1].trim();
        if (name && !looksLikeFile(name)) names.add(name);
      }
    }
  };
  scan(source);
  const texFiles = Object.entries(additionalFiles).filter(([f]) => f.endsWith(".tex"));
  if (texFiles.length > 0) {
    const decoder = new TextDecoder();
    for (const [, content] of texFiles) {
      scan(typeof content === "string" ? content : decoder.decode(content));
    }
  }
  return [...names];
}
function extractPreamble(source) {
  const beginDocIdx = source.indexOf("\\begin{document}");
  if (beginDocIdx === -1) return "";
  return source.substring(0, beginDocIdx);
}

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/engine/src/texlive.js
var TEXLIVE_YEAR = 2026;

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/engine/src/ctan.js
var LATEX_FILE_EXTENSIONS = [".sty", ".cls", ".def", ".clo", ".fd", ".cfg", ".tex"];
var XzReadableStream = null;
var xzwasmUrl = "./src/xzwasm.js";
function setXzwasmUrl(url) {
  xzwasmUrl = url;
}
var xzLoading = null;
async function loadXzwasm() {
  if (XzReadableStream) return XzReadableStream;
  if (typeof self.xzwasm?.XzReadableStream === "function") return XzReadableStream = self.xzwasm.XzReadableStream;
  if (xzLoading) return xzLoading;
  xzLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let timer;
    const finish = (error) => {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      script.remove();
      if (error) reject(error);
      else resolve(XzReadableStream);
    };
    script.crossOrigin = "anonymous";
    script.src = xzwasmUrl;
    script.onload = () => {
      if (typeof self.xzwasm?.XzReadableStream !== "function") {
        finish(new Error("Invalid XZ decompressor script at " + xzwasmUrl));
        return;
      }
      XzReadableStream = self.xzwasm.XzReadableStream;
      finish();
    };
    script.onerror = () => finish(new Error("Failed to load xzwasm from " + xzwasmUrl));
    timer = setTimeout(() => finish(new Error("Timed out loading xzwasm from " + xzwasmUrl)), 3e4);
    document.head.appendChild(script);
  });
  try {
    return await xzLoading;
  } finally {
    xzLoading = null;
  }
}
function parseTar(tarData) {
  const files = /* @__PURE__ */ new Map();
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset < tarData.length - 512) {
    let isZero = true;
    for (let i = 0; i < 512; i++) {
      if (tarData[offset + i] !== 0) {
        isZero = false;
        break;
      }
    }
    if (isZero) break;
    const nameBytes = tarData.subarray(offset, offset + 100);
    let nameEnd = nameBytes.indexOf(0);
    if (nameEnd === -1) nameEnd = 100;
    const name = decoder.decode(nameBytes.subarray(0, nameEnd));
    const sizeBytes = tarData.subarray(offset + 124, offset + 136);
    let sizeEnd = 0;
    for (let i = 0; i < 12; i++) {
      if (sizeBytes[i] === 0 || sizeBytes[i] === 32) break;
      sizeEnd = i + 1;
    }
    const sizeStr = decoder.decode(sizeBytes.subarray(0, sizeEnd));
    const size = parseInt(sizeStr, 8) || 0;
    const typeFlag = tarData[offset + 156];
    const prefixBytes = tarData.subarray(offset + 345, offset + 500);
    let prefixEnd = prefixBytes.indexOf(0);
    if (prefixEnd === -1) prefixEnd = 155;
    const prefix = decoder.decode(prefixBytes.subarray(0, prefixEnd));
    const fullPath = prefix ? prefix + "/" + name : name;
    offset += 512;
    if ((typeFlag === 0 || typeFlag === 48) && size > 0 && name) {
      files.set(fullPath, new Uint8Array(tarData.buffer, tarData.byteOffset + offset, size));
    }
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}
var packageNameCache = /* @__PURE__ */ new Map();
var fileToPackageIndex = null;
var fileToPackageLoading = null;
var fontNameIndex = null;
var fontNameLoading = null;
function normalizeFontName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
var CTANFetcher = class {
  /**
   * @param {CTANFetcherOptions} [options] - Fetcher options
   */
  constructor(options = {}) {
    this.proxyUrl = options.proxyUrl || "http://localhost:8787";
    this.bundlesUrl = options.bundlesUrl || this.proxyUrl + "/bundles";
    this.mountedFiles = /* @__PURE__ */ new Set();
    this.fileCache = /* @__PURE__ */ new Map();
    this.loadedPackages = /* @__PURE__ */ new Set();
    this.fetchCount = 0;
    this.onLog = options.onLog || (() => {
    });
    if (options.xzwasmUrl) {
      setXzwasmUrl(options.xzwasmUrl);
    }
  }
  /**
   * Load file-to-package index (maps filename.sty → package-name).
   * @returns {Promise<Object<string, string>>} Index mapping filenames to packages
   */
  async loadFileToPackageIndex() {
    if (fileToPackageIndex) return fileToPackageIndex;
    if (fileToPackageLoading) return fileToPackageLoading;
    fileToPackageLoading = (async () => {
      try {
        const response = await fetch(`${this.bundlesUrl}/file-to-package.json`);
        if (response.ok) {
          fileToPackageIndex = await response.json();
          this.onLog(`Loaded file-to-package index: ${Object.keys(fileToPackageIndex).length} entries`);
        } else {
          this.onLog(`Failed to load file-to-package index: ${response.status}`);
          fileToPackageIndex = {};
        }
      } catch (e) {
        this.onLog(`Error loading file-to-package index: ${e.message}`);
        fileToPackageIndex = {};
      }
      return fileToPackageIndex;
    })();
    return fileToPackageLoading;
  }
  /**
   * Look up package name for a file.
   * @param {string} fileName - File name (e.g., "lingmacros.sty")
   * @returns {Promise<string|null>} Package name or null
   */
  async lookupPackageForFile(fileName) {
    const index = await this.loadFileToPackageIndex();
    return index[fileName] || null;
  }
  /**
   * Load font-name-to-package index (maps normalized family name → package).
   * @returns {Promise<Object<string, string>>} Index mapping font keys to packages
   */
  async loadFontNameIndex() {
    if (fontNameIndex) return fontNameIndex;
    if (fontNameLoading) return fontNameLoading;
    fontNameLoading = (async () => {
      try {
        const response = await fetch(`${this.bundlesUrl}/font-name-to-package.json`);
        if (response.ok) {
          fontNameIndex = await response.json();
          this.onLog(`Loaded font-name index: ${Object.keys(fontNameIndex).length} entries`);
        } else {
          this.onLog(`Failed to load font-name index: ${response.status}`);
          fontNameIndex = {};
        }
      } catch (e) {
        this.onLog(`Error loading font-name index: ${e.message}`);
        fontNameIndex = {};
      }
      return fontNameIndex;
    })();
    return fontNameLoading;
  }
  /**
   * Look up the TeX Live package that provides a font family.
   * @param {string} fontName - Font family name (e.g., "EB Garamond")
   * @returns {Promise<string|null>} Package name or null
   */
  async lookupPackageForFontName(fontName) {
    const index = await this.loadFontNameIndex();
    return index[normalizeFontName(fontName)] || null;
  }
  /**
   * Resolve a list of font family names to the set of packages that provide
   * them. Unknown names are returned separately so callers can report them.
   * @param {string[]} fontNames - Font family names from the document
   * @returns {Promise<{packages: string[], unresolved: string[]}>}
   */
  async resolveFontPackages(fontNames) {
    const index = await this.loadFontNameIndex();
    const packages = /* @__PURE__ */ new Set();
    const unresolved = [];
    for (const name of fontNames) {
      const pkg = index[normalizeFontName(name)];
      if (pkg) {
        packages.add(pkg);
      } else {
        unresolved.push(name);
        this.onLog(`[FONT] No package found for font "${name}" (will rely on bundled/system fonts)`);
      }
    }
    return { packages: [...packages], unresolved };
  }
  /**
   * Get all cached file contents.
   * @returns {Object<string, Uint8Array>} Map of file paths to contents
   */
  // Only returns files that were loaded in this session (via fetchPackage)
  getCachedFiles() {
    return Object.fromEntries(this.fileCache);
  }
  /**
   * Load a package from cache.
   * @param {string} packageName - Package name
   * @returns {Promise<PackageResult|null>} Package result or null if not cached
   */
  async loadPackageFromCache(packageName) {
    try {
      const meta = await getPackageMeta(packageName);
      if (!meta) {
        this.onLog(`[Cache] ${packageName}: no metadata found - will fetch fresh`);
        return null;
      }
      if (meta.cacheVersion !== CTAN_CACHE_VERSION) {
        this.onLog(`[Cache] ${packageName}: version mismatch (cached=${meta.cacheVersion}, current=${CTAN_CACHE_VERSION}) - will refetch`);
        return null;
      }
      this.onLog(`[Cache] ${packageName}: loading from cache (v${meta.cacheVersion}, source=${meta.source || "unknown"})`);
      if (meta.notFound) return { notFound: true };
      const files = /* @__PURE__ */ new Map();
      if (meta.files && meta.files.length > 0) {
        const filesToLoad = [];
        for (const filePath of meta.files) {
          if (this.fileCache.has(filePath)) {
            files.set(filePath, this.fileCache.get(filePath));
            this.mountedFiles.add(filePath);
          } else {
            filesToLoad.push(filePath);
          }
        }
        if (filesToLoad.length > 0) {
          await ensureTexliveMounted();
          const results = await Promise.all(
            filesToLoad.map(async (filePath) => {
              const content = await fileSystem.readBinary(filePath).catch(() => null);
              return content ? [filePath, new Uint8Array(content)] : null;
            })
          );
          for (const result of results) {
            if (result) {
              files.set(result[0], result[1]);
              this.mountedFiles.add(result[0]);
              this.fileCache.set(result[0], result[1]);
            }
          }
        }
      }
      return {
        files,
        dependencies: meta.dependencies || []
      };
    } catch (e) {
      return null;
    }
  }
  /**
   * Fetch a package from CTAN/TexLive.
   * @param {string} packageName - Package name
   * @param {{tlYear?: number}} [options] - Options
   * @returns {Promise<PackageResult|null>} Package result or null if not found
   */
  async fetchPackage(packageName, options = {}) {
    const { tlYear } = options;
    const yearLabel = tlYear ? ` (TL${tlYear})` : "";
    this.onLog(`[FETCH] ${packageName}${yearLabel}: starting fetch`);
    if (!tlYear) {
      const cached = await this.loadPackageFromCache(packageName);
      if (cached) {
        if (cached.notFound) {
          const extensions = LATEX_FILE_EXTENSIONS;
          for (const ext of extensions) {
            const fileName = packageName + ext;
            const realPkg = await this.lookupPackageForFile(fileName);
            if (realPkg && realPkg !== packageName) {
              this.onLog(`[FETCH] ${packageName}: not found, but ${fileName} is in package "${realPkg}"`);
              return this.fetchPackage(realPkg, options);
            }
          }
          this.onLog(`[FETCH] ${packageName}: marked as not found in cache`);
          return null;
        }
        this.onLog(`[FETCH] ${packageName}: loaded from cache`);
        this.loadedPackages.add(packageName);
        return cached;
      }
    } else {
      this.onLog(`[FETCH] ${packageName}: skipping cache for TL${tlYear} request`);
    }
    this.onLog(`[FETCH] ${packageName}: not in cache, fetching from TexLive${yearLabel}...`);
    return this.fetchTexLivePackage(packageName, tlYear);
  }
  // Look up real TexLive archive name via CTAN API
  async lookupTexLivePackageName(packageName) {
    if (packageNameCache.has(packageName)) {
      return packageNameCache.get(packageName);
    }
    try {
      const response = await fetch(`${this.proxyUrl}/api/ctan-pkg/${packageName}`);
      if (!response.ok) return packageName;
      const data = await response.json();
      const realName = data.contained_in || data.name || packageName;
      packageNameCache.set(packageName, realName);
      return realName;
    } catch (e) {
      return packageName;
    }
  }
  // Fetch from TexLive archive
  // tlYear: optional year (2026, 2025, 2024, 2023) - if specified, goes directly to CTAN proxy
  async fetchTexLivePackage(packageName, tlYear = null) {
    const yearLabel = tlYear ? ` (TL${tlYear})` : "";
    const yearSuffix = tlYear ? `?tlYear=${tlYear}` : "";
    const cached = tlYear ? null : await this.loadPackageFromCache(packageName);
    if (cached) {
      if (cached.notFound) {
        this.onLog(`Package ${packageName} marked as not found in cache`);
        return null;
      }
      this.onLog(`Package ${packageName} loaded from cache (TexLive)`);
      this.loadedPackages.add(packageName);
      return cached;
    }
    this.onLog(`[TEXLIVE] Fetching ${packageName} from TexLive ${tlYear || TEXLIVE_YEAR} via ${this.proxyUrl}...`);
    let response = null;
    let texlivePkg = packageName;
    try {
      const url = `${this.proxyUrl}/api/texlive/${packageName}${yearSuffix}`;
      this.onLog(`[TEXLIVE] Trying URL: ${url}`);
      response = await fetch(url);
      this.onLog(`[TEXLIVE] Response status: ${response?.status}`);
    } catch (e) {
      this.onLog(`[TEXLIVE] Fetch error: ${e.message}`);
      response = null;
    }
    if (!response || !response.ok) {
      const extensions = LATEX_FILE_EXTENSIONS;
      for (const ext of extensions) {
        const fileName = packageName + ext;
        const realPkg = await this.lookupPackageForFile(fileName);
        if (realPkg && realPkg !== packageName) {
          this.onLog(`${fileName} is in package "${realPkg}", fetching...`);
          texlivePkg = realPkg;
          try {
            response = await fetch(`${this.proxyUrl}/api/texlive/${texlivePkg}${yearSuffix}`);
            if (response?.ok) break;
          } catch (e) {
            response = null;
          }
        }
      }
    }
    if (!response || !response.ok) {
      this.onLog(`Looking up package container via CTAN API...`);
      const realName = await this.lookupTexLivePackageName(packageName);
      if (realName !== packageName) {
        this.onLog(`${packageName} is in ${realName}, fetching...`);
        texlivePkg = realName;
        try {
          response = await fetch(`${this.proxyUrl}/api/texlive/${texlivePkg}${yearSuffix}`);
        } catch (e) {
          response = null;
        }
      }
    }
    try {
      if (!response || !response.ok) {
        this.onLog(`[TEXLIVE] FAILED for ${packageName} (status=${response?.status}), falling back to CTAN...`);
        return tlYear ? null : this.fetchCtanPackage(packageName);
      }
      this.onLog(`[TEXLIVE] SUCCESS for ${packageName}, extracting XZ archive...`);
      let xzData = await response.arrayBuffer();
      const downloadedSize = xzData.byteLength;
      this.onLog(`Downloaded ${(downloadedSize / 1024).toFixed(1)} KB, decompressing...`);
      const XzStream = await loadXzwasm();
      const xzStream = new XzStream(new Blob([xzData]).stream());
      xzData = null;
      const reader = xzStream.getReader();
      const chunks = [];
      let totalLen = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new Uint8Array(value);
        chunks.push(chunk);
        totalLen += chunk.length;
      }
      this.onLog(`Decompressed ${chunks.length} chunks, total ${totalLen} bytes`);
      const tarData = new Uint8Array(totalLen);
      let pos = 0;
      for (let i = 0; i < chunks.length; i++) {
        tarData.set(chunks[i], pos);
        pos += chunks[i].length;
        chunks[i] = null;
      }
      const tarFiles = parseTar(tarData);
      this.onLog(`Extracted ${tarFiles.size} files from TAR (keys: ${[...tarFiles.keys()].slice(0, 3).join(", ")}...)`);
      for (const [tarPath, content] of tarFiles) {
        if (tarPath.endsWith(`${packageName}.sty`)) {
          const text = new TextDecoder().decode(content.slice(0, 500));
          const versionMatch = text.match(/ProvidesPackage\{[^}]+\}\[([^\]]+)\]/);
          if (versionMatch) {
            this.onLog(`Package ${packageName} version: ${versionMatch[1]}`);
          }
          break;
        }
      }
      const files = /* @__PURE__ */ new Map();
      const cacheWrites = [];
      await ensureTexliveMounted();
      for (const [tarPath, content] of tarFiles) {
        if (tarPath.includes("/doc/") || tarPath.startsWith("doc/")) continue;
        if (tarPath.includes("/source/") || tarPath.startsWith("source/")) continue;
        const ext = tarPath.substring(tarPath.lastIndexOf(".")).toLowerCase();
        const fileName = tarPath.split("/").pop();
        if (fileName && ext.startsWith(".")) {
          let targetPath;
          if (tarPath.includes("/texmf-dist/") || tarPath.includes("texmf-dist/")) {
            const idx = tarPath.indexOf("texmf-dist/");
            targetPath = "/texlive/" + tarPath.substring(idx);
          } else if (tarPath.startsWith("bibtex/") || tarPath.includes("/bibtex/")) {
            targetPath = "/texlive/texmf-dist/" + tarPath.slice(tarPath.indexOf("bibtex/"));
          } else if (tarPath.includes("/tex/") || tarPath.startsWith("tex/")) {
            const idx = tarPath.indexOf("tex/");
            targetPath = "/texlive/texmf-dist/" + tarPath.substring(idx);
          } else if (tarPath.includes("/fonts/") || tarPath.startsWith("fonts/")) {
            const idx = tarPath.indexOf("fonts/");
            targetPath = "/texlive/texmf-dist/" + tarPath.substring(idx);
          } else {
            targetPath = `/texlive/texmf-dist/tex/latex/${packageName}/${fileName}`;
          }
          const fileData = new Uint8Array(content);
          files.set(targetPath, fileData);
          this.mountedFiles.add(targetPath);
          this.fileCache.set(targetPath, fileData);
          if (!tlYear) cacheWrites.push(fileSystem.writeBinary(targetPath, fileData, { createParents: true }).catch(() => {
          }));
        }
      }
      await Promise.all(cacheWrites);
      this.onLog(`Processed ${files.size} TeX/font files from ${packageName}`);
      if (files.size === 0) {
        this.onLog(`No TeX files found in ${packageName}, marking as not found`);
        if (!tlYear) await savePackageMeta(packageName, {
          notFound: true,
          cacheVersion: CTAN_CACHE_VERSION
        });
        return null;
      }
      const cacheEntry = {
        name: texlivePkg,
        // The actual package that provided the files
        files: [...files.keys()],
        dependencies: [],
        cacheVersion: CTAN_CACHE_VERSION,
        source: `texlive-${tlYear || TEXLIVE_YEAR}`
      };
      if (!tlYear) await savePackageMeta(packageName, cacheEntry);
      if (!tlYear && texlivePkg !== packageName) {
        await savePackageMeta(texlivePkg, cacheEntry);
        this.onLog(`Cached under both "${packageName}" and "${texlivePkg}"`);
      }
      this.fetchCount++;
      this.loadedPackages.add(packageName);
      if (texlivePkg !== packageName) {
        this.loadedPackages.add(texlivePkg);
      }
      return { files, dependencies: [] };
    } catch (e) {
      this.onLog(`[TEXLIVE] EXTRACTION ERROR for ${packageName}: ${e.message}`);
      this.onLog(`[TEXLIVE] Stack: ${e.stack?.split("\n").slice(0, 3).join(" | ")}`);
      this.onLog(`[TEXLIVE] Falling back to CTAN (WARNING: may have older version)...`);
      return tlYear ? null : this.fetchCtanPackage(packageName);
    }
  }
  // Fetch from CTAN proxy (fallback when TexLive doesn't have the package)
  async fetchCtanPackage(packageName, tlYear = null) {
    const yearSuffix = tlYear ? `?tlYear=${tlYear}` : "";
    const yearLabel = tlYear ? ` (TL${tlYear})` : "";
    this.onLog(`[CTAN-FALLBACK] Fetching ${packageName}${yearLabel} from CTAN proxy...`);
    if (packageName === "enumitem" && !tlYear) {
      this.onLog(`[CTAN-FALLBACK] *** WARNING: enumitem from CTAN may be v3.10 which has known bugs! ***`);
      this.onLog(`[CTAN-FALLBACK] *** TexLive 2026 should be used for enumitem v3.11 ***`);
    }
    let response = null;
    let ctanPkg = packageName;
    try {
      response = await fetch(`${this.proxyUrl}/api/fetch/${packageName}${yearSuffix}`);
    } catch (e) {
      response = null;
    }
    if (!response || !response.ok) {
      const extensions = LATEX_FILE_EXTENSIONS;
      for (const ext of extensions) {
        const fileName = packageName + ext;
        const realPkg = await this.lookupPackageForFile(fileName);
        if (realPkg && realPkg !== packageName) {
          this.onLog(`${fileName} is in package "${realPkg}", fetching from CTAN${yearLabel}...`);
          ctanPkg = realPkg;
          try {
            response = await fetch(`${this.proxyUrl}/api/fetch/${ctanPkg}${yearSuffix}`);
            if (response?.ok) break;
          } catch (e) {
            response = null;
          }
        }
      }
    }
    try {
      if (!response || !response.ok) {
        this.onLog(`CTAN package ${packageName} not found (404)`);
        await savePackageMeta(packageName, {
          notFound: true,
          cacheVersion: CTAN_CACHE_VERSION
        });
        return null;
      }
      const data = await response.json();
      if (data.error) {
        this.onLog(`CTAN fetch failed: ${data.error}`);
        await savePackageMeta(packageName, {
          notFound: true,
          cacheVersion: CTAN_CACHE_VERSION
        });
        return null;
      }
      if (data.useTexLive && typeof data.texlivePackage === "string") {
        return this.fetchTexLivePackage(data.texlivePackage, tlYear);
      }
      const files = /* @__PURE__ */ new Map();
      const cacheWrites = [];
      await ensureTexliveMounted();
      for (const [path, info] of Object.entries(data.files)) {
        let content;
        if (info.encoding === "base64") {
          const binary = atob(info.content);
          content = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            content[i] = binary.charCodeAt(i);
          }
        } else if (typeof info.content === "string") {
          content = new TextEncoder().encode(info.content);
        } else {
          content = new Uint8Array(info.content);
        }
        files.set(path, content);
        this.mountedFiles.add(path);
        this.fileCache.set(path, content);
        cacheWrites.push(fileSystem.writeBinary(path, content, { createParents: true }).catch(() => {
        }));
      }
      await Promise.all(cacheWrites);
      const cacheEntry = {
        name: ctanPkg,
        // The actual package that provided the files
        files: [...files.keys()],
        dependencies: data.dependencies || [],
        cacheVersion: CTAN_CACHE_VERSION,
        source: "ctan"
      };
      await savePackageMeta(packageName, cacheEntry);
      if (ctanPkg !== packageName) {
        await savePackageMeta(ctanPkg, cacheEntry);
        this.onLog(`Cached under both "${packageName}" and "${ctanPkg}"`);
      }
      this.fetchCount++;
      this.loadedPackages.add(packageName);
      if (ctanPkg !== packageName) {
        this.loadedPackages.add(ctanPkg);
      }
      return {
        files,
        dependencies: data.dependencies || []
      };
    } catch (e) {
      this.onLog(`CTAN fetch error: ${e.message}`);
      await savePackageMeta(packageName, {
        notFound: true,
        cacheVersion: CTAN_CACHE_VERSION
      });
      return null;
    }
  }
  async fetchWithDependencies(packageName, fetched = /* @__PURE__ */ new Set()) {
    if (fetched.has(packageName)) return /* @__PURE__ */ new Map();
    fetched.add(packageName);
    const result = await this.fetchPackage(packageName);
    if (!result) return /* @__PURE__ */ new Map();
    const allFiles = new Map(result.files);
    for (const dep of result.dependencies) {
      const depFiles = await this.fetchWithDependencies(dep, fetched);
      for (const [path, content] of depFiles) {
        allFiles.set(path, content);
      }
    }
    return allFiles;
  }
  /**
   * Batch fetch multiple packages in parallel.
   * Used for pre-fetching detected CTAN packages before compilation.
   * @param {string[]} packageNames - Package names to fetch
   * @param {Object} options
   * @param {number} options.concurrency - Max parallel fetches (default: 1, see note below)
   * @returns {Promise<{fetched: string[], failed: string[], skipped: string[]}>}
   */
  async batchFetchPackages(packageNames, options = {}) {
    const { concurrency = 1 } = options;
    const fetched = [];
    const failed = [];
    const skipped = [];
    const uniquePackages = [...new Set(packageNames)];
    const membersOf = /* @__PURE__ */ new Map();
    for (const pkgName of uniquePackages) {
      let container = pkgName;
      if (!options.tlYear) {
        for (const ext of LATEX_FILE_EXTENSIONS) {
          const realPkg = await this.lookupPackageForFile(pkgName + ext);
          if (realPkg && realPkg !== pkgName) {
            container = realPkg;
            break;
          }
        }
      }
      if (!membersOf.has(container)) membersOf.set(container, []);
      membersOf.get(container).push(pkgName);
    }
    const toFetch = [];
    for (const [container, members] of membersOf) {
      if (this.loadedPackages.has(container) || members.some((m) => this.loadedPackages.has(m))) {
        this.loadedPackages.add(container);
        skipped.push(...members);
        continue;
      }
      const cached = await this.loadPackageFromCache(container);
      if (cached && cached.files && !cached.notFound) {
        for (const [path, content] of cached.files) {
          this.fileCache.set(path, content);
        }
        this.loadedPackages.add(container);
        for (const m of members) this.loadedPackages.add(m);
        skipped.push(...members);
      } else {
        toFetch.push(container);
      }
    }
    if (toFetch.length === 0) {
      this.onLog(`[PRE-FETCH] Done: ${fetched.length} fetched, ${failed.length} failed, ${skipped.length} cached`);
      return { fetched, failed, skipped };
    }
    this.onLog(`[PRE-FETCH] Batch fetching ${toFetch.length} container package${toFetch.length === 1 ? "" : "s"} (from ${uniquePackages.length} requested)...`);
    for (let i = 0; i < toFetch.length; i += concurrency) {
      const chunk = toFetch.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map(async (container) => {
          const result = await this.fetchPackage(container);
          return { container, result };
        })
      );
      for (const res of results) {
        const container = res.status === "fulfilled" ? res.value.container : null;
        const members = container && membersOf.get(container) || (container ? [container] : []);
        if (res.status === "fulfilled" && res.value.result) {
          this.loadedPackages.add(container);
          for (const m of members) {
            this.loadedPackages.add(m);
            fetched.push(m);
          }
        } else {
          failed.push(...members.length ? members : ["unknown"]);
        }
      }
    }
    this.onLog(`[PRE-FETCH] Done: ${fetched.length} fetched, ${failed.length} failed, ${skipped.length} cached`);
    return { fetched, failed, skipped };
  }
  /**
   * Get list of all mounted file paths.
   * @returns {string[]} Array of file paths
   */
  getMountedFiles() {
    return [...this.mountedFiles];
  }
  /**
   * Get fetcher statistics.
   * @returns {{fetchCount: number, mountedFiles: number}} Stats object
   */
  getStats() {
    return {
      fetchCount: this.fetchCount,
      mountedFiles: this.mountedFiles.size
    };
  }
  /**
   * Clear the mounted files set and memory caches.
   */
  clearMountedFiles() {
    this.mountedFiles.clear();
    this.fileCache.clear();
    this.loadedPackages.clear();
  }
};

// data/offline-tex-2026-11-08/deps/node_modules/@siglum/engine/src/compiler.js
var _globalActiveWorker = null;
var _globalWorkerId = 0;
function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
var fmtCacheMounted = false;
async function ensureFmtCacheMount() {
  if (fmtCacheMounted) return true;
  try {
    await fileSystem.mountAuto("/fmt-cache");
    fmtCacheMounted = true;
    return true;
  } catch (e) {
    console.warn("Failed to mount fmt-cache:", e);
    return false;
  }
}
var nextCompilerRequestId = 0;
var SiglumCompiler = class {
  /**
   * @param {SiglumCompilerOptions} [options] - Compiler options
   */
  constructor(options = {}) {
    this.bundlesUrl = options.bundlesUrl || "packages/bundles";
    this.wasmUrl = options.wasmUrl || "busytex.wasm";
    this.runtimeKey = this.wasmUrl.match(/\/releases\/(tl2026-[a-f0-9]{16})(?:\/|$)/)?.[1] || "tl2026-r1";
    this.jsUrl = options.jsUrl || null;
    this.workerUrl = options.workerUrl || null;
    this.ctanProxyUrl = options.ctanProxyUrl || null;
    this.xzwasmUrl = options.xzwasmUrl || (this.ctanProxyUrl ? `${this.ctanProxyUrl}/xzwasm.js` : "./src/xzwasm.js");
    this.bundleManager = new BundleManager({
      bundleBase: this.bundlesUrl,
      onLog: (msg) => this._log(msg)
    });
    this.ctanFetcher = new CTANFetcher({
      proxyUrl: this.ctanProxyUrl,
      xzwasmUrl: this.xzwasmUrl,
      onLog: (msg) => this._log(msg)
    });
    this.worker = null;
    this.workerReady = false;
    this.wasmModule = null;
    this._initWorkerPromise = null;
    this._initPromise = null;
    this.pendingCompile = null;
    this.formatGenerationPromise = null;
    this.onLog = options.onLog || (() => {
    });
    this.onProgress = options.onProgress || (() => {
    });
    this.enableCtan = options.enableCtan ?? this.ctanProxyUrl !== null;
    this.enableLazyFS = options.enableLazyFS !== false;
    this.enableDocCache = options.enableDocCache !== false;
    this.maxRetries = options.maxRetries ?? 15;
    this.verbose = options.verbose ?? false;
    this.eagerBundles = options.eagerBundles || {};
    this._pendingRangeRequests = /* @__PURE__ */ new Map();
    this._rangeRequestTimer = null;
    this._rangeRequestDebounceMs = 10;
    this._rangeCoalesceGapBytes = 64 * 1024;
  }
  _log(msg) {
    this.onLog(msg);
  }
  /**
   * Get eager bundles for a specific engine.
   * Eager bundles are loaded immediately instead of being deferred.
   * @param {string} engine - The engine (pdflatex, xelatex, lualatex)
   * @returns {string[]} List of bundle names to load eagerly
   */
  getEagerBundles(engine) {
    if (Array.isArray(this.eagerBundles)) {
      return this.eagerBundles;
    }
    return this.eagerBundles[engine] || [];
  }
  /**
   * Preload bundles into memory cache.
   * Call this to eagerly load bundles before compilation.
   * Useful for loading large deferred bundles (like cm-super) in advance.
   *
   * @example
   * // Preload cm-super before first compile
   * await compiler.preloadBundles(['cm-super']);
   *
   * @param {string[]} bundleNames - Bundles to preload
   * @returns {Promise<{loaded: string[], failed: string[]}>}
   */
  async preloadBundles(bundleNames) {
    await this.bundleManager.loadManifest();
    const loaded = [];
    const failed = [];
    const promises = bundleNames.map(async (bundleName) => {
      try {
        if (!this.bundleManager.bundleExists(bundleName)) {
          this._log(`Preload: bundle ${bundleName} does not exist`);
          failed.push(bundleName);
          return;
        }
        const data = await this.bundleManager.loadBundle(bundleName);
        if (data) {
          this._log(`Preloaded bundle: ${bundleName} (${(data.byteLength / 1024 / 1024).toFixed(1)}MB)`);
          loaded.push(bundleName);
        } else {
          failed.push(bundleName);
        }
      } catch (e) {
        this._log(`Preload failed for ${bundleName}: ${e.message}`);
        failed.push(bundleName);
      }
    });
    await Promise.all(promises);
    return { loaded, failed };
  }
  /**
   * Pre-warm the compiler in the background.
   * Call this early (e.g., on page load) to eliminate cold start latency.
   * The promise resolves when initialization is complete, but you don't need to await it.
   *
   * @example
   * // On app mount, before user starts typing
   * const compiler = new BusyTeXCompiler(options);
   * compiler.prewarm(); // Fire and forget - init happens in background
   *
   * // Later, when user wants to compile:
   * await compiler.compile(source); // Already warmed up!
   *
   * @returns {Promise<void>} Resolves when initialization is complete
   */
  prewarm() {
    if (this._prewarmPromise) {
      return this._prewarmPromise;
    }
    this._prewarmPromise = this.init().catch((e) => {
      this._log("Prewarm failed: " + e.message);
      this._prewarmPromise = null;
      throw e;
    });
    return this._prewarmPromise;
  }
  /**
   * Check if compiler is ready (initialized and warmed up)
   * @returns {boolean}
   */
  isReady() {
    return this.workerReady && this.wasmModule !== void 0;
  }
  /**
   * Initialize the compiler. Loads WASM, manifests, and prepares the worker.
   * @returns {Promise<void>}
   */
  init() {
    if (!this._initPromise) {
      this._initPromise = this._doInit().catch((e) => {
        this._initPromise = null;
        throw e;
      });
    }
    return this._initPromise;
  }
  async _doInit() {
    this._log("Initializing Siglum compiler...");
    await Promise.all([
      this._loadManifests(),
      this._loadWasm()
    ]);
    await Promise.all([
      this._initWorker(),
      this.bundleManager.preloadEngine("pdflatex").catch((e) => {
        this._log("Bundle preload failed (will load on demand): " + e.message);
      })
    ]);
    this._log("Compiler initialized");
  }
  async _loadManifests() {
    await this.bundleManager.loadManifest();
    await this.bundleManager.loadBundleDeps();
  }
  async _loadWasm() {
    this._log("Loading WASM...");
    const startTime = performance.now();
    if (typeof WebAssembly.compileStreaming === "function" && typeof caches !== "undefined") {
      try {
        const cache = await caches.open("siglum-wasm-tl2026-v2");
        let response = await cache.match(this.wasmUrl);
        if (response) {
          try {
            this.wasmModule = await WebAssembly.compileStreaming(response);
            const elapsed = (performance.now() - startTime).toFixed(0);
            this._log(`WASM loaded from cache + compileStreaming in ${elapsed}ms`);
            return;
          } catch (e) {
            this._log("Cached WASM compile failed, evicting: " + e.message);
            cache.delete(this.wasmUrl).catch(() => {
            });
          }
        }
        response = await fetch(this.wasmUrl);
        if (response.ok) {
          const responseToCache = response.clone();
          this.wasmModule = await WebAssembly.compileStreaming(response);
          cache.put(this.wasmUrl, responseToCache).catch(() => {
          });
          const elapsed = (performance.now() - startTime).toFixed(0);
          this._log(`WASM fetched + compileStreaming in ${elapsed}ms`);
          return;
        }
      } catch (e) {
        this._log("compileStreaming path failed, falling back: " + e.message);
      }
    }
    try {
      const response = await fetch(this.wasmUrl);
      if (!response.ok) {
        throw new Error(`WASM fetch failed: ${response.status} ${response.statusText}`);
      }
      const wasmBytes = new Uint8Array(await response.arrayBuffer());
      const fetchElapsed = (performance.now() - startTime).toFixed(0);
      const compileStart = performance.now();
      this.wasmModule = await WebAssembly.compile(wasmBytes);
      const compileElapsed = (performance.now() - compileStart).toFixed(0);
      this._log(`WASM fetched in ${fetchElapsed}ms, compiled in ${compileElapsed}ms (fallback)`);
    } catch (e) {
      this._log("WASM load failed: " + e.message);
      throw e;
    }
  }
  async _initWorker() {
    if (this.worker) return;
    if (this._initWorkerPromise) {
      return this._initWorkerPromise;
    }
    this._initWorkerPromise = this._doInitWorker();
    try {
      await this._initWorkerPromise;
    } finally {
      this._initWorkerPromise = null;
    }
  }
  async _doInitWorker() {
    if (_globalActiveWorker && _globalActiveWorker !== this.worker) {
      console.warn("[SiglumCompiler] WARNING: Another worker already exists! Terminating old worker.");
      _globalActiveWorker.terminate();
      _globalActiveWorker = null;
    }
    let workerUrl = this.workerUrl;
    if (!workerUrl) {
      const workerResponse = await fetch(new URL("./worker.js", import.meta.url));
      const workerCode = await workerResponse.text();
      const blob = new Blob([workerCode], { type: "application/javascript" });
      workerUrl = URL.createObjectURL(blob);
    }
    const workerId = ++_globalWorkerId;
    this.worker = new Worker(workerUrl);
    this.worker._workerId = workerId;
    _globalActiveWorker = this.worker;
    this.worker.onmessage = (e) => this._handleWorkerMessage(e);
    this.worker.onerror = (e) => this._handleWorkerError(e);
    const wasmUrlObj = new URL(this.wasmUrl, window.location.href);
    const busytexJsUrl = this.jsUrl ? new URL(this.jsUrl, window.location.href).href : new URL("busytex.js", wasmUrlObj.href).href;
    const memorySnapshot = null;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Worker init timeout")), 3e4);
      const originalHandler = this.worker.onmessage;
      this.worker.onmessage = (e) => {
        if (e.data.type === "ready") {
          clearTimeout(timeout);
          this.workerReady = true;
          this.worker.onmessage = originalHandler;
          this._log("Worker ready");
          resolve();
        } else {
          originalHandler(e);
        }
      };
      const initMsg = {
        type: "init",
        wasmModule: this.wasmModule,
        busytexJsUrl,
        manifest: this.bundleManager.fileManifest,
        packageMapData: this.bundleManager.packageMap,
        bundleDepsData: this.bundleManager.bundleDeps,
        bundleRegistryData: this.bundleManager.bundleRegistry ? [...this.bundleManager.bundleRegistry] : [],
        verbose: this.verbose,
        bundlesUrl: this.bundlesUrl
        // For worker-direct OPFS/network bundle loading
      };
      if (memorySnapshot) {
        initMsg.memorySnapshot = memorySnapshot;
        this.worker.postMessage(initMsg, [memorySnapshot]);
      } else {
        this.worker.postMessage(initMsg);
      }
    });
  }
  _handleWorkerMessage(e) {
    const msg = e.data;
    switch (msg.type) {
      case "log":
        this._log(msg.message);
        break;
      case "progress":
        this.onProgress(msg.stage, msg.detail);
        break;
      case "compile-response":
        if (this.pendingCompile) {
          this.pendingCompile.resolve(msg);
          this.pendingCompile = null;
        }
        break;
      case "format-generate-response":
        if (this.pendingFormat) {
          this.pendingFormat.resolve(msg);
          this.pendingFormat = null;
        }
        break;
      case "ctan-fetch-request":
        this._handleCtanFetchRequest(msg);
        break;
      case "bundle-fetch-request":
        this._handleBundleFetchRequest(msg);
        break;
      case "file-range-fetch-request":
        this._queueRangeRequest(msg);
        break;
      case "memory-snapshot":
        this._handleMemorySnapshot(msg).catch((e2) => {
          this._log("Failed to save memory snapshot: " + e2.message);
        });
        break;
      default:
        if (msg.type && !["log", "progress", "compile-response", "format-generate-response"].includes(msg.type)) {
          console.log("[Compiler] Unhandled message type:", msg.type);
        }
    }
  }
  _handleWorkerError(e) {
    this._log("Worker error: " + e.message);
    if (this.pendingCompile) {
      this.pendingCompile.reject(new Error("Worker error: " + e.message));
      this.pendingCompile = null;
    }
    this.workerReady = false;
    if (this.worker) {
      this.worker.terminate();
      if (_globalActiveWorker === this.worker) {
        _globalActiveWorker = null;
      }
    }
    this.worker = null;
  }
  async _handleCtanFetchRequest(msg) {
    const { requestId, packageName, fileName, tlYear } = msg;
    try {
      let actualPackage = packageName;
      if (fileName) {
        const mappedPackage = await this.ctanFetcher.lookupPackageForFile(fileName);
        if (mappedPackage && mappedPackage !== packageName) {
          this._log(`[CTAN-REQ] ${fileName} maps to package "${mappedPackage}" (not "${packageName}")`);
          actualPackage = mappedPackage;
        }
      }
      const yearLabel = tlYear ? ` (TL${tlYear})` : "";
      this._log(`[CTAN-REQ] Worker requested package: ${actualPackage}${yearLabel}`);
      const result = await this.ctanFetcher.fetchPackage(actualPackage, { tlYear });
      if (result) {
        this._log(`[CTAN-REQ] ${packageName}: got ${result.files?.size || 0} files`);
      }
      if (!result) {
        this.worker.postMessage({
          type: "ctan-fetch-response",
          requestId,
          packageName,
          success: false,
          error: "Package not found"
        });
        return;
      }
      const files = {};
      const transferList = [];
      for (const [path, data] of result.files) {
        if (data && data.buffer) {
          const copy = data.buffer.slice(0);
          files[path] = new Uint8Array(copy);
          transferList.push(copy);
        }
      }
      this.worker.postMessage({
        type: "ctan-fetch-response",
        requestId,
        packageName,
        success: true,
        files,
        dependencies: result.dependencies || []
      }, transferList);
    } catch (e) {
      this._log("CTAN fetch error: " + e.message);
      this.worker.postMessage({
        type: "ctan-fetch-response",
        requestId,
        packageName,
        success: false,
        error: e.message
      });
    }
  }
  async _handleBundleFetchRequest(msg) {
    const { requestId, bundleName } = msg;
    try {
      this._log("Worker requested bundle: " + bundleName);
      const bundleData = await this.bundleManager.loadBundle(bundleName);
      const copy = bundleData.slice(0);
      this.worker.postMessage({
        type: "bundle-fetch-response",
        requestId,
        bundleName,
        success: true,
        bundleData: copy
      }, [copy]);
    } catch (e) {
      this._log("Bundle fetch error: " + e.message);
      this.worker.postMessage({
        type: "bundle-fetch-response",
        requestId,
        bundleName,
        success: false,
        error: e.message
      });
    }
  }
  /**
   * Queue a range request for batching. Requests are coalesced and fetched
   * together to reduce HTTP overhead.
   */
  _queueRangeRequest(msg) {
    const { requestId, bundleName, start, end } = msg;
    if (!this._pendingRangeRequests.has(bundleName)) {
      this._pendingRangeRequests.set(bundleName, []);
    }
    this._pendingRangeRequests.get(bundleName).push({ requestId, start, end });
    if (this._rangeRequestTimer) {
      clearTimeout(this._rangeRequestTimer);
    }
    this._rangeRequestTimer = setTimeout(() => {
      this._processRangeRequestBatch().catch((e) => {
        console.error("[Compiler] Range batch processing error:", e);
        this._log("Error processing range batch: " + e.message);
      });
    }, this._rangeRequestDebounceMs);
  }
  /**
   * Process all pending range requests, coalescing nearby ranges.
   */
  async _processRangeRequestBatch() {
    this._rangeRequestTimer = null;
    for (const [bundleName, requests] of this._pendingRangeRequests.entries()) {
      if (requests.length === 0) continue;
      const coalesced = this._coalesceRanges(requests);
      this._log(`Range coalescing: ${requests.length} requests -> ${coalesced.length} fetches for ${bundleName}`);
      for (const group of coalesced) {
        await this._fetchCoalescedRange(bundleName, group);
      }
    }
    this._pendingRangeRequests.clear();
  }
  /**
   * Coalesce nearby ranges to reduce HTTP requests.
   * Returns groups of original requests that can be satisfied by a single fetch.
   */
  _coalesceRanges(requests) {
    if (requests.length === 0) return [];
    if (requests.length === 1) return [[requests[0]]];
    const sorted = [...requests].sort((a, b) => a.start - b.start);
    const groups = [];
    let currentGroup = [sorted[0]];
    let groupEnd = sorted[0].end;
    for (let i = 1; i < sorted.length; i++) {
      const req = sorted[i];
      if (req.start <= groupEnd + this._rangeCoalesceGapBytes) {
        currentGroup.push(req);
        groupEnd = Math.max(groupEnd, req.end);
      } else {
        groups.push(currentGroup);
        currentGroup = [req];
        groupEnd = req.end;
      }
    }
    groups.push(currentGroup);
    return groups;
  }
  /**
   * Fetch a coalesced range and distribute data to original requesters.
   */
  async _fetchCoalescedRange(bundleName, group) {
    const fetchStart = Math.min(...group.map((r) => r.start));
    const fetchEnd = Math.max(...group.map((r) => r.end));
    try {
      const url = `${this.bundlesUrl}/${bundleName}.raw`;
      const response = await fetch(url, {
        headers: {
          "Range": `bytes=${fetchStart}-${fetchEnd - 1}`
        }
      });
      if (response.status !== 206 && response.status !== 200) {
        throw new Error(`Range request failed with status ${response.status}`);
      }
      const fullData = new Uint8Array(await response.arrayBuffer());
      this._log(`Fetched coalesced range [${fetchStart}:${fetchEnd}] = ${fullData.length} bytes`);
      for (const req of group) {
        const offset = response.status === 200 ? req.start : req.start - fetchStart;
        const length = req.end - req.start;
        const data = fullData.slice(offset, offset + length);
        if (data.length !== length) throw new Error(`Incomplete range response for ${bundleName}`);
        this.worker.postMessage({
          type: "file-range-fetch-response",
          requestId: req.requestId,
          bundleName,
          start: req.start,
          end: req.end,
          success: true,
          data
        }, [data.buffer]);
      }
    } catch (e) {
      this._log("Coalesced range fetch error: " + e.message);
      for (const req of group) {
        this.worker.postMessage({
          type: "file-range-fetch-response",
          requestId: req.requestId,
          bundleName,
          start: req.start,
          end: req.end,
          success: false,
          error: e.message
        });
      }
    }
  }
  async _handleMemorySnapshot(msg) {
    const { snapshot, byteLength, isShared } = msg;
    if (!snapshot || byteLength === 0) {
      this._log("Memory snapshot is empty, skipping save");
      return;
    }
    let snapshotArray;
    if (isShared) {
      snapshotArray = new Uint8Array(byteLength);
      snapshotArray.set(new Uint8Array(snapshot));
      this._log(`Saving memory snapshot to cache (${(byteLength / 1024 / 1024).toFixed(1)}MB, from shared)...`);
    } else {
      snapshotArray = new Uint8Array(snapshot);
      this._log(`Saving memory snapshot to cache (${(byteLength / 1024 / 1024).toFixed(1)}MB)...`);
    }
    const success = await saveWasmMemorySnapshot(snapshotArray, {
      savedAt: Date.now(),
      byteLength
    });
    if (success) {
      this._log("Memory snapshot saved");
    } else {
      this._log("Failed to save memory snapshot");
    }
  }
  /**
   * Compile LaTeX source to PDF.
   * @param {string} source - LaTeX source code
   * @param {CompileOptions} [options] - Compilation options
   * @returns {Promise<CompileResult>} Compilation result with PDF or error
   */
  async compile(source, options = {}) {
    if (this.formatGenerationPromise) {
      this._log("Waiting for format generation to complete...");
      await this.formatGenerationPromise.catch(() => {
      });
    }
    const mainFile = normalizeProjectPath(options.mainFile || "document.tex");
    const projectFiles = Object.entries(options.additionalFiles || {}).map(([path, content]) => [normalizeProjectPath(path), content]);
    const engine = options.engine || detectEngine(source);
    const useCache = this.enableDocCache && options.useCache !== false && Object.keys(options.additionalFiles || {}).length === 0;
    if (useCache) {
      const docHash = hashSync(JSON.stringify([this.runtimeKey, mainFile, source]));
      const cached = await getCachedPdf(docHash, engine);
      if (cached) {
        this._log("Using cached PDF");
        return {
          success: true,
          pdf: new Uint8Array(cached),
          cached: true
        };
      }
    }
    if (!this.workerReady) {
      await this._initWorker();
    }
    const { bundles } = this.bundleManager.checkPackages(source, engine);
    const eagerBundles = this.getEagerBundles(engine);
    const additionalFilesMap = options.additionalFiles || {};
    const { ctanPackages, additionalBundles: depBundles = [] } = this.bundleManager.prescanForCtanPackages(
      source,
      engine,
      additionalFilesMap,
      mainFile,
      bundles
    );
    if (this.enableCtan) {
      if (engine === "xelatex" || engine === "lualatex") {
        const fontNames = extractFontNames(source, additionalFilesMap);
        if (fontNames.length > 0) {
          const { packages, unresolved } = await this.ctanFetcher.resolveFontPackages(fontNames);
          if (packages.length > 0) {
            this._log(`Fonts: ${fontNames.length} named, resolved to packages: ${packages.join(", ")}`);
            for (const pkg of packages) {
              if (!ctanPackages.includes(pkg)) ctanPackages.push(pkg);
            }
          }
          if (unresolved.length > 0) {
            this._log(`Fonts: unresolved (relying on bundled/system fonts): ${unresolved.join(", ")}`);
          }
        }
      }
      if (ctanPackages.length > 0) {
        this._log(`Pre-scan: ${ctanPackages.length} potential CTAN packages`);
        const prescanStart = performance.now();
        const { fetched, failed, skipped } = await this.ctanFetcher.batchFetchPackages(ctanPackages);
        const elapsed = (performance.now() - prescanStart).toFixed(0);
        if (fetched.length > 0 || skipped.length > 0) {
          this._log(`Pre-fetch: ${fetched.length} new, ${skipped.length} cached, ${failed.length} not found (${elapsed}ms)`);
        }
      }
    }
    const allBundles = [.../* @__PURE__ */ new Set([...bundles, ...eagerBundles, ...depBundles])];
    const extras = [];
    if (eagerBundles.length > 0) extras.push("eager: " + eagerBundles.join(", "));
    if (depBundles.length > 0) extras.push("deps: " + depBundles.join(", "));
    if (extras.length > 0) {
      this._log("Required bundles: " + bundles.join(", ") + " (+ " + extras.join(", ") + ")");
    } else {
      this._log("Required bundles: " + bundles.join(", "));
    }
    this.onProgress("loading", "Preparing compilation...");
    const bundleNames = allBundles;
    let transferList = [];
    this._log(`Bundles: ${bundleNames.join(", ")} (worker-direct loading)`);
    const ctanFilesRaw = this.ctanFetcher.getCachedFiles();
    const ctanFiles = {};
    for (const [path, data] of Object.entries(ctanFilesRaw)) {
      if (data && data.buffer) {
        const copy = data.buffer.slice(0);
        ctanFiles[path] = new Uint8Array(copy);
        transferList.push(copy);
      }
    }
    const ctanFileCount = Object.keys(ctanFiles).length;
    if (ctanFileCount > 0) {
      this._log(`Passing ${ctanFileCount} cached CTAN files to worker`);
    }
    for (const [filename, content] of projectFiles) {
      const data = typeof content === "string" ? new TextEncoder().encode(content) : content;
      const copy = new Uint8Array(data).buffer;
      ctanFiles["/" + filename] = new Uint8Array(copy);
      transferList.push(copy);
    }
    let cachedFormat = null;
    const preamble = extractPreamble(source);
    const preambleHash = hashSync(preamble);
    const fmtKey = this.runtimeKey + "_" + preambleHash + "_" + engine;
    let formatSideEffectFiles = null;
    const canUseFormat = projectFiles.length === 0 && !mainFile.includes("/");
    if (canUseFormat && this._fmtMemCache?.key === fmtKey && this._fmtMemCache?.data?.buffer?.byteLength > 0) {
      const fmtCopy = this._fmtMemCache.data.buffer.slice(0);
      cachedFormat = { fmtName: fmtKey, fmtData: new Uint8Array(fmtCopy) };
      transferList.push(fmtCopy);
      formatSideEffectFiles = this._fmtMemCache.sideEffectFiles || null;
      this._log("Using cached format (memory)");
    } else if (canUseFormat) {
      const fmtPath = "/" + getFmtPath(fmtKey);
      await ensureFmtCacheMount();
      const fmtData = await fileSystem.readBinary(fmtPath).catch(() => null);
      if (fmtData && fmtData.byteLength > 0) {
        const fmtArray = fmtData instanceof Uint8Array ? fmtData : new Uint8Array(fmtData);
        formatSideEffectFiles = await this._loadFormatSideEffects(fmtKey);
        this._fmtMemCache = { key: fmtKey, data: new Uint8Array(fmtArray), sideEffectFiles: formatSideEffectFiles };
        const fmtCopy = fmtArray.buffer.slice(fmtArray.byteOffset, fmtArray.byteOffset + fmtArray.byteLength);
        cachedFormat = { fmtName: fmtKey, fmtData: new Uint8Array(fmtCopy) };
        transferList.push(fmtCopy);
        this._log("Using cached format (filesystem)");
      }
    }
    if (cachedFormat && formatSideEffectFiles && Object.keys(formatSideEffectFiles).length > 0) {
      const restored = {};
      for (const [name, b64] of Object.entries(formatSideEffectFiles)) {
        const bytes = base64ToBytes(b64);
        const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        restored[name] = new Uint8Array(copy);
        transferList.push(copy);
      }
      cachedFormat.sideEffectFiles = restored;
      this._log(`Restoring ${Object.keys(restored).length} preamble side-effect file(s) with cached format`);
    }
    const auxCacheKey = this.runtimeKey + ":" + mainFile + ":" + (cachedFormat ? preambleHash + "_fmt" : preambleHash);
    const auxCache = await getAuxCache(auxCacheKey);
    this.onProgress("compiling", "Compiling...");
    const compileId = String(++nextCompilerRequestId);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingCompile) {
          this.pendingCompile = null;
          reject(new Error("Compilation timeout"));
        }
      }, 12e4);
      this.pendingCompile = {
        resolve: async (result) => {
          clearTimeout(timeout);
          if (result.success && result.pdfData) {
            const pdfData = Uint8Array.from(new Uint8Array(result.pdfData));
            if (useCache && pdfData) {
              const docHash = hashSync(JSON.stringify([this.runtimeKey, mainFile, source]));
              await saveCachedPdf(docHash, engine, result.pdfData);
            }
            if (result.auxFilesToCache) {
              await saveAuxCache(auxCacheKey, result.auxFilesToCache);
            }
            if (canUseFormat && !cachedFormat && preamble && engine !== "xelatex") {
              this.generateFormat(source, { engine }).then(async () => {
                await ensureFmtCacheMount();
                const data = await fileSystem.readBinary("/" + getFmtPath(fmtKey)).catch(() => null);
                if (data) {
                  const sideEffectFiles = await this._loadFormatSideEffects(fmtKey);
                  this._fmtMemCache = { key: fmtKey, data: new Uint8Array(data), sideEffectFiles };
                }
              }).catch(() => {
              });
            }
            resolve({
              success: true,
              pdf: pdfData,
              syncTexData: result.syncTexData || null,
              // SyncTeX data for source/PDF synchronization
              stats: result.stats,
              log: result.log
            });
          } else {
            resolve({
              success: false,
              error: result.error || (result.success ? "Compilation produced no PDF" : `TeX compilation failed (exit code ${result.exitCode ?? "unknown"})`),
              exitCode: result.exitCode,
              log: result.log
            });
          }
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      };
      try {
        this.worker.postMessage({
          type: "compile",
          id: compileId,
          source,
          engine,
          mainFile,
          options: {
            enableLazyFS: this.enableLazyFS,
            enableCtan: this.enableCtan,
            maxRetries: this.maxRetries,
            verbose: this.verbose
          },
          bundleNames,
          // Worker-direct: send names only
          bundlesUrl: this.bundlesUrl,
          // Worker loads from OPFS/network
          ctanFiles,
          cachedFormat,
          cachedAuxFiles: auxCache?.files || null,
          // Deferred bundles minus any that are eagerly loaded
          deferredBundleNames: (this.bundleManager.bundleDeps?.deferred || []).filter((b) => !eagerBundles.includes(b))
        }, transferList);
      } catch (e) {
        this._log("Failed to post compile message to worker: " + e.message);
        reject(e);
        return;
      }
    });
  }
  /**
   * Pre-generate a format file for faster subsequent compilations.
   * @param {string} source - LaTeX source with preamble to cache
   * @param {{engine?: string, mainFile?: string, additionalFiles?: Object<string, string|Uint8Array>}} [options] - Options. Project dependencies disable format caching.
   * @returns {Promise<Uint8Array|null>} Format data or null if not supported
   */
  async generateFormat(source, options = {}) {
    if (Object.keys(options.additionalFiles || {}).length > 0 || normalizeProjectPath(options.mainFile || "document.tex").includes("/")) {
      this._log("Format caching disabled for multi-file or nested projects");
      return null;
    }
    const engine = options.engine || "pdflatex";
    if (engine === "xelatex") {
      this._log("Format caching not supported for XeLaTeX (native fonts)");
      return null;
    }
    const preamble = extractPreamble(source);
    if (!preamble) {
      throw new Error("No preamble found in source");
    }
    const preambleHash = hashSync(preamble);
    const fmtKey = this.runtimeKey + "_" + preambleHash + "_" + engine;
    const fmtPath = "/" + getFmtPath(fmtKey);
    await ensureFmtCacheMount();
    const existingFmt = await fileSystem.readBinary(fmtPath).catch(() => null);
    if (existingFmt && existingFmt.byteLength > 0) {
      this._log("Format already cached");
      return new Uint8Array(existingFmt);
    }
    if (!this.workerReady) {
      await this._initWorker();
    }
    const { bundles } = this.bundleManager.checkPackages(source, engine);
    const { additionalBundles: depBundles = [] } = this.bundleManager.prescanForCtanPackages(
      source,
      engine,
      {},
      void 0,
      bundles
    );
    const bundleNames = [.../* @__PURE__ */ new Set([...bundles, ...depBundles])];
    const transferList = [];
    const ctanFilesRaw = this.ctanFetcher.getCachedFiles();
    const ctanFiles = {};
    for (const [path, data] of Object.entries(ctanFilesRaw)) {
      if (data && data.buffer) {
        const copy = data.buffer.slice(0);
        ctanFiles[path] = new Uint8Array(copy);
        transferList.push(copy);
      }
    }
    this._log("Generating format file...");
    this.onProgress("format", "Generating format...");
    this.formatGenerationPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingFormat) {
          this.pendingFormat = null;
          reject(new Error("Format generation timeout"));
        }
      }, 3e5);
      this.pendingFormat = {
        resolve: (result) => {
          clearTimeout(timeout);
          if (result.success) {
            const fmtData = new Uint8Array(result.formatData);
            const sideEffects = result.sideEffectFiles || {};
            const sideEffectsB64 = {};
            for (const [name, buf] of Object.entries(sideEffects)) {
              sideEffectsB64[name] = bytesToBase64(new Uint8Array(buf));
            }
            ensureFmtCacheMount().then(async () => {
              await fileSystem.writeBinary(fmtPath, fmtData, { createParents: true });
              await this._saveFormatSideEffects(fmtKey, sideEffectsB64);
            }).then(() => {
              const n = Object.keys(sideEffectsB64).length;
              this._log(`Format generated and cached${n ? ` (+${n} preamble side-effect file(s))` : ""}`);
              resolve(fmtData);
            }).catch((e) => {
              this._log("Warning: Failed to cache format: " + e.message);
              resolve(fmtData);
            });
          } else {
            reject(new Error(result.error || "Format generation failed"));
          }
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      };
      this.worker.postMessage({
        type: "generate-format",
        id: String(++nextCompilerRequestId),
        preambleContent: preamble,
        engine,
        manifest: this.bundleManager.fileManifest,
        packageMapData: this.bundleManager.packageMap,
        bundleDepsData: this.bundleManager.bundleDeps,
        bundleRegistryData: [...this.bundleManager.bundleRegistry],
        bundleNames,
        // Worker-direct: send names only
        bundlesUrl: this.bundlesUrl,
        // Worker loads from OPFS/network
        ctanFiles,
        maxRetries: this.maxRetries
      }, transferList);
    }).finally(() => {
      this.formatGenerationPromise = null;
    });
    return this.formatGenerationPromise;
  }
  /**
   * Persist the preamble side-effect files captured during format generation,
   * next to the cached format. Stored as a JSON map of filename → base64.
   * @param {string} fmtKey
   * @param {Object<string,string>} sideEffectsB64
   */
  async _saveFormatSideEffects(fmtKey, sideEffectsB64) {
    const path = "/" + getFmtPath(fmtKey) + ".side.json";
    try {
      if (Object.keys(sideEffectsB64).length === 0) return;
      const json = new TextEncoder().encode(JSON.stringify(sideEffectsB64));
      await fileSystem.writeBinary(path, json, { createParents: true });
    } catch (e) {
      this._log("Warning: failed to persist format side-effect files: " + e.message);
    }
  }
  /**
   * Load the preamble side-effect files persisted next to a cached format.
   * @param {string} fmtKey
   * @returns {Promise<Object<string,string>|null>} filename → base64, or null
   */
  async _loadFormatSideEffects(fmtKey) {
    const path = "/" + getFmtPath(fmtKey) + ".side.json";
    try {
      const data = await fileSystem.readBinary(path).catch(() => null);
      if (!data || data.byteLength === 0) return null;
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }
  /**
   * Clear all caches (CTAN packages, mounted files).
   * @returns {Promise<void>}
   */
  async clearCache() {
    this._log("Clearing CTAN cache...");
    await clearCTANCache();
    this.ctanFetcher.clearMountedFiles();
    this._log("Cache cleared");
  }
  /**
   * Clear bundle memory cache to free RAM.
   * Bundles are still cached on disk (OPFS) and will reload quickly.
   * Call this after compile to reduce main thread memory usage.
   */
  clearBundleMemoryCache() {
    this.bundleManager.clearCache();
  }
  /**
   * Get compiler statistics.
   * @returns {{bundles: Object, ctan: Object}} Statistics from bundle manager and CTAN fetcher
   */
  getStats() {
    return {
      bundles: this.bundleManager.getStats(),
      ctan: this.ctanFetcher.getStats()
    };
  }
  /**
   * Terminate the worker. Call unload() for full cleanup.
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      if (_globalActiveWorker === this.worker) {
        _globalActiveWorker = null;
      }
      this.worker = null;
      this.workerReady = false;
    }
    this._initPromise = null;
  }
  /**
   * Unload compiler to free memory. Clears RAM caches but keeps disk caches.
   * Call init() again to reinitialize.
   */
  unload() {
    this._log("Unloading compiler to free memory...");
    this.terminate();
    this.bundleManager.clearCache();
    this.ctanFetcher.clearMountedFiles();
    this._log("Compiler unloaded");
  }
  /**
   * Check if compiler is currently loaded.
   * @returns {boolean}
   */
  isLoaded() {
    return this.worker !== null;
  }
};
export {
  SiglumCompiler
};
