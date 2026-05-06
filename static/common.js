// common.js - 两个版本共用的核心逻辑（渲染、搜索、分类树等）

// 初始化全局变量（供各版本设置）
window.allData = window.allData || { bookmarks: [], categories: {} };
window.activeCategoryKey = window.activeCategoryKey || null;
window.allDataExpanded = window.allDataExpanded || {};

// ---------- 工具函数 ----------
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

// ---------- 分类树构建 ----------
function buildCategoryTree() {
    const categories = window.allData.categories || {};
    const nodes = {};
    for (let name in categories) {
        nodes[name] = {
            name: name,
            icon: categories[name].icon || 'fas fa-folder',
            parent: categories[name].parent || null,
            priority: categories[name].priority || 100,
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

// ---------- 渲染分类树 ----------
function renderCategoryTree() {
    const tree = buildCategoryTree();
    function applyExpanded(nodes) {
        for (let node of nodes) {
            node.expanded = window.allDataExpanded[node.name] || false;
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
            if (cat === '__all__') { setActiveCategory(null); return; }
            if (cat === '__recommend__') { setActiveCategory('__recommend__'); return; }
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
            setActiveCategory(cat);
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

// ---------- 卡片渲染 ----------
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
        tagsHtml = '<div class="card-tags">' + b.tags.map(tag => `<span class="tag" onclick="event.stopPropagation(); searchByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>`).join('') + '</div>';
    }
    return `<div class="card" onclick="window.open('${fullUrl}', '_blank'); incrementClick(${b.id})">
                <button class="edit-btn" onclick="event.stopPropagation(); openEditModal(${b.id})">✏️</button>
                <div class="card-body">
                    <div class="card-icon" onclick="event.stopPropagation(); changeIcon(${b.id})">${iconHtml}</div>
                    <div class="card-content">
                        <div class="card-title-wrapper"><div class="card-title">${title}</div>${tagsHtml}</div>
                        ${desc ? `<div class="card-description">${desc}</div>` : ''}
                    </div>
                </div>
                <div class="card-toast">${shortUrl}</div>
            </div>`;
}

// ---------- 设置活动分类 ----------
function setActiveCategory(cat) {
    window.activeCategoryKey = cat;
    renderCategoryTree();
    // 刷新右侧内容（需由各版本实现 refreshBookmarks）
    if (typeof refreshBookmarks === 'function') refreshBookmarks(cat);
}

// ---------- 本地搜索 ----------
function localSearch(keyword) {
    const lower = keyword.toLowerCase();
    const old = document.querySelector('.search-results');
    if (old) old.remove();
    if (!lower) {
        if (typeof refreshBookmarks === 'function') refreshBookmarks(window.activeCategoryKey);
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
    matched.forEach(b => { html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b, window.lineconsToFA || {})}</div>`; });
    html += '</div>';
    container.innerHTML = html;
}

// ---------- 公共事件绑定 ----------
function bindCommonEvents() {
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
    if (shortcutHint) shortcutHint.addEventListener('click', () => window.openAddModal?.());
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            if (window.openAddModal) window.openAddModal();
        }
    });
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
            document.getElementById('selectedEngineIcon').innerHTML = `<i class="${iconClass}"></i>`;
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
    searchInput.placeholder = '点击左侧图标切换搜索引擎，可本地搜索，快速找到书签';
    document.getElementById('selectedEngineIcon').innerHTML = `<i class="${searchEngines[0].iconClass}"></i>`;
    engineSelector?.addEventListener('click', (e) => {
        e.stopPropagation();
        engineDropdown.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
        if (!engineSelector.contains(e.target)) engineDropdown.classList.remove('show');
    });
    function performSearch() {
        const query = searchInput.value.trim();
        if (currentEngine.type === 'local') localSearch(query);
        else if (query) window.open(currentEngine.url + encodeURIComponent(query), '_blank');
    }
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); performSearch(); } });
    renderEngineDropdown();
}

// ---------- 全局 fallbackIcon ----------
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

// 初始化公共部分
document.addEventListener('DOMContentLoaded', () => {
    initSearch();
    bindCommonEvents();
});

// ---------- 暴露给全局（供各版本调用）----------
window.renderCategoryTree = renderCategoryTree;
window.setActiveCategory = setActiveCategory;
window.buildCategoryTree = buildCategoryTree;
window.localSearch = localSearch;
window.escapeHtml = escapeHtml;
window.shortenUrl = shortenUrl;
window.getDomainFavicon = getDomainFavicon;
window.renderSingleBookmarkCard = renderSingleBookmarkCard;