// local.js - 本地版完整实现（含 IndexedDB、渲染、分类管理）

(function() {
    // ---------- DOM 元素 ----------
    const modalTitle = document.getElementById('modalTitle');
    const editingId = document.getElementById('editingId');
    const urlInput = document.getElementById('urlInput');
    const titleInput = document.getElementById('titleInput');
    const descriptionInput = document.getElementById('descriptionInput');
    const categorySelect = document.getElementById('categorySelect');
    const tagsInput = document.getElementById('tagsInput');
    const submitBtn = document.getElementById('submitBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const clipboardHint = document.getElementById('clipboardHint');
    const bookmarkGrid = document.getElementById('bookmarkGrid');
    const categoryTreeDiv = document.getElementById('categoryTree');
    const collapseBtn = document.getElementById('collapseSidebarBtn');
    const sidebar = document.getElementById('sidebar');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const addBookmarkHeaderBtn = document.getElementById('addBookmarkHeaderBtn');
    const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataBtn = document.getElementById('importDataBtn');
    const shortcutHint = document.getElementById('shortcutHint');

    // 模态框
    const bookmarkModal = document.getElementById('bookmarkModal') ? new bootstrap.Modal(document.getElementById('bookmarkModal')) : null;
    const categoryManageModal = document.getElementById('categoryManageModal') ? new bootstrap.Modal(document.getElementById('categoryManageModal')) : null;
    const newCategoryModal = document.getElementById('newCategoryModal') ? new bootstrap.Modal(document.getElementById('newCategoryModal')) : null;

    // 分类管理相关元素（可能不存在）
    const categoryListContainer = document.getElementById('categoryListContainer');
    const toggleAddCategoryBtn = document.getElementById('toggleAddCategoryBtn');
    const addCategoryForm = document.getElementById('addCategoryForm');
    const newCategoryNameInput = document.getElementById('newCategoryNameInput');
    const newCategoryIconSelect = document.getElementById('newCategoryIconSelect');
    const newCategoryCustomIcon = document.getElementById('newCategoryCustomIcon');
    const newCategoryParentSelect = document.getElementById('newCategoryParentSelect');
    const saveNewCategoryBtn = document.getElementById('saveNewCategoryBtn');
    const newCategoryPriority = document.getElementById('newCategoryPriority');

    // ---------- 全局变量 ----------
    let db = null;
    let allBookmarks = [];
    let allCategories = [];
    let activeCategoryKey = null;
    let allDataExpanded = {};
    let lastFetchedIcon = '';

    // ---------- 数据库操作 ----------
    const DB_NAME = 'BookmarkDB';
    const DB_VERSION = 2;

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
                    db.createObjectStore('categories', { keyPath: 'name' });
                }
                const tx = e.target.transaction;
                const catStore = tx.objectStore('categories');
                const getReq = catStore.get('未分类');
                getReq.onsuccess = () => {
                    if (!getReq.result) {
                        catStore.put({ name: '未分类', icon: 'fas fa-folder', parent: null, priority: 100 });
                    }
                };
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

    // ---------- 工具函数 ----------
    function updateCategorySelect(selected = '') {
        if (!categorySelect) return;
        let html = '<option value="">-- 选择已有分类 --</option>';
        allCategories.forEach(cat => {
            html += `<option value="${escapeHtml(cat.name)}" ${cat.name === selected ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`;
        });
        categorySelect.innerHTML = html;
    }

    async function fetchMetadata(url) {
        try {
            const urlObj = new URL(url);
            if (titleInput) titleInput.value = urlObj.hostname;
            if (clipboardHint) clipboardHint.innerText = '✅ 已读取网址';
            lastFetchedIcon = '';
        } catch (e) {
            if (clipboardHint) clipboardHint.innerText = '⚠️ 无法解析网址';
            lastFetchedIcon = '';
        }
    }

    // ---------- 刷新右侧内容（供 setActiveCategory 调用） ----------
    function refreshBookmarks(cat) {
        if (!bookmarkGrid) return;
        if (cat === null) {
            if (!allBookmarks.length) {
                bookmarkGrid.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签，点击“新增”添加</div>';
                return;
            }
            let html = '<div class="row g-3">';
            allBookmarks.forEach(b => {
                html += `<div class="col-12 col-md-6 col-lg-4">${window.renderSingleBookmarkCard(b)}</div>`;
            });
            html += '</div>';
            bookmarkGrid.innerHTML = html;
        } else {
            const filtered = allBookmarks.filter(b => b.category === cat);
            if (!filtered.length) {
                bookmarkGrid.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 这个分类下没有书签</div>';
                return;
            }
            let html = '<div class="row g-3">';
            filtered.forEach(b => {
                html += `<div class="col-12 col-md-6 col-lg-4">${window.renderSingleBookmarkCard(b)}</div>`;
            });
            html += '</div>';
            bookmarkGrid.innerHTML = html;
        }
    }

    window.refreshBookmarks = refreshBookmarks;

    // ---------- 刷新数据 ----------
    async function refreshData() {
        allBookmarks = await getAllBookmarks();
        allCategories = await getAllCategories();
        window.allData = { bookmarks: allBookmarks, categories: Object.fromEntries(allCategories.map(c => [c.name, c])) };
        window.activeCategoryKey = activeCategoryKey;
        window.allDataExpanded = allDataExpanded;
        if (typeof window.renderCategoryTree === 'function') window.renderCategoryTree();
        if (window.setActiveCategory) window.setActiveCategory(activeCategoryKey);
        const parentSelect = document.getElementById('newCategoryParent');
        if (parentSelect) {
            parentSelect.innerHTML = '<option value="">无</option>';
            allCategories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.name;
                parentSelect.appendChild(opt);
            });
        }
    }

    // ---------- 书签操作 ----------
    window.openAddModal = async function() {
        if (modalTitle) modalTitle.innerText = '📋 新增书签';
        if (editingId) editingId.value = '';
        if (urlInput) {
            urlInput.value = '';
            urlInput.readOnly = false;
        }
        if (titleInput) titleInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        if (tagsInput) tagsInput.value = '';
        updateCategorySelect();
        if (categorySelect) categorySelect.value = '';
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (clipboardHint) clipboardHint.innerText = '';
        lastFetchedIcon = '';
        if (bookmarkModal) bookmarkModal.show();

        try {
            const text = await navigator.clipboard.readText();
            if (text && urlInput) {
                urlInput.value = text;
                if (clipboardHint) clipboardHint.innerText = '✅ 已读取剪贴板，正在获取网页信息...';
                fetchMetadata(text);
            } else if (clipboardHint) {
                clipboardHint.innerText = '⚠️ 剪贴板为空';
            }
        } catch (err) {
            if (clipboardHint) clipboardHint.innerText = '⚠️ 无法读取剪贴板';
        }
    };

    window.openEditModal = async function(id) {
        const item = allBookmarks.find(b => b.id === id);
        if (!item) return;
        if (modalTitle) modalTitle.innerText = '✏️ 编辑书签';
        if (editingId) editingId.value = id;
        if (urlInput) {
            urlInput.value = item.url;
            urlInput.readOnly = true;
        }
        updateCategorySelect(item.category);
        if (categorySelect) categorySelect.value = item.category;
        if (titleInput) titleInput.value = item.title || '';
        if (descriptionInput) descriptionInput.value = item.description || '';
        if (tagsInput) tagsInput.value = (item.tags || []).join('/');
        if (deleteBtn) {
            deleteBtn.style.display = 'block';
            deleteBtn.onclick = handleDelete;
        }
        if (bookmarkModal) bookmarkModal.show();
    };

    async function handleDelete() {
        const id = editingId ? parseInt(editingId.value) : 0;
        if (!id || !confirm('确定删除？')) return;
        await deleteBookmark(id);
        allBookmarks = allBookmarks.filter(b => b.id !== id);
        if (bookmarkModal) bookmarkModal.hide();
        await refreshData();
        if (window.setActiveCategory) window.setActiveCategory(activeCategoryKey);
    }

    async function handleSubmit() {
        const id = editingId ? editingId.value : '';
        const url = urlInput ? urlInput.value.trim() : '';
        if (!url) { alert('网址不能为空'); return; }
        const category = categorySelect ? categorySelect.value : '';
        const title = titleInput ? titleInput.value.trim() : url;
        const description = descriptionInput ? descriptionInput.value.trim() : '';
        const tagsRaw = tagsInput ? tagsInput.value.trim() : '';
        let tags = [];
        if (tagsRaw) tags = tagsRaw.split('/').map(t => t.trim()).filter(t => t);
        const bookmark = { url, category, title, description, tags, clickCount: 0, icon: '' };
        if (id) {
            bookmark.id = parseInt(id);
            const original = allBookmarks.find(b => b.id === bookmark.id);
            if (original) {
                bookmark.clickCount = original.clickCount;
                bookmark.icon = original.icon;
            }
            await saveBookmark(bookmark);
            const idx = allBookmarks.findIndex(b => b.id === bookmark.id);
            if (idx !== -1) allBookmarks[idx] = bookmark;
        } else {
            bookmark.id = Date.now();
            await saveBookmark(bookmark);
            allBookmarks.push(bookmark);
        }
        if (bookmarkModal) bookmarkModal.hide();
        await refreshData();
        if (window.setActiveCategory) window.setActiveCategory(activeCategoryKey);
    }

    window.incrementClick = async function(id) {
        const bookmark = allBookmarks.find(b => b.id === id);
        if (bookmark) {
            bookmark.clickCount = (bookmark.clickCount || 0) + 1;
            await saveBookmark(bookmark);
            const idx = allBookmarks.findIndex(b => b.id === id);
            if (idx !== -1) allBookmarks[idx] = bookmark;
        }
    };

    window.changeIcon = async function(id) {
        const newIcon = prompt('输入新的图标 (Font Awesome 类名或图片URL)');
        if (!newIcon) return;
        const bookmark = allBookmarks.find(b => b.id === id);
        if (bookmark) {
            bookmark.icon = newIcon;
            await saveBookmark(bookmark);
            const idx = allBookmarks.findIndex(b => b.id === id);
            if (idx !== -1) allBookmarks[idx] = bookmark;
            await refreshData();
            if (window.setActiveCategory) window.setActiveCategory(activeCategoryKey);
        }
    };

    window.searchByTag = function(tag) {
        if (searchInput) searchInput.value = tag;
        if (window.localSearch) window.localSearch(tag);
    };

    // ---------- 分类管理 ----------
    async function loadCategoryList() {
        if (!categoryListContainer) return;
        categoryListContainer.innerHTML = '';
        const tree = buildCategoryTree(Object.fromEntries(allCategories.map(c => [c.name, c])));
        const flat = [];
        function flatten(node) { flat.push(node); node.children.forEach(flatten); }
        tree.forEach(flatten);
        flat.forEach(node => {
            const row = categoryListContainer.insertRow();
            row.dataset.category = node.name;
            row.insertCell(0).innerHTML = node.icon.startsWith('http') ? `<img src="${node.icon}" style="width:20px">` : `<i class="${node.icon}"></i>`;
            row.insertCell(1).innerText = node.name;
            row.insertCell(2).innerText = node.parent || '-';
            row.insertCell(3).innerText = node.priority || 100;
            const actionCell = row.insertCell(4);
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm btn-outline-primary me-1';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.onclick = () => editCategory(node.name);
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm btn-outline-danger';
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.onclick = () => deleteCategoryNode(node.name);
            actionCell.appendChild(editBtn);
            actionCell.appendChild(delBtn);
        });
    }

    async function editCategory(name) {
        const cat = allCategories.find(c => c.name === name);
        if (!cat) return;
        const newName = prompt('新名称', name);
        if (newName && newName !== name) {
            if (allCategories.some(c => c.name === newName)) { alert('分类已存在'); return; }
            for (let b of allBookmarks) if (b.category === name) b.category = newName;
            await deleteCategory(name);
            cat.name = newName;
        }
        const newIcon = prompt('图标类名或URL', cat.icon);
        if (newIcon) cat.icon = newIcon;
        const newParent = prompt('上级分类（留空为无）', cat.parent || '');
        cat.parent = newParent || null;
        const newPriority = parseInt(prompt('优先级（数字越小越靠前）', cat.priority || 100));
        if (!isNaN(newPriority)) cat.priority = newPriority;
        await saveCategory(cat);
        await refreshData();
        loadCategoryList();
        if (window.setActiveCategory) window.setActiveCategory(activeCategoryKey);
    }

    async function deleteCategoryNode(name) {
        const hasChildren = allCategories.some(c => c.parent === name);
        const hasBookmarks = allBookmarks.some(b => b.category === name);
        if (hasChildren || hasBookmarks) {
            alert('请先删除子分类或移走书签');
            return;
        }
        if (confirm(`确定删除分类“${name}”吗？`)) {
            await deleteCategory(name);
            await refreshData();
            loadCategoryList();
            if (window.setActiveCategory) window.setActiveCategory(activeCategoryKey);
        }
    }

    async function saveNewCategory() {
        if (!newCategoryNameInput) return;
        const name = newCategoryNameInput.value.trim();
        if (!name) { alert('请输入分类名称'); return; }
        if (allCategories.some(c => c.name === name)) { alert('分类已存在'); return; }
        let icon = newCategoryIconSelect ? (newCategoryIconSelect.value === 'custom' ? (newCategoryCustomIcon ? newCategoryCustomIcon.value.trim() : '') : newCategoryIconSelect.value) : 'fas fa-folder';
        if (!icon) icon = 'fas fa-folder';
        const parent = newCategoryParentSelect ? (newCategoryParentSelect.value || null) : null;
        const priority = newCategoryPriority ? (parseInt(newCategoryPriority.value) || 100) : 100;
        const newCat = { name, icon, parent, priority };
        await saveCategory(newCat);
        if (newCategoryModal) newCategoryModal.hide();
        if (addCategoryForm) addCategoryForm.style.display = 'none';
        if (toggleAddCategoryBtn) toggleAddCategoryBtn.innerHTML = '<i class="fas fa-plus"></i> 新增分类';
        await refreshData();
        loadCategoryList();
        if (window.setActiveCategory) window.setActiveCategory(activeCategoryKey);
        alert('✅ 分类添加成功');
    }

    // ---------- 导入导出 ----------
    function exportData() {
        const data = { bookmarks: allBookmarks, categories: allCategories };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks_backup_${new Date().toISOString().slice(0,19).replace(/:/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function mergeCategories(existing, incoming) {
        const map = new Map();
        existing.forEach(cat => map.set(`${cat.name}|${cat.parent || ''}`, cat));
        incoming.forEach(cat => {
            const key = `${cat.name}|${cat.parent || ''}`;
            if (!map.has(key)) map.set(key, cat);
        });
        return Array.from(map.values());
    }

    function buildCategoryMap(categories) {
        const map = {};
        categories.forEach(cat => map[cat.name] = cat.name);
        return map;
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
                        if (!categories.some(c => c.name === name && c.parent === parent)) categories.push({ name, parent, icon: 'fas fa-folder' });
                        const dl = child.querySelector(':scope > DL');
                        if (dl) parse(dl, [...path, name]);
                    } else {
                        const a = child.querySelector(':scope > A');
                        if (a && a.href && a.href.startsWith('http')) {
                            const url = a.href;
                            const title = a.textContent.trim() || url;
                            const icon = a.getAttribute('ICON') || '';
                            const category = path.length ? path[path.length-1] : '未分类';
                            bookmarks.push({ url, title, category, icon });
                        }
                    }
                }
            }
        }
        parse(rootDL);
        if (!categories.some(c => c.name === '未分类')) categories.push({ name: '未分类', icon: 'fas fa-folder', parent: null, priority: 100 });
        return { categories, bookmarks };
    }

    async function importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html,.htm,.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const content = ev.target.result;
                const fileName = file.name.toLowerCase();
                if (fileName.endsWith('.json')) {
                    try {
                        const data = JSON.parse(content);
                        if (data.bookmarks && data.categories) {
                            const existingCats = await getAllCategories();
                            const mergedCats = mergeCategories(existingCats, data.categories);
                            const categoryMap = buildCategoryMap(mergedCats);
                            const existingBookmarks = await getAllBookmarks();
                            const newBookmarks = [...existingBookmarks];
                            for (let b of data.bookmarks) {
                                b.category = categoryMap[b.category] || b.category;
                                if (!b.id) b.id = Date.now() + Math.random();
                                newBookmarks.push(b);
                            }
                            const tx = db.transaction(['bookmarks', 'categories'], 'readwrite');
                            await tx.objectStore('categories').clear();
                            for (let cat of mergedCats) await tx.objectStore('categories').add(cat);
                            await tx.objectStore('bookmarks').clear();
                            for (let b of newBookmarks) await tx.objectStore('bookmarks').add(b);
                            alert('导入成功');
                            await refreshData();
                        } else alert('无效的 JSON 格式');
                    } catch { alert('解析 JSON 失败'); }
                } else {
                    const result = parseBookmarkHtml(content);
                    if (!result) { alert('无法解析 HTML 文件'); return; }
                    const existingCats = await getAllCategories();
                    const mergedCats = mergeCategories(existingCats, result.categories);
                    const categoryMap = buildCategoryMap(mergedCats);
                    const existingBookmarks = await getAllBookmarks();
                    const newBookmarks = [...existingBookmarks];
                    for (let b of result.bookmarks) {
                        b.category = categoryMap[b.category] || b.category;
                        if (!b.id) b.id = Date.now() + Math.random();
                        newBookmarks.push(b);
                    }
                    const tx = db.transaction(['bookmarks', 'categories'], 'readwrite');
                    await tx.objectStore('categories').clear();
                    for (let cat of mergedCats) await tx.objectStore('categories').add(cat);
                    await tx.objectStore('bookmarks').clear();
                    for (let b of newBookmarks) await tx.objectStore('bookmarks').add(b);
                    alert('导入成功');
                    await refreshData();
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ---------- 事件绑定 ----------
    if (addBookmarkHeaderBtn) addBookmarkHeaderBtn.addEventListener('click', window.openAddModal);
    if (manageCategoriesBtn) manageCategoriesBtn.addEventListener('click', () => { loadCategoryList(); if (categoryManageModal) categoryManageModal.show(); });
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    if (addCategoryBtn && newCategoryModal) {
        addCategoryBtn.addEventListener('click', () => { newCategoryModal.show(); });
    }
    if (saveNewCategoryBtn) saveNewCategoryBtn.addEventListener('click', saveNewCategory);
    if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
    if (deleteBtn) deleteBtn.addEventListener('click', handleDelete);
    if (exportDataBtn) exportDataBtn.addEventListener('click', exportData);
    if (importDataBtn) importDataBtn.addEventListener('click', importData);
    if (shortcutHint) shortcutHint.addEventListener('click', window.openAddModal);
    if (collapseBtn && sidebar) {
        collapseBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const icon = collapseBtn.querySelector('i');
            if (sidebar.classList.contains('collapsed')) icon.className = 'fas fa-chevron-right';
            else icon.className = 'fas fa-bars';
        });
    }

    // ---------- 初始化 ----------
    openDB().then(async () => {
        await refreshData();
        const hasSeenLocalNotice = localStorage.getItem('hasSeenLocalNotice');
        if (!hasSeenLocalNotice) {
            const localNoticeModal = document.getElementById('localNoticeModal');
            if (localNoticeModal) {
                const modal = new bootstrap.Modal(localNoticeModal);
                modal.show();
                localStorage.setItem('hasSeenLocalNotice', 'true');
            }
        }
        const localTitle = document.getElementById('localTitle');
        const localBadge = document.getElementById('localBadge');
        const localModal = document.getElementById('localNoticeModal');
        if (localModal) {
            const modal = new bootstrap.Modal(localModal);
            function showLocalNotice() { modal.show(); }
            if (localTitle) localTitle.addEventListener('click', showLocalNotice);
            if (localBadge) localBadge.addEventListener('click', showLocalNotice);
        }
    }).catch(err => console.error(err));
})();