// online.js - 在线版数据适配器

class OnlineDataAdapter {
    async getAllData() {
        const res = await fetch('/list');
        if (res.status === 401) {
            // 未登录，返回空数据
            return { bookmarks: [], categories: {} };
        }
        const data = await res.json();
        return { bookmarks: data.bookmarks, categories: data.categories };
    }
    async addBookmark(bookmark) {
        // 注意：后端期望的字段略有不同，需转换
        const payload = {
            url: bookmark.url,
            category: bookmark.category,
            title: bookmark.title,
            description: bookmark.description,
            icon: bookmark.icon,
            tags: bookmark.tags,
            status: 'private'   // 本地版概念映射为私密
        };
        const res = await fetch('/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('添加失败');
        return await res.json();
    }
    async updateBookmark(id, updates) {
        const res = await fetch(`/edit/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('更新失败');
        return await res.json();
    }
    async deleteBookmark(id) {
        const res = await fetch(`/delete/${id}`, { method: 'POST' });
        if (!res.ok) throw new Error('删除失败');
        return await res.json();
    }
    async addCategory(cat) {
        const res = await fetch('/add_category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cat)
        });
        if (!res.ok) throw new Error('添加分类失败');
        return await res.json();
    }
    async updateCategory(name, data) {
        const res = await fetch(`/category/${encodeURIComponent(name)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('更新分类失败');
        return await res.json();
    }
    async deleteCategory(name) {
        const res = await fetch(`/category/${encodeURIComponent(name)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('删除分类失败');
        return await res.json();
    }
    async incrementClick(id) {
        await fetch(`/increment_click/${id}`, { method: 'POST' });
    }
    async exportData() {
        const res = await fetch('/export');
        const data = await res.json();
        return data;
    }
    async importData(payload) {
        const res = await fetch('/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('导入失败');
        return await res.json();
    }
}

// 更新用户状态按钮
async function updateUserStatusButton() {
    const btn = document.getElementById('userStatusBtn');
    if (!btn) return;
    try {
        const res = await fetch('/user');
        if (res.ok) {
            const userData = await res.json();
            btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> 退出登录';
            // 可选：添加 title 显示用户名
            btn.title = `当前用户：${userData.username}`;
        } else {
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 尚未登录';
            btn.title = '点击登录';
        }
    } catch (e) {
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 尚未登录';
        btn.title = '点击登录';
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {  // 添加 async
    const adapter = new OnlineDataAdapter();
    const app = new BookmarkApp(adapter);
    window.bookmarkApp = app;

    const enhancedTitle = document.getElementById('enhancedTitle');
    const enhancedBadge = document.getElementById('enhancedBadge');
    const enhancedModal = document.getElementById('enhancedNoticeModal');
    if (enhancedModal) {
        const modal = new bootstrap.Modal(enhancedModal);
        if (enhancedTitle) enhancedTitle.addEventListener('click', () => modal.show());
        if (enhancedBadge) enhancedBadge.addEventListener('click', () => modal.show());
        const hasSeen = localStorage.getItem('hasSeenEnhancedNotice');
        if (!hasSeen) {
            modal.show();
            localStorage.setItem('hasSeenEnhancedNotice', 'true');
        }
    }

    // 初始化用户状态
    await updateUserStatusButton();

    // 用户状态按钮点击事件
    const userStatusBtn = document.getElementById('userStatusBtn');
    if (userStatusBtn) {
        userStatusBtn.addEventListener('click', async () => {
            const res = await fetch('/user');
            if (res.ok) {
                // 已登录，登出
                if (confirm('确定要退出登录吗？')) {
                    await fetch('/logout', { method: 'GET' });
                    await app.loadData();
                    await updateUserStatusButton();
                }
            } else {
                // 未登录，显示登录弹窗
                const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                loginModal.show();
            }
        });
    }

    // 登录表单提交
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');
            try {
                const res = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ username, password })
                });
                const data = await res.json();
                if (data.success) {
                    bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                    await app.loadData();
                    await updateUserStatusButton();
                } else {
                    errorDiv.style.display = 'block';
                    errorDiv.innerText = data.message || '登录失败';
                }
            } catch (err) {
                errorDiv.style.display = 'block';
                errorDiv.innerText = '网络错误';
            }
        });
    }



});