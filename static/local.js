(function() {
    // 辅助函数：安全获取元素，避免报错
    function getEl(id) {
        const el = document.getElementById(id);
        if (!el) console.warn(`元素 #${id} 未找到`);
        return el;
    }

    // ---------- DOM 元素 ----------
    const modalTitle = getEl('modalTitle');
    const editingId = getEl('editingId');
    const urlInput = getEl('urlInput');
    const titleInput = getEl('titleInput');
    const descriptionInput = getEl('descriptionInput');
    const categorySelect = getEl('categorySelect');
    const tagsInput = getEl('tagsInput');
    const submitBtn = getEl('submitBtn');
    const deleteBtn = getEl('deleteBtn');
    const clipboardHint = getEl('clipboardHint');
    const bookmarkGrid = getEl('bookmarkGrid');
    const categoryTreeDiv = getEl('categoryTree');
    const collapseBtn = getEl('collapseSidebarBtn');
    const sidebar = getEl('sidebar');
    const searchInput = getEl('searchInput');
    const searchBtn = getEl('searchBtn');
    const addBookmarkHeaderBtn = getEl('addBookmarkHeaderBtn');
    const manageCategoriesBtn = getEl('manageCategoriesBtn');
    const exportDataBtn = getEl('exportDataBtn');
    const importDataBtn = getEl('importDataBtn');
    const shortcutHint = getEl('shortcutHint');

    // 模态框实例
    const bookmarkModal = new bootstrap.Modal(getEl('bookmarkModal'));
    const categoryManageModal = new bootstrap.Modal(getEl('categoryManageModal'));
    const newCategoryModal = new bootstrap.Modal(getEl('newCategoryModal'));

    // 分类管理相关元素
    const categoryListContainer = getEl('categoryListContainer');
    const toggleAddCategoryBtn = getEl('toggleAddCategoryBtn');
    const addCategoryForm = getEl('addCategoryForm');
    const newCategoryNameInput = getEl('newCategoryNameInput');
    const newCategoryIconSelect = getEl('newCategoryIconSelect');
    const newCategoryCustomIcon = getEl('newCategoryCustomIcon');
    const newCategoryParentSelect = getEl('newCategoryParentSelect');
    const saveNewCategoryBtn = getEl('saveNewCategoryBtn');
    const newCategoryPriority = getEl('newCategoryPriority');

    // ---------- 全局变量 ----------
    let db = null;
    let allBookmarks = [];
    let allCategories = [];
    let activeCategoryKey = null;
    let allDataExpanded = {};
    let lastFetchedIcon = '';

    // ---------- 搜索引擎配置 ----------
    const searchEngines = [
        { name: '本地搜索', iconClass: 'fas fa-search', type: 'local', url: '' },
        { name: '谷歌', iconClass: 'fab fa-google', type: 'web', url: 'https://www.google.com/search?q=' },
        { name: '百度', iconClass: 'fas fa-paw', type: 'web', url: 'https://www.baidu.com/s?wd=' },
        { name: '必应', iconClass: 'fab fa-microsoft', type: 'web', url: 'https://www.bing.com/search?q=' },
        { name: 'GitHub', iconClass: 'fab fa-github', type: 'web', url: 'https://github.com/search?q=' },
        { name: 'Bilibili', iconClass: 'fab fa-bilibili', type: 'web', url: 'https://search.bilibili.com/all?keyword=' }
    ];
    let currentEngine = searchEngines[0];

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
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function shortenUrl(url) {
        try {
            const u = new URL(url);
            return u.hostname.replace('www.', '') + (u.pathname !== '/' ? '…' : '');
        } catch {
            return url.length > 40 ? url.slice(0, 40) + '…' : url;
        }
    }

    function buildCategoryTree(cats) {
        const nodes = {};
        cats.forEach(cat => {
            nodes[cat.name] = {
                name: cat.name,
                icon: cat.icon || 'fas fa-folder',
                parent: cat.parent || null,
                priority: cat.priority || 100,
                children: []
            };
        });
        const roots = [];
        for (let name in nodes) {
            const node = nodes[name];
            const parentName = node.parent;
            if (parentName && nodes[parentName]) {
                nodes[parentName].children.push(node);
            } else {
                roots.push(node);
            }
        }
        roots.sort((a,b) => (a.priority||100) - (b.priority||100));
        roots.forEach(root => root.children.sort((a,b) => (a.priority||100) - (b.priority||100)));
        return roots;
    }

    // ---------- 渲染侧边栏 ----------
    function renderCategoryTree() {
        const tree = buildCategoryTree(allCategories);
        function renderNode(node) {
            const hasChildren = node.children.length > 0;
            const isActive = (activeCategoryKey === node.name);
            const activeClass = isActive ? 'active' : '';
            let iconHtml = '';
            if (node.icon.startsWith('http') || node.icon.startsWith('data:')) {
                iconHtml = `<img src="${node.icon}" onerror="this.style.display='none'">`;
            } else {
                iconHtml = `<i class="${node.icon}"></i>`;
            }
            let arrowHtml = '';
            if (hasChildren) {
                const expanded = allDataExpanded[node.name] || false;
                const expandedClass = expanded ? ' expanded' : '';
                arrowHtml = `<span class="expand-icon${expandedClass}" data-node="${node.name}">❯</span>`;
            } else {
                arrowHtml = `<span class="expand-icon placeholder" style="visibility:hidden;">❯</span>`;
            }
            let html = `
                <div class="tree-node">
                    <div class="tree-node-content ${activeClass}" data-category="${node.name}">
                        <div class="node-inner">
                            <span class="node-icon">${iconHtml}</span>
                            <span class="node-name">${escapeHtml(node.name)}</span>
                            ${arrowHtml}
                        </div>
                    </div>
            `;
            if (hasChildren) {
                const expanded = allDataExpanded[node.name] || false;
                html += `<div class="child-nodes ${expanded ? 'expanded' : ''}">`;
                node.children.forEach(child => { html += renderNode(child); });
                html += `</div>`;
            }
            html += `</div>`;
            return html;
        }
        let treeHtml = '';
        tree.forEach(root => { treeHtml += renderNode(root); });
        if (categoryTreeDiv) categoryTreeDiv.innerHTML = treeHtml;

        // 绑定分类节点点击事件
        document.querySelectorAll('.tree-node-content').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('expand-icon')) return;
                const cat = el.dataset.category;
                if (!cat) return;
                const hasChildren = allCategories.some(c => c.parent === cat);
                if (hasChildren) {
                    allDataExpanded[cat] = !allDataExpanded[cat];
                    renderCategoryTree();
                }
                setActiveCategory(cat);
            });
        });
        // 绑定箭头点击事件
        document.querySelectorAll('.expand-icon').forEach(arrow => {
            arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                const nodeName = arrow.dataset.node;
                if (nodeName) {
                    allDataExpanded[nodeName] = !allDataExpanded[nodeName];
                    renderCategoryTree();
                }
            });
        });
    }

    // ---------- 卡片渲染 ----------
    function renderSingleBookmarkCard(b) {
        let iconHtml = '';
        if (b.icon && (b.icon.startsWith('http') || b.icon.startsWith('data:'))) {
            iconHtml = `<img src="${b.icon}" alt="icon" onerror="this.style.display='none'">`;
        } else {
            iconHtml = `<i class="${b.icon || 'fas fa-tag'}"></i>`;
        }
        const title = escapeHtml(b.title || b.url);
        const desc = escapeHtml(b.description || '');
        const fullUrl = escapeHtml(b.url);
        const shortUrl = shortenUrl(b.url);
        let tagsHtml = '';
        if (b.tags && b.tags.length) {
            tagsHtml = '<div class="card-tags">' + b.tags.map(tag => `<span class="tag" onclick="event.stopPropagation(); searchByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>`).join('') + '</div>';
        }
        return `
            <div class="card" onclick="window.open('${fullUrl}', '_blank'); incrementClick(${b.id})">
                <button class="edit-btn" onclick="event.stopPropagation(); openEditModal(${b.id})">✏️</button>
                <div class="card-body">
                    <div class="card-icon" onclick="event.stopPropagation(); changeIcon(${b.id})">${iconHtml}</div>
                    <div class="card-content">
                        <div class="card-title-wrapper">
                            <div class="card-title">${title}</div>
                            ${tagsHtml}
                        </div>
                        ${desc ? `<div class="card-description">${desc}</div>` : ''}
                    </div>
                </div>
                <div class="card-toast">${shortUrl}</div>
            </div>
        `;
    }

    async function renderAllBookmarks() {
        if (!bookmarkGrid) return;
        if (!allBookmarks.length) {
            bookmarkGrid.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签，点击“新增”添加</div>';
            return;
        }
        let gridHtml = '<div class="row g-3">';
        allBookmarks.forEach(b => {
            gridHtml += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`;
        });
        gridHtml += '</div>';
        bookmarkGrid.innerHTML = gridHtml;
    }

    function renderByCategory(category) {
        const filtered = allBookmarks.filter(b => b.category === category);
        if (!filtered.length) {
            if (bookmarkGrid) bookmarkGrid.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 这个分类下没有书签</div>';
            return;
        }
        let gridHtml = '<div class="row g-3">';
        filtered.forEach(b => {
            gridHtml += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`;
        });
        gridHtml += '</div>';
        if (bookmarkGrid) bookmarkGrid.innerHTML = gridHtml;
    }

    function setActiveCategory(cat) {
        activeCategoryKey = cat;
        renderCategoryTree();
        if (cat === null) {
            renderAllBookmarks();
        } else {
            renderByCategory(cat);
        }
    }

    // ---------- 搜索 ----------
    function localSearch(keyword) {
        if (!keyword.trim()) {
            setActiveCategory(activeCategoryKey);
            return;
        }
        const lower = keyword.toLowerCase();
        const filtered = allBookmarks.filter(b => {
            const title = (b.title || '').toLowerCase();
            const desc = (b.description || '').toLowerCase();
            const tags = (b.tags || []).join('/').toLowerCase();
            return title.includes(lower) || desc.includes(lower) || tags.includes(lower);
        });
        if (!filtered.length) {
            if (bookmarkGrid) bookmarkGrid.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">没有找到匹配的书签</div>';
            return;
        }
        let gridHtml = '<div class="row g-3">';
        filtered.forEach(b => {
            gridHtml += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`;
        });
        gridHtml += '</div>';
        if (bookmarkGrid) bookmarkGrid.innerHTML = gridHtml;
    }

    // ---------- 书签操作 ----------
    function updateCategorySelect(selectedCategory = '') {
        if (!categorySelect) return;
        const categories = allCategories || [];
        let options = '<option value="">-- 选择已有分类 --</option>';
        categories.forEach(cat => {
            options += `<option value="${escapeHtml(cat.name)}" ${cat.name === selectedCategory ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`;
        });
        categorySelect.innerHTML = options;
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

    async function openAddModal() {
        if (modalTitle) modalTitle.innerText = '📋 新增书签';
        if (editingId) editingId.value = '';
        if (urlInput) {
            urlInput.value = '';
            urlInput.readOnly = false;
        }
        if (titleInput) titleInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        if (tagsInput) tagsInput.value = '';
        if (typeof updateCategorySelect === 'function') updateCategorySelect();
        if (categorySelect) categorySelect.value = '';
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
            deleteBtn.onclick = null;   // 添加这一行
        }
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
    }

    window.openEditModal = async function(id) {
        const item = allBookmarks.find(b => b.id === id);
        if (!item) return;
        if (modalTitle) modalTitle.innerText = '✏️ 编辑书签';
        if (editingId) editingId.value = id;
        if (urlInput) {
            urlInput.value = item.url;
            urlInput.readOnly = true;
        }
        if (typeof updateCategorySelect === 'function') updateCategorySelect(item.category);
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
        if (!id) return;
        if (!confirm('确定删除？')) return;
        await deleteBookmark(id);
        allBookmarks = allBookmarks.filter(b => b.id !== id);
        if (bookmarkModal) bookmarkModal.hide();
        setActiveCategory(activeCategoryKey);
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
        const bookmark = {
            url, category, title, description, tags,
            clickCount: 0,
            icon: ''
        };
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
        setActiveCategory(activeCategoryKey);
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
            setActiveCategory(activeCategoryKey);
        }
    };

    window.searchByTag = function(tag) {
        if (searchInput) searchInput.value = tag;
        localSearch(tag);
    };

    // ---------- 分类管理 ----------
    async function loadCategoryList() {
        if (!categoryListContainer) return;
        categoryListContainer.innerHTML = '';
        const tree = buildCategoryTree(allCategories);
        const flat = [];
        function flatten(node) {
            flat.push(node);
            node.children.forEach(flatten);
        }
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
            for (let b of allBookmarks) {
                if (b.category === name) b.category = newName;
                await saveBookmark(b);
            }
            allBookmarks = allBookmarks.map(b => {
                if (b.category === name) b.category = newName;
                return b;
            });
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
        allCategories = await getAllCategories();
        loadCategoryList();
        renderCategoryTree();
        setActiveCategory(activeCategoryKey);
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
            allCategories = await getAllCategories();
            loadCategoryList();
            renderCategoryTree();
            setActiveCategory(activeCategoryKey);
        }
    }

    async function saveNewCategory() {
        const nameInput = document.getElementById('newCategoryName');
        if (!nameInput) {
            console.error('未找到分类名称输入框');
            return;
        }
        const name = nameInput.value.trim();
        if (!name) {
            alert('请输入分类名称');
            return;
        }
        if (allCategories.some(c => c.name === name)) {
            alert('分类已存在');
            return;
        }

        const iconSelect = document.getElementById('newCategoryIconSelect');
        const icon = iconSelect ? (iconSelect.value.trim() || 'fas fa-folder') : 'fas fa-folder';
        const parentSelect = document.getElementById('newCategoryParentSelect');
        const parent = parentSelect ? (parentSelect.value || null) : null;
        const priorityInput = document.getElementById('newCategoryPriority');
        const priority = priorityInput ? (parseInt(priorityInput.value) || 100) : 100;

        const newCat = { name, icon, parent, priority };

        try {
            await saveCategory(newCat);
            // 重新加载分类列表
            allCategories = await getAllCategories();
            // 关闭新增分类弹窗
            const modalEl = document.getElementById('newCategoryModal');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }
            // 刷新分类管理列表、侧边栏和当前视图
            loadCategoryList();
            renderCategoryTree();
            setActiveCategory(activeCategoryKey);
            alert('✅ 分类添加成功');
        } catch (err) {
            console.error('保存分类失败', err);
            alert('❌ 保存失败：' + (err.message || '未知错误'));
        }
    }

    // ---------- 导入导出 ----------
    function exportData() {
        const data = { bookmarks: allBookmarks, categories: allCategories };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks_backup_${new Date().toISOString().slice(0,19)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function mergeCategories(existing, incoming) {
        const map = new Map();
        existing.forEach(cat => map.set(`${cat.name}|${cat.parent || ''}`, cat));
        incoming.forEach(cat => {
            const key = `${cat.name}|${cat.parent || ''}`;
            if (!map.has(key)) {
                map.set(key, { ...cat });
            }
        });
        return Array.from(map.values());
    }

    function buildCategoryMap(categories) {
        const map = {};
        categories.forEach(cat => {
            map[cat.name] = cat.name;
        });
        return map;
    }

    function parseBookmarkHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const rootDL = doc.querySelector('dl');
        if (!rootDL) return null;
        const categories = [];
        const bookmarks = [];
        function parseNode(node, currentPath = []) {
            for (let child of node.children) {
                if (child.tagName === 'DT') {
                    const h3 = child.querySelector(':scope > H3');
                    if (h3) {
                        const folderName = h3.textContent.trim();
                        const parent = currentPath.length ? currentPath[currentPath.length-1] : null;
                        if (!categories.some(c => c.name === folderName && c.parent === parent)) {
                            categories.push({ name: folderName, icon: 'fas fa-folder', parent, priority: 100 });
                        }
                        const dl = child.querySelector(':scope > DL');
                        if (dl) parseNode(dl, [...currentPath, folderName]);
                    } else {
                        const a = child.querySelector(':scope > A');
                        if (a && a.href && a.href.startsWith('http')) {
                            const url = a.href;
                            const title = a.textContent.trim() || url;
                            const icon = a.getAttribute('ICON') || '';
                            const category = currentPath.length ? currentPath[currentPath.length-1] : '未分类';
                            bookmarks.push({ url, title, description: '', category, tags: [], icon, clickCount: 0 });
                        }
                    }
                }
            }
        }
        parseNode(rootDL);
        if (!categories.some(c => c.name === '未分类')) {
            categories.push({ name: '未分类', icon: 'fas fa-folder', parent: null, priority: 100 });
        }
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
                            for (let cat of mergedCats) {
                                await tx.objectStore('categories').add(cat);
                            }
                            await tx.objectStore('bookmarks').clear();
                            for (let b of newBookmarks) {
                                await tx.objectStore('bookmarks').add(b);
                            }
                            alert('导入成功');
                            await refreshData();
                        } else {
                            alert('无效的 JSON 格式');
                        }
                    } catch (err) {
                        alert('解析 JSON 失败');
                    }
                } else {
                    const result = parseBookmarkHtml(content);
                    if (!result) {
                        alert('无法解析 HTML 文件，请确保是浏览器导出的书签文件');
                        return;
                    }
                    const { categories: htmlCats, bookmarks: htmlBookmarks } = result;
                    const existingCats = await getAllCategories();
                    const mergedCats = mergeCategories(existingCats, htmlCats);
                    const categoryMap = buildCategoryMap(mergedCats);
                    const existingBookmarks = await getAllBookmarks();
                    const newBookmarks = [...existingBookmarks];
                    for (let b of htmlBookmarks) {
                        b.category = categoryMap[b.category] || b.category;
                        if (!b.id) b.id = Date.now() + Math.random();
                        newBookmarks.push(b);
                    }
                    const tx = db.transaction(['bookmarks', 'categories'], 'readwrite');
                    await tx.objectStore('categories').clear();
                    for (let cat of mergedCats) {
                        await tx.objectStore('categories').add(cat);
                    }
                    await tx.objectStore('bookmarks').clear();
                    for (let b of newBookmarks) {
                        await tx.objectStore('bookmarks').add(b);
                    }
                    alert('导入成功');
                    await refreshData();
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ---------- 刷新数据 ----------
    async function refreshData() {
        allBookmarks = await getAllBookmarks();
        allCategories = await getAllCategories();
        renderCategoryTree();
        setActiveCategory(activeCategoryKey);
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

    // ---------- 搜索引擎 UI ----------
    function renderEngineDropdown() {
        const dropdown = document.getElementById('engineDropdown');
        if (!dropdown) return;
        let html = '';
        searchEngines.forEach(engine => {
            html += `<div class="engine-option" data-url="${engine.url}" data-iconclass="${engine.iconClass}" data-name="${engine.name}" data-type="${engine.type}">
                        <i class="${engine.iconClass} engine-icon-small"></i><span>${engine.name}</span>
                    </div>`;
        });
        dropdown.innerHTML = html;
        document.querySelectorAll('.engine-option').forEach(opt => {
            opt.addEventListener('click', function() {
                const name = this.dataset.name;
                const type = this.dataset.type;
                const iconClass = this.dataset.iconclass;
                const selectedIcon = document.getElementById('selectedEngineIcon');
                if (selectedIcon) selectedIcon.innerHTML = `<i class="${iconClass}"></i>`;
                currentEngine = searchEngines.find(e => e.name === name) || searchEngines[0];
                if (searchInput) {
                    searchInput.placeholder = type === 'local' ? '可本地搜索，快速找到收藏网址' : `请输入关键字跳转至${name}搜索`;
                }
                const engineDropdownEl = document.getElementById('engineDropdown');
                if (engineDropdownEl) engineDropdownEl.classList.remove('show');
            });
        });
    }

    function initSearch() {
        if (!searchInput || !searchBtn) return;
        searchInput.placeholder = '可本地搜索，快速找到收藏网址';
        const selectedEngineIcon = document.getElementById('selectedEngineIcon');
        if (selectedEngineIcon) selectedEngineIcon.innerHTML = `<i class="${searchEngines[0].iconClass}"></i>`;
        const engineSelector = document.querySelector('.search-engine-selector');
        const engineDropdown = document.getElementById('engineDropdown');
        if (engineSelector && engineDropdown) {
            engineSelector.addEventListener('click', (e) => {
                e.stopPropagation();
                engineDropdown.classList.toggle('show');
            });
            document.addEventListener('click', (e) => {
                if (!engineSelector.contains(e.target)) engineDropdown.classList.remove('show');
            });
        }
        function performSearch() {
            const query = searchInput.value.trim();
            if (currentEngine.type === 'local') localSearch(query);
            else if (query) window.open(currentEngine.url + encodeURIComponent(query), '_blank');
        }
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); performSearch(); } });
        renderEngineDropdown();
    }

    // ---------- 事件绑定 ----------
    if (addBookmarkHeaderBtn) addBookmarkHeaderBtn.addEventListener('click', openAddModal);
    if (manageCategoriesBtn) manageCategoriesBtn.addEventListener('click', () => {
        loadCategoryList();
        categoryManageModal.show();
    });
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', () => {
            const newNameInput = document.getElementById('newCategoryName');
            const newIconInput = document.getElementById('newCategoryIcon');
            const newPriorityInput = document.getElementById('newCategoryPriority');
            if (newNameInput) newNameInput.value = '';
            if (newIconInput) newIconInput.value = 'fas fa-folder';
            if (newPriorityInput) newPriorityInput.value = '100';
            newCategoryModal.show();
        });
    }
    if (saveNewCategoryBtn) saveNewCategoryBtn.addEventListener('click', saveNewCategory);
    if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
//    if (deleteBtn) deleteBtn.addEventListener('click', handleDelete);
    if (exportDataBtn) exportDataBtn.addEventListener('click', exportData);
    if (importDataBtn) importDataBtn.addEventListener('click', importData);
    if (searchBtn) searchBtn.addEventListener('click', () => localSearch(searchInput.value));
    if (searchInput) searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') localSearch(searchInput.value); });
    if (shortcutHint) shortcutHint.addEventListener('click', openAddModal);
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            openAddModal();
        }
    });
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
            const localNoticeModal = new bootstrap.Modal(document.getElementById('localNoticeModal'));
            localNoticeModal.show();
            localStorage.setItem('hasSeenLocalNotice', 'true');
        }
        const localTitle = document.getElementById('localTitle');
        const localBadge = document.getElementById('localBadge');
        const localModal = new bootstrap.Modal(document.getElementById('localNoticeModal'));
        function showLocalNotice() { localModal.show(); }
        if (localTitle) localTitle.addEventListener('click', showLocalNotice);
        if (localBadge) localBadge.addEventListener('click', showLocalNotice);
        initSearch();
    }).catch(err => console.error(err));

    // 快速新增分类
    const quickAddCategoryBtn = document.getElementById('quickAddCategoryBtn');
    if (quickAddCategoryBtn) {
        quickAddCategoryBtn.addEventListener('click', async () => {
            const catName = prompt('输入新分类名称:');
            if (!catName) return;
            const catIcon = prompt('输入图标 (Font Awesome 类名，默认 fas fa-folder):', 'fas fa-folder') || 'fas fa-folder';
            const catParent = prompt('上级分类名称 (留空为一级分类):', '') || null;
            const catPriority = parseInt(prompt('优先级 (数字越小越靠前，默认 100):', '100')) || 100;

            // 检查是否已存在
            if (allCategories.some(c => c.name === catName)) {
                alert('分类已存在');
                return;
            }
            const newCat = { name: catName, icon: catIcon, parent: catParent, priority: catPriority };
            await saveCategory(newCat);
            allCategories = await getAllCategories();
            // 刷新下拉框
            updateCategorySelect(catName);
            // 可选：刷新侧边栏
            renderCategoryTree();
            alert(`分类“${catName}”已创建`);
        });
    }
})();