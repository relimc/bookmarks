// common.js - 通用核心逻辑，包含 BookmarkApp 类及所有 UI 处理

// ---------- 全局工具函数 ----------
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe).replace(/[&<>]/g, function(m) {
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

function getDomainFavicon(url) {
    try {
        const u = new URL(url);
        return u.origin + '/favicon.ico';
    } catch {
        return null;
    }
}

// 搜索引擎配置（与之前相同）
const searchEngines = [
    { name: '本地搜索', iconClass: 'fas fa-search', type: 'local', url: '' },
    { name: '谷歌', iconClass: 'fab fa-google', type: 'web', url: 'https://www.google.com/search?q=' },
    { name: '百度', iconClass: 'fas fa-paw', type: 'web', url: 'https://www.baidu.com/s?wd=' },
    { name: '必应', iconClass: 'fab fa-microsoft', type: 'web', url: 'https://www.bing.com/search?q=' },
    { name: 'GitHub', iconClass: 'fab fa-github', type: 'web', url: 'https://github.com/search?q=' },
    { name: 'Bilibili', iconClass: 'fab fa-bilibili', type: 'web', url: 'https://search.bilibili.com/all?keyword=' }
];
let currentEngine = searchEngines[0];

// ---------- 分类树构建 ----------
function buildCategoryTreeFromObj(categoriesObj) {
    const nodes = {};
    for (let name in categoriesObj) {
        const cat = categoriesObj[name];
        nodes[name] = {
            name: name,
            icon: cat.icon || 'fas fa-folder',
            parent: cat.parent || null,
            priority: cat.priority || 100,
            children: []
        };
    }
    const roots = [];
    for (let name in nodes) {
        const node = nodes[name];
        if (node.parent && nodes[node.parent]) {
            nodes[node.parent].children.push(node);
        } else {
            roots.push(node);
        }
    }
    roots.sort((a,b) => (a.priority||100) - (b.priority||100));
    roots.forEach(root => root.children.sort((a,b) => (a.priority||100) - (b.priority||100)));
    return roots;
}

// 渲染分类树（依赖 window.allData.categories, window.activeCategoryKey, window.allDataExpanded）
function renderCategoryTree() {
    const categoriesObj = window.allData?.categories || {};
    const tree = buildCategoryTreeFromObj(categoriesObj);
    function applyExpanded(nodes) {
        for (let node of nodes) {
            node.expanded = window.allDataExpanded?.[node.name] || false;
            if (node.children) applyExpanded(node.children);
        }
    }
    applyExpanded(tree);

    function renderNode(node) {
        const hasChildren = node.children.length > 0;
        const isActive = (window.activeCategoryKey === node.name);
        const activeClass = isActive ? 'active' : '';

        let iconHtml = '';
        if (node.icon.startsWith('http') || node.icon.startsWith('data:')) {
            iconHtml = `<img src="${node.icon}" onerror="this.style.display='none'">`;
        } else {
            iconHtml = `<i class="${node.icon}"></i>`;
        }

        let arrowHtml = '';
        if (hasChildren) {
            const expandedClass = node.expanded ? ' expanded' : '';
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
            const expandedClass = node.expanded ? 'expanded' : '';
            html += `<div class="child-nodes ${expandedClass}">`;
            for (let child of node.children) {
                html += renderNode(child);
            }
            html += `</div>`;
        }
        html += `</div>`;
        return html;
    }

    const allNodeHtml = `
        <div class="tree-node">
            <div class="tree-node-content ${window.activeCategoryKey === null ? 'active' : ''}" data-category="__all__">
                <div class="node-inner">
                    <span class="node-icon"><i class="fas fa-home"></i></span>
                    <span class="node-name">全部</span>
                    <span class="expand-icon placeholder" style="visibility:hidden;">❯</span>
                </div>
            </div>
        </div>
    `;
    const recommendNodeHtml = `
        <div class="tree-node">
            <div class="tree-node-content ${window.activeCategoryKey === '__recommend__' ? 'active' : ''}" data-category="__recommend__">
                <div class="node-inner">
                    <span class="node-icon"><i class="fas fa-fire"></i></span>
                    <span class="node-name">推荐</span>
                    <span class="expand-icon placeholder" style="visibility:hidden;">❯</span>
                </div>
            </div>
        </div>
    `;

    let treeHtml = allNodeHtml + recommendNodeHtml;
    for (let root of tree) treeHtml += renderNode(root);
    const container = document.getElementById('categoryTree');
    if (container) container.innerHTML = treeHtml;

    // 绑定节点点击
    document.querySelectorAll('.tree-node-content').forEach(el => {
        el.addEventListener('click', (e) => {
            if (document.getElementById('sidebar')?.classList.contains('collapsed')) return;
            if (e.target.classList.contains('expand-icon')) return;
            const cat = el.dataset.category;
            if (!cat) return;
            if (cat === '__all__') { window.bookmarkApp?.setActiveCategory(null); return; }
            if (cat === '__recommend__') { window.bookmarkApp?.setActiveCategory('__recommend__'); return; }
            const hasChildren = Object.values(window.allData.categories).some(c => c.parent === cat);
            if (hasChildren) {
                if (!window.allDataExpanded) window.allDataExpanded = {};
                const isTopLevel = !window.allData.categories[cat]?.parent;
                if (isTopLevel) {
                    for (let key in window.allDataExpanded) {
                        const other = window.allData.categories[key];
                        if (other && !other.parent && key !== cat) window.allDataExpanded[key] = false;
                    }
                }
                window.allDataExpanded[cat] = !window.allDataExpanded[cat];
                renderCategoryTree();
            }
            window.bookmarkApp?.setActiveCategory(cat);
        });
    });
    document.querySelectorAll('.expand-icon').forEach(arrow => {
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            const nodeName = arrow.dataset.node;
            if (nodeName) {
                if (!window.allDataExpanded) window.allDataExpanded = {};
                window.allDataExpanded[nodeName] = !window.allDataExpanded[nodeName];
                renderCategoryTree();
            }
        });
    });
}

// 卡片渲染（依赖 renderSingleBookmarkCard 全局，后面定义）
function renderSingleBookmarkCard(b, lineconsToFA = {}) {
    let iconHtml = '';
    if (b.icon && (b.icon.startsWith('http') || b.icon.startsWith('data:') || b.icon.startsWith('/static/'))) {
        iconHtml = `<img src="${escapeHtml(b.icon)}" alt="icon" data-url="${escapeHtml(b.url)}" onerror="fallbackIcon(this, '${escapeHtml(b.url)}')">`;
    } else {
        const faClass = lineconsToFA[b.icon] || b.icon || 'fas fa-tag';
        iconHtml = `<i class="${faClass}"></i>`;
    }
    const title = escapeHtml(b.title || b.url);
    const desc = escapeHtml(b.description || '');
    const fullUrl = escapeHtml(b.url);
    const shortUrl = shortenUrl(b.url);
    let tagsHtml = '';
    if (b.tags && b.tags.length) {
        tagsHtml = '<div class="card-tags">' + b.tags.map(tag => `<span class="tag" onclick="event.stopPropagation(); window.bookmarkApp?.searchByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>`).join('') + '</div>';
    }
    return `<div class="card" onclick="window.open('${fullUrl}', '_blank'); window.bookmarkApp?.incrementClick(${b.id})">
                <button class="edit-btn" onclick="event.stopPropagation(); window.bookmarkApp?.openEditModal(${b.id})">✏️</button>
                <div class="card-body">
                    <div class="card-icon" onclick="event.stopPropagation(); window.bookmarkApp?.changeIcon(${b.id})">${iconHtml}</div>
                    <div class="card-content">
                        <div class="card-title-wrapper"><div class="card-title">${title}</div>${tagsHtml}</div>
                        ${desc ? `<div class="card-description">${desc}</div>` : ''}
                    </div>
                </div>
                <div class="card-toast">${shortUrl}</div>
            </div>`;
}
window.renderSingleBookmarkCard = renderSingleBookmarkCard;

window.fallbackIcon = function(img, url) {
    img.onerror = null;
    img.style.display = 'none';
    const parent = img.parentNode;
    if (!parent) return;
    const domainIcon = getDomainFavicon(url);
    if (domainIcon && domainIcon !== img.src) {
        const newImg = new Image();
        newImg.onload = () => { parent.innerHTML = ''; parent.appendChild(newImg); };
        newImg.onerror = () => { parent.innerHTML = '<i class="fas fa-tag"></i>'; };
        newImg.src = domainIcon;
    } else {
        parent.innerHTML = '<i class="fas fa-tag"></i>';
    }
};

// ---------- 全局搜索初始化 ----------
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const engineSelector = document.querySelector('.search-engine-selector');
    const engineDropdown = document.getElementById('engineDropdown');
    if (!searchInput || !searchBtn) return;

    function renderEngineDropdown() {
        if (!engineDropdown) return;
        let html = '';
        searchEngines.forEach(engine => {
            html += `<div class="engine-option" data-url="${engine.url}" data-iconclass="${engine.iconClass}" data-name="${engine.name}" data-type="${engine.type}">
                        <i class="${engine.iconClass} engine-icon-small"></i><span>${engine.name}</span>
                    </div>`;
        });
        engineDropdown.innerHTML = html;
        document.querySelectorAll('.engine-option').forEach(opt => {
            opt.addEventListener('click', function() {
                const name = this.dataset.name;
                const type = this.dataset.type;
                const iconClass = this.dataset.iconclass;
                document.getElementById('selectedEngineIcon').innerHTML = `<i class="${iconClass}"></i>`;
                currentEngine = searchEngines.find(e => e.name === name) || searchEngines[0];
                searchInput.placeholder = type === 'local' ? '点击左侧图标切换搜索引擎，可本地搜索' : `请输入关键字跳转至${name}搜索`;
                engineDropdown.classList.remove('show');
            });
        });
    }

    searchInput.placeholder = '点击左侧图标切换搜索引擎，可本地搜索';
    document.getElementById('selectedEngineIcon').innerHTML = `<i class="${searchEngines[0].iconClass}"></i>`;
    engineSelector?.addEventListener('click', (e) => {
        e.stopPropagation();
        engineDropdown?.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
        if (!engineSelector?.contains(e.target)) engineDropdown?.classList.remove('show');
    });
    function performSearch() {
        const query = searchInput.value.trim();
        if (currentEngine.type === 'local') {
            window.bookmarkApp?.localSearch(query);
        } else if (query) {
            window.open(currentEngine.url + encodeURIComponent(query), '_blank');
        }
    }
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); performSearch(); } });
    renderEngineDropdown();
}

function bindCommonEvents(app) {
    const collapseBtn = document.getElementById('collapseSidebarBtn');
    const sidebar = document.getElementById('sidebar');
    if (collapseBtn && sidebar) {
        collapseBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const icon = collapseBtn.querySelector('i');
            if (sidebar.classList.contains('collapsed')) icon.className = 'fas fa-chevron-right';
            else icon.className = 'fas fa-bars';
            if (sidebar.classList.contains('collapsed') && window.allDataExpanded) {
                Object.keys(window.allDataExpanded).forEach(k => window.allDataExpanded[k] = false);
                renderCategoryTree();
            }
        });
    }
    const shortcutHint = document.querySelector('.shortcut-hint');
    shortcutHint?.addEventListener('click', () => app?.openAddModal());
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            app?.openAddModal();
        }
    });
}

// ---------- BookmarkApp 类 ----------
class BookmarkApp {
    constructor(dataAdapter) {
        this.data = dataAdapter;
        this.activeCategoryKey = null;
        window.bookmarkApp = this; // 全局引用，供卡片点击等使用
        this.init();
    }

    async init() {
        // 绑定所有 UI 事件（模态框按钮、下拉菜单等）
        this.bindModalEvents();
        initSearch();
        bindCommonEvents(this);
        // 加载数据
        await this.loadData();
        // 新增分类弹窗图标选择器初始化（若存在）
        this.initNewCategoryIconSelector();
        // 分类列表搜索初始化
        this.initCategorySearch();
    }

    async loadData() {
        const { bookmarks, categories } = await this.data.getAllData();
        window.allData = { bookmarks, categories };
        if (!window.allDataExpanded) window.allDataExpanded = {};
        renderCategoryTree();
        this.setActiveCategory(this.activeCategoryKey || '__recommend__');
        // 额外刷新分类下拉框等（延迟一帧确保DOM渲染）
        setTimeout(() => {
            this.updateCategorySelect();
        }, 0);
    }

    setActiveCategory(cat) {
        this.activeCategoryKey = cat;
        window.activeCategoryKey = cat;
        renderCategoryTree();
        this.refreshBookmarks(cat);
    }

    refreshBookmarks(category) {
        const container = document.getElementById('bookmarkGrid');
        if (!container) return;
        let filtered = [...(window.allData.bookmarks || [])];
        if (category === '__recommend__') {
            filtered.sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0));
            filtered = filtered.slice(0, 30);
        } else if (category && category !== '__all__') {
            filtered = filtered.filter(b => b.category === category);
        }
        if (filtered.length === 0) {
            container.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签，点击“新增”添加</div>';
            return;
        }
        let html = '<div class="row g-3">';
        filtered.forEach(bookmark => {
            html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(bookmark)}</div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    localSearch(keyword) {
        const lower = keyword.toLowerCase();
        if (!lower) {
            this.refreshBookmarks(this.activeCategoryKey);
            return;
        }
        const matched = window.allData.bookmarks.filter(b => {
            const title = (b.title || '').toLowerCase();
            const desc = (b.description || '').toLowerCase();
            const tags = (b.tags || []).join(' ').toLowerCase();
            return title.includes(lower) || desc.includes(lower) || tags.includes(lower);
        });
        const container = document.getElementById('bookmarkGrid');
        if (!matched.length) {
            container.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">没有找到匹配的书签</div>';
            return;
        }
        let html = '<div class="row g-3">';
        matched.forEach(b => { html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`; });
        html += '</div>';
        container.innerHTML = html;
    }

    async incrementClick(id) {
        await this.data.incrementClick(id);
        // 重新加载数据以更新点击次数（可选更新本地缓存）
        await this.loadData();
    }

    async changeIcon(id) {
        const newIcon = prompt('输入新的图标 (Font Awesome 类名或图片URL)');
        if (!newIcon) return;
        await this.data.updateBookmark(id, { icon: newIcon });
        await this.loadData();
    }

    openAddModal() {
        // 清空表单，设置标题等
        document.getElementById('modalTitle').innerText = '📋 新增书签';
        document.getElementById('editingId').value = '';
        const urlInput = document.getElementById('urlInput');
        if (urlInput) {
            urlInput.value = '';
            urlInput.readOnly = false;
        }
        document.getElementById('titleInput').value = '';
        document.getElementById('descriptionInput').value = '';
        document.getElementById('bookmarkTags').value = '';
        this.updateCategorySelect();
        document.getElementById('categorySelect').value = '';
        document.getElementById('deleteBtn').style.display = 'none';
        document.getElementById('clipboardHint').innerText = '';
        const modal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
        modal.show();
        // 尝试读取剪贴板
        navigator.clipboard.readText().then(text => {
            if (text && urlInput) {
                urlInput.value = text;
                document.getElementById('clipboardHint').innerText = '✅ 已读取剪贴板';
                this.fetchMetadata(text);
            }
        }).catch(() => {});
    }

    openEditModal(id) {
        const item = window.allData.bookmarks.find(b => b.id === id);
        if (!item) return;
        document.getElementById('modalTitle').innerText = '✏️ 编辑书签';
        document.getElementById('editingId').value = id;
        const urlInput = document.getElementById('urlInput');
        urlInput.value = item.url;
        urlInput.readOnly = true;
        document.getElementById('titleInput').value = item.title || '';
        document.getElementById('descriptionInput').value = item.description || '';
        document.getElementById('bookmarkTags').value = (item.tags || []).join('/');
        this.updateCategorySelect(item.category);
        document.getElementById('categorySelect').value = item.category;
        document.getElementById('deleteBtn').style.display = 'block';
        document.getElementById('deleteBtn').onclick = () => this.handleDelete();
        const modal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
        modal.show();
    }

    async fetchMetadata(url) {
        // 在线版会调用后端，本地版不做真实抓取，仅占位
        const hint = document.getElementById('clipboardHint');
        hint.innerText = '✅ 已读取网址';
    }

    async handleDelete() {
        const id = parseInt(document.getElementById('editingId').value);
        if (!id || !confirm('确定删除？')) return;
        await this.data.deleteBookmark(id);
        const modal = bootstrap.Modal.getInstance(document.getElementById('bookmarkModal'));
        modal.hide();
        await this.loadData();
    }

    async handleSubmit() {
        const url = document.getElementById('urlInput').value.trim();
        if (!url) { alert('网址不能为空'); return; }
        const category = document.getElementById('categorySelect').value;
        if (!category) { alert('请选择分类'); return; }
        const title = document.getElementById('titleInput').value.trim() || url;
        const description = document.getElementById('descriptionInput').value.trim() || '';
        const tagsRaw = document.getElementById('bookmarkTags').value.trim();
        const tags = tagsRaw ? tagsRaw.split('/').map(t => t.trim()).filter(t => t) : [];
        let icon = '';
        const editingIdVal = document.getElementById('editingId').value;
        if (editingIdVal) {
            const original = window.allData.bookmarks.find(b => b.id === parseInt(editingIdVal));
            icon = original ? original.icon : '';
        } else {
            // 尝试从 origin 获取 favicon
            try { icon = new URL(url).origin + '/favicon.ico'; } catch { icon = ''; }
        }
        const bookmark = { url, category, title, description, tags, icon, clickCount: 0 };
        if (editingIdVal) {
            bookmark.id = parseInt(editingIdVal);
            await this.data.updateBookmark(bookmark.id, bookmark);
        } else {
            await this.data.addBookmark(bookmark);
        }
        const modal = bootstrap.Modal.getInstance(document.getElementById('bookmarkModal'));
        modal.hide();
        await this.loadData();
    }

    updateCategorySelect(selected = '') {
        const categorySelect = document.getElementById('categorySelect');
        if (!categorySelect) return;
        const cats = Object.keys(window.allData.categories || {}).sort();
        let html = '<option value="">-- 选择已有分类 --</option>';
        cats.forEach(c => {
            html += `<option value="${escapeHtml(c)}" ${c === selected ? 'selected' : ''}>${escapeHtml(c)}</option>`;
        });
        categorySelect.innerHTML = html;
    }

    // 分类管理相关
    async loadCategoryList() {
        const container = document.getElementById('categoryListContainer');
        if (!container) return;
        const cats = window.allData.categories || {};
        const sorted = Object.keys(cats).sort((a,b) => (cats[a].priority||100) - (cats[b].priority||100));
        let html = '';
        for (let name of sorted) {
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
        }
        container.innerHTML = html;
        // 绑定编辑/删除按钮事件
        document.querySelectorAll('.edit-category-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const name = btn.closest('tr').dataset.category;
                await this.editCategory(name);
            });
        });
        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const name = btn.closest('tr').dataset.category;
                await this.deleteCategoryHandler(name);
            });
        });
    }

    async editCategory(name) {
        const cat = window.allData.categories[name];
        const newName = prompt('新名称', name);
        if (newName && newName !== name) {
            if (window.allData.categories[newName]) { alert('分类已存在'); return; }
            // 更新所有书签的分类
            for (let b of window.allData.bookmarks) {
                if (b.category === name) {
                    b.category = newName;
                    await this.data.updateBookmark(b.id, b);
                }
            }
            await this.data.deleteCategory(name);
            cat.name = newName;
            name = newName;
        }
        const newIcon = prompt('图标类名或URL', cat.icon);
        if (newIcon) cat.icon = newIcon;
        const newParent = prompt('上级分类（留空为无）', cat.parent || '');
        cat.parent = newParent || null;
        const newPriority = parseInt(prompt('优先级（数字越小越靠前）', cat.priority || 100));
        if (!isNaN(newPriority)) cat.priority = newPriority;
        await this.data.addCategory(cat);
        await this.loadData();
        const manageModal = document.getElementById('categoryManageModal');
        if (manageModal && manageModal.classList.contains('show')) {
            this.loadCategoryList();
        }
    }

    async deleteCategoryHandler(name) {
        const hasChildren = Object.values(window.allData.categories).some(c => c.parent === name);
        const hasBookmarks = window.allData.bookmarks.some(b => b.category === name);
        if (hasChildren || hasBookmarks) {
            alert('请先删除子分类或移走书签');
            return;
        }
        if (confirm(`确定删除分类“${name}”吗？`)) {
            await this.data.deleteCategory(name);
            await this.loadData();
            const manageModal = document.getElementById('categoryManageModal');
            if (manageModal && manageModal.classList.contains('show')) {
                this.loadCategoryList();
            }
        }
    }

    async exportBookmarks() {
        const data = await this.data.exportData(); // 返回 { bookmarks, categories }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks_backup_${new Date().toISOString().slice(0,19).replace(/:/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async importBookmarksFromFile(file) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const content = ev.target.result;
            const fileName = file.name.toLowerCase();
            if (fileName.endsWith('.json')) {
                try {
                    const data = JSON.parse(content);
                    if (data.bookmarks && data.categories) {
                        await this.data.importData(data);
                        alert('导入成功');
                        await this.loadData();
                    } else alert('无效的 JSON 格式');
                } catch { alert('解析 JSON 失败'); }
            } else {
                // 解析 HTML 书签（复用原有逻辑）
                const result = this.parseBookmarkHtml(content);
                if (!result) { alert('无法解析 HTML 文件'); return; }
                await this.data.importData(result);
                alert('导入成功');
                await this.loadData();
            }
        };
        reader.readAsText(file);
    }

    parseBookmarkHtml(html) {
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

    // 模态框事件绑定
    bindModalEvents() {
        const addBookmarkDropdown = document.getElementById('addBookmarkDropdownItem');
        addBookmarkDropdown?.addEventListener('click', (e) => { e.preventDefault(); this.openAddModal(); });
        const importBookmarksDropdown = document.getElementById('importBookmarksDropdownItem');
        importBookmarksDropdown?.addEventListener('click', (e) => {
            e.preventDefault();
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.html,.htm,.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) await this.importBookmarksFromFile(file);
            };
            input.click();
        });
        const exportBookmarksDropdown = document.getElementById('exportBookmarksDropdownItem');
        exportBookmarksDropdown?.addEventListener('click', (e) => { e.preventDefault(); this.exportBookmarks(); });
        const addCategoryDropdown = document.getElementById('addCategoryDropdownItem');
        addCategoryDropdown?.addEventListener('click', (e) => {
            e.preventDefault();
            // 打开新增分类模态框，填充上级分类下拉框
            const parentSelect = document.getElementById('newCategoryParent');
            if (parentSelect) {
                const cats = Object.keys(window.allData.categories || {}).sort();
                let html = '<option value="">-- 无 --</option>';
                cats.forEach(c => html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`);
                parentSelect.innerHTML = html;
            }
            document.getElementById('newCategoryName').value = '';
            document.getElementById('newCatSelectedIconValue').value = 'fas fa-folder';
            document.getElementById('newCatSelectedIconPreview').innerHTML = '<i class="fas fa-folder"></i>';
            document.getElementById('newCatSelectedIconText').innerText = '请选择图标';
            document.getElementById('newCategoryPriority').value = '100';
            const modal = new bootstrap.Modal(document.getElementById('newCategoryModal'));
            modal.show();
        });
        const listCategoriesDropdown = document.getElementById('listCategoriesDropdownItem');
        listCategoriesDropdown?.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.loadData();
            await this.loadCategoryList();
            const searchInput = document.getElementById('categorySearchInput');
            if (searchInput) searchInput.value = '';
            const modal = new bootstrap.Modal(document.getElementById('categoryManageModal'));
            modal.show();
        });
        const submitBtn = document.getElementById('submitBtn');
        submitBtn?.addEventListener('click', () => this.handleSubmit());
        const confirmNewCategoryBtn = document.getElementById('confirmNewCategoryBtn');
        confirmNewCategoryBtn?.addEventListener('click', async () => {
            const name = document.getElementById('newCategoryName').value.trim();
            if (!name) { alert('请输入分类名称'); return; }
            const icon = document.getElementById('newCatSelectedIconValue').value || 'fas fa-folder';
            const parent = document.getElementById('newCategoryParent').value || null;
            const priority = parseInt(document.getElementById('newCategoryPriority').value) || 100;
            if (window.allData.categories[name]) { alert('分类已存在'); return; }
            await this.data.addCategory({ name, icon, parent, priority });
            const modal = bootstrap.Modal.getInstance(document.getElementById('newCategoryModal'));
            modal.hide();
            await this.loadData();
            const manageModal = document.getElementById('categoryManageModal');
            if (manageModal && manageModal.classList.contains('show')) {
                this.loadCategoryList();
            }
        });
    }

    initNewCategoryIconSelector() {
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
            opt.addEventListener('click', (e) => {
                const link = opt.dataset.link;
                if (link) {
                    // 跳转到外部链接，不关闭面板
                    window.open(link, '_blank');
                    return;
                }
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

    initCategorySearch() {
        const searchInput = document.getElementById('categorySearchInput');
        if (!searchInput) return;
        searchInput.addEventListener('input', () => {
            const keyword = searchInput.value.trim().toLowerCase();
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

    searchByTag(tag) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = tag;
        this.localSearch(tag);
    }
}

// 导出（全局）
window.BookmarkApp = BookmarkApp;