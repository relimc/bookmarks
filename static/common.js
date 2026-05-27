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
    { name: '搜索书签', iconClass: 'fas fa-search', type: 'local', url: '' },
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
    // 图标处理
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

    // 标签渲染
    // 标签处理：最多显示3个，超出显示 +N
    let tagsHtml = '';
    if (b.tags && b.tags.length) {
        const maxDisplay = 3;
        const visibleTags = b.tags.slice(0, maxDisplay);
        const remainingTags = b.tags.slice(maxDisplay);
        tagsHtml = '<div class="card-tags">';
        visibleTags.forEach(tag => {
            tagsHtml += `<span class="tag" onclick="event.stopPropagation(); window.bookmarkApp?.searchByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>`;
        });
        if (remainingTags.length > 0) {
            const remainingJson = encodeURIComponent(JSON.stringify(remainingTags));
            tagsHtml += `<span class="tag tag-more" data-remaining="${remainingJson}">+${remainingTags.length}</span>`;
        }
        tagsHtml += '</div>';
    }

    // 根据登录状态选择编辑按钮图标
    const isLoggedIn = window.isLoggedIn !== false; // 默认为 true（已登录或本地版）
    const editIcon = isLoggedIn ? '✏️' : 'ℹ️';

    return `<div class="card" onclick="window.open('${fullUrl}', '_blank'); window.bookmarkApp?.incrementClick(${b.id})">
                <button class="edit-btn" onclick="event.stopPropagation(); window.bookmarkApp?.openEditModal(${b.id})">${editIcon}</button>
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
                searchInput.placeholder = type === 'local' ? '点击左侧图标切换搜索引擎，默认搜索书签' : `请输入关键字跳转至${name}搜索`;
                engineDropdown.classList.remove('show');
            });
        });
    }

    searchInput.placeholder = '点击左侧图标切换搜索引擎，默认搜索书签';
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
    // 存储书签弹窗的状态
    _pendingBookmarkData = null;
    _pendingBookmarkIsEdit = false;

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
        // 初始化 tooltip
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.forEach(el => new bootstrap.Tooltip(el));
        // 为 .tag-more 添加悬浮显示剩余标签的功能
        this.initTagMoreTooltip();
        this.initEditCategoryIconSelector()
    }

    initTagMoreTooltip() {
        let tooltip = null;
        let hideTimeout = null;
        const self = this;

        function getTooltipContainer() {
            if (tooltip) return tooltip;
            const el = document.createElement('div');
            el.id = 'tag-more-tooltip';
            el.className = 'tag-more-tooltip';
            el.style.cssText = `
                position: absolute;
                background-color: #fff;
                border: 1px solid #ccc;
                border-radius: 8px;
                padding: 8px 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                max-width: 200px;
                display: none;
            `;
            document.body.appendChild(el);
            tooltip = el;

            // 鼠标进入浮层时取消隐藏定时器
            tooltip.addEventListener('mouseenter', () => {
                if (hideTimeout) clearTimeout(hideTimeout);
            });
            // 鼠标离开浮层时延迟隐藏
            tooltip.addEventListener('mouseleave', () => {
                hideTimeout = setTimeout(() => {
                    tooltip.style.display = 'none';
                }, 100);
            });
            return tooltip;
        }

        function showTooltip(target, remainingTags) {
            const container = getTooltipContainer();
            container.innerHTML = '';
            remainingTags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'tag tooltip-tag';
                tagSpan.textContent = tag;
                tagSpan.style.cssText = `
                    cursor: pointer;
                    margin: 2px;
                    display: inline-block;
                    background: #eef2f6;
                    border-radius: 12px;
                    padding: 2px 8px;
                    font-size: 0.75rem;
                `;
                tagSpan.onclick = (e) => {
                    e.stopPropagation();
                    self.searchByTag(tag);
                    container.style.display = 'none';
                };
                container.appendChild(tagSpan);
            });
            const rect = target.getBoundingClientRect();
            container.style.left = rect.left + 'px';
            container.style.top = (rect.bottom + window.scrollY + 5) + 'px';
            container.style.display = 'block';
        }

        // 监听 .tag-more 的鼠标进入
        document.body.addEventListener('mouseenter', (e) => {
            const target = e.target.closest('.tag-more');
            if (!target) return;
            const remainingEncoded = target.getAttribute('data-remaining');
            if (!remainingEncoded) return;
            let remaining = [];
            try {
                remaining = JSON.parse(decodeURIComponent(remainingEncoded));
            } catch (err) {
                console.error('解析剩余标签失败', err);
            }
            if (!remaining.length) return;
            if (hideTimeout) clearTimeout(hideTimeout);
            showTooltip(target, remaining);
        }, true);

        // 监听鼠标离开 .tag-more 时延迟隐藏浮层，但允许移动到浮层上
        document.body.addEventListener('mouseleave', (e) => {
            const target = e.target.closest('.tag-more');
            if (!target) return;
            const related = e.relatedTarget;
            const tooltipEl = getTooltipContainer();
            if (!tooltipEl.contains(related)) {
                hideTimeout = setTimeout(() => {
                    tooltipEl.style.display = 'none';
                }, 150);
            }
        }, true);
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

        // 推荐视图：按点击次数排序
        if (category === '__recommend__') {
            filtered.sort((a, b) => (b.click_count || 0) - (a.click_count || 0));
            filtered = filtered.slice(0, 30);
            if (filtered.length === 0) {
                container.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签，使用Ctrl+Shift+V快捷键添加</div>';
                return;
            }
            let html = '<div class="row g-3">';
            filtered.forEach(bookmark => {
                html += `<div class="col-12 col-md-6 col-lg-4">${window.renderSingleBookmarkCard(bookmark)}</div>`;
            });
            html += '</div>';
            container.innerHTML = html;
            return;
        }

        // 单个分类视图（包括子分类）
        if (category && category !== '__all__') {
            // 获取该分类及其所有子分类的名称列表
            const getChildrenNames = (catName) => {
                const children = Object.values(window.allData.categories).filter(c => c.parent === catName);
                let names = [catName];
                children.forEach(child => {
                    names = names.concat(getChildrenNames(child.name));
                });
                return names;
            };
            const includeCategories = getChildrenNames(category);
            filtered = filtered.filter(b => includeCategories.includes(b.category));
            if (filtered.length === 0) {
                container.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 这个分类下没有书签</div>';
                return;
            }
            let html = '<div class="row g-3">';
            filtered.forEach(bookmark => {
                html += `<div class="col-12 col-md-6 col-lg-4">${window.renderSingleBookmarkCard(bookmark)}</div>`;
            });
            html += '</div>';
            container.innerHTML = html;
            return;
        }

        // 全部分类视图：按一级分类分组
        // 获取所有一级分类（parent 为 null 或空字符串）
        const topCategories = Object.values(window.allData.categories)
            .filter(c => !c.parent || c.parent === '')
            .sort((a, b) => (a.priority || 100) - (b.priority || 100));

        // 如果没有书签，显示空状态
        if (filtered.length === 0) {
            container.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签，使用Ctrl+Shift+V快捷键添加</div>';
            return;
        }

        // 如果没有任何一级分类（理论上至少会有“未分类”），则直接平铺
        if (topCategories.length === 0) {
            let html = '<div class="row g-3">';
            filtered.forEach(bookmark => {
                html += `<div class="col-12 col-md-6 col-lg-4">${window.renderSingleBookmarkCard(bookmark)}</div>`;
            });
            html += '</div>';
            container.innerHTML = html;
            return;
        }

        // 构建分组：每个一级分类下，显示该分类及其所有子分类的书签
        const getChildrenNames = (catName) => {
            const children = Object.values(window.allData.categories).filter(c => c.parent === catName);
            let names = [catName];
            children.forEach(child => {
                names = names.concat(getChildrenNames(child.name));
            });
            return names;
        };

        let html = '';
        for (const topCat of topCategories) {
            const includeCategories = getChildrenNames(topCat.name);
            const groupBookmarks = filtered.filter(b => includeCategories.includes(b.category));
            if (groupBookmarks.length === 0) continue;

            // 分组标题
            const catIcon = topCat.icon && (topCat.icon.startsWith('http') || topCat.icon.startsWith('data:'))
                ? `<img src="${escapeHtml(topCat.icon)}" style="width: 20px; margin-right: 8px;">`
                : `<i class="${escapeHtml(topCat.icon || 'fas fa-folder')}" style="margin-right: 8px;"></i>`;
            html += `
                <div class="category-section">
                    <div class="category-section-title">
                        ${catIcon}
                        <span>${escapeHtml(topCat.name)}</span>
                    </div>
                    <div class="row g-3">
            `;
            groupBookmarks.forEach(bookmark => {
                html += `<div class="col-12 col-md-6 col-lg-4">${window.renderSingleBookmarkCard(bookmark)}</div>`;
            });
            html += `
                    </div>
                </div>
            `;
        }

        // 处理没有归属一级分类的书签（例如孤立分类？理论上不会，但保险）
        const orphanBookmarks = filtered.filter(b => {
            const cat = window.allData.categories[b.category];
            return !cat || cat.parent;
            // 若分类不存在或父级存在但父级不是顶层，则单独展示？实际上面已覆盖所有顶层及其子分类，孤儿不应存在。
        });
        if (orphanBookmarks.length > 0) {
            html += `
                <div class="category-section">
                    <div class="category-section-title">
                        <i class="fas fa-question-circle" style="margin-right: 8px;"></i>
                        <span>其他</span>
                    </div>
                    <div class="row g-3">
            `;
            orphanBookmarks.forEach(bookmark => {
                html += `<div class="col-12 col-md-6 col-lg-4">${window.renderSingleBookmarkCard(bookmark)}</div>`;
            });
            html += `</div></div>`;
        }

        if (html === '') {
            container.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签</div>';
        } else {
            container.innerHTML = html;
        }
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
            container.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">🔍 没有找到相关书签，试试其他关键词吧～</div>';
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
        // 若未登录且在线版需要登录，则提示登录（此逻辑已在 bindModalEvents 中调用前检查，此处可保留）
        if (!window.isLoggedIn && typeof this.showLoginRequired === 'function') {
            this.showLoginRequired();
            return;
        }

        const modal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
        const titleInput = document.getElementById('titleInput');
        const descInput = document.getElementById('descriptionInput');
        const tagsInput = document.getElementById('bookmarkTags');
        const urlInput = document.getElementById('urlInput');
        const isPrivateCheckbox = document.getElementById('isPrivateCheckbox');

        // 重置表单
        document.getElementById('modalTitle').innerText = '📋 新增书签';
        document.getElementById('editingId').value = '';
        if (urlInput) {
            urlInput.value = '';
            urlInput.readOnly = false;
        }
        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';
        if (tagsInput) tagsInput.value = '';

        // 重置分类下拉框并保存初始值
        this.updateCategorySelect();
        if (this.categorySelect) this.categorySelect.value = '';
        this._prevCategoryValue = '';

        // 删除按钮隐藏
        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) deleteBtn.style.display = 'none';
        // 私密复选框默认勾选
        if (isPrivateCheckbox) isPrivateCheckbox.checked = true;

        const hint = document.getElementById('clipboardHint');
        if (hint) hint.innerText = '';
        window.lastFetchedIcon = '';

        modal.show();

        // 尝试读取剪贴板
        navigator.clipboard.readText().then(text => {
            if (text && urlInput) {
                urlInput.value = text;
                if (hint) hint.innerText = '✅ 已读取剪贴板，正在获取网页信息...';
                this.fetchMetadata(text);
            } else if (hint) {
                hint.innerText = '⚠️ 剪贴板为空';
            }
        }).catch(() => {
            if (hint) hint.innerText = '⚠️ 无法读取剪贴板';
        });
    }

    openEditModal(id) {
        const item = window.allData.bookmarks.find(b => b.id === id);
        if (!item) return;
        const isLoggedIn = window.isLoggedIn !== false;
        const isOwner = (item.user_id === currentUserId); // 需要获取当前登录用户的ID


        const isOnline = window.isOnline === true;
        let showSharedBy = false;
        let sharedByUsername = '';

        if (isOnline) {
            // 仅在线版判断是否显示共享人
            const currentId = window.currentUserId;
            const isOwner = (currentId && item.user_id === currentId);
            if (!isOwner) {
                showSharedBy = true;
                sharedByUsername = item.username || '未知用户';
            }
        }

        // 获取共享人容器
        const sharedByContainer = document.getElementById('sharedByContainer');
        const sharedBySpan = document.getElementById('sharedByUsername');

        if (showSharedBy && sharedByContainer) {
            sharedByContainer.style.display = '';
            if (sharedBySpan) sharedBySpan.innerText = sharedByUsername;
        } else if (sharedByContainer) {
            sharedByContainer.style.display = 'none';
        }

        const modal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
        const titleInput = document.getElementById('titleInput');
        const descInput = document.getElementById('descriptionInput');
        const tagsInput = document.getElementById('bookmarkTags');
        const urlInput = document.getElementById('urlInput');
        const isPrivateCheckbox = document.getElementById('isPrivateCheckbox');
        const deleteBtn = document.getElementById('deleteBtn');
        const submitBtn = document.getElementById('submitBtn');
        const cancelBtn = document.querySelector('#bookmarkModal .btn-secondary');
        const modalFooter = document.querySelector('#bookmarkModal .modal-footer');
        let privateContainer = document.getElementById('privateCheckboxContainer');


        if (!privateContainer) {
            privateContainer = document.querySelector('#bookmarkModal .modal-footer .form-check');
        }
        const rightButtonGroup = document.querySelector('#bookmarkModal .modal-footer .d-flex.gap-2');

        // 清空可能存在的旧删除事件
        if (deleteBtn) deleteBtn.onclick = null;

        // 设置标题
        document.getElementById('modalTitle').innerText = isLoggedIn ? '✏️ 编辑书签' : 'ℹ️ 书签详情';
        document.getElementById('editingId').value = id;
        urlInput.value = item.url;
        urlInput.readOnly = true;
        titleInput.value = item.title || '';
        descInput.value = item.description || '';
        if (tagsInput) tagsInput.value = (item.tags || []).join('/');

        // 更新分类下拉框并选中当前分类
        this.updateCategorySelect(item.category);
        if (this.categorySelect) {
            this.categorySelect.value = item.category;
            this._prevCategoryValue = item.category;
        }

        // 私密复选框状态
        if (isPrivateCheckbox) {
            isPrivateCheckbox.checked = (item.status === 'private');
            isPrivateCheckbox.disabled = !isLoggedIn;
        }

        if (!isLoggedIn) {
            // 隐藏私密容器
            if (privateContainer) privateContainer.style.display = 'none';
            // 让右侧按钮组靠右
            if (rightButtonGroup) rightButtonGroup.classList.add('ms-auto');
            if (cancelBtn) cancelBtn.innerText = '关闭';
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (submitBtn) submitBtn.style.display = 'none';
        } else {
            if (privateContainer) privateContainer.style.display = '';
            if (rightButtonGroup) rightButtonGroup.classList.remove('ms-auto');
            if (cancelBtn) cancelBtn.innerText = '取消';
            const isEdit = !!document.getElementById('editingId').value;
            if (deleteBtn) deleteBtn.style.display = isEdit ? 'block' : 'none';
            if (submitBtn) submitBtn.style.display = 'block';
        }
        modal.show();
    }

    async fetchMetadata(url) {
        const hint = document.getElementById('clipboardHint');
        if (!hint) return;
        hint.innerText = '正在获取网页信息...';
        try {
            const res = await fetch('/fetch-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (data.success) {
                const titleInput = document.getElementById('titleInput');
                const descInput = document.getElementById('descriptionInput');
                const tagsInput = document.getElementById('bookmarkTags');
                if (titleInput) titleInput.value = data.title || '';
                if (descInput) descInput.value = data.description || '';
                // 后端已经完成随机，直接展示
                if (tagsInput && data.keywords && data.keywords.length) {
                    tagsInput.value = data.keywords.join('/');
                }
                window.lastFetchedIcon = data.icon || '';
                hint.innerText = '✅ 信息获取完成';
            } else {
                console.warn('抓取失败:', data.message || '未知错误');
                hint.innerText = '⚠️ 获取失败，请手动填写信息';
            }
        } catch (err) {
            console.error('Fetch metadata error:', err);
            hint.innerText = '⚠️ 网络错误，请手动填写信息';
        }
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
        if (!window.isLoggedIn) {
            this.showLoginRequired();
            return;
        }

        const url = document.getElementById('urlInput').value.trim();
        if (!url) { alert('网址不能为空'); return; }

        let category = document.getElementById('categorySelect').value;
        if (!category) {
            category = '未分类';
        }

        const title = document.getElementById('titleInput').value.trim() || url;
        const description = document.getElementById('descriptionInput').value.trim() || '';
        const tagsRaw = document.getElementById('bookmarkTags').value.trim();
        const tags = tagsRaw ? tagsRaw.split('/').map(t => t.trim()).filter(t => t) : [];

        const isPrivateCheckbox = document.getElementById('isPrivateCheckbox');
        const isPrivate = isPrivateCheckbox ? isPrivateCheckbox.checked : true;
        let status = isPrivate ? 'private' : 'public';

        // 公开书签的确认弹窗：仅对非管理员用户显示
        if (status === 'public') {
            if (!window.isAdmin) {
                if (!confirm('公开书签需管理员审核后，才能发布。是否确定提交审核？')) {
                    return;
                }
            }
            // 管理员直接通过，无需弹窗
        }

        let icon = '';
        const editingIdVal = document.getElementById('editingId').value;
        if (editingIdVal) {
            const original = window.allData.bookmarks.find(b => b.id === parseInt(editingIdVal));
            icon = original ? original.icon : '';
        } else {
            try { icon = new URL(url).origin + '/favicon.ico'; } catch { icon = ''; }
        }

        const bookmark = { url, category, title, description, tags, icon, clickCount: 0, status };

        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '保存中...';

        try {
            if (editingIdVal) {
                bookmark.id = parseInt(editingIdVal);
                await this.data.updateBookmark(bookmark.id, bookmark);
            } else {
                await this.data.addBookmark(bookmark);
            }
            const modal = bootstrap.Modal.getInstance(document.getElementById('bookmarkModal'));
            modal.hide();
            await this.loadData();
        } catch (err) {
            console.error(err);
            alert('保存失败：' + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    updateCategorySelect(selected = '') {
        if (!this.categorySelect) {
            this.categorySelect = document.getElementById('categorySelect');
        }
        const cats = Object.keys(window.allData.categories || {}).sort();
        let html = '<option value="">-- 选择已有分类 --</option>';
        cats.forEach(c => {
            html += `<option value="${escapeHtml(c)}" ${c === selected ? 'selected' : ''}>${escapeHtml(c)}</option>`;
        });
        this.categorySelect.innerHTML = html;
    }

    openEditCategoryModal(categoryName) {
        const cat = window.allData.categories[categoryName];
        if (!cat) return;

        // 关闭分类列表模态框（如果在打开状态）
        const categoryManageModalEl = document.getElementById('categoryManageModal');
        const categoryModal = bootstrap.Modal.getInstance(categoryManageModalEl);
        if (categoryModal) categoryModal.hide();

        // 记录原始分类名
        document.getElementById('editCategoryOriginalName').value = categoryName;
        document.getElementById('editCategoryName').value = cat.name;

        // 设置图标选择器
        const iconPreview = document.getElementById('editCatSelectedIconPreview');
        const iconText = document.getElementById('editCatSelectedIconText');
        const iconValue = document.getElementById('editCatSelectedIconValue');
        if (cat.icon) {
            if (cat.icon.startsWith('http') || cat.icon.startsWith('data:')) {
                iconPreview.innerHTML = `<img src="${cat.icon}" style="max-width:20px; max-height:20px;">`;
            } else {
                iconPreview.innerHTML = `<i class="${cat.icon}"></i>`;
            }
            iconText.innerText = cat.icon;
            iconValue.value = cat.icon;
        } else {
            iconPreview.innerHTML = '<i class="fas fa-folder"></i>';
            iconText.innerText = 'fas fa-folder';
            iconValue.value = 'fas fa-folder';
        }

        // 填充上级分类下拉框
        const parentSelect = document.getElementById('editCategoryParent');
        if (parentSelect) {
            const allCats = Object.keys(window.allData.categories || {}).filter(c => c !== categoryName);
            let html = '<option value="">-- 无 --</option>';
            allCats.sort().forEach(c => {
                html += `<option value="${escapeHtml(c)}" ${cat.parent === c ? 'selected' : ''}>${escapeHtml(c)}</option>`;
            });
            parentSelect.innerHTML = html;
        }

        // 优先级
        const priorityInput = document.getElementById('editCategoryPriority');
        if (priorityInput) priorityInput.value = cat.priority || 100;

        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
        modal.show();
    }

    openAddCategoryModal() {
        // 确保移除此前的任何残留背板
        this.removeModalBackdrop();
        // 填充上级分类下拉框...
        const parentSelect = document.getElementById('newCategoryParent');
        if (parentSelect) {
            const cats = Object.keys(window.allData.categories || {}).sort();
            let html = '<option value="">-- 无 --</option>';
            cats.forEach(c => html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`);
            parentSelect.innerHTML = html;
        }
        // 重置表单...
        const nameInput = document.getElementById('newCategoryName');
        if (nameInput) nameInput.value = '';
        const iconValue = document.getElementById('newCatSelectedIconValue');
        if (iconValue) iconValue.value = 'fas fa-folder';
        const iconPreview = document.getElementById('newCatSelectedIconPreview');
        if (iconPreview) iconPreview.innerHTML = '<i class="fas fa-folder"></i>';
        const iconText = document.getElementById('newCatSelectedIconText');
        if (iconText) iconText.innerText = '请选择图标';
        const priorityInput = document.getElementById('newCategoryPriority');
        if (priorityInput) priorityInput.value = '100';
        const modal = new bootstrap.Modal(document.getElementById('newCategoryModal'));
        modal.show();
    }

    removeModalBackdrop() {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
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
                this.openEditCategoryModal(name);
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
            if (window.allData.categories[newName]) {
                alert('分类已存在');
                return;
            }
            // 更新所有书签的分类引用
            for (let b of window.allData.bookmarks) {
                if (b.category === name) {
                    b.category = newName;
                    await this.data.updateBookmark(b.id, { category: newName });
                }
            }
            // 更新分类本身（调用 updateCategory 而不是 addCategory）
            await this.data.updateCategory(name, { new_name: newName });
            // 删除旧分类（如果后端 updateCategory 未自动处理重命名，则需要手动删除）
            // 但根据后端实现，updateCategory 路由支持重命名，所以我们只需刷新数据
            name = newName; // 更新变量以便后续修改其他属性
        }
        const newIcon = prompt('图标类名或URL', cat.icon);
        if (newIcon) cat.icon = newIcon;
        const newParent = prompt('上级分类（留空为无）', cat.parent || '');
        cat.parent = newParent || null;
        const newPriority = parseInt(prompt('优先级（数字越小越靠前）', cat.priority || 100));
        if (!isNaN(newPriority)) cat.priority = newPriority;
        // 更新分类属性（此时名称可能已变）
        await this.data.updateCategory(name, {
            icon: cat.icon,
            parent: cat.parent,
            priority: cat.priority
        });
        await this.loadData();
        // 刷新分类列表弹窗
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

    bindModalEvents() {
        // 新增书签
        const addBookmarkDropdown = document.getElementById('addBookmarkDropdownItem');
        if (addBookmarkDropdown) {
            addBookmarkDropdown.addEventListener('click', (e) => {
                e.preventDefault();
                if (!window.isLoggedIn) {
                    this.showLoginRequired();
                    return;
                }
                this.openAddModal();
            });
        }

        // 导入书签
        const importBookmarksDropdown = document.getElementById('importBookmarksDropdownItem');
        if (importBookmarksDropdown) {
            importBookmarksDropdown.addEventListener('click', (e) => {
                e.preventDefault();
                if (!window.isLoggedIn) {
                    this.showLoginRequired();
                    return;
                }
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.html,.htm,.json';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) await this.importBookmarksFromFile(file);
                };
                input.click();
            });
        }

        // 导出书签（增加登录检查）
        const exportBookmarksDropdown = document.getElementById('exportBookmarksDropdownItem');
        if (exportBookmarksDropdown) {
            exportBookmarksDropdown.addEventListener('click', (e) => {
                e.preventDefault();
                if (!window.isLoggedIn) {
                    this.showLoginRequired();
                    return;
                }
                this.exportBookmarks();
            });
        }

        // 新增分类
        const addCategoryDropdown = document.getElementById('addCategoryDropdownItem');
        if (addCategoryDropdown) {
            addCategoryDropdown.addEventListener('click', (e) => {
                e.preventDefault();
                if (!window.isLoggedIn) {
                    this.showLoginRequired();
                    return;
                }
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
        }

        // 分类列表（增加登录检查）
        const listCategoriesDropdown = document.getElementById('listCategoriesDropdownItem');
        if (listCategoriesDropdown) {
            listCategoriesDropdown.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!window.isLoggedIn) {
                    this.showLoginRequired();
                    return;
                }
                await this.loadData();
                await this.loadCategoryList();
                const searchInput = document.getElementById('categorySearchInput');
                if (searchInput) searchInput.value = '';
                const modal = new bootstrap.Modal(document.getElementById('categoryManageModal'));
                modal.show();
            });
        }

        // 保存书签的提交按钮
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                if (!window.isLoggedIn) {
                    this.showLoginRequired();
                    return;
                }
                this.handleSubmit();
            });
        }

        // 新增分类模态框中的确认按钮
        const confirmNewCategoryBtn = document.getElementById('confirmNewCategoryBtn');
        if (confirmNewCategoryBtn) {
            confirmNewCategoryBtn.addEventListener('click', async () => {
                const name = document.getElementById('newCategoryName').value.trim();
                if (!name) { alert('请输入分类名称'); return; }
                const icon = document.getElementById('newCatSelectedIconValue').value || 'fas fa-folder';
                const parent = document.getElementById('newCategoryParent').value || null;
                const priority = parseInt(document.getElementById('newCategoryPriority').value) || 100;

                if (window.allData.categories[name]) {
                    alert('分类已存在');
                    return;
                }

                try {
                    await this.data.addCategory({ name, icon, parent, priority });
                    await this.loadData();

                    const newCategoryModalEl = document.getElementById('newCategoryModal');
                    const newCategoryModal = bootstrap.Modal.getInstance(newCategoryModalEl);

                    if (this._pendingBookmarkData) {
                        this._pendingBookmarkData.category = name;
                        if (newCategoryModal) {
                            newCategoryModal.hide();
                            newCategoryModalEl.addEventListener('hidden.bs.modal', async () => {
                                await this.restoreBookmarkModal();
                            }, { once: true });
                        } else {
                            await this.restoreBookmarkModal();
                        }
                    } else {
                        if (newCategoryModal) newCategoryModal.hide();
                        // 如果分类列表弹窗打开，刷新它
                        const manageModal = document.getElementById('categoryManageModal');
                        if (manageModal && manageModal.classList.contains('show')) {
                            this.loadCategoryList();
                        }
                    }
                } catch (err) {
                    console.error(err);
                    alert('添加分类失败：' + err.message);
                }
            });
        }

        const quickAddCategoryBtn = document.getElementById('quickAddCategoryBtn');
        if (quickAddCategoryBtn) {
            quickAddCategoryBtn.addEventListener('click', () => {
                this.saveBookmarkModalState();
                const bookmarkModalEl = document.getElementById('bookmarkModal');
                const bookmarkModal = bootstrap.Modal.getInstance(bookmarkModalEl);
                if (bookmarkModal) {
                    bookmarkModal.hide();
                    // 等待书签弹窗完全关闭后再打开新增分类弹窗
                    bookmarkModalEl.addEventListener('hidden.bs.modal', () => {
                        this.openAddCategoryModal();
                    }, { once: true });
                } else {
                    this.openAddCategoryModal();
                }
            });
        }

        const confirmEditCategoryBtn = document.getElementById('confirmEditCategoryBtn');
        if (confirmEditCategoryBtn) {
            confirmEditCategoryBtn.addEventListener('click', async () => {
                const originalName = document.getElementById('editCategoryOriginalName').value;
                const newName = document.getElementById('editCategoryName').value.trim();
                if (!newName) { alert('分类名称不能为空'); return; }
                const icon = document.getElementById('editCatSelectedIconValue').value || 'fas fa-folder';
                const parent = document.getElementById('editCategoryParent').value || null;
                const priority = parseInt(document.getElementById('editCategoryPriority').value) || 100;

                try {
                    await this.data.updateCategory(originalName, {
                        new_name: newName !== originalName ? newName : undefined,
                        icon,
                        parent,
                        priority
                    });
                    await this.loadData();
                    const editModal = bootstrap.Modal.getInstance(document.getElementById('editCategoryModal'));
                    editModal.hide();

                    // 重新打开分类列表并刷新
                    await this.loadCategoryList();
                    const categoryManageModal = new bootstrap.Modal(document.getElementById('categoryManageModal'));
                    categoryManageModal.show();
                } catch (err) {
                    console.error(err);
                    alert('更新失败：' + err.message);
                }
            });
        }

    }

    // 保存书签弹窗当前状态（表单数据+编辑ID）
    saveBookmarkModalState() {
        this._pendingBookmarkData = {
            editingId: document.getElementById('editingId').value,
            url: document.getElementById('urlInput').value,
            title: document.getElementById('titleInput').value,
            description: document.getElementById('descriptionInput').value,
            tags: document.getElementById('bookmarkTags').value,
            category: document.getElementById('categorySelect').value,
            isPrivate: document.getElementById('isPrivateCheckbox')?.checked,
        };
        this._pendingBookmarkIsEdit = !!document.getElementById('editingId').value;
    }

    // 恢复书签弹窗状态（并刷新分类下拉框）
    async restoreBookmarkModal() {
        this.removeModalBackdrop();

        if (!this._pendingBookmarkData) return;
        // 重新打开书签弹窗
        const bookmarkModal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
        // 先设置表单值
        document.getElementById('editingId').value = this._pendingBookmarkData.editingId;
        document.getElementById('urlInput').value = this._pendingBookmarkData.url;
        document.getElementById('titleInput').value = this._pendingBookmarkData.title;
        document.getElementById('descriptionInput').value = this._pendingBookmarkData.description;
        document.getElementById('bookmarkTags').value = this._pendingBookmarkData.tags;
        // 更新分类下拉框（此时新分类已存在）
        await this.updateCategorySelect(this._pendingBookmarkData.category);
        document.getElementById('categorySelect').value = this._pendingBookmarkData.category;
        if (document.getElementById('isPrivateCheckbox')) {
            document.getElementById('isPrivateCheckbox').checked = this._pendingBookmarkData.isPrivate;
        }
        // 设置标题和按钮显示状态
        const isLoggedIn = window.isLoggedIn !== false;
        const isEdit = !!this._pendingBookmarkData.editingId;
        if (isEdit) {
            document.getElementById('modalTitle').innerText = isLoggedIn ? '✏️ 编辑书签' : 'ℹ️ 书签详情';
        } else {
            document.getElementById('modalTitle').innerText = '📋 新增书签';
        }
        const deleteBtn = document.getElementById('deleteBtn');
        const submitBtn = document.getElementById('submitBtn');
        const cancelBtn = document.querySelector('#bookmarkModal .btn-secondary');
        if (isLoggedIn && isEdit) {
            if (deleteBtn) deleteBtn.style.display = 'block';
            if (submitBtn) submitBtn.style.display = 'block';
            if (cancelBtn) cancelBtn.innerText = '取消';
            if (deleteBtn) deleteBtn.onclick = () => this.handleDelete();
        } else if (!isLoggedIn && isEdit) {
            // 只读模式
            // ... 已有逻辑
        } else {
            // 新增模式
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (submitBtn) submitBtn.style.display = 'block';
            if (cancelBtn) cancelBtn.innerText = '取消';
        }
        // 确保分类下拉框可用
        if (this.categorySelect) this.categorySelect.disabled = false;
        bookmarkModal.show();
        // 清空暂存数据
        this._pendingBookmarkData = null;
    }

    // 辅助方法：显示登录框（请确保该方法已添加到 BookmarkApp 类中）
    showLoginRequired() {
        const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
        loginModal.show();
    }

    // 初始化编辑分类弹窗中的图标选择器（与新增分类逻辑一致，仅ID前缀不同）
    initEditCategoryIconSelector() {
        const display = document.getElementById('editCatSelectedIconDisplay');
        const panel = document.getElementById('editCatIconDropdownPanel');
        if (!display || !panel) return;
        const caret = display.querySelector('.caret');
        const preview = document.getElementById('editCatSelectedIconPreview');
        const text = document.getElementById('editCatSelectedIconText');
        const iconValue = document.getElementById('editCatSelectedIconValue');
        const customInput = document.getElementById('editCatCustomIconInput');
        const applyBtn = document.getElementById('editCatApplyCustomIcon');

        // 显示/隐藏下拉面板
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

        // 预设图标选项点击
        panel.querySelectorAll('.icon-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const value = opt.dataset.value;
                const name = opt.dataset.name;
                // 如果是更多链接，跳转不更新图标值
                if (opt.dataset.link) {
                    window.open(opt.dataset.link, '_blank');
                    panel.classList.remove('show');
                    if (caret) caret.classList.remove('open');
                    return;
                }
                if (value) {
                    preview.innerHTML = opt.querySelector('i').cloneNode(true).outerHTML;
                    text.innerText = name || value;
                    iconValue.value = value;
                }
                panel.classList.remove('show');
                if (caret) caret.classList.remove('open');
            });
        });

        // 自定义图标
        if (applyBtn && customInput) {
            applyBtn.addEventListener('click', () => {
                const custom = customInput.value.trim();
                if (!custom) return;
                // 直接使用输入的值作为图标（支持类名或URL）
                let icon = custom;
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