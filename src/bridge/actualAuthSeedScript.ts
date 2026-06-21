export type ActualAuthSeed = {
  serverUrl: string;
  token: string;
};

export function buildActualAuthSeedScript(seed: ActualAuthSeed): string {
  const config = JSON.stringify({
    serverUrl: seed.serverUrl.replace(/\/+$/, ''),
    token: seed.token,
  });

  return `
(function seedActualAuthStorage() {
  var config = ${config};
  var guardKey = 'actual-wrapper-auth-seeded:' + config.token;

  function finish() {
    try {
      if (window.sessionStorage && window.sessionStorage.getItem(guardKey) !== '1') {
        window.sessionStorage.setItem(guardKey, '1');
        window.location.reload();
      }
    } catch (_error) {
    }
  }

  try {
    if (!window.indexedDB || !window.sessionStorage) {
      return true;
    }

    if (window.sessionStorage.getItem(guardKey) === '1') {
      return true;
    }

    var request = window.indexedDB.open('actual', 9);
    request.onupgradeneeded = function onActualStorageUpgrade(event) {
      var db = event.target.result;
      if (!db.objectStoreNames.contains('asyncStorage')) {
        db.createObjectStore('asyncStorage');
      }
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'filepath' });
      }
    };
    request.onsuccess = function onActualStorageOpen(event) {
      var db = event.target.result;
      var transaction = db.transaction(['asyncStorage'], 'readwrite');
      var store = transaction.objectStore('asyncStorage');
      store.put(config.serverUrl, 'server-url');
      store.put(true, 'did-bootstrap');
      store.put(config.token, 'user-token');
      transaction.oncomplete = function onActualStorageSeeded() {
        db.close();
        finish();
      };
      transaction.onerror = function onActualStorageSeedError() {
        db.close();
      };
    };
  } catch (_error) {
  }

  return true;
})();
true;
`;
}
