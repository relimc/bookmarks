// local.js - 基于 IndexedDB 的完整实现，复用 online 版 UI 交互

(function() {
    // ---------- DOM 元素 ----------
    const bookmarkModal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
    const categoryManageModal = new bootstrap.Modal(document.getElementById('categoryManageModal'));
    const newCategoryModal = new bootstrap.Modal(document.getElementById('newCategoryModal'));

    const modalTitle = document.getElementById('modalTitle');
    const editingId = document.getElementById('editingId');
    const urlInput = document.getElementById('urlInput');
    const titleInput = document.getElementById('titleInput');
    const descriptionInput = document.getElementById('descriptionInput');
    const categorySelect = document.getElementById('categorySelect');
    const bookmarkTags = document.getElementById('bookmarkTags');
    const submitBtn = document.getElementById('submitBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const clipboardHint = document.getElementById('clipboardHint');
    const bookmarkGrid = document.getElementById('bookmarkGrid');
    const searchInput = document.getElementById('searchInput');
    const addBookmarkDropdownItem = document.getElementById('addBookmarkDropdownItem');
    const importBookmarksDropdownItem = document.getElementById('importBookmarksDropdownItem');
    const exportBookmarksDropdownItem = document.getElementById('exportBookmarksDropdownItem');
    const addCategoryDropdownItem = document.getElementById('addCategoryDropdownItem');
    const listCategoriesDropdownItem = document.getElementById('listCategoriesDropdownItem');

    // 新增分类弹窗元素
    const newCategoryName = document.getElementById('newCategoryName');
    const newCategoryParent = document.getElementById('newCategoryParent');
    const newCategoryPriority = document.getElementById('newCategoryPriority');
    const confirmNewCategoryBtn = document.getElementById('confirmNewCategoryBtn');

    // 全局数据
    let db = null;
    window.allData = { bookmarks: [], categories: {} };
    window.allDataExpanded = {};
    let activeCategoryKey = null;
    let lastFetchedIcon = '';

    // ---------- IndexedDB 操作 ----------
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
                    // 初始化默认分类
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

    async function getAllBookmarks() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['bookmarks'], 'readonly');
            const store = tx.objectStore('bookmarks');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async function getAllCategories() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['categories'], 'readonly');
            const store = tx.objectStore('categories');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async function saveBookmark(bookmark) {
        const tx = db.transaction(['bookmarks'], 'readwrite');
        const store = tx.objectStore('bookmarks');
        if (bookmark.id) {
            await store.put(bookmark);
        } else {
            bookmark.id = Date.now();
            await store.add(bookmark);
        }
        return bookmark.id;
    }

    async function deleteBookmark(id) {
        const tx = db.transaction(['bookmarks'], 'readwrite');
        const store = tx.objectStore('bookmarks');
        await store.delete(id);
    }

    async function saveCategory(category) {
        const tx = db.transaction(['categories'], 'readwrite');
        const store = tx.objectStore('categories');
        await store.put(category);
    }

    async function deleteCategory(name) {
        const tx = db.transaction(['categories'], 'readwrite');
        const store = tx.objectStore('categories');
        await store.delete(name);
    }

    // ---------- UI 辅助函数（复用 online 版）----------
    function updateCategorySelect(selected = '') {
        const cats = Object.keys(window.allData.categories || {}).sort();
        let html = '<option value="">-- 选择已有分类 --</option>';
        cats.forEach(c => {
            html += `<option value="${escapeHtml(c)}" ${c === selected ? 'selected' : ''}>${escapeHtml(c)}</option>`;
        });
        categorySelect.innerHTML = html;
    }

    function refreshBookmarks(category) {
        if (!bookmarkGrid) return;
        let filtered = [...(window.allData.bookmarks || [])];
        if (category === '__recommend__') {
            filtered.sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0));
            filtered = filtered.slice(0, 30);
        } else if (category && category !== '__all__') {
            filtered = filtered.filter(b => b.category === category);
        }
        if (filtered.length === 0) {
            bookmarkGrid.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签，点击“新增”添加</div>';
            return;
        }
        let html = '<div class="row g-3">';
        filtered.forEach(bookmark => {
            html += `<div class="col-12 col-md-6 col-lg-4">${window.renderSingleBookmarkCard(bookmark)}</div>`;
        });
        html += '</div>';
        bookmarkGrid.innerHTML = html;
    }

    window.refreshBookmarks = refreshBookmarks;

    function setActiveCategory(cat) {
        activeCategoryKey = cat;
        window.activeCategoryKey = cat;
        if (typeof window.renderCategoryTree === 'function') window.renderCategoryTree();
        refreshBookmarks(cat);
    }
    window.setActiveCategory = setActiveCategory;

    async function refreshDataAndUI() {
        const bookmarks = await getAllBookmarks();
        const categoriesArr = await getAllCategories();
        const categoriesObj = {};
        categoriesArr.forEach(c => { categoriesObj[c.name] = c; });
        window.allData = { bookmarks, categories: categoriesObj };
        if (typeof window.renderCategoryTree === 'function') window.renderCategoryTree();
        setActiveCategory(activeCategoryKey || '__recommend__');
    }

    // 分类列表相关函数
    function loadCategoryList() {
        const container = document.getElementById('categoryListContainer');
        if (!container) return;
        const cats = window.allData.categories || {};
        const sorted = Object.keys(cats).sort((a,b) => (cats[a].priority||100) - (cats[b].priority||100));
        let html = '';
        sorted.forEach(name => {
            const cat = cats[name];
            const iconHtml = cat.icon && (cat.icon.startsWith('http') || cat.icon.startsWith('data:'))
                ? `<img src="${escapeHtml(cat.icon)}" style="width:20px">`
                : `<i class="${escapeHtml(cat.icon || 'fas fa-folder')}"></i>`;
            html += `<tr data-category="${escapeHtml(name)}">
                        <td>${iconHtml}</td>
                        <td>${escapeHtml(name)}</td>
                        <td>${cat.parent ? escapeHtml(cat.parent) : '-'}</td>
                        <td>${cat.priority ?? 100}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary edit-category-btn"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-outline-danger delete-category-btn"><i class="fas fa-trash"></i></button>
                         </td>
                     </tr>`;
        });
        container.innerHTML = html;
        document.querySelectorAll('.edit-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.closest('tr').dataset.category;
                editCategory(name);
            });
        });
        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.closest('tr').dataset.category;
                deleteCategoryHandler(name);
            });
        });
    }

    async function editCategory(name) {
        const cat = window.allData.categories[name];
        const newName = prompt('新名称', name);
        if (newName && newName !== name) {
            if (window.allData.categories[newName]) { alert('分类已存在'); return; }
            // 更新所有书签的分类
            for (let b of window.allData.bookmarks) {
                if (b.category === name) {
                    b.category = newName;
                    await saveBookmark(b);
                }
            }
            await deleteCategory(name);
            cat.name = newName;
            name = newName;
        }
        const newIcon = prompt('图标类名或URL', cat.icon);
        if (newIcon) cat.icon = newIcon;
        const newParent = prompt('上级分类（留空为无）', cat.parent || '');
        cat.parent = newParent || null;
        const newPriority = parseInt(prompt('优先级（数字越小越靠前）', cat.priority || 100));
        if (!isNaN(newPriority)) cat.priority = newPriority;
        await saveCategory(cat);
        await refreshDataAndUI();
        if (categoryManageModal._isShown) loadCategoryList();
    }

    async function deleteCategoryHandler(name) {
        const hasChildren = Object.values(window.allData.categories).some(c => c.parent === name);
        const hasBookmarks = window.allData.bookmarks.some(b => b.category === name);
        if (hasChildren || hasBookmarks) {
            alert('请先删除子分类或移走书签');
            return;
        }
        if (confirm(`确定删除分类“${name}”吗？`)) {
            await deleteCategory(name);
            await refreshDataAndUI();
            if (categoryManageModal._isShown) loadCategoryList();
        }
    }

    function initCategorySearch() {
        const searchInputCat = document.getElementById('categorySearchInput');
        if (!searchInputCat) return;
        searchInputCat.addEventListener('input', function() {
            const keyword = this.value.trim().toLowerCase();
            const rows = document.querySelectorAll('#categoryListContainer tr');
            rows.forEach(row => {
                const nameCell = row.cells[1];
                if (nameCell) {
                    const text = nameCell.textContent.toLowerCase();
                    row.style.display = text.includes(keyword) ? '' : 'none';
                }
            });
        });
    }

    // 新增分类弹窗图标选择器初始化
    function initNewCategoryIconSelector() {
        const display = document.getElementById('newCatSelectedIconDisplay');
        const panel = document.getElementById('newCatIconDropdownPanel');
        const caret = display?.querySelector('.caret');
        const preview = document.getElementById('newCatSelectedIconPreview');
        const text = document.getElementById('newCatSelectedIconText');
        const iconValue = document.getElementById('newCatSelectedIconValue');
        const customInput = document.getElementById('newCatCustomIconInput');
        const applyBtn = document.getElementById('newCatApplyCustomIcon');
        if (!display || !panel) return;
        display.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('show');
            if (caret) caret.classList.toggle('open', panel.classList.contains('show'));
        });
        document.addEventListener('click', (e) => {
            if (!display.contains(e.target) && !panel.contains(e.target)) {
                panel.classList.remove('show');
                if (caret) caret.classList.remove('open');
            }
        });
        panel.querySelectorAll('.icon-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const value = opt.dataset.value;
                const name = opt.dataset.name;
                preview.innerHTML = opt.querySelector('i').cloneNode(true).outerHTML;
                text.innerText = name;
                iconValue.value = value;
                panel.classList.remove('show');
                if (caret) caret.classList.remove('open');
            });
        });
        if (applyBtn && customInput) {
            applyBtn.addEventListener('click', () => {
                const custom = customInput.value.trim();
                if (!custom) return;
                const icon = custom;
                if (icon.startsWith('http') || icon.startsWith('data:')) {
                    preview.innerHTML = `<img src="${icon}" style="max-width:20px; max-height:20px;">`;
                } else {
                    preview.innerHTML = `<i class="${icon}"></i>`;
                }
                text.innerText = icon;
                iconValue.value = icon;
                panel.classList.remove('show');
                if (caret) caret.classList.remove('open');
                customInput.value = '';
            });
        }
    }

    // 书签操作
    async function fetchMetadata(url) {
        // 本地版无法抓取，仅做剪贴板提示
        if (clipboardHint) clipboardHint.innerText = '✅ 已读取网址';
        lastFetchedIcon = '';
    }

    window.openAddModal = async function() {
        modalTitle.innerText = '📋 新增书签';
        editingId.value = '';
        urlInput.value = '';
        urlInput.readOnly = false;
        titleInput.value = '';
        descriptionInput.value = '';
        if (bookmarkTags) bookmarkTags.value = '';
        updateCategorySelect();
        categorySelect.value = '';
        deleteBtn.style.display = 'none';
        clipboardHint.innerText = '';
        lastFetchedIcon = '';
        bookmarkModal.show();
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text;
                clipboardHint.innerText = '✅ 已读取剪贴板';
                fetchMetadata(text);
            } else {
                clipboardHint.innerText = '⚠️ 剪贴板为空';
            }
        } catch {
            clipboardHint.innerText = '⚠️ 无法读取剪贴板';
        }
    };

    window.openEditModal = async function(id) {
        const item = window.allData.bookmarks.find(b => b.id === id);
        if (!item) return;
        modalTitle.innerText = '✏️ 编辑书签';
        editingId.value = id;
        urlInput.value = item.url;
        urlInput.readOnly = true;
        titleInput.value = item.title || '';
        descriptionInput.value = item.description || '';
        if (bookmarkTags) bookmarkTags.value = (item.tags || []).join('/');
        updateCategorySelect(item.category);
        categorySelect.value = item.category;
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = handleDelete;
        bookmarkModal.show();
    };

    async function handleDelete() {
        const id = parseInt(editingId.value);
        if (!id || !confirm('确定删除？')) return;
        await deleteBookmark(id);
        bookmarkModal.hide();
        await refreshDataAndUI();
    }

    async function handleSubmit() {
        const url = urlInput.value.trim();
        if (!url) { alert('网址不能为空'); return; }
        const category = categorySelect.value;
        if (!category) { alert('请选择分类'); return; }
        const title = titleInput.value.trim() || url;
        const description = descriptionInput.value.trim() || '';
        const tagsRaw = bookmarkTags ? bookmarkTags.value.trim() : '';
        const tags = tagsRaw ? tagsRaw.split('/').map(t => t.trim()).filter(t => t) : [];
        let icon = '';
        if (editingId.value) {
            const original = window.allData.bookmarks.find(b => b.id === parseInt(editingId.value));
            icon = original ? original.icon : '';
        } else {
            if (lastFetchedIcon) icon = lastFetchedIcon;
            else try { icon = new URL(url).origin + '/favicon.ico'; } catch { icon = ''; }
        }
        const bookmark = {
            url, category, title, description, tags,
            icon, clickCount: 0
        };
        if (editingId.value) {
            bookmark.id = parseInt(editingId.value);
            await saveBookmark(bookmark);
        } else {
            await saveBookmark(bookmark);
        }
        bookmarkModal.hide();
        await refreshDataAndUI();
    }

    // 导入导出
    async function exportBookmarks() {
        const data = {
            bookmarks: window.allData.bookmarks,
            categories: Object.values(window.allData.categories)
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks_backup_${new Date().toISOString().slice(0,19).replace(/:/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function parseBookmarkHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const rootDL = doc.querySelector('dl');
        if (!rootDL) return null;
        const categories = [], bookmarks = [];
        function parse(node, path = []) {
            for (let child of node.children) {
                if (child.tagName === 'DT') {
                    const h3 = child.querySelector(':scope > H3');
                    if (h3) {
                        const name = h3.textContent.trim();
                        const parent = path.length ? path[path.length-1] : null;
                        if (!categories.some(c => c.name === name && c.parent === parent))
                            categories.push({ name, parent, icon: 'fas fa-folder', priority: 100 });
                        const dl = child.querySelector(':scope > DL');
                        if (dl) parse(dl, [...path, name]);
                    } else {
                        const a = child.querySelector(':scope > A');
                        if (a && a.href && a.href.startsWith('http')) {
                            const url = a.href;
                            const title = a.textContent.trim() || url;
                            const icon = a.getAttribute('ICON') || '';
                            const category = path.length ? path[path.length-1] : '未分类';
                            bookmarks.push({ url, title, category, icon, tags: [], clickCount: 0 });
                        }
                    }
                }
            }
        }
        parse(rootDL);
        if (!categories.some(c => c.name === '未分类')) categories.push({ name: '未分类', icon: 'fas fa-folder', parent: null, priority: 100 });
        return { categories, bookmarks };
    }

    async function importBookmarksFromFile(file) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const content = ev.target.result;
            const fileName = file.name.toLowerCase();
            if (fileName.endsWith('.json')) {
                try {
                    const data = JSON.parse(content);
                    if (data.bookmarks && data.categories) {
                        const existingCatsMap = new Map();
                        Object.values(window.allData.categories).forEach(c => existingCatsMap.set(c.name, c));
                        for (let cat of data.categories) {
                            if (!existingCatsMap.has(cat.name)) {
                                await saveCategory(cat);
                            }
                        }
                        for (let b of data.bookmarks) {
                            if (b.category && !existingCatsMap.has(b.category)) {
                                if (!data.categories.some(c => c.name === b.category)) continue;
                            }
                            if (!b.id) b.id = Date.now() + Math.random();
                            await saveBookmark(b);
                        }
                        alert('导入成功');
                        await refreshDataAndUI();
                    } else alert('无效的 JSON 格式');
                } catch { alert('解析 JSON 失败'); }
            } else {
                const result = parseBookmarkHtml(content);
                if (!result) { alert('无法解析 HTML 文件'); return; }
                for (let cat of result.categories) {
                    if (!window.allData.categories[cat.name]) {
                        await saveCategory(cat);
                    }
                }
                for (let b of result.bookmarks) {
                    if (!b.id) b.id = Date.now() + Math.random();
                    await saveBookmark(b);
                }
                alert('导入成功');
                await refreshDataAndUI();
            }
        };
        reader.readAsText(file);
    }

    function triggerImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html,.htm,.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) await importBookmarksFromFile(file);
        };
        input.click();
    }

    // 事件绑定
    addBookmarkDropdownItem?.addEventListener('click', (e) => {
        e.preventDefault();
        window.openAddModal();
    });
    importBookmarksDropdownItem?.addEventListener('click', (e) => {
        e.preventDefault();
        triggerImport();
    });
    exportBookmarksDropdownItem?.addEventListener('click', (e) => {
        e.preventDefault();
        exportBookmarks();
    });
    addCategoryDropdownItem?.addEventListener('click', (e) => {
        e.preventDefault();
        // 填充上级分类下拉框
        const cats = Object.keys(window.allData.categories || {}).sort();
        let html = '<option value="">-- 无 --</option>';
        cats.forEach(c => html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`);
        newCategoryParent.innerHTML = html;
        newCategoryName.value = '';
        document.getElementById('newCatSelectedIconValue').value = 'fas fa-folder';
        document.getElementById('newCatSelectedIconPreview').innerHTML = '<i class="fas fa-folder"></i>';
        document.getElementById('newCatSelectedIconText').innerText = '请选择图标';
        newCategoryPriority.value = '100';
        newCategoryModal.show();
    });
    listCategoriesDropdownItem?.addEventListener('click', async (e) => {
        e.preventDefault();
        await refreshDataAndUI();
        loadCategoryList();
        const searchInputCat = document.getElementById('categorySearchInput');
        if (searchInputCat) searchInputCat.value = '';
        categoryManageModal.show();
    });
    submitBtn?.addEventListener('click', handleSubmit);
    deleteBtn?.addEventListener('click', handleDelete);
    confirmNewCategoryBtn?.addEventListener('click', async () => {
        const name = newCategoryName.value.trim();
        if (!name) { alert('请输入分类名称'); return; }
        const icon = document.getElementById('newCatSelectedIconValue').value || 'fas fa-folder';
        const parent = newCategoryParent.value || null;
        const priority = parseInt(newCategoryPriority.value) || 100;
        if (window.allData.categories[name]) {
            alert('分类已存在');
            return;
        }
        await saveCategory({ name, icon, parent, priority });
        newCategoryModal.hide();
        await refreshDataAndUI();
        if (categoryManageModal._isShown) loadCategoryList();
    });

    // 初始化
    openDB().then(async () => {
        await refreshDataAndUI();
        initCategorySearch();
        initNewCategoryIconSelector();
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
    }).catch(err => console.error(err));

    // 暴露全局
    window.incrementClick = async function(id) {
        const bookmark = window.allData.bookmarks.find(b => b.id === id);
        if (bookmark) {
            bookmark.clickCount = (bookmark.clickCount || 0) + 1;
            await saveBookmark(bookmark);
            await refreshDataAndUI();
        }
    };
    window.searchByTag = function(tag) {
        if (searchInput) searchInput.value = tag;
        if (typeof window.localSearch === 'function') window.localSearch(tag);
    };
    window.changeIcon = async function(id) {
        const newIcon = prompt('输入新的图标 (Font Awesome 类名或图片URL)');
        if (!newIcon) return;
        const bookmark = window.allData.bookmarks.find(b => b.id === id);
        if (bookmark) {
            bookmark.icon = newIcon;
            await saveBookmark(bookmark);
            await refreshDataAndUI();
        }
    };
})();