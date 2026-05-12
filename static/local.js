// local.js - 本地版数据适配器（IndexedDB）

window.isLoggedIn = true;
let db = null;
const DB_NAME = 'BookmarkDB';
const DB_VERSION = 3;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('bookmarks')) {
                const store = db.createObjectStore('bookmarks', { keyPath: 'id', autoIncrement: true });
                store.createIndex('category', 'category', { unique: false });
            }
            if (!db.objectStoreNames.contains('categories')) {
                const catStore = db.createObjectStore('categories', { keyPath: 'name' });
                const tx = e.target.transaction;
                const store = tx.objectStore('categories');
                const getReq = store.get('未分类');
                getReq.onsuccess = () => {
                    if (!getReq.result) {
                        store.put({ name: '未分类', icon: 'fas fa-folder', parent: null, priority: 100 });
                    }
                };
            }
        };
    });
}

class LocalDataAdapter {
    async getAllData() {
        if (!db) await openDB();
        const bookmarks = await this._getAllBookmarks();
        const categoriesArr = await this._getAllCategories();
        const categories = {};
        categoriesArr.forEach(c => { categories[c.name] = c; });
        return { bookmarks, categories };
    }
    async _getAllBookmarks() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['bookmarks'], 'readonly');
            const store = tx.objectStore('bookmarks');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
    async _getAllCategories() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['categories'], 'readonly');
            const store = tx.objectStore('categories');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
    async addBookmark(bookmark) {
        if (!db) await openDB();
        const tx = db.transaction(['bookmarks'], 'readwrite');
        const store = tx.objectStore('bookmarks');
        if (!bookmark.id) bookmark.id = Date.now();
        await store.add(bookmark);
        return bookmark.id;
    }
    async updateBookmark(id, updates) {
        if (!db) await openDB();
        const tx = db.transaction(['bookmarks'], 'readwrite');
        const store = tx.objectStore('bookmarks');
        const existing = await new Promise((resolve, reject) => {
            const getReq = store.get(id);
            getReq.onsuccess = () => resolve(getReq.result);
            getReq.onerror = () => reject(getReq.error);
        });
        if (!existing) throw new Error('书签不存在');
        const updated = { ...existing, ...updates };
        await store.put(updated);
    }
    async deleteBookmark(id) {
        if (!db) await openDB();
        const tx = db.transaction(['bookmarks'], 'readwrite');
        const store = tx.objectStore('bookmarks');
        await store.delete(id);
    }
    async addCategory(cat) {
        if (!db) await openDB();
        const tx = db.transaction(['categories'], 'readwrite');
        const store = tx.objectStore('categories');
        await store.put(cat);
    }
    async updateCategory(name, data) {
        if (!db) await openDB();
        const tx = db.transaction(['categories'], 'readwrite');
        const store = tx.objectStore('categories');
        const existing = await new Promise((resolve, reject) => {
            const getReq = store.get(name);
            getReq.onsuccess = () => resolve(getReq.result);
            getReq.onerror = () => reject(getReq.error);
        });
        if (!existing) throw new Error('分类不存在');
        const updated = { ...existing, ...data };
        if (data.new_name && data.new_name !== name) {
            // 处理重命名
            await store.delete(name);
            updated.name = data.new_name;
            await store.put(updated);
            // 更新所有书签中的分类名
            const bookmarksTx = db.transaction(['bookmarks'], 'readwrite');
            const bookmarkStore = bookmarksTx.objectStore('bookmarks');
            const allBookmarks = await this._getAllBookmarks();
            for (let b of allBookmarks) {
                if (b.category === name) {
                    b.category = data.new_name;
                    await bookmarkStore.put(b);
                }
            }
        } else {
            await store.put(updated);
        }
    }
    async deleteCategory(name) {
        if (!db) await openDB();
        const tx = db.transaction(['categories'], 'readwrite');
        const store = tx.objectStore('categories');
        await store.delete(name);
    }
    async incrementClick(id) {
        if (!db) await openDB();
        const tx = db.transaction(['bookmarks'], 'readwrite');
        const store = tx.objectStore('bookmarks');
        const bookmark = await new Promise((resolve, reject) => {
            const getReq = store.get(id);
            getReq.onsuccess = () => resolve(getReq.result);
            getReq.onerror = () => reject(getReq.error);
        });
        if (bookmark) {
            bookmark.clickCount = (bookmark.clickCount || 0) + 1;
            await store.put(bookmark);
        }
    }
    async exportData() {
        const { bookmarks, categories } = await this.getAllData();
        return { bookmarks, categories: Object.values(categories) };
    }
    async importData(payload) {
        if (!db) await openDB();
        const tx = db.transaction(['bookmarks', 'categories'], 'readwrite');
        const bookmarkStore = tx.objectStore('bookmarks');
        const categoryStore = tx.objectStore('categories');
        // 合并分类（简单不删除已有，仅添加新分类）
        for (let cat of payload.categories) {
            const existing = await new Promise((resolve) => {
                const req = categoryStore.get(cat.name);
                req.onsuccess = () => resolve(req.result);
            });
            if (!existing) await categoryStore.put(cat);
        }
        // 添加书签，避免重复（简单按 url+title 去重？这里简单全部添加，但需要避免 id 冲突）
        for (let b of payload.bookmarks) {
            if (!b.id) b.id = Date.now() + Math.random();
            await bookmarkStore.add(b);
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    await openDB();
    const adapter = new LocalDataAdapter();
    const app = new BookmarkApp(adapter);
    window.bookmarkApp = app;

    // 显示本地版提示
    const hasSeen = localStorage.getItem('hasSeenLocalNotice');
    if (!hasSeen) {
        const noticeModal = new bootstrap.Modal(document.getElementById('localNoticeModal'));
        noticeModal.show();
        localStorage.setItem('hasSeenLocalNotice', 'true');
    }
    const localTitle = document.getElementById('localTitle');
    const localBadge = document.getElementById('localBadge');
    const localModal = document.getElementById('localNoticeModal');
    if (localModal) {
        const modal = new bootstrap.Modal(localModal);
        localTitle?.addEventListener('click', () => modal.show());
        localBadge?.addEventListener('click', () => modal.show());
    }

});