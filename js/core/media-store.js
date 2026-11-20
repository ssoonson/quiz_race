// 선생님이 고른 배경음악 파일을 이 브라우저(IndexedDB)에 보관합니다. 서버로 보내지 않습니다.
const DB_NAME = 'classroom-race';
const STORE = 'files';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

/** @param file File (mp3, m4a, ogg, wav) */
export const saveBgmFile = (file) => run('readwrite', (s) => s.put({ name: file.name, blob: file }, 'bgm'));
/** @returns {Promise<{name: string, blob: Blob} | undefined>} */
export const loadBgmFile = () => run('readonly', (s) => s.get('bgm')).catch(() => undefined);
export const clearBgmFile = () => run('readwrite', (s) => s.delete('bgm'));
