// local.js - 本地版数据适配器（IndexedDB）

window.isLoggedIn = true;
let db = null;
const DB_NAME = 'BookmarkDB';
const DB_VERSION = 3;
window.isAdmin = false
window.isOnline = false;          // 标记为本地版
window.currentUserId = null;      // 本地版无用户ID

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
        if (!bookmark.id) {
            // 使用时间戳 + 随机数确保唯一
            bookmark.id = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        }
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
        return { success: true };
    }
    async addCategory(cat) {
        if (!db) await openDB();
        const tx = db.transaction(['categories'], 'readwrite');
        const store = tx.objectStore('categories');

        // 检查中文名是否已存在（如果提供了中文名）
        if (cat.name) {
            const existing = await new Promise((resolve) => {
                const req = store.get(cat.name);
                req.onsuccess = () => resolve(req.result);
            });
            if (existing) {
                throw new Error('分类已存在');
            }
        }

        // 检查英文名是否已存在（如果提供了英文名）
        if (cat.name_en) {
            const all = await new Promise((resolve) => {
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result);
            });
            if (all.some(c => c.name_en === cat.name_en)) {
                throw new Error('英文分类名已存在');
            }
        }

        // 保存分类
        await store.put(cat);

        // 返回成功标志
        return { success: true };
    }
    async updateCategory(name, data) {
        if (!db) await openDB();
        const tx = db.transaction(['categories'], 'readwrite');
        const store = tx.objectStore('categories');

        // 获取原有分类
        const existing = await new Promise((resolve, reject) => {
            const getReq = store.get(name);
            getReq.onsuccess = () => resolve(getReq.result);
            getReq.onerror = () => reject(getReq.error);
        });
        if (!existing) throw new Error('分类不存在');

        // 处理重命名
        if (data.new_name && data.new_name !== name) {
            // 检查新名称是否已存在
            const exists = await new Promise((resolve) => {
                const req = store.get(data.new_name);
                req.onsuccess = () => resolve(!!req.result);
            });
            if (exists) throw new Error('分类名已存在');
            // 删除旧分类，用新名称存储
            await store.delete(name);
            existing.name = data.new_name;
        }
        // 更新其他字段
        if (data.new_name_en !== undefined) existing.name_en = data.new_name_en;
        if (data.icon !== undefined) existing.icon = data.icon;
        if (data.parent !== undefined) existing.parent = data.parent;
        if (data.priority !== undefined) existing.priority = data.priority;
        if (data.private !== undefined) existing.private = data.private;

        // 保存
        await store.put(existing);

        // 如果重命名了，需要更新所有书签中的分类引用
        if (data.new_name && data.new_name !== name) {
            const bookmarkTx = db.transaction(['bookmarks'], 'readwrite');
            const bookmarkStore = bookmarkTx.objectStore('bookmarks');
            const allBookmarks = await new Promise((resolve, reject) => {
                const req = bookmarkStore.getAll();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            for (let b of allBookmarks) {
                if (b.category === name) {
                    b.category = data.new_name;
                    await bookmarkStore.put(b);
                }
            }
        }

        // 返回成功结果
        return { success: true };
    }
    async deleteCategory(name, force = false) {
        if (!db) await openDB();
        const tx = db.transaction(['categories', 'bookmarks'], 'readwrite');
        const catStore = tx.objectStore('categories');
        const bmStore = tx.objectStore('bookmarks');

        // 获取所有分类
        const allCats = await new Promise((resolve) => {
            const req = catStore.getAll();
            req.onsuccess = () => resolve(req.result);
        });
        // 检查是否有子分类
        const hasChildren = allCats.some(c => c.parent === name);
        const allBookmarks = await new Promise((resolve) => {
            const req = bmStore.getAll();
            req.onsuccess = () => resolve(req.result);
        });
        const hasBookmarks = allBookmarks.some(b => b.category === name);

        if (!force) {
            if (hasChildren || hasBookmarks) {
                const err = new Error('该分类下还有子分类或书签，无法删除');
                err.has_children = hasChildren;
                err.has_bookmarks = hasBookmarks;
                throw err;
            }
            await catStore.delete(name);
            return { success: true };
        } else {
            // 强制删除：递归获取所有子分类名称
            function getAllChildrenNames(catName) {
                const children = allCats.filter(c => c.parent === catName);
                let names = [catName];
                children.forEach(child => {
                    names = names.concat(getAllChildrenNames(child.name));
                });
                return names;
            }
            const allNames = getAllChildrenNames(name);
            // 删除这些分类的书签
            for (let b of allBookmarks) {
                if (allNames.includes(b.category)) {
                    await bmStore.delete(b.id);
                }
            }
            // 删除分类本身及子分类
            for (let n of allNames) {
                await catStore.delete(n);
            }
            return { success: true };
        }
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

function updatePageTitle() {
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
         titleEl.innerText = t('title_local'); // 本地版
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

    updatePageTitle();

});