// online.js - 在线版特有逻辑（后端 API、登录状态等）

// 依赖 common.js，需先加载 common.js

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
    const addBookmarkHeaderBtn = document.getElementById('addBookmarkHeaderBtn');
    const bookmarkTags = document.getElementById('bookmarkTags');
    const selectedCategoryName = document.getElementById('selectedCategoryName');
    const userStatusBtn = document.getElementById('userStatusBtn');

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
    const newCategoryNameInput = document.getElementById('newCategoryNameInput');
    const newCategoryIconSelect = document.getElementById('newCategoryIconSelect');
    const newCategoryCustomIconManage = document.getElementById('newCategoryCustomIconManage');
    const newCategoryParentSelect = document.getElementById('newCategoryParentSelect');
    const newCategoryPriority = document.getElementById('newCategoryPriority');
    const iconSuggestions = document.getElementById('iconSuggestions');
    const addCategoryFooterBtn = document.getElementById('addCategoryFooterBtn');
    const confirmNewCategoryBtn = document.getElementById('confirmNewCategoryBtn');
    const newCategoryCustomIcon = document.getElementById('newCategoryCustomIcon');


    // 用户界面元素
    const userMenuBtn = document.getElementById('userMenuBtn');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');

    // ---------- 全局变量 ----------
    let activeCategoryKey = null;
    let isAddingNewCategory = false;
    let lastFetchedIcon = '';
    let isLoggedIn = false;
    let allDataExpanded = {};

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

    const commonIcons = [ /* 省略，同原 online.js */ ];

    // ---------- 辅助函数（在线版特有）----------
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
            existingCategoryGroup.style.display = 'none';
            newCategoryIconGroup.style.display = 'block';
            parentCategoryGroup.style.display = 'block';
            toggleCategoryMode.innerText = '🔽 选择已有分类';
            updateParentCategorySelect();
            selectedCategoryName.value = '';
            selectedIconValue.value = 'fas fa-folder';
            selectedIconPreview.innerHTML = '<i class="fas fa-folder"></i>';
            selectedIconText.textContent = '请选择分类';
            if (newCategoryCustomIcon) { newCategoryCustomIcon.style.display = 'none'; newCategoryCustomIcon.value = ''; }
        } else {
            existingCategoryGroup.style.display = 'block';
            newCategoryIconGroup.style.display = 'none';
            parentCategoryGroup.style.display = 'none';
            toggleCategoryMode.innerText = '➕ 新增分类';
        }
    }

    if (addCategoryFooterBtn) {
        addCategoryFooterBtn.addEventListener('click', () => {
            // 填充上级分类下拉框
            const parentSelect = document.getElementById('newCategoryParent');
            if (parentSelect) {
                const cats = Object.keys(window.allData.categories || {}).sort();
                let html = '<option value="">-- 无 (一级分类) --</option>';
                cats.forEach(c => html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`);
                parentSelect.innerHTML = html;
            }
            // 重置表单
            document.getElementById('newCategoryName').value = '';
            document.getElementById('newCategoryIconSelect').value = 'fas fa-folder';
            document.getElementById('newCategoryCustomIcon').style.display = 'none';
            document.getElementById('newCategoryCustomIcon').value = '';
            document.getElementById('newCategoryPriority').value = '100';
            // 显示模态框
            const newCategoryModal = new bootstrap.Modal(document.getElementById('newCategoryModal'));
            newCategoryModal.show();
        });
    }

    if (newCategoryIconSelect) {
        newCategoryIconSelect.addEventListener('change', function() {
            newCategoryCustomIcon.style.display = this.value === 'custom' ? 'block' : 'none';
        });
    }

    if (confirmNewCategoryBtn) {
        confirmNewCategoryBtn.addEventListener('click', async () => {
            const name = document.getElementById('newCategoryName').value.trim();
            if (!name) { alert('请输入分类名称'); return; }

            let iconSelect = document.getElementById('newCategoryIconSelect');
            let icon = iconSelect.value === 'custom'
                ? document.getElementById('newCategoryCustomIcon').value.trim()
                : iconSelect.value;
            if (!icon) icon = 'fas fa-folder';

            const parent = document.getElementById('newCategoryParent').value || null;
            const priority = parseInt(document.getElementById('newCategoryPriority').value) || 100;

            try {
                const res = await fetch('/add_category', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, icon, parent, priority })
                });
                const result = await res.json();
                if (res.ok && result.success) {
                    alert('✅ 分类添加成功');
                    // 关闭独立模态框
                    const newCategoryModalEl = document.getElementById('newCategoryModal');
                    const modal = bootstrap.Modal.getInstance(newCategoryModalEl);
                    modal.hide();
                    // 刷新全局数据
                    await refreshDataAndUI();
                    // 如果分类管理主模态框是打开的，则刷新其中的列表
                    const mainModalEl = document.getElementById('categoryManageModal');
                    if (mainModalEl.classList.contains('show')) {
                        loadCategoryList();
                    }
                } else {
                    alert('❌ 添加失败：' + (result.message || ''));
                }
            } catch (err) {
                alert('❌ 网络错误');
                console.error(err);
            }
        });
    }


    toggleCategoryMode?.addEventListener('click', () => setCategoryMode(!isAddingNewCategory));

    // ---------- 书签操作 ----------
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

    window.openAddModal = async function() {
        if (!isLoggedIn) { loginModal.show(); return; }
        modalTitle.innerText = '📋 新增书签';
        editingId.value = '';
        urlInput.value = '';
        urlInput.readOnly = false;
        titleInput.value = '';
        descriptionInput.value = '';
        if (bookmarkTags) bookmarkTags.value = '';
        setCategoryMode(false);
        setCategoryMode(true);
        updateCategorySelect();
        if (categorySelect) categorySelect.value = '';
        parentCategorySelect.value = '';
        deleteBtn.style.display = 'none';
        clipboardHint.innerText = '';
        lastFetchedIcon = '';
        selectedIconValue.value = 'fas fa-folder';
        selectedIconPreview.innerHTML = '<i class="fas fa-folder"></i>';
        selectedIconText.textContent = '请选择分类';
        selectedCategoryName.value = '';
        if (newCategoryCustomIcon) { newCategoryCustomIcon.style.display = 'none'; newCategoryCustomIcon.value = ''; }
        customIconInputPanel.value = '';
        iconDropdownPanel?.classList.remove('show');
        caret?.classList.remove('open');
        const isPrivateCheckbox = document.getElementById('isPrivateCheckbox');
        if (isPrivateCheckbox) isPrivateCheckbox.checked = true;
        bookmarkModal.show();
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text;
                clipboardHint.innerText = '✅ 已读取剪贴板，正在获取网页信息...';
                fetchMetadata(text);
            } else clipboardHint.innerText = '⚠️ 剪贴板为空';
        } catch { clipboardHint.innerText = '⚠️ 无法读取剪贴板'; }
    };

    window.openEditModal = async function(id) {
        if (!isLoggedIn) { loginModal.show(); return; }
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
        const isPrivateCheckbox = document.getElementById('isPrivateCheckbox');
        if (isPrivateCheckbox) isPrivateCheckbox.checked = !(item.status === 'approved');
        if (deleteBtn) { deleteBtn.style.display = 'block'; deleteBtn.onclick = handleDelete; }
        bookmarkModal.show();
    };

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

    async function handleSubmit() {
        if (!isLoggedIn) { alert('请先登录'); loginModal.show(); return; }
        const url = urlInput.value.trim();
        if (!url) { alert('请输入网址'); return; }

        let category, categoryIcon = '', parentCategory = '';
        const isPrivateCheckbox = document.getElementById('isPrivateCheckbox');
        let status = (isPrivateCheckbox && isPrivateCheckbox.checked) ? 'private' : 'public';
        if (status === 'public' && !confirm('公开书签需管理员审核后，才能发布。是否确定提交审核？')) return;

        if (isAddingNewCategory) {
            category = selectedCategoryName.value.trim();
            if (!category) { alert('请选择一个分类图标'); return; }
            if (newCategoryCustomIcon.style.display === 'block' && newCategoryCustomIcon.value.trim()) categoryIcon = newCategoryCustomIcon.value.trim();
            else categoryIcon = selectedIconValue.value || 'fas fa-folder';
            parentCategory = parentCategorySelect.value;
        } else {
            category = categorySelect.value;
            if (!category) { alert('请选择分类'); return; }
        }

        let icon = '';
        if (editingId.value) {
            const original = allData.bookmarks.find(b => b.id === parseInt(editingId.value));
            icon = original ? original.icon : '';
        } else {
            if (lastFetchedIcon) icon = lastFetchedIcon;
            else try { icon = new URL(url).origin + '/favicon.ico'; } catch { icon = ''; }
        }

        const tagsRaw = bookmarkTags ? bookmarkTags.value.trim() : '';
        let tags = tagsRaw ? tagsRaw.split('/').map(t => t.trim()).filter(t => t) : [];

        const payload = { url, category, category_icon: categoryIcon, parent_category: parentCategory,
            title: titleInput.value.trim() || category || '链接', description: descriptionInput.value.trim() || '',
            icon, tags, status };

        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';
        try {
            let res;
            if (editingId.value) res = await fetch(`/edit/${editingId.value}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            else res = await fetch('/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await res.json();
            if (res.ok && result.success) {
                alert(editingId.value ? '✅ 修改成功！' : '✅ 提交成功！');
                closeModal();
                await refreshDataAndUI();
            } else alert('❌ 操作失败：' + (result.message || '未知错误'));
        } catch { alert('❌ 网络错误'); }
        finally { submitBtn.disabled = false; submitBtn.textContent = editingId.value ? '保存修改' : '保存'; }
    }

    function closeModal() { bookmarkModal.hide(); urlInput.readOnly = false; }

    // ---------- 分类管理 ----------
    function loadCategoryList() {
        const container = document.getElementById('categoryListContainer');
        if (!container) {
            console.error('找不到 categoryListContainer 元素');
            return;
        }

        const cats = window.allData.categories || {};
        const sorted = Object.keys(cats).sort((a,b) => (cats[a].priority||100) - (cats[b].priority||100));
        let html = '';
        sorted.forEach(name => {
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
        });
        container.innerHTML = html;

        // 重新绑定按钮事件
        document.querySelectorAll('.edit-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = btn.closest('tr').dataset.category;
                editCategory(name);
            });
        });
        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = btn.closest('tr').dataset.category;
                deleteCategory(name);
            });
        });
    }

    // 分类搜索过滤
    function initCategorySearch() {
        const searchInput = document.getElementById('categorySearchInput');
        if (!searchInput) return;
        searchInput.addEventListener('input', function() {
            const keyword = this.value.trim().toLowerCase();
            const rows = document.querySelectorAll('#categoryListContainer tr');
            rows.forEach(row => {
                const nameCell = row.cells[1]; // 分类名称在第2列
                if (nameCell) {
                    const text = nameCell.textContent.toLowerCase();
                    row.style.display = text.includes(keyword) ? '' : 'none';
                }
            });
        });
    }
    initCategorySearch();

    function editCategory(name) {
        const cat = allData.categories[name];
        const newName = prompt('新名称', name);
        if (newName && newName !== name) {
            if (allData.categories[newName]) { alert('分类已存在'); return; }
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

    newCategoryIconSelect?.addEventListener('change', function() { newCategoryCustomIconManage.style.display = this.value === 'custom' ? 'block' : 'none'; });

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
    function parseBookmarkHtml(html) { /* 同原 online.js */ }
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

    // ---------- 辅助函数 ----------
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

    // 渲染书签网格
    function refreshBookmarks(category) {
        const container = document.getElementById('bookmarkGrid');
        if (!container) return;

        let filtered = [...(allData.bookmarks || [])];
        if (category === '__recommend__') {
            // 推荐排序：按点击次数降序
            filtered.sort((a, b) => (b.click_count || 0) - (a.click_count || 0));
            filtered = filtered.slice(0, 30);
        } else if (category && category !== '__all__') {
            filtered = filtered.filter(b => b.category === category);
        }
        // 如果 category 为 null 或 '__all__'，则显示全部

        if (filtered.length === 0) {
            container.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 暂无书签，点击“新增”添加</div>';
            return;
        }

        let html = '<div class="row g-3">';
        filtered.forEach(bookmark => {
            html += `<div class="col-12 col-md-6 col-lg-4">${window.renderSingleBookmarkCard(bookmark)}</div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // 挂载到 window，让 common.js 的分类切换能调用
    window.refreshBookmarks = refreshBookmarks;

    // ---------- 刷新数据与登录状态 ----------
    async function refreshDataAndUI() {
        try {
            const res = await fetch('/list');
            if (res.status === 401) {
                // 未登录状态
                isLoggedIn = false;
                document.body.classList.remove('logged-in');
                if (userStatusBtn) {
                    userStatusBtn.innerText = '点击登录';
                    userStatusBtn.title = '';
                }
                // 清空全局数据
                window.allData = { bookmarks: [], categories: {} };
                if (!window.allDataExpanded) window.allDataExpanded = {};
                renderCategoryTree();
                updateCategorySelect();
                const grid = document.getElementById('bookmarkGrid');
                if (grid) grid.innerHTML = '<div class="text-center p-5" style="color:#8fa3bc;">✨ 请登录后查看</div>';
                return;
            }
            if (!res.ok) throw new Error('加载失败');
            const data = await res.json();

            // 关键：挂载到全局，供 common.js 使用
            window.allData = {
                bookmarks: data.bookmarks || [],
                categories: data.categories || {}
            };
            if (!window.allDataExpanded) window.allDataExpanded = {};

            // 渲染侧边栏分类树
            renderCategoryTree();

            // 更新分类下拉框（新增/编辑书签时使用）
            updateCategorySelect();

            // 设置当前激活的分类（如果之前有记忆，则恢复；否则默认显示推荐）
            if (activeCategoryKey && window.allData.categories[activeCategoryKey]) {
                setActiveCategory(activeCategoryKey);
            } else {
                setActiveCategory('__recommend__');
            }

            // 同步登录状态
            try {
                const userRes = await fetch('/user');
                if (userRes.ok) {
                    const userData = await userRes.json();
                    isLoggedIn = true;
                    document.body.classList.add('logged-in');
                    if (userStatusBtn) {
                        userStatusBtn.innerText = '退出登录';
                        userStatusBtn.title = `当前登录：${userData.username}`;
                    }
                } else {
                    throw new Error('Not logged in');
                }
            } catch {
                isLoggedIn = false;
                document.body.classList.remove('logged-in');
                if (userStatusBtn) {
                    userStatusBtn.innerText = '点击登录';
                    userStatusBtn.title = '';
                }
            }
        } catch (err) {
            console.error('刷新数据失败:', err);
            const container = document.getElementById('categoryTree');
            if (container) container.innerHTML = `<div class="text-center p-4 text-danger">❌ 加载失败</div>`;
            const grid = document.getElementById('bookmarkGrid');
            if (grid) grid.innerHTML = `<div class="text-center p-5 text-danger">❌ 无法加载数据，请检查网络或刷新重试</div>`;
        }
    }

    // ---------- 事件绑定 ----------
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
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            if (!isLoggedIn) loginModal.show();
            else window.openAddModal();
        }
    });
    document.querySelector('.shortcut-hint')?.addEventListener('click', () => window.openAddModal());

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
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => { /* 同原 online.js */ });
    document.getElementById('registerForm')?.addEventListener('submit', async (e) => { /* 同原 online.js */ });
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

    // 增强版弹窗
    const enhancedTitle = document.getElementById('enhancedTitle');
    const enhancedBadge = document.getElementById('enhancedBadge');
    const enhancedModal = new bootstrap.Modal(document.getElementById('enhancedNoticeModal'));
    function showEnhancedNotice() { enhancedModal.show(); }
    if (enhancedTitle) enhancedTitle.addEventListener('click', showEnhancedNotice);
    if (enhancedBadge) enhancedBadge.addEventListener('click', showEnhancedNotice);

    const privateCheckbox = document.getElementById('bookmarkPrivate');
    if (privateCheckbox) {
        privateCheckbox.addEventListener('change', function() {
            if (!this.checked && !confirm('公开书签后，所有访客均能看到此书签，是否确定公开？')) this.checked = true;
        });
    }
    userStatusBtn.addEventListener('click', () => {
        if (isLoggedIn) {
            if (confirm('确定要退出登录吗？')) fetch('/logout').finally(() => refreshDataAndUI());
        } else loginModal.show();
    });

    // 在 DOMContentLoaded 或初始化代码中
    const categoryManageModalEl = document.getElementById('categoryManageModal');
    const newCategoryModal = new bootstrap.Modal(document.getElementById('newCategoryModal'));

    // 保存新分类
    if (confirmNewCategoryBtn) {
        confirmNewCategoryBtn.addEventListener('click', async () => {
            const name = document.getElementById('newCategoryName').value.trim();
            if (!name) { alert('请输入分类名称'); return; }

            let iconSelect = document.getElementById('newCategoryIconSelect');
            let icon = iconSelect.value === 'custom'
                ? document.getElementById('newCategoryCustomIcon').value.trim()
                : iconSelect.value;
            if (!icon) icon = 'fas fa-folder';

            const parent = document.getElementById('newCategoryParent').value || null;
            const priority = parseInt(document.getElementById('newCategoryPriority').value) || 100;

            try {
                const res = await fetch('/add_category', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, icon, parent, priority })
                });
                const result = await res.json();
                if (res.ok && result.success) {
                    alert('✅ 分类添加成功');
                    newCategoryModal.hide();
                    await refreshDataAndUI();
                    // 如果管理分类弹窗开着，刷新其中的列表
                    if (categoryManageModalEl && categoryManageModalEl.classList.contains('show')) {
                        loadCategoryList();
                        // 重置搜索框
                        const searchInput = document.getElementById('categorySearchInput');
                        if (searchInput) searchInput.value = '';
                    }
                } else {
                    alert('❌ 添加失败：' + (result.message || ''));
                }
            } catch (err) {
                alert('❌ 网络错误');
                console.error(err);
            }
        });
    }

    // 处理自定义图标输入显示
    if (newCategoryIconSelect) {
        newCategoryIconSelect.addEventListener('change', function() {
            newCategoryCustomIcon.style.display = this.value === 'custom' ? 'block' : 'none';
        });
    }

    // 新增分类（下拉菜单项）
    const addCategoryDropdownItem = document.getElementById('addCategoryDropdownItem');
    if (addCategoryDropdownItem) {
        addCategoryDropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            // 填充上级分类下拉框
            const parentSelect = document.getElementById('newCategoryParent');
            if (parentSelect) {
                const cats = Object.keys(window.allData.categories || {}).sort();
                let html = '<option value="">-- 无 (一级分类) --</option>';
                cats.forEach(c => html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`);
                parentSelect.innerHTML = html;
            }
            // 重置表单
            const nameInput = document.getElementById('newCategoryName');
            if (nameInput) nameInput.value = '';
            const iconSelect = document.getElementById('newCategoryIconSelect');
            if (iconSelect) iconSelect.value = 'fas fa-folder';
            const customIcon = document.getElementById('newCategoryCustomIcon');
            if (customIcon) {
                customIcon.style.display = 'none';
                customIcon.value = '';
            }
            const priorityInput = document.getElementById('newCategoryPriority');
            if (priorityInput) priorityInput.value = '100';

            const newCategoryModal = new bootstrap.Modal(document.getElementById('newCategoryModal'));
            newCategoryModal.show();
        });
    }

    // 分类列表（下拉菜单项）
    const listCategoriesDropdownItem = document.getElementById('listCategoriesDropdownItem');
    if (listCategoriesDropdownItem) {
        listCategoriesDropdownItem.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!isLoggedIn) {
                loginModal.show();
                return;
            }
            // 刷新全局数据
            await refreshDataAndUI();
            // 加载分类列表表格
            loadCategoryList();
            // 重置搜索框并清空过滤
            const searchInput = document.getElementById('categorySearchInput');
            if (searchInput) {
                searchInput.value = '';
                // 触发 input 事件以显示所有行
                searchInput.dispatchEvent(new Event('input'));
            }
            // 显示分类列表模态框
            categoryManageModal.show();
        });
    }

    const addBookmarkDropdownItem = document.getElementById('addBookmarkDropdownItem');
    if (addBookmarkDropdownItem) {
        addBookmarkDropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isLoggedIn) {
                loginModal.show();
                return;
            }
            window.openAddModal();
        });
    }

    // 导入书签的实际处理函数（如果已经存在，则直接使用；否则定义）
    function triggerImportBookmarks() {
        if (!isLoggedIn) {
            loginModal.show();
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html,.htm';
        input.onchange = handleFileSelect;   // 假设已有 handleFileSelect 函数
        input.click();
    }

    // 绑定导入下拉项
    const importBookmarksDropdownItem = document.getElementById('importBookmarksDropdownItem');
    if (importBookmarksDropdownItem) {
        importBookmarksDropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            triggerImportBookmarks();
        });
    }

    // 导出书签的处理函数
    async function exportBookmarks() {
        if (!isLoggedIn) {
            loginModal.show();
            return;
        }
        try {
            const response = await fetch('/export');
            if (!response.ok) throw new Error('导出失败');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'bookmarks_export.json';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match) filename = match[1];
            }
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('导出失败');
        }
    }

    // 绑定导出下拉项
    const exportBookmarksDropdownItem = document.getElementById('exportBookmarksDropdownItem');
    if (exportBookmarksDropdownItem) {
        exportBookmarksDropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            exportBookmarks();
        });
    }


})();