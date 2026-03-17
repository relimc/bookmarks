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
    let categorySelect = document.getElementById('categorySelect'); // 可能被动态重新获取
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

    function getFaIcon(lineconsClass) {
        return lineconsToFA[lineconsClass] || lineconsToFA['default'];
    }

    // ---------- 工具函数 ----------
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
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
                    searchInput.placeholder = type === 'local' ? '可本地搜索，快速找到收藏网址' : `请输入关键字跳转至${name}搜索`;
                }
                document.getElementById('engineDropdown').classList.remove('show');
            });
        });
    }

    function initSearch() {
        if (!searchInput || !searchBtn) return;

        currentEngine = searchEngines[0];
        searchInput.placeholder = currentEngine.type === 'local' ? '可本地搜索，快速找到收藏网址' : '请输入关键字跳转至搜索引擎搜索';
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
        // 确保 categorySelect 元素存在
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
            // 新增模式：显示图标选择器，隐藏已有分类下拉框，显示上级分类
            if (existingCategoryGroup) existingCategoryGroup.style.display = 'none';
            if (newCategoryIconGroup) newCategoryIconGroup.style.display = 'block';
            if (parentCategoryGroup) parentCategoryGroup.style.display = 'block';
            if (toggleCategoryMode) {
                toggleCategoryMode.style.display = 'inline';
                toggleCategoryMode.innerText = '🔽 选择已有分类'; // 改为“选择已有分类”
            }
            updateParentCategorySelect();

            // 重置新增分类字段
            if (selectedCategoryName) selectedCategoryName.value = '';
            if (selectedIconValue) selectedIconValue.value = 'fas fa-folder';
            if (selectedIconPreview) selectedIconPreview.innerHTML = '<i class="fas fa-folder"></i>';
            if (selectedIconText) selectedIconText.textContent = '请选择分类';
            if (newCategoryCustomIcon) {
                newCategoryCustomIcon.style.display = 'none';
                newCategoryCustomIcon.value = '';
            }
        } else {
            // 编辑模式：显示已有分类下拉框，隐藏图标选择器，隐藏上级分类
            if (existingCategoryGroup) existingCategoryGroup.style.display = 'block';
            if (newCategoryIconGroup) newCategoryIconGroup.style.display = 'none';
            if (parentCategoryGroup) parentCategoryGroup.style.display = 'none';
            if (toggleCategoryMode) {
                toggleCategoryMode.style.display = 'inline';
                toggleCategoryMode.innerText = '➕ 新增分类'; // 改为“新增分类”
            }
        }
    }

    toggleCategoryMode.addEventListener('click', function() {
        setCategoryMode(!isAddingNewCategory);
    });

    // 上级分类变化监听
    parentCategorySelect.addEventListener('change', function() {
        if (isAddingNewCategory) {
            if (this.value) {
                newCategoryIconGroup.style.display = 'none'; // 有上级分类时隐藏图标选择器？根据需求调整，这里保持显示
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
        if (b.icon && (b.icon.startsWith('http') || b.icon.startsWith('data:image'))) {
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
        setCategoryMode(false); // 编辑模式
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
        setCategoryMode(true); // 新增模式
        parentCategorySelect.value = '';
        deleteBtn.style.display = 'none';
        clipboardHint.innerText = '';
        lastFetchedIcon = '';

        // 重置图标选择器
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
            // 新增模式：从图标选择器获取分类名称和图标
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
            // 编辑模式：从下拉框获取分类名称
            category = categorySelect.value;
            if (!category) { alert('请选择分类'); return; }
            // 编辑模式不修改分类图标，保留原值
            categoryIcon = ''; // 后端会用原分类图标
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

    // 初始化
    initSearch();
    refreshDataAndUI();
})();