(function() {
    // 获取模态框实例
    const bookmarkModal = new bootstrap.Modal(document.getElementById('bookmarkModal'));

    // DOM 元素
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
    const selectedCategoryName = document.getElementById('selectedCategoryName');
    const addBookmarkHeaderBtn = document.getElementById('addBookmarkHeaderBtn');

    // 自定义图标选择器元素
    const selectedIconDisplay = document.getElementById('selectedIconDisplay');
    const iconDropdownPanel = document.getElementById('iconDropdownPanel');
    const iconOptions = document.querySelectorAll('.icon-option');
    const selectedIconPreview = document.getElementById('selectedIconPreview');
    const selectedIconText = document.getElementById('selectedIconText');
    const caret = document.querySelector('.caret');
    const selectedIconValue = document.getElementById('selectedIconValue');
    const customIconInputPanel = document.getElementById('customIconInputPanel');
    const applyCustomBtn = document.getElementById('applyCustomIcon');

    // 分类管理相关元素
    const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
    const categoryManageModal = new bootstrap.Modal(document.getElementById('categoryManageModal'));
    const categoryListContainer = document.getElementById('categoryListContainer');
    const toggleAddCategoryBtn = document.getElementById('toggleAddCategoryBtn');
    const addCategoryForm = document.getElementById('addCategoryForm');
    const newCategoryNameInput = document.getElementById('newCategoryNameInput');
    const newCategoryIconSelect = document.getElementById('newCategoryIconSelect');
    const newCategoryCustomIcon = document.getElementById('newCategoryCustomIcon');
    const newCategoryParentSelect = document.getElementById('newCategoryParentSelect');
    const saveNewCategoryBtn = document.getElementById('saveNewCategoryBtn');
    const newCategoryCustomIconManage = document.getElementById('newCategoryCustomIconManage');
    const newCategoryPriority = document.getElementById('newCategoryPriority');
    const iconSuggestions = document.getElementById('iconSuggestions');

    // 全局数据
    let allData = { bookmarks: [], categories: {} };
    let activeCategoryKey = null;
    let isAddingNewCategory = false;
    let lastFetchedIcon = '';

    // 搜索引擎配置
    const searchEngines = [
        { name: '本地搜索', iconClass: 'fas fa-search', type: 'local', url: '' },
        { name: '谷歌', iconClass: 'fab fa-google', type: 'web', url: 'https://www.google.com/search?q=' },
        { name: '百度', iconClass: 'fas fa-paw', type: 'web', url: 'https://www.baidu.com/s?wd=' },
        { name: '必应', iconClass: 'fab fa-microsoft', type: 'web', url: 'https://www.bing.com/search?q=' },
        { name: 'GitHub', iconClass: 'fab fa-github', type: 'web', url: 'https://github.com/search?q=' },
        { name: 'Bilibili', iconClass: 'fab fa-bilibili', type: 'web', url: 'https://search.bilibili.com/all?keyword=' },
        { name: 'DeepSeek', iconClass: 'fas fa-robot', type: 'web', url: 'https://chat.deepseek.com/?q=' }
    ];
    let currentEngine = searchEngines[0];

    // ---------- Linecons 转 Font Awesome 映射 ----------
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
        { class: 'fas fa-star' },
        { class: 'fas fa-heart' },
        { class: 'fas fa-thumbs-up' },
        { class: 'fas fa-check' },
        { class: 'fas fa-times' },
        { class: 'fas fa-plus' },
        { class: 'fas fa-minus' },
        { class: 'fas fa-cog' },
        { class: 'fas fa-trash' },
        { class: 'fas fa-pencil-alt' },
        { class: 'fas fa-envelope' },
        { class: 'fas fa-phone' },
        { class: 'fas fa-map-marker-alt' },
        { class: 'fas fa-calendar' },
        { class: 'fas fa-clock' },
        { class: 'fas fa-globe' },
        { class: 'fas fa-lock' },
        { class: 'fas fa-unlock' },
        { class: 'fas fa-share-alt' },
        { class: 'fas fa-print' }
    ];

    function getFaIcon(lineconsClass) {
        return lineconsToFA[lineconsClass] || lineconsToFA['default'];
    }

    // ---------- 工具函数 ----------
    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        unsafe = String(unsafe); // 强制转换为字符串
        return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function shortenUrl(url) {
        try {
            const u = new URL(url);
            return u.hostname.replace('www.', '') + (u.pathname !== '/' ? '…' : '');
        } catch {
            return url.length > 40 ? url.slice(0, 40) + '…' : url;
        }
    }

    window.getDomainFaviconFromUrl = function(url) {
        try {
            const u = new URL(url);
            return `${u.protocol}//${u.hostname}/favicon.ico`;
        } catch {
            return null;
        }
    };

    // ---------- 搜索引擎下拉菜单 ----------
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
                if (searchInput) {
                    searchInput.placeholder = type === 'local' ? '可本地搜索，快速找到书签' : `请输入关键字跳转至${name}搜索`;
                }
                document.getElementById('engineDropdown').classList.remove('show');
            });
        });
    }

    function initSearch() {
        if (!searchInput || !searchBtn) return;

        currentEngine = searchEngines[0];
        searchInput.placeholder = currentEngine.type === 'local' ? '可本地搜索，快速找到书签' : '请输入关键字跳转至搜索引擎搜索';
        const selectedEngineIcon = document.getElementById('selectedEngineIcon');
        selectedEngineIcon.innerHTML = `<i class="${searchEngines[0].iconClass}"></i>`;
        selectedEngineIcon.title = searchEngines[0].name;

        const engineSelector = document.querySelector('.search-engine-selector');
        const engineDropdown = document.getElementById('engineDropdown');

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

    // 本地搜索
    function localSearch(keyword) {
        const sections = document.querySelectorAll('.category-section');
        const lowerKeyword = keyword.toLowerCase();

        const oldResults = document.querySelector('.search-results');
        if (oldResults) oldResults.remove();

        if (!lowerKeyword) {
            sections.forEach(section => section.style.display = 'block');
            return;
        }

        sections.forEach(section => section.style.display = 'none');

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results row g-3';
        bookmarkGrid.appendChild(resultsContainer);

        const allCards = document.querySelectorAll('.card');
        let hasMatch = false;

        allCards.forEach(card => {
            const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
            const desc = card.querySelector('.card-description')?.textContent.toLowerCase() || '';
            const url = card.querySelector('.card-toast')?.textContent.toLowerCase() || '';

            if (title.includes(lowerKeyword) || desc.includes(lowerKeyword) || url.includes(lowerKeyword)) {
                const clonedCard = card.cloneNode(true);
                clonedCard.style.display = 'flex';
                resultsContainer.appendChild(clonedCard);
                hasMatch = true;
            }
        });

        if (!hasMatch) {
            resultsContainer.innerHTML = '<div class="col-12 text-center p-5" style="color:#8fa3bc;">没有找到匹配的网址</div>';
        }
    }

    // ---------- 分类相关 ----------
    function updateCategorySelect(selectedCategory = '') {
        if (!categorySelect || !categorySelect.tagName) {
            categorySelect = document.getElementById('categorySelect');
            if (!categorySelect) {
                console.error('categorySelect element not found!');
                return;
            }
        }
        const categories = Object.keys(allData.categories || {}).sort();
        let options = '<option value="">-- 选择已有分类 --</option>';
        categories.forEach(cat => {
            options += `<option value="${escapeHtml(cat)}" ${cat === selectedCategory ? 'selected' : ''}>${escapeHtml(cat)}</option>`;
        });
        categorySelect.innerHTML = options;
    }

    function updateParentCategorySelect() {
        const categories = Object.keys(allData.categories || {}).sort();
        let options = '<option value="">可选，不选则下方分类为一级分类</option>';
        categories.forEach(cat => {
            if (isAddingNewCategory && selectedCategoryName?.value === cat) return;
            options += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
        });
        parentCategorySelect.innerHTML = options;
    }

    function setCategoryMode(isNew) {
        isAddingNewCategory = isNew;
        if (isNew) {
            if (existingCategoryGroup) existingCategoryGroup.style.display = 'none';
            if (newCategoryIconGroup) newCategoryIconGroup.style.display = 'block';
            if (parentCategoryGroup) parentCategoryGroup.style.display = 'block';
            if (toggleCategoryMode) {
                toggleCategoryMode.style.display = 'inline';
                toggleCategoryMode.innerText = '🔽 选择已有分类';
            }
            updateParentCategorySelect();

            if (selectedCategoryName) selectedCategoryName.value = '';
            if (selectedIconValue) selectedIconValue.value = 'fas fa-folder';
            if (selectedIconPreview) selectedIconPreview.innerHTML = '<i class="fas fa-folder"></i>';
            if (selectedIconText) selectedIconText.textContent = '请选择分类';
            if (newCategoryCustomIcon) {
                newCategoryCustomIcon.style.display = 'none';
                newCategoryCustomIcon.value = '';
            }
        } else {
            if (existingCategoryGroup) existingCategoryGroup.style.display = 'block';
            if (newCategoryIconGroup) newCategoryIconGroup.style.display = 'none';
            if (parentCategoryGroup) parentCategoryGroup.style.display = 'none';
            if (toggleCategoryMode) {
                toggleCategoryMode.style.display = 'inline';
                toggleCategoryMode.innerText = '➕ 新增分类';
            }
        }
    }

    toggleCategoryMode.addEventListener('click', function() {
        setCategoryMode(!isAddingNewCategory);
    });

    parentCategorySelect.addEventListener('change', function() {
        if (isAddingNewCategory) {
            if (this.value) {
                newCategoryIconGroup.style.display = 'none';
            } else {
                newCategoryIconGroup.style.display = 'block';
            }
        }
    });

    // 构建分类树
    function buildCategoryTree() {
        const categories = allData.categories || {};
        const nodes = {};

        for (let name in categories) {
            nodes[name] = {
                name: name,
                icon: categories[name].icon || 'fas fa-folder',
                parent: categories[name].parent || null,
                priority: categories[name].priority || 100,  // 默认100
                children: []
            };
        }

        const rootNodes = [];
        for (let name in nodes) {
            const node = nodes[name];
            const parentName = node.parent;
            if (parentName && nodes[parentName]) {
                nodes[parentName].children.push(node);
            } else {
                rootNodes.push(node);
            }
        }

        rootNodes.sort((a, b) => a.name.localeCompare(b.name));
        rootNodes.forEach(root => root.children.sort((a, b) => a.name.localeCompare(b.name)));

        return rootNodes;
    }

    function findNodeInTree(nodeName, nodes) {
        for (let node of nodes) {
            if (node.name === nodeName) return node;
            if (node.children && node.children.length > 0) {
                const found = findNodeInTree(nodeName, node.children);
                if (found) return found;
            }
        }
        return null;
    }

    function toggleNodeExpanded(nodeName) {
        if (!allData._expanded) allData._expanded = {};
        allData._expanded[nodeName] = !allData._expanded[nodeName];
        renderCategoryTree();
    }

    function renderCategoryTree() {
        const tree = buildCategoryTree();

        // 在这里对一级分类按优先级排序（数字越小越靠前）
        tree.sort((a, b) => (a.priority || 100) - (b.priority || 100));

        if (allData._expanded) {
            function applyExpanded(node) {
                if (allData._expanded[node.name]) {
                    node.expanded = true;
                } else {
                    node.expanded = false;
                }
                if (node.children) {
                    node.children.forEach(applyExpanded);
                }
            }
            tree.forEach(applyExpanded);
        }

        if (!tree.length && activeCategoryKey !== null) {
            categoryTreeDiv.innerHTML = `<div class="text-center p-4" style="color:#8fa3bc;">📭 暂无分类</div>`;
            return;
        }

        const allNodeHtml = `
            <div class="tree-node">
                <div class="tree-node-content ${activeCategoryKey === null ? 'active' : ''}" data-category="__all__">
                    <span class="node-icon"><i class="fas fa-home"></i></span>
                    <span class="node-name">全部</span>
                    <span class="expand-icon placeholder" style="visibility:hidden;">❯</span>
                </div>
            </div>
        `;

        function renderNode(node) {
            const hasChildren = node.children && node.children.length > 0;
            const isActive = (activeCategoryKey === node.name);
            const activeClass = isActive ? 'active' : '';

            let iconHtml = '';
            if (node.icon) {
                if (node.icon.startsWith('http') || node.icon.startsWith('data:image')) {
                    iconHtml = `<img src="${node.icon}" onerror="this.style.display='none';this.parentNode.innerHTML='<i class=\\'fas fa-folder\\'></i>';">`;
                } else {
                    const faClass = lineconsToFA[node.icon] || node.icon;
                    iconHtml = `<i class="${faClass}"></i>`;
                }
            } else {
                iconHtml = '<i class="fas fa-folder"></i>';
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
                        <span class="node-icon">${iconHtml}</span>
                        <span class="node-name">${escapeHtml(node.name)}</span>
                        ${arrowHtml}
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

        let treeHtml = allNodeHtml;
        for (let root of tree) {
            treeHtml += renderNode(root);
        }
        categoryTreeDiv.innerHTML = treeHtml;

        document.querySelectorAll('.tree-node-content').forEach(el => {
            el.addEventListener('click', function(e) {
                if (sidebar.classList.contains('collapsed')) return;
                if (e.target.classList.contains('expand-icon')) return;
                const cat = this.dataset.category;
                if (cat === '__all__') {
                    setActiveCategory(null);
                    return;
                }
                if (cat) {
                    const treeNode = this.closest('.tree-node');
                    const hasChildren = treeNode.querySelector('.child-nodes') !== null;
                    if (hasChildren) {
                        toggleNodeExpanded(cat);
                    }
                    setActiveCategory(cat);
                }
            });
        });

        document.querySelectorAll('.expand-icon').forEach(arrow => {
            arrow.addEventListener('click', function(e) {
                e.stopPropagation();
                const nodeName = this.dataset.node;
                if (nodeName) {
                    toggleNodeExpanded(nodeName);
                }
            });
        });
    }

    // 卡片渲染
    function renderSingleBookmarkCard(b) {
        let iconHtml = '';
        if (b.icon && (b.icon.startsWith('http') || b.icon.startsWith('data:image') || b.icon.startsWith('/static/'))) {
            iconHtml = `<img src="${escapeHtml(b.icon)}" alt="icon" onerror="this.onerror=null; this.style.display='none'; let domainIcon = getDomainFaviconFromUrl('${escapeHtml(b.url)}'); if(domainIcon) { let img = new Image(); img.onload = function() { this.parentNode.innerHTML = ''; this.parentNode.appendChild(img); }; img.onerror = function() { this.parentNode.innerHTML = '<i class=\\'fas fa-tag\\'></i>'; }; img.src = domainIcon; } else { this.parentNode.innerHTML = '<i class=\\'fas fa-tag\\'></i>'; }">`;
        } else {
            const faClass = lineconsToFA[b.icon] || b.icon || 'fas fa-tag';
            iconHtml = `<i class="${faClass}"></i>`;
        }
        const title = escapeHtml(b.title || b.category || '链接');
        const desc = escapeHtml(b.description || '');
        const fullUrl = escapeHtml(b.url);
        const shortUrl = shortenUrl(b.url);

        return `
            <div class="card" onclick="window.open('${fullUrl}', '_blank')">
                <button class="edit-btn" onclick="event.stopPropagation(); openEditModal(${b.id})">✏️</button>
                <div class="card-body">
                    <div class="card-icon">${iconHtml}</div>
                    <div class="card-content">
                        <div class="card-title">${title}</div>
                        ${desc ? `<div class="card-description">${desc}</div>` : ''}
                    </div>
                </div>
                <div class="card-toast">${shortUrl}</div>
            </div>
        `;
    }

    function renderBookmarksByCategory(category) {
        const oldResults = document.querySelector('.search-results');
        if (oldResults) oldResults.remove();

        const bookmarks = allData.bookmarks || [];
        let filtered = [];

        if (category) {
            const categories = getCategoryAndDescendants(category);
            filtered = bookmarks.filter(b => categories.includes(b.category));
        }

        if (!category || filtered.length === 0) {
            bookmarkGrid.innerHTML = `<div class="text-center p-5" style="color:#8fa3bc;">✨ 这个分类下还没有网址</div>`;
            return;
        }

        filtered.sort((a, b) => b.id - a.id);
        let gridHtml = '<div class="row g-3">';
        for (let b of filtered) {
            gridHtml += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`;
        }
        gridHtml += '</div>';
        bookmarkGrid.innerHTML = gridHtml;
    }

    function getCategoryAndDescendants(categoryName) {
        if (!categoryName) return [];
        const tree = buildCategoryTree();

        function findNode(nodes, name) {
            for (let node of nodes) {
                if (node.name === name) return node;
                if (node.children) {
                    const found = findNode(node.children, name);
                    if (found) return found;
                }
            }
            return null;
        }

        const node = findNode(tree, categoryName);
        if (!node) return [categoryName];

        const result = [];
        function collect(node) {
            result.push(node.name);
            if (node.children) {
                node.children.forEach(child => collect(child));
            }
        }
        collect(node);
        return result;
    }

    function getLeafCategories() {
        const tree = buildCategoryTree();
        const leaves = [];

        function collectLeaves(nodes) {
            for (let node of nodes) {
                if (node.children && node.children.length > 0) {
                    collectLeaves(node.children);
                } else {
                    leaves.push(node.name);
                }
            }
        }

        collectLeaves(tree);
        return leaves;
    }

    // 首页：按一级分类分组显示所有网址
    function renderAllLeafCategories() {
        const oldResults = document.querySelector('.search-results');
        if (oldResults) oldResults.remove();

        bookmarkGrid.style.display = 'block';
        const topLevelMap = getTopLevelCategoriesWithDescendants();
        const bookmarks = allData.bookmarks || [];

        if (Object.keys(topLevelMap).length === 0 || bookmarks.length === 0) {
            bookmarkGrid.innerHTML = `<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签，使用快捷键添加网址吧</div>`;
            return;
        }

        let allHtml = '';
        for (let topCat in topLevelMap) {
            const descendantCats = topLevelMap[topCat];
            const items = bookmarks.filter(b => descendantCats.includes(b.category));
            if (items.length === 0) continue;

            items.sort((a, b) => b.id - a.id);
            allHtml += `<div class="category-section">`;
            allHtml += `<h3 class="category-section-title"><i class="fas fa-tag"></i> ${escapeHtml(topCat)}</h3>`;
            allHtml += `<div class="row g-3">`;
            for (let b of items) {
                allHtml += `<div class="col-12 col-md-6 col-lg-4">${renderSingleBookmarkCard(b)}</div>`;
            }
            allHtml += `</div></div>`;
        }

        bookmarkGrid.innerHTML = allHtml || `<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签，使用快捷键添加网址吧</div>`;
    }

    function getTopLevelCategoriesWithDescendants() {
        const tree = buildCategoryTree();
        const result = {};

        function collectDescendants(node, list) {
            list.push(node.name);
            if (node.children) {
                node.children.forEach(child => collectDescendants(child, list));
            }
        }

        tree.forEach(root => {
            const list = [];
            collectDescendants(root, list);
            result[root.name] = list;
        });

        return result;
    }

    function setActiveCategory(categoryName) {
        if (categoryName === null) {
            activeCategoryKey = null;
            renderAllLeafCategories();
            renderCategoryTree();
            const iconEl = document.getElementById('currentCategoryIcon');
            const nameEl = document.getElementById('currentCategoryName');
            if (iconEl) iconEl.innerHTML = '<i class="fas fa-home"></i>';
            if (nameEl) nameEl.innerText = '全部';
            return;
        }
        activeCategoryKey = categoryName;
        renderCategoryTree();
        renderBookmarksByCategory(categoryName);
    }

    // ---------- 数据刷新 ----------
    async function refreshDataAndUI() {
        try {
            const res = await fetch('/list');
            if (!res.ok) throw new Error('加载失败');
            allData = await res.json();
            if (!allData._expanded) allData._expanded = {};

            renderCategoryTree();

            if (activeCategoryKey && allData.categories[activeCategoryKey]) {
                setActiveCategory(activeCategoryKey);
            } else {
                renderAllLeafCategories();
                activeCategoryKey = null;
                const iconEl = document.getElementById('currentCategoryIcon');
                const nameEl = document.getElementById('currentCategoryName');
                if (iconEl) iconEl.innerHTML = '<i class="fas fa-home"></i>';
                if (nameEl) nameEl.innerText = '全部';
            }
        } catch (err) {
            console.error(err);
            categoryTreeDiv.innerHTML = `<div class="text-center p-4 text-danger">❌ 加载失败</div>`;
        }
    }

    // ---------- 弹窗逻辑 ----------
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
        parentCategoryGroup.style.display = 'none';
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = handleDelete;
        clipboardHint.innerText = '';
        bookmarkModal.show();
    };

    async function openAddModal() {
        modalTitle.innerText = '📋 新增书签';
        editingId.value = '';
        urlInput.value = '';
        urlInput.readOnly = false;
        titleInput.value = '';
        descriptionInput.value = '';
        setCategoryMode(true);
        parentCategorySelect.value = '';
        deleteBtn.style.display = 'none';
        clipboardHint.innerText = '';
        lastFetchedIcon = '';

        if (selectedIconValue) selectedIconValue.value = 'fas fa-folder';
        if (selectedIconPreview) selectedIconPreview.innerHTML = '<i class="fas fa-folder"></i>';
        if (selectedIconText) selectedIconText.textContent = '请选择分类';
        if (selectedCategoryName) selectedCategoryName.value = '';
        if (newCategoryCustomIcon) {
            newCategoryCustomIcon.style.display = 'none';
            newCategoryCustomIcon.value = '';
        }
        if (customIconInputPanel) customIconInputPanel.value = '';
        if (iconDropdownPanel) iconDropdownPanel.classList.remove('show');
        if (caret) caret.classList.remove('open');

        bookmarkModal.show();

        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text;
                clipboardHint.innerText = '✅ 已读取剪贴板，正在获取网页信息...';
                fetchMetadata(text);
            } else {
                clipboardHint.innerText = '⚠️ 剪贴板为空';
            }
        } catch (err) {
            clipboardHint.innerText = '⚠️ 无法读取剪贴板';
        }
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
            } else {
                clipboardHint.innerText = '⚠️ 信息获取失败';
            }
        } catch (e) {
            clipboardHint.innerText = '⚠️ 抓取异常';
        }
    }

    async function handleSubmit() {
        console.log('=== handleSubmit called ===');
        console.log('editingId.value:', editingId.value);
        console.log('editingId.value type:', typeof editingId.value);

        const url = urlInput.value.trim();
        if (!url) { alert('请输入网址'); return; }
        console.log('url:', url);

        let category;
        let categoryIcon = '';
        let parentCategory = '';

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
            console.log('isAddingNewCategory = true');
            console.log('category:', category, categoryIcon, parentCategory);
        } else {
            category = categorySelect.value;
            if (!category) { alert('请选择分类'); return; }
            console.log('isAddingNewCategory = false');
            console.log('selected category:', category);
        }

        let icon = '';
        if (editingId.value) {
            const original = allData.bookmarks.find(b => b.id === parseInt(editingId.value));
            icon = original ? original.icon : '';
            console.log('editing mode: using original icon');
            console.log('original icon:', icon);
        } else {
            if (lastFetchedIcon) {
                icon = lastFetchedIcon;
            } else {
                try {
                    const urlObj = new URL(urlInput.value.trim());
                    icon = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
                } catch {
                    icon = '';
                }
            }
            console.log('add mode: icon set to', icon);
        }

        const payload = {
            url: url,
            category: category,
            category_icon: categoryIcon,
            parent_category: parentCategory,
            title: titleInput.value.trim() || category || '链接',
            description: descriptionInput.value.trim() || '',
            icon: icon
        };
        console.log('payload:', payload);

        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';

        try {
            let res;
            if (editingId.value) {
                console.log('➡️ Sending edit request to /edit/' + editingId.value);
                res = await fetch(`/edit/${editingId.value}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                console.log('➡️ Sending add request to /add');
                res = await fetch('/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            console.log('response status:', res.status);
            const result = await res.json();
            console.log('response data:', result);

            if (res.ok && result.success) {
                alert(editingId.value ? '✅ 修改成功！' : '✅ 提交成功！');
                closeModal();
                allData = result.data;
                allData._expanded = {};
                refreshDataAndUI();
            } else {
                alert('❌ 操作失败: ' + (result.message || ''));
            }
        } catch (err) {
            console.error('❌ 网络错误', err);
            alert('❌ 网络错误');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = editingId.value ? '保存修改' : '提交收藏';
        }
    }

    async function handleDelete() {
        const id = editingId.value;
        if (!id) return;
        if (!confirm('确定要删除这个书签吗？')) return;

        deleteBtn.disabled = true;
        deleteBtn.textContent = '删除中...';

        try {
            const res = await fetch(`/delete/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await res.json();
            if (res.ok && result.success) {
                alert('✅ 删除成功！');
                closeModal();
                allData = result.data;
                allData._expanded = {};
                refreshDataAndUI();
            } else {
                alert('❌ 删除失败: ' + (result.message || ''));
            }
        } catch (err) {
            alert('❌ 网络错误');
        } finally {
            deleteBtn.disabled = false;
            deleteBtn.textContent = '删除';
        }
    }

    function closeModal() {
        bookmarkModal.hide();
        urlInput.readOnly = false;
    }

    // 快捷键
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            openAddModal();
        }
    });

    submitBtn.addEventListener('click', handleSubmit);

    // 折叠按钮
    collapseBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const icon = collapseBtn.querySelector('i');
        if (sidebar.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-right';
        } else {
            icon.className = 'fas fa-bars';
        }
        hideSubcategoryPopup();
    });

    // 快捷键提示点击
    const shortcutHint = document.querySelector('.shortcut-hint');
    if (shortcutHint) {
        shortcutHint.addEventListener('click', (e) => {
            e.stopPropagation();
            openAddModal();
        });
    }

    // ---------- 折叠侧边栏时的二级分类浮层 ----------
    const popup = document.getElementById('subcategoryPopup');
    if (!popup) {
        console.error('浮层容器未找到，请检查 HTML');
    }

    function getDirectChildren(categoryName) {
        const tree = buildCategoryTree();
        function findNode(nodes, name) {
            for (let node of nodes) {
                if (node.name === name) return node;
                if (node.children) {
                    const found = findNode(node.children, name);
                    if (found) return found;
                }
            }
            return null;
        }
        const node = findNode(tree, categoryName);
        return node ? node.children.map(child => child.name) : [];
    }

    function showSubcategoryPopup(targetElement, categoryName) {
        const children = getDirectChildren(categoryName);
        if (children.length === 0) return;

        const content = targetElement.closest('.tree-node-content');
        if (!content) return;
        const rect = content.getBoundingClientRect();
        const sidebarRect = sidebar.getBoundingClientRect();

        popup.innerHTML = children.map(child =>
            `<div class="subcategory-item" data-category="${escapeHtml(child)}">${escapeHtml(child)}</div>`
        ).join('');
        popup.style.top = (rect.top - sidebarRect.top) + 'px';
        popup.classList.add('show');
    }

    function hideSubcategoryPopup() {
        popup.classList.remove('show');
    }

    sidebar.addEventListener('mouseover', (e) => {
        if (!sidebar.classList.contains('collapsed')) return;
        const icon = e.target.closest('.node-icon');
        if (!icon) return;
        const content = icon.closest('.tree-node-content');
        if (!content) return;
        const categoryName = content.dataset.category;
        if (!categoryName || categoryName === '__all__') {
            hideSubcategoryPopup();
            return;
        }
        const children = getDirectChildren(categoryName);
        if (children.length === 0) {
            hideSubcategoryPopup();
            return;
        }
        showSubcategoryPopup(icon, categoryName);
    });

    sidebar.addEventListener('mouseleave', () => {
        if (!sidebar.classList.contains('collapsed')) return;
        setTimeout(() => {
            if (!popup.matches(':hover')) {
                hideSubcategoryPopup();
            }
        }, 100);
    });

    popup.addEventListener('mouseenter', () => {});
    popup.addEventListener('mouseleave', () => {
        hideSubcategoryPopup();
    });

    popup.addEventListener('click', (e) => {
        const item = e.target.closest('.subcategory-item');
        if (!item) return;
        const category = item.dataset.category;
        if (category) {
            setActiveCategory(category);
            hideSubcategoryPopup();
        }
    });

    // ---------- 导入书签功能 ----------
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.html,.htm';
            fileInput.onchange = handleFileSelect;
            fileInput.click();
        });
    }

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const htmlContent = e.target.result;
            parseBookmarks(htmlContent);
        };
        reader.readAsText(file);
    }

    function parseBookmarks(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const rootDL = doc.querySelector('dl');
        if (!rootDL) {
            alert('无法解析书签文件，请确保导出的HTML格式正确。');
            return;
        }

        const categories = [];
        const bookmarks = [];

        function parseNode(node, currentPath = []) {
            for (let child of node.children) {
                if (child.tagName === 'DT') {
                    const h3 = child.querySelector(':scope > H3');
                    if (h3) {
                        const folderName = h3.textContent.trim();
                        const fullPath = [...currentPath, folderName];
                        const parent = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;

                        categories.push({
                            name: folderName,
                            parent: parent,
                            icon: 'fas fa-folder'
                        });

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
                            if (url && url.startsWith('http')) {
                                const category = currentPath.length > 0 ? currentPath[currentPath.length - 1] : '未分类';
                                bookmarks.push({
                                    url: url,
                                    title: title,
                                    category: category,
                                    icon: icon
                                });
                            }
                        }
                    }
                }
            }
        }

        parseNode(rootDL);

        if (bookmarks.length === 0 && categories.length === 0) {
            alert('未找到任何书签。');
            return;
        }

        if (!confirm(`找到 ${categories.length} 个分类，${bookmarks.length} 个书签。确定导入吗？`)) {
            return;
        }

        importBookmarksWithCategories(categories, bookmarks);
    }

    async function importBookmarksWithCategories(categories, bookmarks) {
        const importBtn = document.getElementById('importBookmarksBtn');
        const originalText = importBtn.innerHTML;
        importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导入中...';
        importBtn.disabled = true;

        // 分类去重（按名称，忽略父级，简化处理）
        const categoryMap = new Map();
        categories.forEach(cat => {
            if (!categoryMap.has(cat.name)) {
                categoryMap.set(cat.name, cat);
            }
        });
        const uniqueCategories = Array.from(categoryMap.values());

        try {
            const payload = {
                categories: uniqueCategories,
                bookmarks: bookmarks
            };
            const res = await fetch('/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (res.ok && result.success) {
                alert(`✅ 导入成功！共导入 ${result.imported} 个书签。`);
                refreshDataAndUI();
            } else {
                alert('❌ 导入失败: ' + (result.message || '未知错误'));
            }
        } catch (err) {
            console.error('导入异常:', err);
            alert('❌ 网络错误，请重试');
        } finally {
            importBtn.innerHTML = originalText;
            importBtn.disabled = false;
        }
    }

    // ---------- 自定义图标选择器交互 ----------
    if (selectedIconDisplay) {
        selectedIconDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            iconDropdownPanel.classList.toggle('show');
            caret.classList.toggle('open', iconDropdownPanel.classList.contains('show'));
        });
    }

    document.addEventListener('click', (e) => {
        if (!selectedIconDisplay?.contains(e.target) && !iconDropdownPanel?.contains(e.target)) {
            iconDropdownPanel?.classList.remove('show');
            caret?.classList.remove('open');
        }
    });

    iconOptions.forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value;
            const name = option.dataset.name;
            const iconHtml = option.querySelector('i').cloneNode(true);

            selectedIconPreview.innerHTML = '';
            selectedIconPreview.appendChild(iconHtml);
            selectedIconText.textContent = name;
            selectedIconValue.value = value;
            selectedCategoryName.value = name;

            iconDropdownPanel.classList.remove('show');
            caret.classList.remove('open');

            if (newCategoryCustomIcon) {
                newCategoryCustomIcon.style.display = 'none';
                newCategoryCustomIcon.value = '';
            }
        });
    });

    if (applyCustomBtn) {
        applyCustomBtn.addEventListener('click', () => {
            const customVal = customIconInputPanel.value.trim();
            if (!customVal) return;

            let name, icon;
            const slashIndex = customVal.indexOf('/');
            if (slashIndex === -1) {
                name = customVal;
                icon = 'fas fa-tag';
            } else {
                name = customVal.substring(0, slashIndex).trim();
                icon = customVal.substring(slashIndex + 1).trim();
                if (!name) name = '未命名';
                if (!icon) icon = 'fas fa-tag';
            }

            const isImageUrl = icon.startsWith('http') || icon.startsWith('data:image');
            if (isImageUrl) {
                selectedIconPreview.innerHTML = `<img src="${icon}" style="max-width:20px; max-height:20px;">`;
                selectedIconText.textContent = name;
                selectedIconValue.value = icon;
                selectedCategoryName.value = name;

                if (newCategoryCustomIcon) {
                    newCategoryCustomIcon.style.display = 'block';
                    newCategoryCustomIcon.value = icon;
                }
            } else {
                selectedIconPreview.innerHTML = `<i class="${icon}"></i>`;
                selectedIconText.textContent = name;
                selectedIconValue.value = icon;
                selectedCategoryName.value = name;

                if (newCategoryCustomIcon) {
                    newCategoryCustomIcon.style.display = 'none';
                    newCategoryCustomIcon.value = '';
                }
            }

            iconDropdownPanel.classList.remove('show');
            caret.classList.remove('open');
        });
    }

    // ---------- 分类管理功能 ----------
    if (manageCategoriesBtn) {
        manageCategoriesBtn.addEventListener('click', () => {
            loadCategoryList();
            categoryManageModal.show();
        });
    }

    function loadCategoryList() {
        const categories = allData.categories || {};
        const tree = buildCategoryTree();

        const flatList = [];
        function flatten(node) {
            flatList.push(node);
            if (node.children) {
                node.children.forEach(flatten);
            }
        }
        tree.forEach(flatten);

        let html = ''; // 只生成表格行，不包含表头
        flatList.forEach(node => {
            const iconHtml = renderIconPreview(node.icon);
            html += `
                <tr data-category="${escapeHtml(node.name)}">
                    <td class="category-icon-cell">${iconHtml}</td>
                    <td>${escapeHtml(node.name)}</td>
                    <td>${node.parent ? escapeHtml(node.parent) : '-'}</td>
                    <td>${escapeHtml(node.priority ?? 100)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary edit-category-btn" title="编辑"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger delete-category-btn" title="删除"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        categoryListContainer.innerHTML = html;

        // 重新绑定编辑/删除事件
        document.querySelectorAll('.edit-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const categoryName = row.dataset.category;
                editCategory(categoryName);
            });
        });

        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const categoryName = row.dataset.category;
                deleteCategory(categoryName);
            });
        });

        // 更新上级分类下拉框
        let parentOptions = '<option value="">-- 无 (一级分类) --</option>';
        Object.keys(categories).sort().forEach(cat => {
            parentOptions += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
        });
        newCategoryParentSelect.innerHTML = parentOptions;
    }

    function renderIconPreview(icon) {
        if (!icon) return '<i class="fas fa-folder"></i>';
        if (icon.startsWith('http') || icon.startsWith('data:image')) {
            return `<img src="${icon}" style="max-width:24px; max-height:24px;">`;
        } else {
            return `<i class="${icon}"></i>`;
        }
    }

    function editCategory(categoryName) {
        const category = allData.categories[categoryName];
        const newName = prompt('请输入新分类名称（留空表示不修改）', categoryName);
        if (newName === null) return;
        const newIcon = prompt('请输入新图标（留空表示不修改）', category?.icon || '');
        const newParent = prompt('请输入上级分类名称（留空表示无上级）', category?.parent || '');
        const newPriority = prompt('请输入优先级（数字越小越靠前，留空表示不修改）', category?.priority || '100');

        const payload = {};
        if (newName && newName !== categoryName) payload.new_name = newName;
        if (newIcon) payload.icon = newIcon;
        if (newParent !== undefined) payload.parent = newParent;
        if (newPriority && !isNaN(newPriority)) payload.priority = parseInt(newPriority);

        fetch(`/category/${encodeURIComponent(categoryName)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                alert('修改成功');
                allData = result.data;
                loadCategoryList();
                refreshDataAndUI();
            } else {
                alert('修改失败：' + result.message);
            }
        })
        .catch(err => alert('网络错误'));
    }

    function deleteCategory(categoryName) {
        const msg = `确定要删除分类“${categoryName}”吗？\n这将同时删除其所有子分类及下属书签，且无法恢复！`;
        if (!confirm(msg)) return;

        fetch(`/category/${encodeURIComponent(categoryName)}`, {
            method: 'DELETE'
        })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                alert('删除成功');
                allData = result.data;
                loadCategoryList(); // 刷新分类列表
                refreshDataAndUI(); // 刷新主界面
            } else {
                alert('删除失败：' + result.message);
            }
        })
        .catch(err => alert('网络错误'));
    }

    // 切换表单显示的函数
    function toggleAddCategoryForm() {
        if (!addCategoryForm || !toggleAddCategoryBtn) return;
        if (addCategoryForm.style.display === 'none') {
            addCategoryForm.style.display = 'block';
            toggleAddCategoryBtn.innerHTML = '<i class="fas fa-minus"></i> 隐藏表单';
        } else {
            addCategoryForm.style.display = 'none';
            toggleAddCategoryBtn.innerHTML = '<i class="fas fa-plus"></i> 新增分类';
        }
    }

    // 卡片头部点击事件（使用事件委托，避免获取不到元素）
    const categoryHeader = document.querySelector('#categoryManageModal .card-header');
    if (categoryHeader) {
        categoryHeader.addEventListener('click', (e) => {
            // 如果点击的元素在新增表单内或点击的是新增按钮本身，不触发
            if (e.target.closest('#addCategoryForm') || e.target.closest('#toggleAddCategoryBtn')) {
                return;
            }
            toggleAddCategoryForm();
        });
    }

    // 新增分类按钮点击（单独处理，并阻止冒泡）
    if (toggleAddCategoryBtn) {
        toggleAddCategoryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAddCategoryForm();
        });
    }

    // 图标选择联动
    if (newCategoryIconSelect && newCategoryCustomIconManage) {
        newCategoryIconSelect.addEventListener('change', function() {
            newCategoryCustomIconManage.style.display = this.value === 'custom' ? 'block' : 'none';
        });
    }

    // 保存新增分类
    if (saveNewCategoryBtn) {
        saveNewCategoryBtn.addEventListener('click', async () => {
            // 获取分类名称
            const name = newCategoryNameInput.value.trim();
            if (!name) {
                alert('请输入分类名称');
                return;
            }

            // 获取图标
            let icon;
            if (newCategoryIconSelect.value === 'custom') {
                icon = newCategoryCustomIconManage.value.trim();
                if (!icon) {
                    alert('请输入自定义图标');
                    return;
                }
            } else {
                icon = newCategoryIconSelect.value || 'fas fa-folder';
            }

            // 获取上级分类
            const parent = newCategoryParentSelect.value || null;

            // 获取优先级（确保为整数）
            let priority = parseInt(newCategoryPriority.value);
            if (isNaN(priority) || priority < 0) {
                priority = 100; // 默认值
            }

            // 发送请求
            try {
                const res = await fetch('/add_category', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, icon, parent, priority })
                });
                const result = await res.json();
                if (res.ok && result.success) {
                    alert('✅ 分类添加成功');
                    // 更新全局数据
                    allData = result.data;
                    // 刷新分类列表（表格内）
                    loadCategoryList();
                    // 刷新侧边栏及卡片区域
                    refreshDataAndUI();

                    // 重置表单并折叠
                    newCategoryNameInput.value = '';
                    newCategoryIconSelect.value = 'fas fa-folder';
                    newCategoryCustomIconManage.style.display = 'none';
                    newCategoryCustomIconManage.value = '';
                    newCategoryParentSelect.value = '';
                    newCategoryPriority.value = '100';
                    addCategoryForm.style.display = 'none';
                    toggleAddCategoryBtn.innerHTML = '<i class="fas fa-plus"></i> 新增分类';
                } else {
                    alert('❌ 添加失败：' + (result.message || ''));
                }
            } catch (err) {
                console.error('添加分类异常:', err);
                alert('❌ 网络错误，请稍后重试');
            }
        });
    }

    if (addBookmarkHeaderBtn) {
        addBookmarkHeaderBtn.addEventListener('click', openAddModal);
    }

    if (newCategoryCustomIconManage) {
        // 构建下拉列表内容
    function renderIconSuggestions() {
        let html = '';
        commonIcons.forEach(icon => {
            html += `<div class="suggestion-item" data-icon="${icon.class}">
                <i class="${icon.class}"></i>
                <span class="suggestion-class">${icon.class}</span>
            </div>`;
        });
        // 添加更多图标链接
        html += `<div class="suggestion-item more-link" data-action="more">
            <i class="fas fa-external-link-alt"></i>
            <span>更多图标...</span>
        </div>`;
        iconSuggestions.innerHTML = html;
    }
        renderIconSuggestions();

        // 显示/隐藏下拉列表
        newCategoryCustomIconManage.addEventListener('focus', () => {
            iconSuggestions.style.display = 'block';
        });

        newCategoryCustomIconManage.addEventListener('blur', () => {
            // 延迟隐藏，以便点击选项时不会立即消失
            setTimeout(() => {
                iconSuggestions.style.display = 'none';
            }, 200);
        });

        // 点击选项填充
        iconSuggestions.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (!item) return;

            if (item.dataset.action === 'more') {
                // 打开 FontAwesome 官网
                window.open('https://fontawesome.com/icons', '_blank');
                // 隐藏下拉列表
                iconSuggestions.style.display = 'none';
                // 可选：移除输入框焦点
                newCategoryCustomIconManage.blur();
                return;
            }

            const iconClass = item.dataset.icon;
            if (iconClass) {
                newCategoryCustomIconManage.value = iconClass;
                newCategoryCustomIconManage.dispatchEvent(new Event('input'));
                iconSuggestions.style.display = 'none';
            }
        });
    }

    // 初始化
    initSearch();
    refreshDataAndUI();
})();