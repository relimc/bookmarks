// common.js - 通用核心逻辑，包含 BookmarkApp 类及所有 UI 处理

// 确保 i18n.js 已加载
if (typeof t === 'undefined') {
    console.error('i18n.js not loaded');
}

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
    { name: 'Google', iconClass: 'fab fa-google', type: 'web', url: 'https://www.google.com/search?q=' },
    { name: 'Baidu', iconClass: 'fas fa-paw', type: 'web', url: 'https://www.baidu.com/s?wd=' },
    { name: 'Bing', iconClass: 'fab fa-microsoft', type: 'web', url: 'https://www.bing.com/search?q=' },
    { name: 'GitHub', iconClass: 'fab fa-github', type: 'web', url: 'https://github.com/search?q=' },
    { name: 'Bilibili', iconClass: 'fab fa-bilibili', type: 'web', url: 'https://search.bilibili.com/all?keyword=' },
    { name: 'YouTube', iconClass: 'fab fa-youtube', type: 'web', url: 'https://www.youtube.com/results?search_query=' },
    { name: 'Yandex', iconClass: 'fab fa-yandex-international', type: 'web', url: 'https://yandex.com/search/?text=' }
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

function renderShortcutHint() {
    const hintContainer = document.getElementById('shortcutHint');
    if (!hintContainer) return;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? '⌘' : t('ctrl_key');
    const shiftKey = '⇧';
    const vKey = 'V';

    let hintText = t('add_bookmark_shortcut')
        .replace('{{ctrl}}', ctrlKey)
        .replace('{{shift}}', shiftKey)
        .replace('{{v}}', vKey);

    // 对于非Mac系统，使用文字样式
    if (!isMac) {
        hintContainer.innerHTML = `
            <span class="hint-text">
                <kbd>${t('ctrl_key')}</kbd>+<kbd>${t('shift_key')}</kbd>+<kbd>${t('v_key')}</kbd> ${t('add_bookmark')}
            </span>
            <span class="hint-icon"><i class="fas fa-lightbulb"></i></span>
        `;
    } else {
        hintContainer.innerHTML = `
            <span class="hint-text">
                ${ctrlKey} ${shiftKey} ${vKey} ${t('add_bookmark')}
            </span>
            <span class="hint-icon"><i class="fas fa-lightbulb"></i></span>
        `;
    }
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

    // ============================================================
    // 标签展示逻辑：最多显示 3 个，多余的用 +N 显示
    // ============================================================
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
            const remainingJson = JSON.stringify(remainingTags);
            const safeRemaining = remainingJson.replace(/"/g, '&quot;');
            tagsHtml += `<span class="tag tag-more" data-remaining='${safeRemaining}'>+${remainingTags.length}</span>`;
        }
        tagsHtml += '</div>';
    }

    const isLoggedIn = window.isLoggedIn !== false;
    const editIcon = isLoggedIn ? '✏️' : 'ℹ️';

    return `<div class="card" onclick="window.open('${fullUrl}', '_blank'); window.bookmarkApp?.incrementClick('${b.id}')">
                <button class="edit-btn" onclick="event.stopPropagation(); window.bookmarkApp?.openEditModal('${b.id}')">${editIcon}</button>
                <div class="card-body">
                    <div class="card-icon" onclick="event.stopPropagation(); window.bookmarkApp?.changeIcon('${b.id}')">${iconHtml}</div>
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

function updateSearchPlaceholder() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    if (currentEngine && currentEngine.type === 'local') {
        searchInput.placeholder = t('search_placeholder');
    } else if (currentEngine) {
        // 获取搜索引擎显示名称
        let engineDisplayName = currentEngine.name;
        if (currentEngine.name === '谷歌') engineDisplayName = 'Google';
        else if (currentEngine.name === '百度') engineDisplayName = 'Baidu';
        else if (currentEngine.name === '必应') engineDisplayName = 'Bing';
        else if (currentEngine.name === 'GitHub') engineDisplayName = 'GitHub';
        else if (currentEngine.name === 'Bilibili') engineDisplayName = 'Bilibili';
        else if (currentEngine.name === 'YouTube') engineDisplayName = 'YouTube';
        else if (currentEngine.name === 'Yandex') engineDisplayName = 'Yandex';

        // 英文模式下不需要添加"搜索"后缀，中文需要
        const currentLang = getCurrentLang();
        if (currentLang === 'zh') {
            searchInput.placeholder = `请输入关键字跳转至${engineDisplayName}搜索`;
        } else {
            searchInput.placeholder = `Enter keyword to search on ${engineDisplayName}`;
        }
    } else {
        searchInput.placeholder = t('search_placeholder');
    }
}

// ---------- 全局搜索初始化 ----------
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const engineSelector = document.querySelector('.search-engine-selector');
    const engineDropdown = document.getElementById('engineDropdown');
    if (!searchInput || !searchBtn) return;

    // 渲染搜索引擎下拉菜单（支持多语言）
    function renderEngineDropdown() {
        if (!engineDropdown) return;
        let html = '';
        searchEngines.forEach(engine => {
            let engineName = engine.name;
            // 根据当前语言翻译引擎名称
            if (engine.name === '搜索书签') {
                engineName = t('search_bookmarks');
            } else if (engine.name === '谷歌') {
                engineName = 'Google';
            } else if (engine.name === '百度') {
                engineName = 'Baidu';
            } else if (engine.name === '必应') {
                engineName = 'Bing';
            } else if (engine.name === 'GitHub') {
                engineName = 'GitHub';
            } else if (engine.name === 'Bilibili') {
                engineName = 'Bilibili';
            } else if (engine.name === 'YouTube') {
                engineName = 'YouTube';
            } else if (engine.name === 'Yandex') {
                engineName = 'Yandex';
            }
            html += `<div class="engine-option" data-url="${engine.url}" data-iconclass="${engine.iconClass}" data-name="${engine.name}" data-type="${engine.type}">
                        <i class="${engine.iconClass} engine-icon-small"></i><span>${engineName}</span>
                    </div>`;
        });
        engineDropdown.innerHTML = html;

        // 重新绑定点击事件
        document.querySelectorAll('.engine-option').forEach(opt => {
            opt.addEventListener('click', function() {
                const name = this.dataset.name;
                const type = this.dataset.type;
                const iconClass = this.dataset.iconclass;
                document.getElementById('selectedEngineIcon').innerHTML = `<i class="${iconClass}"></i>`;
                currentEngine = searchEngines.find(e => e.name === name) || searchEngines[0];
                updateSearchPlaceholder();
                engineDropdown.classList.remove('show');
            });
        });
    }

    // 暴露到全局，供语言切换时调用
    window.renderEngineDropdown = renderEngineDropdown;

    // 设置初始 placeholder
    currentEngine = searchEngines[0];
    updateSearchPlaceholder();
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
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });

    // 初始化渲染
    renderEngineDropdown();
}

// 语言切换功能
function initLanguageSwitcher() {
    const langBtn = document.getElementById('langSwitcherBtn');
    const langDropdown = document.getElementById('langDropdown');
    const currentLangText = document.getElementById('currentLangText');

    if (!langBtn || !langDropdown) return;

    // 更新当前语言显示
    function updateLangDisplay() {
        const langNames = { zh: '中文', en: 'English' };
        if (currentLangText) currentLangText.innerText = langNames[currentLang] || '中文';
    }

    // 切换语言
    function switchLanguage(lang) {
        if (setLanguage(lang)) {
            // 更新语言显示
            updateLangDisplay();
            updatePageText();
            updatePageTitle();
            updateSearchPlaceholder();

            // 重新渲染搜索引擎下拉菜单
            if (typeof window.renderEngineDropdown === 'function') {
                window.renderEngineDropdown();
            }

            // 重新初始化所有 Bootstrap Tooltip
            document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
                const tooltip = bootstrap.Tooltip.getInstance(el);
                if (tooltip) {
                    tooltip.dispose();
                }
                new bootstrap.Tooltip(el);
            });

            // 刷新书签网格（无条件刷新，传入当前激活的分类 key，可能为 null）
            if (window.bookmarkApp) {
                window.bookmarkApp.refreshBookmarks(window.bookmarkApp.activeCategoryKey);
            }

            // 更新用户状态按钮
            if (typeof updateUserStatusButton === 'function') {
                updateUserStatusButton();
            }

            // 更新分类弹窗的输入框顺序和占位符
            if (window.bookmarkApp && typeof window.bookmarkApp.updateCategoryModalPlaceholders === 'function') {
                window.bookmarkApp.updateCategoryModalPlaceholders();
            }

            const batchModal = document.getElementById('batchAddModal');
            if (batchModal && batchModal.classList.contains('show') && window.bookmarkApp) {
                window.bookmarkApp.batchUpdateCategorySelect(
                    document.getElementById('batchCategorySelect')?.value || ''
                );
            }

            // ============================================================
            // ★★★ 关键修改：使用 window.bookmarkApp 调用实例方法 ★★★
            // ============================================================

            // 1. 刷新侧边栏分类树（使用实例方法）
            if (window.bookmarkApp && typeof window.bookmarkApp.renderCategoryTree === 'function') {
                window.bookmarkApp.renderCategoryTree();
            }

            // 2. 刷新书签弹窗中的分类下拉框
            if (window.bookmarkApp && typeof window.bookmarkApp.updateCategorySelect === 'function') {
                const currentSelected = document.getElementById('categorySelect')?.value || '';
                window.bookmarkApp.updateCategorySelect(currentSelected);
            }

            // 3. 刷新书签网格
            if (window.bookmarkApp && window.bookmarkApp.activeCategoryKey) {
                window.bookmarkApp.refreshBookmarks(window.bookmarkApp.activeCategoryKey);
            }

            // 4. 更新用户状态按钮
            if (typeof updateUserStatusButton === 'function') {
                updateUserStatusButton();
            }

            // 5. 如果书签弹窗是打开的，更新标题和按钮
            const bookmarkModal = document.getElementById('bookmarkModal');
            if (bookmarkModal && bookmarkModal.classList.contains('show')) {
                const modalTitle = document.getElementById('modalTitle');
                const isLoggedIn = window.isLoggedIn !== false;
                const editingId = document.getElementById('editingId').value;
                if (editingId) {
                    modalTitle.innerText = isLoggedIn ? t('edit_bookmark_title') : t('bookmark_info_title');
                } else {
                    modalTitle.innerText = t('add_bookmark_title');
                }
                const cancelBtn = document.getElementById('cancelBtn');
                const saveBtn = document.getElementById('submitBtn');
                const deleteBtn = document.getElementById('deleteBtn');
                if (cancelBtn) cancelBtn.innerText = t('cancel_btn');
                if (saveBtn) saveBtn.innerText = t('save_btn');
                if (deleteBtn && deleteBtn.style.display !== 'none') deleteBtn.innerText = t('delete_btn');

                // 更新私密复选框的 Tooltip
                const privateTooltip = document.getElementById('privateTooltip');
                if (privateTooltip) {
                    privateTooltip.setAttribute('title', t('private_tip'));
                    const tooltipInstance = bootstrap.Tooltip.getInstance(privateTooltip);
                    if (tooltipInstance) {
                        tooltipInstance.dispose();
                        new bootstrap.Tooltip(privateTooltip);
                    }
                }
            }

            // 6. 如果分类列表弹窗是打开的，更新其内容
            const categoryModal = document.getElementById('categoryManageModal');
            if (categoryModal && categoryModal.classList.contains('show')) {
                const closeBtn = categoryModal.querySelector('.modal-footer .btn-secondary');
                if (closeBtn) closeBtn.innerText = t('close');
                if (window.bookmarkApp && typeof window.bookmarkApp.loadCategoryList === 'function') {
                    window.bookmarkApp.loadCategoryList();
                }
            }

            // 7. 如果新增分类弹窗是打开的，更新按钮文字和上级分类下拉框
            const newCategoryModal = document.getElementById('newCategoryModal');
            if (newCategoryModal && newCategoryModal.classList.contains('show')) {
                const cancelBtn = newCategoryModal.querySelector('.modal-footer .btn-secondary');
                const saveBtn = newCategoryModal.querySelector('.modal-footer .btn-primary');
                if (cancelBtn) cancelBtn.innerText = t('cancel_btn');
                if (saveBtn) saveBtn.innerText = t('save_btn');

                const parentSelect = document.getElementById('newCategoryParent');
                if (parentSelect && window.bookmarkApp) {
                    const currentVal = parentSelect.value;
                    const cats = Object.keys(window.allData.categories || {}).sort();
                    let html = `<option value="">${t('no_parent')}</option>`;
                    cats.forEach(c => {
                        const cat = window.allData.categories[c];
                        const displayName = window.bookmarkApp.getCategoryDisplayName(cat);
                        html += `<option value="${escapeHtml(c)}" ${c === currentVal ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
                    });
                    parentSelect.innerHTML = html;
                }
            }

            // 8. 如果编辑分类弹窗是打开的，更新其内容
            const editCategoryModal = document.getElementById('editCategoryModal');
            if (editCategoryModal && editCategoryModal.classList.contains('show')) {
                const cancelBtn = editCategoryModal.querySelector('.modal-footer .btn-secondary');
                const saveBtn = editCategoryModal.querySelector('.modal-footer .btn-primary');
                if (cancelBtn) cancelBtn.innerText = t('cancel_btn');
                if (saveBtn) saveBtn.innerText = t('save_btn');

                const parentSelect = document.getElementById('editCategoryParent');
                const originalName = document.getElementById('editCategoryOriginalName')?.value || '';
                if (parentSelect && window.bookmarkApp && originalName) {
                    const currentVal = parentSelect.value;
                    const allCats = Object.keys(window.allData.categories || {}).filter(c => c !== originalName);
                    let html = `<option value="">${t('no_parent')}</option>`;
                    allCats.sort().forEach(c => {
                        const cat = window.allData.categories[c];
                        const displayName = window.bookmarkApp.getCategoryDisplayName(cat);
                        html += `<option value="${escapeHtml(c)}" ${c === currentVal ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
                    });
                    parentSelect.innerHTML = html;
                }
            }

            // 9. 更新分类弹窗中的输入框占位符
            if (window.bookmarkApp && typeof window.bookmarkApp.updateCategoryModalPlaceholders === 'function') {
                window.bookmarkApp.updateCategoryModalPlaceholders();
            }

            // 10. 如果增强版/本地版提示模态框中的按钮链接需要更新，在这里处理
            // 但 setEnvironmentLinks 会处理，无需额外操作
        }
    }

    // 按钮点击显示/隐藏下拉菜单
    langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langDropdown.classList.toggle('show');
    });

    // 点击选项切换语言
    langDropdown.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = opt.dataset.lang;
            if (lang) switchLanguage(lang);
            langDropdown.classList.remove('show');
        });
    });

    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', () => {
        langDropdown.classList.remove('show');
    });

    updateLangDisplay();
    updatePageText();
}

function updatePrivateTooltip() {
    const tooltipIcon = document.getElementById('privateTooltip');
    if (tooltipIcon) {
        const newTitle = t('private_tip');
        tooltipIcon.setAttribute('title', newTitle);
        const existingTooltip = bootstrap.Tooltip.getInstance(tooltipIcon);
        if (existingTooltip) {
            existingTooltip.dispose();
        }
        new bootstrap.Tooltip(tooltipIcon);
    }
}

function bindCommonEvents(app) {
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
    // ============================================================
    // 构造函数
    // ============================================================
    constructor(dataAdapter) {
        this.data = dataAdapter;
        this.activeCategoryKey = null;
        this.categorySelect = null;
        this._prevCategoryValue = '';
        this._categoryChangeHandler = null;
        this._pendingBookmarkData = null;
        this._pendingBookmarkIsEdit = false;
        window.bookmarkApp = this; // 全局引用
        this.init();
    }

    // ============================================================
    // 初始化
    // ============================================================
    async init() {
        // 缓存分类下拉框元素
        this.categorySelect = document.getElementById('categorySelect');
        // 绑定所有 UI 事件
        this.bindModalEvents();
        // 初始化搜索、侧边栏折叠等（由外部 common.js 的全局函数处理）
        // 但这里可以调用外部初始化函数（如果存在）
        if (typeof initSearch === 'function') initSearch();
        if (typeof bindCommonEvents === 'function') bindCommonEvents(this);
        this.initTagMoreTooltip();
        // 加载数据
        await this.loadData();
        // 初始化图标选择器等
        this.initNewCategoryIconSelector();
        this.initEditCategoryIconSelector();
        this.initCategorySearch();
        // 初始化 Tooltip
        this.initTooltips();
        // 设置初始激活分类
        this.setActiveCategory('__recommend__');
        if (typeof initLanguageSwitcher === 'function') {
            initLanguageSwitcher();
        }
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
                position: fixed;
                background: #fff;
                border: 1px solid #ccc;
                border-radius: 8px;
                padding: 8px 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                max-width: 250px;
                display: none;
                pointer-events: auto;
            `;
            document.body.appendChild(el);
            tooltip = el;

            tooltip.addEventListener('mouseenter', () => {
                if (hideTimeout) clearTimeout(hideTimeout);
            });
            tooltip.addEventListener('mouseleave', () => {
                hideTimeout = setTimeout(() => {
                    tooltip.style.display = 'none';
                }, 150);
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
                    pointer-events: auto;
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

        // 使用事件委托监听鼠标进入 .tag-more
        document.body.addEventListener('mouseenter', (e) => {
            const target = e.target.closest('.tag-more');
            if (!target) return;
            const remainingAttr = target.getAttribute('data-remaining');
            if (!remainingAttr) return;
            let remaining = [];
            try {
                // 将 HTML 实体转回引号
                const jsonStr = remainingAttr.replace(/&quot;/g, '"');
                remaining = JSON.parse(jsonStr);
            } catch (err) {
                console.error('解析剩余标签失败', err);
            }
            if (!remaining.length) return;
            if (hideTimeout) clearTimeout(hideTimeout);
            showTooltip(target, remaining);
        }, true);

        // 鼠标离开 .tag-more 时延迟隐藏，允许移动到浮层
        document.body.addEventListener('mouseleave', (e) => {
            const target = e.target.closest('.tag-more');
            if (!target) return;
            const tooltipEl = getTooltipContainer();
            const related = e.relatedTarget;
            if (!tooltipEl.contains(related)) {
                hideTimeout = setTimeout(() => {
                    tooltipEl.style.display = 'none';
                }, 150);
            }
        }, true);
    }

    // ============================================================
    // 数据加载
    // ============================================================
    async loadData() {
        const { bookmarks, categories } = await this.data.getAllData();
        window.allData = { bookmarks, categories };
        if (!window.allDataExpanded) window.allDataExpanded = {};
        this.renderCategoryTree();
        // 刷新当前视图
        this.setActiveCategory(this.activeCategoryKey || '__recommend__');
    }

    // ============================================================
    // 辅助：分类双语显示
    // ============================================================
    getCategoryDisplayName(category) {
        if (!category) return t('unnamed');
        const currentLang = getCurrentLang();
        if (currentLang === 'en' && category.name_en) {
            return category.name_en;
        }
        if (currentLang === 'zh' && category.name) {
            return category.name;
        }
        return category.name || category.name_en || t('unnamed');
    }

    // ============================================================
    // 分类树渲染
    // ============================================================
    renderCategoryTree() {
        const categoriesObj = window.allData?.categories || {};
        const tree = buildCategoryTreeFromObj(categoriesObj);

        function applyExpanded(nodes) {
            for (let node of nodes) {
                node.expanded = window.allDataExpanded?.[node.name] || false;
                if (node.children) applyExpanded(node.children);
            }
        }
        applyExpanded(tree);

        const app = this;

        function renderNode(node) {
            const hasChildren = node.children.length > 0;
            const isActive = (window.activeCategoryKey === node.name);
            const activeClass = isActive ? 'active' : '';

            const catObj = categoriesObj[node.name];
            const displayName = catObj ? app.getCategoryDisplayName(catObj) : node.name;

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
                            <span class="node-name">${escapeHtml(displayName)}</span>
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
                        <span class="node-name">${t('all')}</span>
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
                        <span class="node-name">${t('recommend')}</span>
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
                if (cat === '__all__') { app.setActiveCategory(null); return; }
                if (cat === '__recommend__') { app.setActiveCategory('__recommend__'); return; }
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
                    app.renderCategoryTree();
                }
                app.setActiveCategory(cat);
            });
        });
        document.querySelectorAll('.expand-icon').forEach(arrow => {
            arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                const nodeName = arrow.dataset.node;
                if (nodeName) {
                    if (!window.allDataExpanded) window.allDataExpanded = {};
                    window.allDataExpanded[nodeName] = !window.allDataExpanded[nodeName];
                    app.renderCategoryTree();
                }
            });
        });
    }

    // ============================================================
    // 设置活动分类 & 刷新书签网格
    // ============================================================
    setActiveCategory(cat) {
        this.activeCategoryKey = cat;
        window.activeCategoryKey = cat;
        this.renderCategoryTree();
        this.refreshBookmarks(cat);
    }

    refreshBookmarks(category) {
        const container = document.getElementById('bookmarkGrid');
        if (!container) return;

        let filtered = [...(window.allData.bookmarks || [])];

        // 推荐视图
        if (category === '__recommend__') {
            filtered.sort((a, b) => (b.click_count || 0) - (a.click_count || 0));
            filtered = filtered.slice(0, 30);
            if (filtered.length === 0) {
                container.innerHTML = `<div class="text-center p-5" style="color:#8fa3bc;">${t('no_recommend')}</div>`;
                return;
            }
            let html = '<div class="row g-3">';
            filtered.forEach(b => html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`);
            html += '</div>';
            container.innerHTML = html;
            return;
        }

        // 单个分类（含子分类）
        if (category && category !== '__all__') {
            const getChildrenNames = (catName) => {
                const children = Object.values(window.allData.categories).filter(c => c.parent === catName);
                let names = [catName];
                children.forEach(child => names = names.concat(getChildrenNames(child.name)));
                return names;
            };
            const includeCategories = getChildrenNames(category);
            filtered = filtered.filter(b => includeCategories.includes(b.category));
            if (filtered.length === 0) {
                container.innerHTML = `<div class="text-center p-5" style="color:#8fa3bc;">${t('no_bookmarks_in_category')}</div>`;
                return;
            }
            let html = '<div class="row g-3">';
            filtered.forEach(b => html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`);
            html += '</div>';
            container.innerHTML = html;
            return;
        }

        // 全部分类视图（按一级分类分组）
        const topCategories = Object.values(window.allData.categories)
            .filter(c => !c.parent || c.parent === '')
            .sort((a, b) => (a.priority || 100) - (b.priority || 100));

        if (filtered.length === 0) {
            container.innerHTML = `<div class="text-center p-5" style="color:#8fa3bc;">${t('no_bookmarks')}</div>`;
            return;
        }

        const categoryMap = window.allData.categories || {};
        const getChildrenNames = (catName) => {
            const children = Object.values(categoryMap).filter(c => c.parent === catName);
            let names = [catName];
            children.forEach(child => names = names.concat(getChildrenNames(child.name)));
            return names;
        };

        let html = '';
        const processedBookmarks = new Set();

        for (const topCat of topCategories) {
            const includeCategories = getChildrenNames(topCat.name);
            const groupBookmarks = filtered.filter(b => includeCategories.includes(b.category));
            if (groupBookmarks.length === 0) continue;

            groupBookmarks.forEach(b => processedBookmarks.add(b.id));

            const catIcon = topCat.icon && (topCat.icon.startsWith('http') || topCat.icon.startsWith('data:'))
                ? `<img src="${escapeHtml(topCat.icon)}" style="width:20px;margin-right:8px;">`
                : `<i class="${escapeHtml(topCat.icon || 'fas fa-folder')}" style="margin-right:8px;"></i>`;
            html += `
                <div class="category-section">
                    <div class="category-section-title">${catIcon}<span>${escapeHtml(this.getCategoryDisplayName(topCat))}</span></div>
                    <div class="row g-3">
            `;
            groupBookmarks.forEach(b => html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`);
            html += `</div></div>`;
        }

        // 孤儿书签归入"未分类"
        const orphanBookmarks = filtered.filter(b => !processedBookmarks.has(b.id));
        if (orphanBookmarks.length > 0) {
            const uncategorizedName = '未分类';
            const uncategorizedCat = categoryMap[uncategorizedName] || { icon: 'fas fa-folder' };
            const catIcon = uncategorizedCat.icon && (uncategorizedCat.icon.startsWith('http') || uncategorizedCat.icon.startsWith('data:'))
                ? `<img src="${escapeHtml(uncategorizedCat.icon)}" style="width:20px;margin-right:8px;">`
                : `<i class="${escapeHtml(uncategorizedCat.icon || 'fas fa-folder')}" style="margin-right:8px;"></i>`;
            html += `
                <div class="category-section">
                    <div class="category-section-title">${catIcon}<span>${t('uncategorized')}</span></div>
                    <div class="row g-3">
            `;
            orphanBookmarks.forEach(b => html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`);
            html += `</div></div>`;
        }

        container.innerHTML = html || `<div class="text-center p-5" style="color:#8fa3bc;">${t('no_bookmarks')}</div>`;
    }

    // ============================================================
    // 本地搜索
    // ============================================================
    localSearch(keyword) {
        const lower = keyword.toLowerCase().trim();
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
            container.innerHTML = `<div class="text-center p-5" style="color:#8fa3bc;">${t('no_match')}</div>`;
            return;
        }
        let html = '<div class="row g-3">';
        matched.forEach(b => html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`);
        html += '</div>';
        container.innerHTML = html;
    }

    // ============================================================
    // 书签模态框：新增/编辑
    // ============================================================
    openAddModal() {
        const modal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
        document.getElementById('modalTitle').innerText = t('add_bookmark_title');
        document.getElementById('editingId').value = '';
        document.getElementById('urlInput').value = '';
        document.getElementById('urlInput').readOnly = false;
        document.getElementById('titleInput').value = '';
        document.getElementById('descriptionInput').value = '';
        document.getElementById('bookmarkTags').value = '';
        this.updateCategorySelect();
        if (this.categorySelect) this.categorySelect.value = '';
        document.getElementById('deleteBtn').style.display = 'none';
        const isPrivateCheckbox = document.getElementById('isPrivateCheckbox');
        if (isPrivateCheckbox) isPrivateCheckbox.checked = true;
        document.getElementById('clipboardHint').innerText = '';
        window.lastFetchedIcon = '';
        modal.show();

        // 剪贴板读取
        navigator.clipboard.readText().then(text => {
            if (text) {
                document.getElementById('urlInput').value = text;
                document.getElementById('clipboardHint').innerText = t('clipboard_loaded');
                this.fetchMetadata(text);
            }
        }).catch(() => {});
    }

    openEditModal(id) {
        const item = window.allData.bookmarks.find(b => String(b.id) === String(id));
        if (!item) return;

        const isLoggedIn = window.isLoggedIn !== false;
        const isOwner = (window.currentUserId && item.user_id === window.currentUserId);

        const sharedByContainer = document.getElementById('sharedByContainer');
        const sharedBySpan = document.getElementById('sharedByUsername');
        const privateContainer = document.getElementById('privateCheckboxContainer');
        const isPrivateCheckbox = document.getElementById('isPrivateCheckbox');

        if (!isLoggedIn || !isOwner) {
            if (sharedByContainer) {
                sharedByContainer.style.display = '';
                if (sharedBySpan) sharedBySpan.innerText = item.username || t('anonymous_user');
            }
            if (privateContainer) privateContainer.style.display = 'none';
            if (isPrivateCheckbox) isPrivateCheckbox.disabled = true;
        } else {
            if (sharedByContainer) sharedByContainer.style.display = 'none';
            if (privateContainer) privateContainer.style.display = '';
            if (isPrivateCheckbox) {
                isPrivateCheckbox.disabled = false;
                isPrivateCheckbox.checked = (item.status === 'private');
            }
        }

        const modalTitle = document.getElementById('modalTitle');
        const editingId = document.getElementById('editingId');
        const urlInput = document.getElementById('urlInput');
        const titleInput = document.getElementById('titleInput');
        const descInput = document.getElementById('descriptionInput');
        const tagsInput = document.getElementById('bookmarkTags');
        const categorySelect = document.getElementById('categorySelect');
        const deleteBtn = document.getElementById('deleteBtn');
        const submitBtn = document.getElementById('submitBtn');
        const cancelBtn = document.querySelector('#bookmarkModal .btn-secondary');

        modalTitle.innerText = isLoggedIn ? t('edit_bookmark_title') : t('bookmark_info_title');
        editingId.value = id;
        urlInput.value = item.url;
        urlInput.readOnly = true;
        titleInput.value = item.title || '';
        descInput.value = item.description || '';
        if (tagsInput) tagsInput.value = (item.tags || []).join('/');
        this.updateCategorySelect(item.category);
        categorySelect.value = item.category;

        if (!isLoggedIn) {
            titleInput.readOnly = true;
            descInput.readOnly = true;
            if (tagsInput) tagsInput.readOnly = true;
            categorySelect.disabled = true;
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (submitBtn) submitBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.innerText = t('close');
            if (isPrivateCheckbox) isPrivateCheckbox.disabled = true;
        } else {
            titleInput.readOnly = false;
            descInput.readOnly = false;
            if (tagsInput) tagsInput.readOnly = false;
            categorySelect.disabled = false;
            if (deleteBtn) {
                deleteBtn.style.display = 'block';
                deleteBtn.onclick = () => this.handleDelete();
            }
            if (submitBtn) submitBtn.style.display = 'block';
            if (cancelBtn) cancelBtn.innerText = t('cancel_btn');
            if (isPrivateCheckbox) isPrivateCheckbox.disabled = false;
        }

        const modal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
        modal.show();
    }

    // ============================================================
    // 保存/恢复书签弹窗状态（用于新增分类返回）
    // ============================================================
    saveBookmarkModalState() {
        this._pendingBookmarkData = {
            editingId: document.getElementById('editingId').value,
            url: document.getElementById('urlInput').value,
            title: document.getElementById('titleInput').value,
            description: document.getElementById('descriptionInput').value,
            tags: document.getElementById('bookmarkTags').value,
            category: document.getElementById('categorySelect').value,
            isPrivate: document.getElementById('isPrivateCheckbox')?.checked || true
        };
        this._pendingBookmarkIsEdit = !!document.getElementById('editingId').value;
    }

    async restoreBookmarkModal() {
        this.removeModalBackdrop();
        if (!this._pendingBookmarkData) return;

        document.getElementById('editingId').value = this._pendingBookmarkData.editingId;
        document.getElementById('urlInput').value = this._pendingBookmarkData.url;
        document.getElementById('titleInput').value = this._pendingBookmarkData.title;
        document.getElementById('descriptionInput').value = this._pendingBookmarkData.description;
        document.getElementById('bookmarkTags').value = this._pendingBookmarkData.tags;
        await this.updateCategorySelect(this._pendingBookmarkData.category);
        document.getElementById('categorySelect').value = this._pendingBookmarkData.category;
        if (document.getElementById('isPrivateCheckbox')) {
            document.getElementById('isPrivateCheckbox').checked = this._pendingBookmarkData.isPrivate;
        }

        const isLoggedIn = window.isLoggedIn !== false;
        const isEdit = !!this._pendingBookmarkData.editingId && this._pendingBookmarkData.editingId !== '';

        const sharedByContainer = document.getElementById('sharedByContainer');
        const sharedBySpan = document.getElementById('sharedByUsername');
        const privateContainer = document.getElementById('privateCheckboxContainer');
        const isPrivateCheckbox = document.getElementById('isPrivateCheckbox');

        if (isEdit) {
            const currentId = parseInt(this._pendingBookmarkData.editingId);
            const currentItem = window.allData.bookmarks.find(b => b.id === currentId);
            const isOwner = (window.currentUserId && currentItem && currentItem.user_id === window.currentUserId);
            if (!isLoggedIn || !isOwner) {
                if (sharedByContainer) {
                    sharedByContainer.style.display = '';
                    if (sharedBySpan) sharedBySpan.innerText = currentItem ? (currentItem.username || t('anonymous_user')) : t('anonymous_user');
                }
                if (privateContainer) privateContainer.style.display = 'none';
                if (isPrivateCheckbox) isPrivateCheckbox.disabled = true;
            } else {
                if (sharedByContainer) sharedByContainer.style.display = 'none';
                if (privateContainer) privateContainer.style.display = '';
                if (isPrivateCheckbox) isPrivateCheckbox.disabled = false;
            }
        } else {
            if (sharedByContainer) sharedByContainer.style.display = 'none';
            if (privateContainer) privateContainer.style.display = '';
            if (isPrivateCheckbox) {
                isPrivateCheckbox.disabled = false;
                isPrivateCheckbox.checked = true;
            }
        }

        const modalTitle = document.getElementById('modalTitle');
        modalTitle.innerText = isEdit ? (isLoggedIn ? t('edit_bookmark_title') : t('bookmark_info_title')) : t('add_bookmark_title');

        const titleInput = document.getElementById('titleInput');
        const descInput = document.getElementById('descriptionInput');
        const tagsInput = document.getElementById('bookmarkTags');
        const categorySelect = document.getElementById('categorySelect');
        const deleteBtn = document.getElementById('deleteBtn');
        const submitBtn = document.getElementById('submitBtn');
        const cancelBtn = document.querySelector('#bookmarkModal .btn-secondary');

        if (!isLoggedIn) {
            titleInput.readOnly = true;
            descInput.readOnly = true;
            if (tagsInput) tagsInput.readOnly = true;
            categorySelect.disabled = true;
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (submitBtn) submitBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.innerText = t('close');
            if (isPrivateCheckbox) isPrivateCheckbox.disabled = true;
        } else {
            titleInput.readOnly = false;
            descInput.readOnly = false;
            if (tagsInput) tagsInput.readOnly = false;
            categorySelect.disabled = false;
            if (isPrivateCheckbox) isPrivateCheckbox.disabled = false;
            if (isEdit) {
                if (deleteBtn) {
                    deleteBtn.style.display = 'block';
                    deleteBtn.onclick = () => this.handleDelete();
                }
                if (submitBtn) submitBtn.style.display = 'block';
                if (cancelBtn) cancelBtn.innerText = t('cancel_btn');
            } else {
                if (deleteBtn) deleteBtn.style.display = 'none';
                if (submitBtn) submitBtn.style.display = 'block';
                if (cancelBtn) cancelBtn.innerText = t('cancel_btn');
            }
        }
        if (categorySelect) categorySelect.disabled = !isLoggedIn;

        const bookmarkModal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
        bookmarkModal.show();
        this._pendingBookmarkData = null;
    }

    // ============================================================
    // 书签提交 & 删除
    // ============================================================
    async handleSubmit() {
        if (!window.isLoggedIn) {
            this.showLoginRequired();
            return;
        }

        const url = document.getElementById('urlInput').value.trim();
        if (!url) { alert(t('url_required')); return; }

        let category = document.getElementById('categorySelect').value;
        if (!category) category = '未分类';

        const title = document.getElementById('titleInput').value.trim() || url;
        const description = document.getElementById('descriptionInput').value.trim() || '';
        const tagsRaw = document.getElementById('bookmarkTags').value.trim();
        const tags = tagsRaw ? tagsRaw.split('/').map(t => t.trim()).filter(t => t) : [];

        const isPrivateCheckbox = document.getElementById('isPrivateCheckbox');
        const isPrivate = isPrivateCheckbox ? isPrivateCheckbox.checked : true;
        let status = isPrivate ? 'private' : 'public';

        if (status === 'public' && !window.isAdmin) {
            if (!confirm(t('public_confirm'))) return;
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
        submitBtn.innerHTML = t('saving');

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
            alert(t('save_failed') + ': ' + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    async handleDelete() {
        const id = document.getElementById('editingId').value;   // 直接获取字符串
        if (!id || !confirm(t('confirm_delete'))) return;
        const deleteBtn = document.getElementById('deleteBtn');
        deleteBtn.disabled = true;
        deleteBtn.textContent = t('deleting');
        try {
            await this.data.deleteBookmark(id);
            const modal = bootstrap.Modal.getInstance(document.getElementById('bookmarkModal'));
            modal.hide();
            await this.loadData();
        } catch (err) {
            console.error(err);
            alert(t('delete_failed') + ': ' + err.message);
        } finally {
            deleteBtn.disabled = false;
            deleteBtn.textContent = t('delete_btn');
        }
    }

    // ============================================================
    // 元数据抓取
    // ============================================================
    async fetchMetadata(url) {
        const hint = document.getElementById('clipboardHint');
        if (!hint) return;
        hint.innerText = t('fetching_metadata');
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
                if (tagsInput && data.keywords && data.keywords.length) {
                    tagsInput.value = data.keywords.join('/');
                }
                window.lastFetchedIcon = data.icon || '';
                hint.innerText = t('fetch_success');
            } else {
                console.warn('抓取失败:', data.message);
                hint.innerText = t('fetch_failed');
            }
        } catch (err) {
            console.error(err);
            hint.innerText = t('fetch_error');
        }
    }

    // ============================================================
    // 分类管理：下拉框更新
    // ============================================================
    updateCategorySelect(selected = '') {
        if (!this.categorySelect) {
            this.categorySelect = document.getElementById('categorySelect');
        }
        const cats = Object.keys(window.allData.categories || {}).sort();
        let html = `<option value="">${t('select_category')}</option>`;
        cats.forEach(c => {
            const cat = window.allData.categories[c];
            const displayName = this.getCategoryDisplayName(cat);
            html += `<option value="${escapeHtml(c)}" ${c === selected ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
        });
        // 不再添加 __new__ 选项
        this.categorySelect.innerHTML = html;

        // 简化 change 事件，只记录选中值
        if (this._categoryChangeHandler) {
            this.categorySelect.removeEventListener('change', this._categoryChangeHandler);
        }
        this._categoryChangeHandler = (e) => {
            this._prevCategoryValue = e.target.value;
        };
        this.categorySelect.addEventListener('change', this._categoryChangeHandler);
    }

    // ============================================================
    // 分类管理：列表
    // ============================================================
    async loadCategoryList() {
        const container = document.getElementById('categoryListContainer');
        if (!container) return;
        const cats = window.allData.categories || {};
        const sorted = Object.keys(cats).sort((a, b) => (cats[a].priority || 100) - (cats[b].priority || 100));
        let html = '';
        for (let name of sorted) {
            const cat = cats[name];
            const displayName = this.getCategoryDisplayName(cat);
            const iconHtml = cat.icon && (cat.icon.startsWith('http') || cat.icon.startsWith('data:'))
                ? `<img src="${escapeHtml(cat.icon)}" style="width:20px">`
                : `<i class="${escapeHtml(cat.icon || 'fas fa-folder')}"></i>`;
            const parentDisplayName = cat.parent ? this.getCategoryDisplayName(cats[cat.parent] || { name: cat.parent }) : '-';
            html += `<tr data-category="${escapeHtml(name)}">
                        <td>${iconHtml}</td>
                        <td>${escapeHtml(displayName)}</td>
                        <td>${escapeHtml(parentDisplayName)}</td>
                        <td>${cat.priority ?? 100}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary edit-category-btn"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-outline-danger delete-category-btn"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
        }
        container.innerHTML = html;

        document.querySelectorAll('.edit-category-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const name = btn.closest('tr').dataset.category;
                this.openEditCategoryModal(name);
            });
        });
        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const name = btn.closest('tr').dataset.category;
                await this.deleteCategoryHandler(name);
            });
        });
    }

    // ============================================================
    // 分类管理：新增/编辑/删除
    // ============================================================
    openAddCategoryModal() {
        this.removeModalBackdrop();
        const parentSelect = document.getElementById('newCategoryParent');
        if (parentSelect) {
            const cats = Object.keys(window.allData.categories || {}).sort();
            let html = `<option value="">${t('no_parent')}</option>`;
            cats.forEach(c => {
                const cat = window.allData.categories[c];
                const displayName = this.getCategoryDisplayName(cat);
                html += `<option value="${escapeHtml(c)}">${escapeHtml(displayName)}</option>`;
            });
            parentSelect.innerHTML = html;
        }
        document.getElementById('newCategoryNameZh').value = '';
        document.getElementById('newCategoryNameEn').value = '';
        document.getElementById('newCatSelectedIconValue').value = 'fas fa-folder';
        document.getElementById('newCatSelectedIconPreview').innerHTML = '<i class="fas fa-folder"></i>';
        document.getElementById('newCatSelectedIconText').innerText = t('select_icon');
        document.getElementById('newCategoryPriority').value = '100';
        const modal = new bootstrap.Modal(document.getElementById('newCategoryModal'));
        modal.show();

        // 更新占位符（确保当前语言）
        this.updateCategoryModalPlaceholders();
    }

    openEditCategoryModal(categoryName) {
        const cat = window.allData.categories[categoryName];
        if (!cat) return;
        const categoryManageModalEl = document.getElementById('categoryManageModal');
        const categoryModal = bootstrap.Modal.getInstance(categoryManageModalEl);
        if (categoryModal) categoryModal.hide();

        document.getElementById('editCategoryOriginalName').value = categoryName;
        document.getElementById('editCategoryNameZh').value = cat.name || '';
        document.getElementById('editCategoryNameEn').value = cat.name_en || '';

        const iconPreview = document.getElementById('editCatSelectedIconPreview');
        const iconText = document.getElementById('editCatSelectedIconText');
        const iconValue = document.getElementById('editCatSelectedIconValue');
        if (cat.icon) {
            if (cat.icon.startsWith('http') || cat.icon.startsWith('data:')) {
                iconPreview.innerHTML = `<img src="${cat.icon}" style="max-width:20px;max-height:20px;">`;
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

        const parentSelect = document.getElementById('editCategoryParent');
        if (parentSelect) {
            const allCats = Object.keys(window.allData.categories || {}).filter(c => c !== categoryName);
            let html = `<option value="">${t('no_parent')}</option>`;
            allCats.sort().forEach(c => {
                const catObj = window.allData.categories[c];
                const displayName = this.getCategoryDisplayName(catObj);
                html += `<option value="${escapeHtml(c)}" ${cat.parent === c ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
            });
            parentSelect.innerHTML = html;
        }
        document.getElementById('editCategoryPriority').value = cat.priority || 100;
        const modal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
        modal.show();
        this.updateCategoryModalPlaceholders();
    }

    async deleteCategoryHandler(name) {
        const hasChildren = Object.values(window.allData.categories).some(c => c.parent === name);
        const hasBookmarks = window.allData.bookmarks.some(b => b.category === name);
        if (hasChildren || hasBookmarks) {
            alert(t('category_has_items'));
            return;
        }
        if (!confirm(t('confirm_delete_category'))) return;
        await this.data.deleteCategory(name);
        await this.loadData();
        const manageModal = document.getElementById('categoryManageModal');
        if (manageModal && manageModal.classList.contains('show')) {
            this.loadCategoryList();
        }
    }

    // ============================================================
    // 导入导出
    // ============================================================
    async exportBookmarks() {
        const data = await this.data.exportData();
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
                        alert(t('import_success'));
                        await this.loadData();
                    } else alert(t('invalid_json'));
                } catch { alert(t('invalid_json')); }
            } else {
                const result = this.parseBookmarkHtml(content);
                if (!result) { alert(t('invalid_html')); return; }
                await this.data.importData(result);
                alert(t('import_success'));
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

    // ============================================================
    // 工具方法
    // ============================================================
    showLoginRequired() {
        const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
        loginModal.show();
    }

    removeModalBackdrop() {
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }

    initTooltips() {
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
            if (!bootstrap.Tooltip.getInstance(el)) {
                new bootstrap.Tooltip(el);
            }
        });
    }

    initNewCategoryIconSelector() {
        const display = document.getElementById('newCatSelectedIconDisplay');
        const panel = document.getElementById('newCatIconDropdownPanel');
        if (!display || !panel) {
            console.warn('图标选择器元素未找到');
            return;
        }
        const caret = display.querySelector('.caret');
        const preview = document.getElementById('newCatSelectedIconPreview');
        const text = document.getElementById('newCatSelectedIconText');
        const iconValue = document.getElementById('newCatSelectedIconValue');
        const customInput = document.getElementById('newCatCustomIconInput');
        const applyBtn = document.getElementById('newCatApplyCustomIcon');

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

    // 初始化编辑分类弹窗中的图标选择器
    initEditCategoryIconSelector() {
        const display = document.getElementById('editCatSelectedIconDisplay');
        const panel = document.getElementById('editCatIconDropdownPanel');
        if (!display || !panel) {
            console.warn('编辑分类图标选择器元素未找到');
            return;
        }
        const caret = display.querySelector('.caret');
        const preview = document.getElementById('editCatSelectedIconPreview');
        const text = document.getElementById('editCatSelectedIconText');
        const iconValue = document.getElementById('editCatSelectedIconValue');
        const customInput = document.getElementById('editCatCustomIconInput');
        const applyBtn = document.getElementById('editCatApplyCustomIcon');

        // 移除旧的事件监听器（避免重复绑定）
        const newDisplay = display.cloneNode(true);
        display.parentNode.replaceChild(newDisplay, display);
        // 重新获取新元素
        const newDisplayEl = document.getElementById('editCatSelectedIconDisplay');
        const newPanel = document.getElementById('editCatIconDropdownPanel');
        const newCaret = newDisplayEl.querySelector('.caret');
        const newPreview = document.getElementById('editCatSelectedIconPreview');
        const newText = document.getElementById('editCatSelectedIconText');
        const newIconValue = document.getElementById('editCatSelectedIconValue');

        newDisplayEl.addEventListener('click', (e) => {
            e.stopPropagation();
            newPanel.classList.toggle('show');
            if (newCaret) newCaret.classList.toggle('open', newPanel.classList.contains('show'));
        });

        document.addEventListener('click', (e) => {
            if (!newDisplayEl.contains(e.target) && !newPanel.contains(e.target)) {
                newPanel.classList.remove('show');
                if (newCaret) newCaret.classList.remove('open');
            }
        });

        // 预设图标选项点击
        newPanel.querySelectorAll('.icon-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const value = opt.dataset.value;
                const name = opt.dataset.name;
                if (opt.dataset.link) {
                    window.open(opt.dataset.link, '_blank');
                    newPanel.classList.remove('show');
                    if (newCaret) newCaret.classList.remove('open');
                    return;
                }
                if (value) {
                    newPreview.innerHTML = opt.querySelector('i').cloneNode(true).outerHTML;
                    newText.innerText = name || value;
                    newIconValue.value = value;
                }
                newPanel.classList.remove('show');
                if (newCaret) newCaret.classList.remove('open');
            });
        });

        // 自定义图标
        if (applyBtn && customInput) {
            // 移除旧的绑定，重新绑定
            const newApply = applyBtn.cloneNode(true);
            applyBtn.parentNode.replaceChild(newApply, applyBtn);
            const newApplyBtn = document.getElementById('editCatApplyCustomIcon');
            const newCustomInput = document.getElementById('editCatCustomIconInput');
            newApplyBtn.addEventListener('click', () => {
                const custom = newCustomInput.value.trim();
                if (!custom) return;
                const icon = custom;
                if (icon.startsWith('http') || icon.startsWith('data:')) {
                    newPreview.innerHTML = `<img src="${icon}" style="max-width:20px; max-height:20px;">`;
                } else {
                    newPreview.innerHTML = `<i class="${icon}"></i>`;
                }
                newText.innerText = icon;
                newIconValue.value = icon;
                newPanel.classList.remove('show');
                if (newCaret) newCaret.classList.remove('open');
                newCustomInput.value = '';
            });
        }
    }

    initCategorySearch() {
        const searchInput = document.getElementById('categorySearchInput');
        if (!searchInput) return;
        searchInput.addEventListener('input', () => {
            const keyword = searchInput.value.trim().toLowerCase();
            document.querySelectorAll('#categoryListContainer tr').forEach(row => {
                const nameCell = row.cells[1];
                if (nameCell) {
                    row.style.display = nameCell.textContent.toLowerCase().includes(keyword) ? '' : 'none';
                }
            });
        });
    }

    // ============================================================
    // 事件绑定（模态框按钮等）
    // ============================================================
    bindModalEvents() {
        // 新增书签（下拉菜单）
        const addBookmarkItem = document.getElementById('addBookmarkDropdownItem');
        if (addBookmarkItem) {
            addBookmarkItem.addEventListener('click', (e) => {
                e.preventDefault();
                if (!window.isLoggedIn) { this.showLoginRequired(); return; }
                this.openAddModal();
            });
        }

        // 批量新增
        const batchAddItem = document.getElementById('batchAddBookmarkItem');
        if (batchAddItem) {
            batchAddItem.addEventListener('click', (e) => {
                e.preventDefault();
                if (!window.isLoggedIn) { this.showLoginRequired(); return; }
                this.openBatchAddModal();
            });
        }
        const batchSubmitBtn = document.getElementById('batchSubmitBtn');
        if (batchSubmitBtn) {
            batchSubmitBtn.addEventListener('click', () => this.batchSubmit());
        }

        // 导入书签
        const importItem = document.getElementById('importBookmarksDropdownItem');
        if (importItem) {
            importItem.addEventListener('click', (e) => {
                e.preventDefault();
                if (!window.isLoggedIn) { this.showLoginRequired(); return; }
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

        // 导出书签
        const exportItem = document.getElementById('exportBookmarksDropdownItem');
        if (exportItem) {
            exportItem.addEventListener('click', (e) => {
                e.preventDefault();
                if (!window.isLoggedIn) { this.showLoginRequired(); return; }
                this.exportBookmarks();
            });
        }

        // 新增分类（下拉菜单）
        const addCategoryItem = document.getElementById('addCategoryDropdownItem');
        if (addCategoryItem) {
            addCategoryItem.addEventListener('click', (e) => {
                e.preventDefault();
                if (!window.isLoggedIn) { this.showLoginRequired(); return; }
                this.openAddCategoryModal();
            });
        }

        // 分类列表（下拉菜单）
        const listCategoryItem = document.getElementById('listCategoriesDropdownItem');
        if (listCategoryItem) {
            listCategoryItem.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!window.isLoggedIn) { this.showLoginRequired(); return; }
                await this.loadData();
                await this.loadCategoryList();
                const searchInput = document.getElementById('categorySearchInput');
                if (searchInput) searchInput.value = '';
                const modal = new bootstrap.Modal(document.getElementById('categoryManageModal'));
                modal.show();
            });
        }

        // 快速新增分类按钮（书签弹窗内）
        const quickAddBtn = document.getElementById('quickAddCategoryBtn');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', () => {
                if (!window.isLoggedIn) { this.showLoginRequired(); return; }
                this.saveBookmarkModalState();
                const bookmarkModalEl = document.getElementById('bookmarkModal');
                const bookmarkModal = bootstrap.Modal.getInstance(bookmarkModalEl);
                if (bookmarkModal) {
                    bookmarkModal.hide();
                    bookmarkModalEl.addEventListener('hidden.bs.modal', () => {
                        this.openAddCategoryModal();
                    }, { once: true });
                } else {
                    this.openAddCategoryModal();
                }
            });
        }

        // 批量新增弹窗中的快速新增分类按钮
        // 批量新增弹窗中的快速新增分类按钮
        const batchQuickAddCategoryBtn = document.getElementById('batchQuickAddCategoryBtn');
        if (batchQuickAddCategoryBtn) {
            batchQuickAddCategoryBtn.addEventListener('click', () => {
                if (!window.isLoggedIn) {
                    this.showLoginRequired();
                    return;
                }
                const batchModalEl = document.getElementById('batchAddModal');
                const batchModal = bootstrap.Modal.getInstance(batchModalEl);
                if (batchModal) {
                    batchModal.hide();
                }
                this._pendingBatchCategory = true;
                this.openAddCategoryModal();

                const newCategoryModalEl = document.getElementById('newCategoryModal');
                const restoreBatchModal = () => {
                    if (batchModal) {
                        batchModal.show();
                        this.batchUpdateCategorySelect(
                            document.getElementById('batchCategorySelect')?.value || ''
                        );
                    }
                    this._pendingBatchCategory = false;
                    newCategoryModalEl.removeEventListener('hidden.bs.modal', restoreBatchModal);
                };
                newCategoryModalEl.addEventListener('hidden.bs.modal', restoreBatchModal);
            });
        }

        // 书签弹窗提交按钮
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.addEventListener('click', () => this.handleSubmit());

        // 新增分类弹窗确认
        // 新增分类模态框中的确认按钮
        // 在 BookmarkApp.bindModalEvents 中
        const confirmNewCategoryBtn = document.getElementById('confirmNewCategoryBtn');
        if (confirmNewCategoryBtn) {
            confirmNewCategoryBtn.addEventListener('click', async () => {
                const nameZh = document.getElementById('newCategoryNameZh').value.trim();
                const nameEn = document.getElementById('newCategoryNameEn').value.trim();

                if (!nameZh && !nameEn) {
                    alert(t('category_name_required_one'));
                    return;
                }

                const icon = document.getElementById('newCatSelectedIconValue').value || 'fas fa-folder';
                const parent = document.getElementById('newCategoryParent').value || null;
                const priority = parseInt(document.getElementById('newCategoryPriority').value) || 100;

                // 前端重名检查（中文名）
                if (nameZh && window.allData.categories[nameZh]) {
                    alert(t('category_name_zh_exists'));
                    return;
                }
                // 英文名重名检查（遍历 name_en）
                if (nameEn) {
                    const exists = Object.values(window.allData.categories).some(c => c.name_en === nameEn);
                    if (exists) {
                        alert(t('category_name_en_exists'));
                        return;
                    }
                }

                try {
                    const result = await this.data.addCategory({
                        name: nameZh || '',
                        name_en: nameEn || '',
                        icon,
                        parent,
                        priority
                    });

                    if (result.success) {
                        // 刷新全局数据
                        await this.loadData();

                        // 关闭新增分类弹窗
                        const modal = bootstrap.Modal.getInstance(document.getElementById('newCategoryModal'));
                        modal.hide();

                        // 1. 如果是从批量新增弹窗调用的，刷新批量分类下拉框
                        if (this._pendingBatchCategory) {
                            this.batchUpdateCategorySelect();
                            this._pendingBatchCategory = false;
                        }

                        // 2. 如果是从书签弹窗调用的，恢复书签弹窗
                        if (this._pendingBookmarkData) {
                            this._pendingBookmarkData.category = nameZh || nameEn || '未分类';
                            await this.restoreBookmarkModal();
                        }

                        // 3. 如果分类列表弹窗是打开的，刷新列表
                        const manageModal = document.getElementById('categoryManageModal');
                        if (manageModal && manageModal.classList.contains('show')) {
                            this.loadCategoryList();
                        }

                        // 4. 如果批量新增弹窗是打开的（但没有使用 _pendingBatchCategory 标记），刷新其下拉框
                        const batchModal = document.getElementById('batchAddModal');
                        if (batchModal && batchModal.classList.contains('show')) {
                            this.batchUpdateCategorySelect();
                        }

                        if (this._pendingBatchCategory) {
                            this.batchUpdateCategorySelect();
                            this._pendingBatchCategory = false;
                        }

                    } else {
                        alert(result.message || t('add_category_failed'));
                    }
                } catch (err) {
                    console.error(err);
                    alert(t('network_error'));
                }
            });
        }

        // 编辑分类弹窗确认
        // 编辑分类模态框中的确认按钮
        const confirmEditCategoryBtn = document.getElementById('confirmEditCategoryBtn');
        if (confirmEditCategoryBtn) {
            confirmEditCategoryBtn.addEventListener('click', async () => {
                const originalName = document.getElementById('editCategoryOriginalName').value;
                const newNameZh = document.getElementById('editCategoryNameZh').value.trim();
                const newNameEn = document.getElementById('editCategoryNameEn').value.trim();

                if (!newNameZh && !newNameEn) {
                    alert(t('category_name_required_one'));
                    return;
                }

                const icon = document.getElementById('editCatSelectedIconValue').value || 'fas fa-folder';
                const parent = document.getElementById('editCategoryParent').value || null;
                const priority = parseInt(document.getElementById('editCategoryPriority').value) || 100;

                // 重名检查（排除自身）
                if (newNameZh && newNameZh !== originalName && window.allData.categories[newNameZh]) {
                    alert(t('category_name_zh_exists'));
                    return;
                }
                if (newNameEn) {
                    const exists = Object.values(window.allData.categories).some(c => c.name_en === newNameEn && c.name !== originalName);
                    if (exists) {
                        alert(t('category_name_en_exists'));
                        return;
                    }
                }

                try {
                    const updateData = {
                        icon,
                        parent,
                        priority
                    };
                    if (newNameZh !== originalName) {
                        updateData.new_name = newNameZh || '';
                    }
                    // 检查英文名是否变化
                    const originalCat = window.allData.categories[originalName];
                    if (originalCat && newNameEn !== originalCat.name_en) {
                        updateData.new_name_en = newNameEn || '';
                    }

                    // 直接获取 result
                    const result = await this.data.updateCategory(originalName, updateData);

                    if (result.success) {
                        await this.loadData();
                        // 关闭编辑分类弹窗
                        const modal = bootstrap.Modal.getInstance(document.getElementById('editCategoryModal'));
                        modal.hide();

                        // 刷新分类列表弹窗（如果已打开）
                        const manageModal = document.getElementById('categoryManageModal');
                        if (manageModal && manageModal.classList.contains('show')) {
                            this.loadCategoryList();
                        }
                    } else {
                        alert(result.message || t('edit_category_failed'));
                    }
                } catch (err) {
                    console.error(err);
                    alert(t('network_error'));
                }
            });
        }
    }

    // 其他可能需要的方法（如点击卡片增加点击次数、修改图标等）
    async incrementClick(id) {
        const bookmark = window.allData.bookmarks.find(b => String(b.id) === String(id));
        if (bookmark) {
            bookmark.clickCount = (bookmark.clickCount || 0) + 1;
            // 如果是在线版，调用 API；本地版直接更新 IndexedDB
            await this.data.incrementClick?.(bookmark.id);
            // 刷新界面
            this.refreshBookmarks(this.activeCategoryKey);
        }
    }

    async changeIcon(id) {
        const newIcon = prompt(t('change_icon_prompt'));
        if (!newIcon) return;
        await this.data.updateBookmark(id, { icon: newIcon });
        await this.loadData();
    }

    searchByTag(tag) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = tag;
        this.localSearch(tag);
    }

    updateCategoryModalPlaceholders() {
        // 更新占位符
        document.querySelectorAll('#newCategoryModal [data-i18n-placeholder], #editCategoryModal [data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) el.placeholder = t(key);
        });

        // 调整输入框顺序
        this.reorderCategoryInputs();
    }

    reorderCategoryInputs() {
        const currentLang = getCurrentLang();
        const isEnglish = currentLang === 'en';

        // 处理新增分类弹窗
        const newRow = document.querySelector('#newCategoryModal .row.g-2');
        if (newRow) {
            const children = newRow.children;
            if (children.length === 2) {
                // 第一个是中文输入框，第二个是英文输入框
                if (isEnglish) {
                    children[0].style.order = 2;
                    children[1].style.order = 1;
                } else {
                    children[0].style.order = 1;
                    children[1].style.order = 2;
                }
            }
        }

        // 处理编辑分类弹窗
        const editRow = document.querySelector('#editCategoryModal .row.g-2');
        if (editRow) {
            const children = editRow.children;
            if (children.length === 2) {
                if (isEnglish) {
                    children[0].style.order = 2;
                    children[1].style.order = 1;
                } else {
                    children[0].style.order = 1;
                    children[1].style.order = 2;
                }
            }
        }
    }

    // ============================================================
    // 批量新增书签
    // ============================================================
    openBatchAddModal() {
        // 重置表单
        document.getElementById('batchUrlsInput').value = '';
        this.batchUpdateCategorySelect();
        document.getElementById('batchProgressContainer').style.display = 'none';
        document.getElementById('batchProgressBar').style.width = '0%';
        document.getElementById('batchProgressText').innerText = '0 / 0';

        const modal = new bootstrap.Modal(document.getElementById('batchAddModal'));
        modal.show();
    }

    batchUpdateCategorySelect(selected = '') {
        const select = document.getElementById('batchCategorySelect');
        if (!select) return;
        const cats = Object.keys(window.allData.categories || {}).sort();
        let html = `<option value="">${t('select_category')}</option>`;
        cats.forEach(c => {
            const cat = window.allData.categories[c];
            const displayName = this.getCategoryDisplayName(cat);
            html += `<option value="${escapeHtml(c)}" ${c === selected ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
        });
        select.innerHTML = html;

        if (this._batchCategoryChangeHandler) {
            select.removeEventListener('change', this._batchCategoryChangeHandler);
        }
        this._batchCategoryChangeHandler = (e) => {
            this._batchPrevCategoryValue = e.target.value;
        };
        select.addEventListener('change', this._batchCategoryChangeHandler);
    }

    openAddCategoryModalFromBatch() {
        // 打开新增分类弹窗，但不关联书签弹窗
        // 复用 openAddCategoryModal，但后续不恢复书签弹窗，而是刷新下拉框
        this._pendingBatchCategory = true; // 标记来自批量新增
        this.openAddCategoryModal();
        // 重写恢复逻辑，在新增成功后刷新下拉框
    }

    // 批量抓取元数据（不操作DOM）
    async fetchMetadataForUrl(url) {
        try {
            const res = await fetch('/fetch-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (data.success) {
                return {
                    title: data.title || url,
                    description: data.description || '',
                    icon: data.icon || '',
                    keywords: data.keywords || []
                };
            } else {
                console.warn('抓取元数据失败:', url, data.message);
                return null;
            }
        } catch (err) {
            console.error('抓取异常:', url, err);
            return null;
        }
    }

    async batchSubmit() {
        const textarea = document.getElementById('batchUrlsInput');
        const select = document.getElementById('batchCategorySelect');
        const category = select ? select.value : '';

        if (!category) {
            alert(t('batch_no_category'));
            return;
        }

        const rawText = textarea.value;
        const urls = rawText.split(/[\n\r,;；|，]+/).map(s => s.trim()).filter(s => s);
        if (urls.length === 0) {
            alert(t('batch_empty'));
            return;
        }

        // 去重
        const uniqueUrls = [];
        const seen = new Set();
        for (const url of urls) {
            if (!seen.has(url)) {
                seen.add(url);
                uniqueUrls.push(url);
            }
        }

        // 显示进度条
        const container = document.getElementById('batchProgressContainer');
        const progressBar = document.getElementById('batchProgressBar');
        const progressText = document.getElementById('batchProgressText');
        container.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.innerText = `0 / ${uniqueUrls.length}`;

        const submitBtn = document.getElementById('batchSubmitBtn');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = t('batch_processing');

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < uniqueUrls.length; i++) {
            const url = uniqueUrls[i];
            let bookmarkData = {
                url: url,
                category: category,
                status: 'private',
                title: url,
                description: '',
                tags: [],
                icon: ''
            };

            // 尝试抓取元数据（两个版本均可用）
            try {
                const meta = await this.fetchMetadataForUrl(url);
                if (meta) {
                    bookmarkData.title = meta.title || url;
                    bookmarkData.description = meta.description || '';
                    bookmarkData.icon = meta.icon || '';
                    if (meta.keywords && meta.keywords.length) {
                        bookmarkData.tags = meta.keywords.slice(0, 5);
                    }
                }
            } catch (err) {
                console.warn(`抓取失败，使用默认值: ${url}`, err);
            }

            // 保存书签
            try {
                await this.data.addBookmark(bookmarkData);
                successCount++;
            } catch (err) {
                console.error(`添加书签失败: ${url}`, err);
                failedCount++;
            }

            // 更新进度
            const processed = i + 1;
            const percent = Math.min((processed / uniqueUrls.length) * 100, 100);
            progressBar.style.width = `${percent}%`;
            progressText.innerText = `${processed} / ${uniqueUrls.length}`;

            // 适当延迟，避免触发反爬
            if (i < uniqueUrls.length - 1) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        // 完成
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        container.style.display = 'none';

        // 提示结果
        if (failedCount === 0) {
            alert(t('batch_complete').replace('{count}', successCount));
        } else {
            alert(t('batch_partial').replace('{success}', successCount).replace('{failed}', failedCount));
        }

        // 刷新数据
        await this.loadData();
        if (this.activeCategoryKey) {
            this.refreshBookmarks(this.activeCategoryKey);
        } else {
            this.refreshBookmarks(null);
        }

        // 关闭批量新增弹窗
        const modal = bootstrap.Modal.getInstance(document.getElementById('batchAddModal'));
        if (modal) modal.hide();
    }

}

// 导出（全局）
window.BookmarkApp = BookmarkApp;