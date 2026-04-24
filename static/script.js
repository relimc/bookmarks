(function() {
    // ---------- 模态框实例 ----------
    const bookmarkModal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
    const categoryManageModal = new bootstrap.Modal(document.getElementById('categoryManageModal'));

    // ---------- DOM 元素 ----------
    const modalTitle = document.getElementById('modalTitle');
    const editingId = document.getElementById('editingId');
    const urlInput = document.getElementById('urlInput');
    const titleInput = document.getElementById('titleInput');
    const descriptionInput = document.getElementById('descriptionInput');
    const parentCategoryGroup = document.getElementById('parentCategoryGroup');
    const parentCategorySelect = document.getElementById('parentCategorySelect');
    let categorySelect = document.getElementById('categorySelect');
    const newCategoryInput = document.getElementById('newCategoryInput');
    const toggleCategoryMode = document.getElementById('toggleCategoryMode');
    const newCategoryIconGroup = document.getElementById('newCategoryIconGroup');
    const existingCategoryGroup = document.getElementById('existingCategoryGroup');
    const submitBtn = document.getElementById('submitBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const clipboardHint = document.getElementById('clipboardHint');
    const categoryTreeDiv = document.getElementById('categoryTree');
    const bookmarkGrid = document.getElementById('bookmarkGrid');
    const collapseBtn = document.getElementById('collapseSidebarBtn');
    const sidebar = document.getElementById('sidebar');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const importBtn = document.getElementById('importBookmarksBtn');
    const exportBtn = document.getElementById('exportBookmarksBtn');
    const addBookmarkHeaderBtn = document.getElementById('addBookmarkHeaderBtn');
    const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
    const bookmarkTags = document.getElementById('bookmarkTags');
    const selectedCategoryName = document.getElementById('selectedCategoryName');

    // 自定义图标选择器元素
    const selectedIconDisplay = document.getElementById('selectedIconDisplay');
    const iconDropdownPanel = document.getElementById('iconDropdownPanel');
    const iconOptions = document.querySelectorAll('.icon-option');
    const selectedIconPreview = document.getElementById('selectedIconPreview');
    const selectedIconText = document.getElementById('selectedIconText');
    const caret = document.querySelector('.caret');
    const selectedIconValue = document.getElementById('selectedIconValue');
    const customIconInputPanel = document.getElementById('customIconInputPanel');
    const applyCustomBtn = document.getElementById('applyCustomBtn');

    // 分类管理相关元素
    const categoryListContainer = document.getElementById('categoryListContainer');
    const toggleAddCategoryBtn = document.getElementById('toggleAddCategoryBtn');
    const addCategoryForm = document.getElementById('addCategoryForm');
    const newCategoryNameInput = document.getElementById('newCategoryNameInput');
    const newCategoryIconSelect = document.getElementById('newCategoryIconSelect');
    const newCategoryCustomIconManage = document.getElementById('newCategoryCustomIconManage');
    const newCategoryParentSelect = document.getElementById('newCategoryParentSelect');
    const saveNewCategoryBtn = document.getElementById('saveNewCategoryBtn');
    const newCategoryPriority = document.getElementById('newCategoryPriority');
    const iconSuggestions = document.getElementById('iconSuggestions');

    // 用户界面元素
    const userMenuBtn = document.getElementById('userMenuBtn');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');

    // 全局数据
    let allData = { bookmarks: [], categories: {} };
    let activeCategoryKey = null;
    let isAddingNewCategory = false;
    let lastFetchedIcon = '';
    let isLoggedIn = false;
    let allDataExpanded = {};

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

    // ---------- Linecons 转 Font Awesome ----------
    const lineconsToFA = {
        'lni lni-folder': 'fas fa-folder',
        'lni lni-music': 'fas fa-music',
        'lni lni-video': 'fas fa-video',
        'lni lni-image': 'fas fa-image',
        'lni lni-code': 'fas fa-code',
        'lni lni-game': 'fas fa-gamepad',
        'lni lni-book': 'fas fa-book',
        'lni lni-shopping': 'fas fa-shopping-cart',
        'lni lni-news': 'fas fa-newspaper',
        'lni lni-heart': 'fas fa-heart',
        'lni lni-star': 'fas fa-star',
        'lni lni-cog': 'fas fa-cog',
        'default': 'fas fa-folder'
    };

    const commonIcons = [
        { class: 'fas fa-star' }, { class: 'fas fa-heart' }, { class: 'fas fa-thumbs-up' },
        { class: 'fas fa-check' }, { class: 'fas fa-times' }, { class: 'fas fa-plus' },
        { class: 'fas fa-minus' }, { class: 'fas fa-cog' }, { class: 'fas fa-trash' },
        { class: 'fas fa-pencil-alt' }, { class: 'fas fa-envelope' }, { class: 'fas fa-phone' },
        { class: 'fas fa-map-marker-alt' }, { class: 'fas fa-calendar' }, { class: 'fas fa-clock' },
        { class: 'fas fa-globe' }, { class: 'fas fa-lock' }, { class: 'fas fa-unlock' },
        { class: 'fas fa-share-alt' }, { class: 'fas fa-print' }
    ];

    // ---------- 工具函数 ----------
    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        unsafe = String(unsafe);
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

    function getDomainFavicon(url) {
        try {
            const u = new URL(url);
            return u.origin + '/favicon.ico';
        } catch {
            return null;
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
                document.getElementById('selectedEngineIcon').innerHTML = `<i class="${iconClass}"></i>`;
                currentEngine = searchEngines.find(e => e.name === name) || searchEngines[0];
                if (searchInput) {
                    searchInput.placeholder = type === 'local' ? '点击左侧图标切换搜索引擎，可本地搜索，快速找到书签' : `请输入关键字跳转至${name}搜索`;
                }
                document.getElementById('engineDropdown').classList.remove('show');
            });
        });
    }

    function initSearch() {
        if (!searchInput || !searchBtn) return;
        currentEngine = searchEngines[0];
        searchInput.placeholder = '点击左侧图标切换搜索引擎，可本地搜索，快速找到书签';
        document.getElementById('selectedEngineIcon').innerHTML = `<i class="${searchEngines[0].iconClass}"></i>`;
        const engineSelector = document.querySelector('.search-engine-selector');
        const engineDropdown = document.getElementById('engineDropdown');
        engineSelector.addEventListener('click', (e) => {
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

    // ---------- 分类树操作 ----------
    function buildCategoryTree() {
        const categories = allData.categories || {};
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
            if (node.parent && nodes[node.parent]) nodes[node.parent].children.push(node);
            else roots.push(node);
        }
        roots.sort((a,b) => (a.priority||100) - (b.priority||100));
        roots.forEach(r => r.children.sort((a,b) => (a.priority||100) - (b.priority||100)));
        return roots;
    }

    function renderCategoryTree() {
        const tree = buildCategoryTree();
        tree.sort((a,b) => (a.priority||100) - (b.priority||100));
        if (allDataExpanded) {
            const apply = (node) => {
                node.expanded = !!allDataExpanded[node.name];
                node.children.forEach(apply);
            };
            tree.forEach(apply);
        }
        const allNode = `<div class="tree-node"><div class="tree-node-content ${activeCategoryKey === null ? 'active' : ''}" data-category="__all__"><div class="node-inner"><span class="node-icon"><i class="fas fa-home"></i></span><span class="node-name">全部</span><span class="expand-icon placeholder" style="visibility:hidden;">❯</span></div></div></div>`;
        const recommendNode = `<div class="tree-node"><div class="tree-node-content ${activeCategoryKey === '__recommend__' ? 'active' : ''}" data-category="__recommend__"><div class="node-inner"><span class="node-icon"><i class="fas fa-fire"></i></span><span class="node-name">推荐</span><span class="expand-icon placeholder" style="visibility:hidden;">❯</span></div></div></div>`;
        function renderNode(node) {
            const hasChildren = node.children.length > 0;
            const activeClass = (activeCategoryKey === node.name) ? 'active' : '';
            let iconHtml = '';
            if (node.icon.startsWith('http') || node.icon.startsWith('data:')) iconHtml = `<img src="${node.icon}" onerror="this.style.display='none'">`;
            else iconHtml = `<i class="${node.icon}"></i>`;
            const arrow = hasChildren ? `<span class="expand-icon${node.expanded ? ' expanded' : ''}" data-node="${node.name}">❯</span>` : `<span class="expand-icon placeholder" style="visibility:hidden;">❯</span>`;
            let html = `<div class="tree-node"><div class="tree-node-content ${activeClass}" data-category="${node.name}"><div class="node-inner"><span class="node-icon">${iconHtml}</span><span class="node-name">${escapeHtml(node.name)}</span>${arrow}</div></div>`;
            if (hasChildren) html += `<div class="child-nodes ${node.expanded ? 'expanded' : ''}">${node.children.map(c => renderNode(c)).join('')}</div>`;
            html += `</div>`;
            return html;
        }
        let treeHtml = allNode + recommendNode;
        tree.forEach(root => { treeHtml += renderNode(root); });
        categoryTreeDiv.innerHTML = treeHtml;
        // 绑定点击事件
        document.querySelectorAll('.tree-node-content').forEach(el => {
            el.addEventListener('click', function(e) {
                if (e.target.classList.contains('expand-icon')) return;
                const cat = this.dataset.category;
                if (cat === '__all__') setActiveCategory(null);
                else if (cat === '__recommend__') setActiveCategory('__recommend__');
                else if (cat) {
                    const hasChildren = !!allData.categories[cat] && Object.values(allData.categories).some(c => c.parent === cat);
                    if (hasChildren) {
                        if (!allDataExpanded) allDataExpanded = {};
                        // 一级分类互斥折叠
                        if (!allData.categories[cat]?.parent) {
                            Object.keys(allDataExpanded).forEach(k => { if (!allData.categories[k]?.parent) allDataExpanded[k] = false; });
                        }
                        allDataExpanded[cat] = !allDataExpanded[cat];
                        renderCategoryTree();
                    }
                    setActiveCategory(cat);
                }
            });
        });
        document.querySelectorAll('.expand-icon').forEach(arrow => {
            arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                const nodeName = arrow.dataset.node;
                if (nodeName) {
                    if (!allDataExpanded) allDataExpanded = {};
                    allDataExpanded[nodeName] = !allDataExpanded[nodeName];
                    renderCategoryTree();
                }
            });
        });
    }

    // ---------- 卡片渲染 ----------
    function renderSingleBookmarkCard(b) {
        let iconHtml = '';
        if (b.icon && (b.icon.startsWith('http') || b.icon.startsWith('data:') || b.icon.startsWith('/static/'))) {
            iconHtml = `<img src="${escapeHtml(b.icon)}" alt="icon" data-url="${escapeHtml(b.url)}" onerror="fallbackIcon(this, '${escapeHtml(b.url)}')">`;
        } else {
            iconHtml = `<i class="${lineconsToFA[b.icon] || b.icon || 'fas fa-tag'}"></i>`;
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

    function renderAllBookmarks() {
        if (!allData.bookmarks.length) {
            bookmarkGrid.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签，点击“新增”添加</div>';
            return;
        }
        let html = '<div class="row g-3">';
        allData.bookmarks.forEach(b => { html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`; });
        html += '</div>';
        bookmarkGrid.innerHTML = html;
    }

    function renderBookmarksByCategory(category) {
        const filtered = allData.bookmarks.filter(b => b.category === category);
        if (!filtered.length) { bookmarkGrid.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 这个分类下没有书签</div>'; return; }
        let html = '<div class="row g-3">';
        filtered.forEach(b => { html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`; });
        html += '</div>';
        bookmarkGrid.innerHTML = html;
    }

    async function renderRecommend() {
        try {
            const res = await fetch('/recommend');
            if (!res.ok) throw new Error();
            const bookmarks = await res.json();
            if (!bookmarks.length) { bookmarkGrid.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无推荐，点击更多网页来积累热度</div>'; return; }
            let html = '<div class="row g-3">';
            bookmarks.forEach(b => { html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`; });
            html += '</div>';
            bookmarkGrid.innerHTML = html;
        } catch { bookmarkGrid.innerHTML = '<div class="text-center p-5 text-danger">❌ 加载推荐失败</div>'; }
    }

    function setActiveCategory(cat) {
        activeCategoryKey = cat;
        renderCategoryTree();
        if (cat === null) renderAllBookmarks();
        else if (cat === '__recommend__') renderRecommend();
        else renderBookmarksByCategory(cat);
        // 更新头部标题
        const iconEl = document.getElementById('currentCategoryIcon');
        const nameEl = document.getElementById('currentCategoryName');
        if (cat === null) { if(iconEl) iconEl.innerHTML = '<i class="fas fa-home"></i>'; if(nameEl) nameEl.innerText = '全部'; }
        else if (cat === '__recommend__') { if(iconEl) iconEl.innerHTML = '<i class="fas fa-fire"></i>'; if(nameEl) nameEl.innerText = '推荐'; }
        else { const c = allData.categories[cat]; if(c) { if(iconEl) iconEl.innerHTML = `<i class="${c.icon}"></i>`; if(nameEl) nameEl.innerText = cat; } }
    }

    // 本地搜索
    function localSearch(keyword) {
        const lower = keyword.toLowerCase();
        const old = document.querySelector('.search-results');
        if (old) old.remove();
        if (!lower) { setActiveCategory(activeCategoryKey); return; }
        const matched = allData.bookmarks.filter(b => {
            const title = (b.title || '').toLowerCase();
            const desc = (b.description || '').toLowerCase();
            const tags = (b.tags || []).join(' ').toLowerCase();
            return title.includes(lower) || desc.includes(lower) || tags.includes(lower);
        });
        if (!matched.length) { bookmarkGrid.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">没有找到匹配的书签</div>'; return; }
        let html = '<div class="row g-3">';
        matched.forEach(b => { html += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`; });
        html += '</div>';
        bookmarkGrid.innerHTML = html;
    }

    // ---------- 书签操作 ----------
    window.openEditModal = async function(id) {
        const item = allData.bookmarks.find(b => b.id === id);
        if (!item) return;
        modalTitle.innerText = '✏️ 编辑书签';
        editingId.value = id;
        urlInput.value = item.url;
        urlInput.readOnly = true;
        setCategoryMode(false);
        updateCategorySelect(item.category);
        categorySelect.value = item.category;
        titleInput.value = item.title || '';
        descriptionInput.value = item.description || '';
        if (bookmarkTags) bookmarkTags.value = (item.tags || []).join('/');

        // 设置可见性单选框
        const statusPrivate = document.getElementById('statusPrivate');
        const statusPublic = document.getElementById('statusPublic');
        if (statusPrivate && statusPublic) {
            if (item.status === 'approved') {
                statusPublic.checked = true;
                statusPrivate.checked = false;
            } else {
                statusPrivate.checked = true;
                statusPublic.checked = false;
            }
        }

        deleteBtn.style.display = 'block';
        deleteBtn.onclick = handleDelete;
        bookmarkModal.show();
    };

    async function openAddModal() {
        modalTitle.innerText = '📋 新增书签';
        editingId.value = '';
        urlInput.value = '';
        urlInput.readOnly = false;
        titleInput.value = '';
        descriptionInput.value = '';
        if (bookmarkTags) bookmarkTags.value = '';
        setCategoryMode(false);
        updateCategorySelect();
        categorySelect.value = '';
        parentCategorySelect.value = '';
        deleteBtn.style.display = 'none';
        document.getElementById('statusPrivate').checked = true;
        clipboardHint.innerText = '';
        lastFetchedIcon = '';
        // 重置图标选择器
        if (selectedIconValue) selectedIconValue.value = 'fas fa-folder';
        if (selectedIconPreview) selectedIconPreview.innerHTML = '<i class="fas fa-folder"></i>';
        if (selectedIconText) selectedIconText.textContent = '请选择分类';
        if (selectedCategoryName) selectedCategoryName.value = '';
        if (newCategoryCustomIcon) { newCategoryCustomIcon.style.display = 'none'; newCategoryCustomIcon.value = ''; }
        if (customIconInputPanel) customIconInputPanel.value = '';
        if (iconDropdownPanel) iconDropdownPanel.classList.remove('show');
        if (caret) caret.classList.remove('open');
        bookmarkModal.show();
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text;
                clipboardHint.innerText = '✅ 已读取剪贴板，正在获取信息...';
                fetchMetadata(text);
            } else clipboardHint.innerText = '⚠️ 剪贴板为空';
        } catch { clipboardHint.innerText = '⚠️ 无法读取剪贴板'; }
    }

    async function fetchMetadata(url) {
        try {
            const res = await fetch('/fetch-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (data.success) {
                lastFetchedIcon = data.icon || '';
                titleInput.value = data.title || '';
                descriptionInput.value = data.description || '';
                clipboardHint.innerText = '✅ 信息获取完成';
            } else clipboardHint.innerText = '⚠️ 信息获取失败';
        } catch { clipboardHint.innerText = '⚠️ 抓取异常'; }
    }

    async function handleSubmit() {
        // 1. 登录检查
        if (!isLoggedIn) {
            alert('请先登录');
            loginModal.show();
            return;
        }

        // 2. 获取基础输入
        const url = urlInput.value.trim();
        if (!url) {
            alert('请输入网址');
            return;
        }

        let category;
        let categoryIcon = '';
        let parentCategory = '';

        // 3. 获取可见性
        let status = 'private';
        const statusRadio = document.querySelector('input[name="bookmarkStatus"]:checked');
        if (statusRadio) {
            status = statusRadio.value;
        } else {
            console.warn('未找到可见性单选框，使用默认值 private');
        }

        // 4. 公开时二次确认
        if (status === 'public') {
            if (!confirm('公开书签需管理员审核后，才能发布。是否确定提交审核？')) {
                return;
            }
        }

        // 5. 处理分类（新增模式或编辑模式）
        if (isAddingNewCategory) {
            category = selectedCategoryName.value.trim();
            if (!category) {
                alert('请选择一个分类图标');
                return;
            }

            if (newCategoryCustomIcon.style.display === 'block' && newCategoryCustomIcon.value.trim()) {
                categoryIcon = newCategoryCustomIcon.value.trim();
            } else {
                categoryIcon = selectedIconValue.value || 'fas fa-folder';
            }
            if (!categoryIcon) categoryIcon = 'fas fa-folder';

            parentCategory = parentCategorySelect.value;
        } else {
            category = categorySelect.value;
            if (!category) {
                alert('请选择分类');
                return;
            }
        }

        // 6. 图标处理（抓取或保留原有）
        let icon = '';
        if (editingId.value) {
            const original = allData.bookmarks.find(b => b.id === parseInt(editingId.value));
            icon = original ? original.icon : '';
        } else {
            if (lastFetchedIcon) {
                icon = lastFetchedIcon;
            } else {
                try {
                    const urlObj = new URL(url);
                    icon = urlObj.origin + '/favicon.ico';
                } catch {
                    icon = '';
                }
            }
        }

        // 7. 标签处理
        const tagsRaw = bookmarkTags ? bookmarkTags.value.trim() : '';
        let tags = [];
        if (tagsRaw) {
            tags = tagsRaw.split('/').map(t => t.trim()).filter(t => t);
        }

        // 8. 构建 payload
        const payload = {
            url: url,
            category: category,
            category_icon: categoryIcon,
            parent_category: parentCategory,
            title: titleInput.value.trim() || category || '链接',
            description: descriptionInput.value.trim() || '',
            icon: icon,
            tags: tags,
            status: status
        };

        // 9. 禁用提交按钮
        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';

        try {
            let res;
            if (editingId.value) {
                // 编辑模式
                res = await fetch(`/edit/${editingId.value}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // 新增模式
                res = await fetch('/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const result = await res.json();
            if (res.ok && result.success) {
                alert(editingId.value ? '✅ 修改成功！' : '✅ 提交成功！');
                closeModal();
                // 刷新数据
                await refreshDataAndUI();
            } else {
                alert('❌ 操作失败：' + (result.message || '未知错误'));
            }
        } catch (err) {
            console.error('提交错误', err);
            alert('❌ 网络错误，请重试');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = editingId.value ? '保存修改' : '提交书签';
        }
    }

    async function handleDelete() {
        const id = editingId.value;
        if (!id || !confirm('确定要删除这个书签吗？')) return;
        deleteBtn.disabled = true;
        deleteBtn.textContent = '删除中...';
        try {
            const res = await fetch(`/delete/${id}`, { method: 'POST' });
            const result = await res.json();
            if (res.ok && result.success) {
                alert('✅ 删除成功！');
                closeModal();
                await refreshDataAndUI();
            } else alert('❌ 删除失败：' + (result.message || ''));
        } catch { alert('❌ 网络错误'); }
        finally { deleteBtn.disabled = false; deleteBtn.textContent = '删除'; }
    }

    function closeModal() { bookmarkModal.hide(); urlInput.readOnly = false; }

    // ---------- 分类管理 ----------
    function updateCategorySelect(selected = '') {
        if (!categorySelect) categorySelect = document.getElementById('categorySelect');
        const cats = Object.keys(allData.categories || {}).sort();
        let html = '<option value="">-- 选择已有分类 --</option>';
        cats.forEach(c => { html += `<option value="${escapeHtml(c)}" ${c === selected ? 'selected' : ''}>${escapeHtml(c)}</option>`; });
        categorySelect.innerHTML = html;
    }

    function updateParentCategorySelect() {
        const cats = Object.keys(allData.categories || {}).sort();
        let html = '<option value="">可选，不选则下方分类为一级分类</option>';
        cats.forEach(c => { html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`; });
        parentCategorySelect.innerHTML = html;
    }

    function setCategoryMode(isNew) {
        isAddingNewCategory = isNew;
        if (isNew) {
            if (existingCategoryGroup) existingCategoryGroup.style.display = 'none';
            if (newCategoryIconGroup) newCategoryIconGroup.style.display = 'block';
            if (parentCategoryGroup) parentCategoryGroup.style.display = 'block';
            if (toggleCategoryMode) { toggleCategoryMode.style.display = 'inline'; toggleCategoryMode.innerText = '🔽 选择已有分类'; }
            updateParentCategorySelect();
            if (selectedCategoryName) selectedCategoryName.value = '';
            if (selectedIconValue) selectedIconValue.value = 'fas fa-folder';
            if (selectedIconPreview) selectedIconPreview.innerHTML = '<i class="fas fa-folder"></i>';
            if (selectedIconText) selectedIconText.textContent = '请选择分类';
            if (newCategoryCustomIcon) { newCategoryCustomIcon.style.display = 'none'; newCategoryCustomIcon.value = ''; }
        } else {
            if (existingCategoryGroup) existingCategoryGroup.style.display = 'block';
            if (newCategoryIconGroup) newCategoryIconGroup.style.display = 'none';
            if (parentCategoryGroup) parentCategoryGroup.style.display = 'none';
            if (toggleCategoryMode) { toggleCategoryMode.style.display = 'inline'; toggleCategoryMode.innerText = '➕ 新增分类'; }
        }
    }

    toggleCategoryMode?.addEventListener('click', () => setCategoryMode(!isAddingNewCategory));

    // 分类管理弹窗
    function loadCategoryList() {
        const cats = allData.categories || {};
        const sorted = Object.keys(cats).sort((a,b) => (cats[a].priority||100) - (cats[b].priority||100));
        let html = '';
        sorted.forEach(name => {
            const cat = cats[name];
            const iconHtml = cat.icon.startsWith('http') ? `<img src="${cat.icon}" style="width:20px">` : `<i class="${cat.icon}"></i>`;
            html += `<tr data-category="${escapeHtml(name)}">
                        <td>${iconHtml}</td>
                        <td>${escapeHtml(name)}</td>
                        <td>${cat.parent ? escapeHtml(cat.parent) : '-'}</td>
                        <td>${cat.priority ?? 100}</td>
                        <td><button class="btn btn-sm btn-outline-primary edit-category-btn"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-outline-danger delete-category-btn"><i class="fas fa-trash"></i></button></td>
                    </tr>`;
        });
        categoryListContainer.innerHTML = html;
        document.querySelectorAll('.edit-category-btn').forEach(btn => {
            btn.addEventListener('click', () => { const name = btn.closest('tr').dataset.category; editCategory(name); });
        });
        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', () => { const name = btn.closest('tr').dataset.category; deleteCategory(name); });
        });
        let parentOpts = '<option value="">-- 无 (一级分类) --</option>';
        sorted.forEach(name => { parentOpts += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`; });
        newCategoryParentSelect.innerHTML = parentOpts;
    }

    function editCategory(name) {
        const cat = allData.categories[name];
        const newName = prompt('新名称', name);
        if (newName && newName !== name) {
            if (allData.categories[newName]) { alert('分类已存在'); return; }
            // 更新所有书签中的分类引用
            allData.bookmarks.forEach(b => { if (b.category === name) b.category = newName; });
            delete allData.categories[name];
            allData.categories[newName] = { ...cat, name: newName };
            name = newName;
        }
        const newIcon = prompt('图标类名或URL', cat.icon);
        if (newIcon) cat.icon = newIcon;
        const newParent = prompt('上级分类（留空为无）', cat.parent || '');
        cat.parent = newParent || null;
        const newPriority = parseInt(prompt('优先级（数字越小越靠前）', cat.priority || 100));
        if (!isNaN(newPriority)) cat.priority = newPriority;
        fetch(`/category/${encodeURIComponent(name)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, icon: cat.icon, parent: cat.parent, priority: cat.priority })
        }).then(res => res.json()).then(result => {
            if (result.success) { alert('修改成功'); refreshDataAndUI(); }
            else alert('修改失败：' + result.message);
        }).catch(() => alert('网络错误'));
    }

    function deleteCategory(name) {
        if (!confirm(`确定删除分类“${name}”及其所有子分类和书签？`)) return;
        fetch(`/category/${encodeURIComponent(name)}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(result => { if (result.success) refreshDataAndUI(); else alert('删除失败：' + result.message); })
            .catch(() => alert('网络错误'));
    }

    // 新增分类
    function toggleAddCategoryForm() {
        if (addCategoryForm.style.display === 'none') {
            addCategoryForm.style.display = 'block';
            toggleAddCategoryBtn.innerHTML = '<i class="fas fa-minus"></i> 隐藏表单';
        } else {
            addCategoryForm.style.display = 'none';
            toggleAddCategoryBtn.innerHTML = '<i class="fas fa-plus"></i> 新增分类';
        }
    }
    document.querySelector('#categoryManageModal .card-header')?.addEventListener('click', (e) => {
        if (!e.target.closest('#addCategoryForm') && !e.target.closest('#toggleAddCategoryBtn')) toggleAddCategoryForm();
    });
    toggleAddCategoryBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleAddCategoryForm(); });
    newCategoryIconSelect?.addEventListener('change', function() { newCategoryCustomIconManage.style.display = this.value === 'custom' ? 'block' : 'none'; });
    saveNewCategoryBtn?.addEventListener('click', async () => {
        const name = newCategoryNameInput.value.trim();
        if (!name) { alert('请输入分类名称'); return; }
        let icon = newCategoryIconSelect.value === 'custom' ? newCategoryCustomIconManage.value.trim() : newCategoryIconSelect.value;
        if (!icon) icon = 'fas fa-folder';
        const parent = newCategoryParentSelect.value || null;
        const priority = parseInt(newCategoryPriority.value) || 100;
        try {
            const res = await fetch('/add_category', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, icon, parent, priority }) });
            const result = await res.json();
            if (res.ok && result.success) {
                alert('✅ 分类添加成功');
                await refreshDataAndUI();
                addCategoryForm.style.display = 'none';
                toggleAddCategoryBtn.innerHTML = '<i class="fas fa-plus"></i> 新增分类';
                newCategoryNameInput.value = '';
                newCategoryIconSelect.value = 'fas fa-folder';
                newCategoryCustomIconManage.value = '';
                newCategoryParentSelect.value = '';
                newCategoryPriority.value = '100';
            } else alert('❌ 添加失败：' + (result.message || ''));
        } catch { alert('❌ 网络错误'); }
    });

    // 图标选择器
    selectedIconDisplay?.addEventListener('click', (e) => { e.stopPropagation(); iconDropdownPanel.classList.toggle('show'); caret.classList.toggle('open', iconDropdownPanel.classList.contains('show')); });
    document.addEventListener('click', (e) => { if (!selectedIconDisplay?.contains(e.target) && !iconDropdownPanel?.contains(e.target)) { iconDropdownPanel?.classList.remove('show'); caret?.classList.remove('open'); } });
    iconOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            const value = opt.dataset.value;
            const name = opt.dataset.name;
            selectedIconPreview.innerHTML = opt.querySelector('i').cloneNode(true).outerHTML;
            selectedIconText.textContent = name;
            selectedIconValue.value = value;
            selectedCategoryName.value = name;
            iconDropdownPanel.classList.remove('show');
            caret.classList.remove('open');
            if (newCategoryCustomIcon) { newCategoryCustomIcon.style.display = 'none'; newCategoryCustomIcon.value = ''; }
        });
    });
    applyCustomBtn?.addEventListener('click', () => {
        const custom = customIconInputPanel.value.trim();
        if (!custom) return;
        let name = custom, icon = custom;
        if (custom.includes('/')) { const parts = custom.split('/'); name = parts[0].trim(); icon = parts[1].trim(); }
        if (icon.startsWith('http') || icon.startsWith('data:')) {
            selectedIconPreview.innerHTML = `<img src="${icon}" style="max-width:20px; max-height:20px;">`;
            if (newCategoryCustomIcon) { newCategoryCustomIcon.style.display = 'block'; newCategoryCustomIcon.value = icon; }
        } else {
            selectedIconPreview.innerHTML = `<i class="${icon}"></i>`;
            if (newCategoryCustomIcon) newCategoryCustomIcon.style.display = 'none';
        }
        selectedIconText.textContent = name;
        selectedIconValue.value = icon;
        selectedCategoryName.value = name;
        iconDropdownPanel.classList.remove('show');
        caret.classList.remove('open');
    });
    if (newCategoryCustomIconManage) {
        function renderIconSuggestions() {
            let html = '';
            commonIcons.forEach(ic => { html += `<div class="suggestion-item" data-icon="${ic.class}"><i class="${ic.class}"></i> <span class="suggestion-class">${ic.class}</span></div>`; });
            html += `<div class="suggestion-item more-link" data-action="more"><i class="fas fa-external-link-alt"></i> <span>更多图标...</span></div>`;
            iconSuggestions.innerHTML = html;
        }
        renderIconSuggestions();
        newCategoryCustomIconManage.addEventListener('focus', () => { iconSuggestions.style.display = 'block'; });
        newCategoryCustomIconManage.addEventListener('blur', () => { setTimeout(() => { iconSuggestions.style.display = 'none'; }, 200); });
        iconSuggestions.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (!item) return;
            if (item.dataset.action === 'more') { window.open('https://fontawesome.com/icons', '_blank'); iconSuggestions.style.display = 'none'; newCategoryCustomIconManage.blur(); return; }
            const iconClass = item.dataset.icon;
            if (iconClass) { newCategoryCustomIconManage.value = iconClass; newCategoryCustomIconManage.dispatchEvent(new Event('input')); iconSuggestions.style.display = 'none'; }
        });
    }

    // ---------- 导入导出 ----------
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
        return { categories, bookmarks };
    }

    async function importBookmarksWithCategories(categories, bookmarks) {
        const btn = importBtn;
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导入中...';
        btn.disabled = true;
        try {
            const res = await fetch('/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categories, bookmarks })
            });
            const result = await res.json();
            if (res.ok && result.success) {
                alert(`✅ 导入成功！共导入 ${result.imported} 个书签。`);
                await refreshDataAndUI();
            } else alert('❌ 导入失败：' + (result.message || ''));
        } catch { alert('❌ 网络错误'); }
        finally { btn.innerHTML = original; btn.disabled = false; }
    }

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const html = e.target.result;
            const result = parseBookmarkHtml(html);
            if (!result) { alert('无法解析书签文件'); return; }
            if (confirm(`找到 ${result.categories.length} 个分类，${result.bookmarks.length} 个书签。确定导入吗？`)) {
                importBookmarksWithCategories(result.categories, result.bookmarks);
            }
        };
        reader.readAsText(file);
    }

    importBtn?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html,.htm';
        input.onchange = handleFileSelect;
        input.click();
    });

    exportBtn?.addEventListener('click', async () => {
        try {
            const res = await fetch('/export');
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bookmarks_export.json';
            a.click();
            URL.revokeObjectURL(url);
        } catch { alert('导出失败'); }
    });

    // ---------- 辅助函数 ----------
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
        } else parent.innerHTML = '<i class="fas fa-tag"></i>';
    };

    window.searchByTag = function(tag) {
        if (searchInput) { searchInput.value = tag; searchInput.placeholder = '点击左侧图标切换搜索引擎，可本地搜索，快速找到书签'; }
        currentEngine = searchEngines[0];
        document.getElementById('selectedEngineIcon').innerHTML = `<i class="${searchEngines[0].iconClass}"></i>`;
        localSearch(tag);
    };

    window.changeIcon = async function(id) {
        const newIcon = prompt('请输入新的图标链接或字体图标类名：');
        if (!newIcon) return;
        try {
            const res = await fetch(`/edit/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ icon: newIcon }) });
            const result = await res.json();
            if (res.ok && result.success) { alert('✅ 图标更新成功'); await refreshDataAndUI(); }
            else alert('❌ 更新失败：' + (result.message || ''));
        } catch { alert('❌ 网络错误'); }
    };

    window.incrementClick = function(id) {
        if (isLoggedIn) fetch(`/increment_click/${id}`, { method: 'POST' }).catch(() => {});
    };

    // ---------- 刷新数据与登录状态 ----------
    async function refreshDataAndUI() {
        try {
            const res = await fetch('/list');
            if (!res.ok) throw new Error('加载失败');
            const data = await res.json();
            allData = data;
            if (!allData._expanded) allData._expanded = {};

            renderCategoryTree();
            updateCategorySelect();

            if (activeCategoryKey && allData.categories[activeCategoryKey]) {
                setActiveCategory(activeCategoryKey);
            } else {
                setActiveCategory(null);
            }

            // 尝试获取用户信息（用于显示登录状态）
            const userRes = await fetch('/user');
            if (userRes.ok) {
                const userData = await userRes.json();
                isLoggedIn = true;
                document.body.classList.add('logged-in');
                userMenuBtn.innerText = '已登录';
                usernameDisplay.innerText = '当前用户：' + userData.username;
            } else {
                isLoggedIn = false;
                document.body.classList.remove('logged-in');
                userMenuBtn.innerText = '未登录';
                usernameDisplay.innerText = '';
            }
        } catch (err) {
            console.error(err);
            categoryTreeDiv.innerHTML = `<div class="text-center p-4 text-danger">❌ 加载失败</div>`;
            bookmarkGrid.innerHTML = `<div class="text-center p-5 text-danger">❌ 无法加载数据，请刷新重试</div>`;
        }
    }

    // ---------- 事件绑定 ----------
    addBookmarkHeaderBtn?.addEventListener('click', openAddModal);
    manageCategoriesBtn?.addEventListener('click', async () => { await refreshDataAndUI(); loadCategoryList(); categoryManageModal.show(); });
    submitBtn?.addEventListener('click', handleSubmit);
    collapseBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const icon = collapseBtn.querySelector('i');
        if (sidebar.classList.contains('collapsed')) icon.className = 'fas fa-chevron-right';
        else icon.className = 'fas fa-bars';
        hideSubcategoryPopup();
        if (sidebar.classList.contains('collapsed') && allData._expanded) {
            Object.keys(allData._expanded).forEach(k => allData._expanded[k] = false);
            renderCategoryTree();
        }
    });
    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') { e.preventDefault(); openAddModal(); } });
    document.querySelector('.shortcut-hint')?.addEventListener('click', () => openAddModal());

    // 浮层
    const popup = document.getElementById('subcategoryPopup');
    function getDirectChildren(cat) { return (allData.categories && Object.values(allData.categories).filter(c => c.parent === cat).map(c => c.name)) || []; }
    function showSubcategoryPopup(target, cat) {
        const children = getDirectChildren(cat);
        if (!children.length) return;
        const rect = target.closest('.tree-node-content').getBoundingClientRect();
        const sidebarRect = sidebar.getBoundingClientRect();
        popup.innerHTML = children.map(c => `<div class="subcategory-item" data-category="${escapeHtml(c)}">${escapeHtml(c)}</div>`).join('');
        popup.style.top = (rect.top - sidebarRect.top) + 'px';
        popup.classList.add('show');
    }
    function hideSubcategoryPopup() { popup?.classList.remove('show'); }
    sidebar?.addEventListener('mouseover', (e) => {
        if (!sidebar.classList.contains('collapsed')) return;
        const icon = e.target.closest('.node-icon');
        if (!icon) return;
        const content = icon.closest('.tree-node-content');
        if (!content) return;
        const cat = content.dataset.category;
        if (!cat || cat === '__all__' || cat === '__recommend__') return;
        const children = getDirectChildren(cat);
        if (!children.length) { hideSubcategoryPopup(); return; }
        showSubcategoryPopup(icon, cat);
    });
    sidebar?.addEventListener('mouseleave', () => { setTimeout(() => { if (!popup?.matches(':hover')) hideSubcategoryPopup(); }, 100); });
    popup?.addEventListener('click', (e) => {
        const item = e.target.closest('.subcategory-item');
        if (item) { setActiveCategory(item.dataset.category); hideSubcategoryPopup(); }
    });

    // 登录/注册模态框
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const err = document.getElementById('loginError');
        err.style.display = 'none';
        try {
            const res = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password }) });
            if (res.ok) { loginModal.hide(); await refreshDataAndUI(); }
            else { err.innerText = '用户名或密码错误'; err.style.display = 'block'; }
        } catch { err.innerText = '网络错误'; err.style.display = 'block'; }
    });
    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        const err = document.getElementById('registerError');
        err.style.display = 'none';
        try {
            const res = await fetch('/register', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password }) });
            if (res.ok) { registerModal.hide(); loginModal.show(); }
            else { err.innerText = '用户名已存在或注册失败'; err.style.display = 'block'; }
        } catch { err.innerText = '网络错误'; err.style.display = 'block'; }
    });
    document.getElementById('showRegisterBtn')?.addEventListener('click', (e) => { e.preventDefault(); loginModal.hide(); registerModal.show(); });
    document.getElementById('showLoginBtn')?.addEventListener('click', (e) => { e.preventDefault(); registerModal.hide(); loginModal.show(); });
    userMenuBtn?.addEventListener('click', (e) => { if (userMenuBtn.innerText === '未登录') { e.preventDefault(); loginModal.show(); } });
    logoutBtn?.addEventListener('click', async () => {
        await fetch('/logout');
        await refreshDataAndUI();
        if (userMenuBtn) userMenuBtn.innerText = '未登录';
        if (usernameDisplay) usernameDisplay.innerText = '';
        loginModal.show();
    });

    // 启动
    initSearch();
    refreshDataAndUI();

    // 点击后显示弹窗
    const enhancedTitle = document.getElementById('enhancedTitle');
    const enhancedBadge = document.getElementById('enhancedBadge');
    const enhancedModal = new bootstrap.Modal(document.getElementById('enhancedNoticeModal'));

    function showEnhancedNotice() {
        enhancedModal.show();
    }

    if (enhancedTitle) enhancedTitle.addEventListener('click', showEnhancedNotice);
    if (enhancedBadge) enhancedBadge.addEventListener('click', showEnhancedNotice);

    // 公开便签
    const privateCheckbox = document.getElementById('bookmarkPrivate');
    if (privateCheckbox) {
        privateCheckbox.addEventListener('change', function() {
            if (!this.checked) {
                if (!confirm('公开书签后，所有访客均能看到此书签，是否确定公开？')) {
                    this.checked = true; // 用户取消，恢复私密
                }
            }
        });
    }
})();