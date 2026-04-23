(function() {

    // ---------- 搜索引擎配置 ----------
    const searchEngines = [
        { name: '本地搜索', iconClass: 'fas fa-search', type: 'local', url: '' },
        { name: '谷歌', iconClass: 'fab fa-google', type: 'web', url: 'https://www.google.com/search?q=' },
        { name: '百度', iconClass: 'fas fa-paw', type: 'web', url: 'https://www.baidu.com/s?wd=' },
        { name: '必应', iconClass: 'fab fa-microsoft', type: 'web', url: 'https://www.bing.com/search?q=' },
        { name: 'GitHub', iconClass: 'fab fa-github', type: 'web', url: 'https://github.com/search?q=' },
        { name: 'Bilibili', iconClass: 'fab fa-bilibili', type: 'web', url: 'https://search.bilibili.com/all?keyword=' },
    ];
    let currentEngine = searchEngines[0];

    // ---------- 数据库操作封装 ----------
    let db = null;
    const DB_NAME = 'BookmarkDB';
    const DB_VERSION = 2; // 版本号递增，避免冲突

    function renderEngineDropdown() {
        const dropdown = document.getElementById('engineDropdown');
        if (!dropdown) return;
        let html = '';
        searchEngines.forEach(engine => {
            html += `
                <div class="engine-option" data-url="${engine.url}" data-iconclass="${engine.iconClass}" data-name="${engine.name}" data-type="${engine.type}">
                    <i class="${engine.iconClass} engine-icon-small"></i>
                    <span>${engine.name}</span>
                </div>
            `;
        });
        dropdown.innerHTML = html;

        document.querySelectorAll('.engine-option').forEach(option => {
            option.addEventListener('click', function() {
                const url = this.dataset.url;
                const iconClass = this.dataset.iconclass;
                const name = this.dataset.name;
                const type = this.dataset.type;
                const selectedIcon = document.getElementById('selectedEngineIcon');
                selectedIcon.innerHTML = `<i class="${iconClass}"></i>`;
                selectedIcon.title = name;
                currentEngine = searchEngines.find(e => e.name === name) || searchEngines[0];
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.placeholder = type === 'local' ? '点击左侧图标切换搜索引擎，可本地搜索，快速找到书签' : `请输入关键字跳转至${name}搜索`;
                }
                document.getElementById('engineDropdown').classList.remove('show');
            });
        });
    }


    function initSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const engineSelector = document.querySelector('.search-engine-selector');
        const engineDropdown = document.getElementById('engineDropdown');

        if (!searchInput || !searchBtn) return;

        // 设置初始placeholder
        searchInput.placeholder = currentEngine.type === 'local' ? '点击左侧图标切换搜索引擎，可本地搜索，快速找到书签' : `请输入关键字跳转至${currentEngine.name}搜索`;
        const selectedEngineIcon = document.getElementById('selectedEngineIcon');
        selectedEngineIcon.innerHTML = `<i class="${searchEngines[0].iconClass}"></i>`;
        selectedEngineIcon.title = searchEngines[0].name;

        engineSelector.addEventListener('click', (e) => {
            e.stopPropagation();
            engineDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!engineSelector.contains(e.target)) {
                engineDropdown.classList.remove('show');
            }
        });

        function performSearch() {
            const query = searchInput.value.trim();
            if (currentEngine.type === 'local') {
                localSearch(query);
            } else {
                if (!query) return;
                const searchUrl = currentEngine.url + encodeURIComponent(query);
                window.open(searchUrl, '_blank');
            }
        }

        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });

        renderEngineDropdown();
    }



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
                // 初始化默认分类（仅在升级时执行一次）
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

    // ---------- 全局数据 ----------
    let allBookmarks = [];
    let allCategories = [];
    let activeCategoryKey = null;
    let allDataExpanded = {};

    // ---------- 辅助函数 ----------
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
        const container = document.getElementById('categoryTree');
        if (container) container.innerHTML = treeHtml;
        // 绑定点击事件
        document.querySelectorAll('.tree-node-content').forEach(el => {
            el.addEventListener('click', (e) => {
                // 如果点击的是箭头，由箭头事件处理，不重复处理
                if (e.target.classList.contains('expand-icon')) return;

                const cat = el.dataset.category;
                if (!cat) return;

                // 判断当前分类是否有子节点
                const node = allCategories.find(c => c.name === cat);
                const hasChildren = allCategories.some(c => c.parent === cat);
                if (hasChildren) {
                    // 切换展开状态
                    allDataExpanded[cat] = !allDataExpanded[cat];
                    // 重新渲染侧边栏
                    renderCategoryTree();
                    // 注意：重新渲染后会重新绑定事件，但当前执行栈结束后会重新绑定，无需额外操作
                }

                // 选中该分类（刷新右侧内容）
                setActiveCategory(cat);
            });
        });
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
            tagsHtml = '<div class="card-tags">';
            b.tags.forEach(tag => {
                tagsHtml += `<span class="tag" onclick="event.stopPropagation(); searchByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>`;
            });
            tagsHtml += '</div>';
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
        const container = document.getElementById('bookmarkGrid');
        if (!container) return;
        if (!allBookmarks.length) {
            container.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签，点击“新增”添加</div>';
            return;
        }
        let gridHtml = '<div class="row g-3">';
        allBookmarks.forEach(b => {
            gridHtml += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`;
        });
        gridHtml += '</div>';
        container.innerHTML = gridHtml;
    }

    function renderByCategory(category) {
        const filtered = category ? allBookmarks.filter(b => b.category === category) : allBookmarks;
        const container = document.getElementById('bookmarkGrid');
        if (!filtered.length) {
            container.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 这个分类下没有书签</div>';
            return;
        }
        let gridHtml = '<div class="row g-3">';
        filtered.forEach(b => {
            gridHtml += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`;
        });
        gridHtml += '</div>';
        container.innerHTML = gridHtml;
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
        const container = document.getElementById('bookmarkGrid');
        if (!filtered.length) {
            container.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">没有找到匹配的书签</div>';
            return;
        }
        let gridHtml = '<div class="row g-3">';
        filtered.forEach(b => {
            gridHtml += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`;
        });
        gridHtml += '</div>';
        container.innerHTML = gridHtml;
    }

    window.searchByTag = function(tag) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = tag;
        localSearch(tag);
    };

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

    // ---------- 书签弹窗 ----------
    const bookmarkModal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
    const categoryManageModal = new bootstrap.Modal(document.getElementById('categoryManageModal'));
    const newCategoryModal = new bootstrap.Modal(document.getElementById('newCategoryModal'));

    async function openAddModal() {
        document.getElementById('modalTitle').innerText = '📋 新增书签';
        document.getElementById('editingId').value = '';
        document.getElementById('urlInput').value = '';
        document.getElementById('titleInput').value = '';
        document.getElementById('descriptionInput').value = '';
        document.getElementById('tagsInput').value = '';
        const catSelect = document.getElementById('categorySelect');
        catSelect.innerHTML = '';
        allCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            catSelect.appendChild(option);
        });
        document.getElementById('deleteBtn').style.display = 'none';
        bookmarkModal.show();
    }

    window.openEditModal = async function(id) {
        const item = allBookmarks.find(b => b.id === id);
        if (!item) return;
        document.getElementById('modalTitle').innerText = '✏️ 编辑书签';
        document.getElementById('editingId').value = id;
        document.getElementById('urlInput').value = item.url;
        document.getElementById('titleInput').value = item.title || '';
        document.getElementById('descriptionInput').value = item.description || '';
        document.getElementById('tagsInput').value = (item.tags || []).join('/');
        const catSelect = document.getElementById('categorySelect');
        catSelect.innerHTML = '';
        allCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            if (cat.name === item.category) option.selected = true;
            catSelect.appendChild(option);
        });
        document.getElementById('deleteBtn').style.display = 'block';
        bookmarkModal.show();
    };

    async function handleDeleteBookmark() {
        const id = parseInt(document.getElementById('editingId').value);
        if (!confirm('确定删除？')) return;
        await deleteBookmark(id);
        allBookmarks = allBookmarks.filter(b => b.id !== id);
        bookmarkModal.hide();
        setActiveCategory(activeCategoryKey);
    }

    async function handleSubmitBookmark() {
        const id = document.getElementById('editingId').value;
        const url = document.getElementById('urlInput').value.trim();
        if (!url) { alert('网址不能为空'); return; }
        const category = document.getElementById('categorySelect').value;
        const title = document.getElementById('titleInput').value.trim() || url;
        const description = document.getElementById('descriptionInput').value.trim();
        const tagsRaw = document.getElementById('tagsInput').value.trim();
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
        bookmarkModal.hide();
        setActiveCategory(activeCategoryKey);
    }

    // ---------- 分类管理 ----------
    async function loadCategoryList() {
        const tbody = document.getElementById('categoryListContainer');
        tbody.innerHTML = '';
        const tree = buildCategoryTree(allCategories);
        const flat = [];
        function flatten(node) {
            flat.push(node);
            node.children.forEach(flatten);
        }
        tree.forEach(flatten);
        flat.forEach(node => {
            const row = tbody.insertRow();
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
        const name = document.getElementById('newCategoryName').value.trim();
        if (!name) { alert('请输入名称'); return; }
        if (allCategories.some(c => c.name === name)) { alert('分类已存在'); return; }
        const icon = document.getElementById('newCategoryIcon').value.trim() || 'fas fa-folder';
        const parent = document.getElementById('newCategoryParent').value || null;
        const priority = parseInt(document.getElementById('newCategoryPriority').value) || 100;
        const newCat = { name, icon, parent, priority };
        await saveCategory(newCat);
        allCategories = await getAllCategories();
        newCategoryModal.hide();
        loadCategoryList();
        renderCategoryTree();
        setActiveCategory(activeCategoryKey);
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

    function parseBookmarkHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const rootDL = doc.querySelector('dl');
        if (!rootDL) return null;

        const categories = []; // { name, icon, parent, priority }
        const bookmarks = [];   // { url, title, description, category, tags, icon, clickCount }

        function parseNode(node, currentPath = []) {
            for (let child of node.children) {
                if (child.tagName === 'DT') {
                    const h3 = child.querySelector(':scope > H3');
                    if (h3) {
                        const folderName = h3.textContent.trim();
                        const fullPath = [...currentPath, folderName];
                        const parent = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
                        // 分类去重（不同路径可能同名，这里简单按名称去重，但更严谨应使用路径）
                        if (!categories.some(c => c.name === folderName && c.parent === parent)) {
                            categories.push({
                                name: folderName,
                                icon: 'fas fa-folder',
                                parent: parent,
                                priority: 100
                            });
                        }
                        const dl = child.querySelector(':scope > DL');
                        if (dl) {
                            parseNode(dl, fullPath);
                        }
                    } else {
                        const a = child.querySelector(':scope > A');
                        if (a) {
                            const url = a.href;
                            const title = a.textContent.trim();
                            const icon = a.getAttribute('ICON') || '';
                            const addDate = a.getAttribute('ADD_DATE');
                            if (url && url.startsWith('http')) {
                                const category = currentPath.length > 0 ? currentPath[currentPath.length - 1] : '未分类';
                                bookmarks.push({
                                    url: url,
                                    title: title || url,
                                    description: '',
                                    category: category,
                                    tags: [],
                                    icon: icon,
                                    clickCount: 0
                                });
                            }
                        }
                    }
                }
            }
        }

        parseNode(rootDL);
        // 确保至少有一个“未分类”分类
        if (!categories.some(c => c.name === '未分类')) {
            categories.push({ name: '未分类', icon: 'fas fa-folder', parent: null, priority: 100 });
        }
        return { categories, bookmarks };
    }

    function importData() {
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
                    // JSON 导入：合并数据，不清空原有
                    try {
                        const data = JSON.parse(content);
                        if (data.bookmarks && data.categories) {
                            // 合并分类
                            const existingCats = await getAllCategories();
                            const mergedCats = mergeCategories(existingCats, data.categories);
                            const categoryMap = buildCategoryMap(mergedCats); // 名称映射（用于书签）
                            // 合并书签（去重基于 url + category? 简单起见，直接追加，不去重）
                            const existingBookmarks = await getAllBookmarks();
                            const newBookmarks = [...existingBookmarks];
                            for (let b of data.bookmarks) {
                                // 将书签的 category 映射到已存在的分类名
                                b.category = categoryMap[b.category] || b.category;
                                if (!b.id) b.id = Date.now() + Math.random();
                                newBookmarks.push(b);
                            }
                            // 保存合并后的分类和书签
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
                    // HTML 导入：合并，处理冲突
                    const result = parseBookmarkHtml(content);
                    if (!result) {
                        alert('无法解析 HTML 文件，请确保是浏览器导出的书签文件');
                        return;
                    }
                    const { categories: htmlCats, bookmarks: htmlBookmarks } = result;
                    // 获取现有分类
                    const existingCats = await getAllCategories();
                    // 合并分类（同名同父级复用）
                    const mergedCats = mergeCategories(existingCats, htmlCats);
                    const categoryMap = buildCategoryMap(mergedCats);
                    // 合并书签
                    const existingBookmarks = await getAllBookmarks();
                    const newBookmarks = [...existingBookmarks];
                    for (let b of htmlBookmarks) {
                        b.category = categoryMap[b.category] || b.category;
                        if (!b.id) b.id = Date.now() + Math.random();
                        newBookmarks.push(b);
                    }
                    // 保存
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

    // 合并分类：保留现有分类，将新分类中不冲突的加入，冲突的则保留原有
    function mergeCategories(existing, incoming) {
        const map = new Map();
        existing.forEach(cat => map.set(`${cat.name}|${cat.parent || ''}`, cat));
        incoming.forEach(cat => {
            const key = `${cat.name}|${cat.parent || ''}`;
            if (!map.has(key)) {
                map.set(key, { ...cat, id: undefined }); // 去除id（如果有）
            }
        });
        return Array.from(map.values());
    }

    // 构建从原始分类名到最终分类名的映射（用于书签重定向）
    function buildCategoryMap(categories) {
        const map = {};
        categories.forEach(cat => {
            map[cat.name] = cat.name;
        });
        return map;
    }

    // ---------- 数据刷新 ----------
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

    // ---------- 事件绑定 ----------
    document.getElementById('addBookmarkHeaderBtn')?.addEventListener('click', openAddModal);
    document.getElementById('manageCategoriesBtn')?.addEventListener('click', () => {
        loadCategoryList();
        categoryManageModal.show();
    });
    document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
        document.getElementById('newCategoryName').value = '';
        document.getElementById('newCategoryIcon').value = 'fas fa-folder';
        document.getElementById('newCategoryPriority').value = '100';
        newCategoryModal.show();
    });
    document.getElementById('saveNewCategoryBtn')?.addEventListener('click', saveNewCategory);
    document.getElementById('submitBtn')?.addEventListener('click', handleSubmitBookmark);
    document.getElementById('deleteBtn')?.addEventListener('click', handleDeleteBookmark);
    document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
    document.getElementById('importDataBtn')?.addEventListener('click', importData);
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    searchBtn?.addEventListener('click', () => localSearch(searchInput.value));
    searchInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') localSearch(searchInput.value); });
    const collapseBtn = document.getElementById('collapseSidebarBtn');
    const sidebar = document.getElementById('sidebar');
    const shortcutHint = document.getElementById('shortcutHint');
    if (shortcutHint) {
        shortcutHint.addEventListener('click', openAddModal);
    }


    collapseBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const icon = collapseBtn.querySelector('i');
        if (sidebar.classList.contains('collapsed')) icon.className = 'fas fa-chevron-right';
        else icon.className = 'fas fa-bars';
    });

    // 添加快捷键 Ctrl+Shift+V 打开新增书签弹窗
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            openAddModal();
        }
    });

    // 初始化
    openDB().then(async () => {
        await refreshData();
        // 显示本地版说明（仅首次访问）
        const hasSeenLocalNotice = localStorage.getItem('hasSeenLocalNotice');
        if (!hasSeenLocalNotice) {
            const noticeModal = new bootstrap.Modal(document.getElementById('localNoticeModal'));
            noticeModal.show();
            localStorage.setItem('hasSeenLocalNotice', 'true');
        }
        // 本地版徽章和标题点击，打开提示模态框
        const localTitle = document.getElementById('localTitle');
        const localBadge = document.getElementById('localBadge');
        const localModal = new bootstrap.Modal(document.getElementById('localNoticeModal'));

        function showLocalNotice() {
            localModal.show();
        }

        if (localTitle) localTitle.addEventListener('click', showLocalNotice);
        if (localBadge) localBadge.addEventListener('click', showLocalNotice);
        initSearch();
    }).catch(err => console.error(err));
})();