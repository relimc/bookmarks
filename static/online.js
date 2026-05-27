// online.js - 在线版数据适配器

// 全局登录状态标志
window.isLoggedIn = false;
window.isOnline = true;

class OnlineDataAdapter {
    async getAllData() {
        const res = await fetch('/list');
        if (res.status === 401) {
            return { bookmarks: [], categories: {} };
        }
        const data = await res.json();
        return { bookmarks: data.bookmarks, categories: data.categories };
    }
    async addBookmark(bookmark) {
        const payload = {
            url: bookmark.url,
            category: bookmark.category,
            title: bookmark.title,
            description: bookmark.description,
            icon: bookmark.icon,
            tags: bookmark.tags,
            status: 'private'
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

async function updateUserStatusButton() {
    const btn = document.getElementById('userStatusBtn');
    if (!btn) return;
    try {
        const res = await fetch('/user');
        if (res.ok) {
            const userData = await res.json();
            window.currentUserId = userData.id;
            window.isAdmin = userData.is_admin === true;
            window.isLoggedIn = true;   // 关键：设置登录标志
            btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> 退出登录';
            btn.title = `当前用户：${userData.username}`;
        } else {
            window.currentUserId = null;
            window.isAdmin = false;
            window.isLoggedIn = false;  // 未登录
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 尚未登录';
            btn.title = '点击登录';
        }
    } catch (e) {
        console.error(e);
        window.currentUserId = null;
        window.isAdmin = false;
        window.isLoggedIn = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 尚未登录';
        btn.title = '点击登录';
    }
}

// 安全的模态框切换函数
function switchModal(closeModalId, openModalId) {
    const closeModalEl = document.getElementById(closeModalId);
    if (!closeModalEl) {
        const openModal = new bootstrap.Modal(document.getElementById(openModalId));
        openModal.show();
        return;
    }
    const closeModal = bootstrap.Modal.getInstance(closeModalEl);
    if (closeModal) {
        closeModal.hide();
        // 等待关闭动画完成后再打开新模态框
        closeModalEl.addEventListener('hidden.bs.modal', function onHidden() {
            closeModalEl.removeEventListener('hidden.bs.modal', onHidden);
            const openModal = new bootstrap.Modal(document.getElementById(openModalId));
            openModal.show();
        }, { once: true });
    } else {
        const openModal = new bootstrap.Modal(document.getElementById(openModalId));
        openModal.show();
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    await updateUserStatusButton();

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

    await updateUserStatusButton();

    const userStatusBtn = document.getElementById('userStatusBtn');
    if (userStatusBtn) {
        userStatusBtn.addEventListener('click', async () => {
            const res = await fetch('/user');
            if (res.ok) {
                if (confirm('确定要退出登录吗？')) {
                    await fetch('/logout', { method: 'GET' });
                    window.isLoggedIn = false;
                    await app.loadData();
                    await updateUserStatusButton();
                }
            } else {
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
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');
            if (errorDiv) {
                errorDiv.style.display = 'none';
                errorDiv.innerText = '';
            }

            if (!username || !password) {
                if (errorDiv) {
                    errorDiv.innerText = '用户名和密码不能为空';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';

            try {
                const res = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ username, password })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
                    if (loginModal) loginModal.hide();
                    if (window.bookmarkApp) await window.bookmarkApp.loadData();
                    if (typeof updateUserStatusButton === 'function') await updateUserStatusButton();

                    window.isLoggedIn = true;
                    bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                    await window.bookmarkApp.loadData();
                    // 强制刷新当前激活的分类视图，使卡片上的编辑按钮图标更新
                    if (window.bookmarkApp.activeCategoryKey) {
                        window.bookmarkApp.setActiveCategory(window.bookmarkApp.activeCategoryKey);
                    } else {
                        window.bookmarkApp.setActiveCategory('__recommend__');
                    }

                } else {
                    if (errorDiv) {
                        errorDiv.innerText = data.message || '登录失败，请检查用户名或密码';
                        errorDiv.style.display = 'block';
                    }
                }
            } catch (err) {
                console.error(err);
                if (errorDiv) {
                    errorDiv.innerText = '网络错误，请稍后重试';
                    errorDiv.style.display = 'block';
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        });
    }

    // 切换注册模态框
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchModal('loginModal', 'registerModal');
        });
    }

    const showLoginBtn = document.getElementById('showLoginBtn');
    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchModal('registerModal', 'loginModal');
        });
    }

    // 注册表单提交
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;
            const errorDiv = document.getElementById('registerError');
            const verificationCode = document.getElementById('regVerificationCode').value.trim();
            errorDiv.style.display = 'none';

            // 前端校验
            if (!username) {
                errorDiv.innerText = '用户名不能为空';
                errorDiv.style.display = 'block';
                return;
            }
            if (username.length < 3 || username.length > 80) {
                errorDiv.innerText = '用户名长度应为3-80个字符';
                errorDiv.style.display = 'block';
                return;
            }
            if (!email) {
                errorDiv.innerText = '邮箱不能为空';
                errorDiv.style.display = 'block';
                return;
            }
            // 简单邮箱正则
            const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
            if (!emailRegex.test(email)) {
                errorDiv.innerText = '邮箱格式不正确';
                errorDiv.style.display = 'block';
                return;
            }
            if (password.length < 8) {
                errorDiv.innerText = '密码长度至少为8位';
                errorDiv.style.display = 'block';
                return;
            }
            if (password !== confirmPassword) {
                errorDiv.innerText = '两次输入的密码不一致';
                errorDiv.style.display = 'block';
                return;
            }

            try {
                const res = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ username, email, password, verification_code: verificationCode })
                });
                const data = await res.json();
                if (data.success) {
                    // 注册成功，关闭注册模态框，打开登录模态框
                    const registerModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
                    registerModal.hide();
                    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                    loginModal.show();
                    // 预填用户名，清空密码
                    document.getElementById('loginUsername').value = username;
                    document.getElementById('loginPassword').value = '';
                    // 清空注册表单
                    document.getElementById('regUsername').value = '';
                    document.getElementById('regEmail').value = '';
                    document.getElementById('regPassword').value = '';
                    document.getElementById('regConfirmPassword').value = '';
                } else {
                    errorDiv.innerText = data.message || '注册失败';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                errorDiv.innerText = '网络错误，请稍后重试';
                errorDiv.style.display = 'block';
            }
        });
    }

    // 获取验证码按钮
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    if (sendCodeBtn) {
        let countdown = 0;
        let canSend = true;

        sendCodeBtn.addEventListener('click', async () => {
            if (!canSend || countdown > 0) return;
            const email = document.getElementById('regEmail').value.trim();
            if (!email) {
                alert('请先填写邮箱');
                return;
            }
            const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
            if (!emailRegex.test(email)) {
                alert('邮箱格式不正确');
                return;
            }

            // 立即禁用按钮，显示“发送中”，防止重复点击
            canSend = false;
            const originalText = sendCodeBtn.innerText;
            sendCodeBtn.disabled = true;
            sendCodeBtn.innerText = '发送中...';

            try {
                const res = await fetch('/send_verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (data.success) {
                    alert('验证码已发送，请注意查收');
                    // 开始倒计时60秒
                    countdown = 60;
                    sendCodeBtn.innerText = `${countdown}秒后重试`;
                    const timer = setInterval(() => {
                        countdown--;
                        if (countdown <= 0) {
                            clearInterval(timer);
                            canSend = true;
                            sendCodeBtn.disabled = false;
                            sendCodeBtn.innerText = '获取验证码';
                        } else {
                            sendCodeBtn.innerText = `${countdown}秒后重试`;
                        }
                    }, 1000);
                } else {
                    alert(data.message || '发送失败');
                    // 恢复按钮状态
                    canSend = true;
                    sendCodeBtn.disabled = false;
                    sendCodeBtn.innerText = originalText;
                }
            } catch (err) {
                console.error(err);
                alert('网络错误，请稍后重试');
                canSend = true;
                sendCodeBtn.disabled = false;
                sendCodeBtn.innerText = originalText;
            }
        });
    }

    // 忘记密码链接
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
            if (loginModal) loginModal.hide();
            const resetModal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
            resetModal.show();
        });
    }

    // 重置密码：发送验证码按钮
    const sendResetCodeBtn = document.getElementById('sendResetCodeBtn');
    if (sendResetCodeBtn) {
        let countdown = 0;
        let canSend = true;

        sendResetCodeBtn.addEventListener('click', async () => {
            if (!canSend || countdown > 0) return;
            const email = document.getElementById('resetEmail').value.trim();
            if (!email) {
                alert('请填写邮箱');
                return;
            }
            const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
            if (!emailRegex.test(email)) {
                alert('邮箱格式不正确');
                return;
            }

            // 立即禁用按钮，显示“发送中...”
            canSend = false;
            const originalText = sendResetCodeBtn.innerText;
            sendResetCodeBtn.disabled = true;
            sendResetCodeBtn.innerText = '发送中...';

            try {
                const res = await fetch('/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message || '验证码已发送，请注意查收');
                    // 开始倒计时 60 秒
                    countdown = 60;
                    sendResetCodeBtn.innerText = `${countdown}秒后重试`;
                    const timer = setInterval(() => {
                        countdown--;
                        if (countdown <= 0) {
                            clearInterval(timer);
                            canSend = true;
                            sendResetCodeBtn.disabled = false;
                            sendResetCodeBtn.innerText = '获取验证码';
                        } else {
                            sendResetCodeBtn.innerText = `${countdown}秒后重试`;
                        }
                    }, 1000);
                } else {
                    alert(data.message || '发送失败，请稍后重试');
                    // 恢复按钮
                    canSend = true;
                    sendResetCodeBtn.disabled = false;
                    sendResetCodeBtn.innerText = originalText;
                }
            } catch (err) {
                console.error(err);
                alert('网络错误，请稍后重试');
                canSend = true;
                sendResetCodeBtn.disabled = false;
                sendResetCodeBtn.innerText = originalText;
            }
        });
    }

    // 重置密码表单提交
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('resetEmail').value.trim();
            const code = document.getElementById('resetCode').value.trim();
            const newPassword = document.getElementById('resetNewPassword').value;
            const confirmPassword = document.getElementById('resetConfirmPassword').value;
            const errorDiv = document.getElementById('resetError');
            errorDiv.style.display = 'none';

            if (!email || !code || !newPassword || !confirmPassword) {
                errorDiv.innerText = '请填写所有字段';
                errorDiv.style.display = 'block';
                return;
            }
            if (newPassword.length < 8) {
                errorDiv.innerText = '密码长度至少为8位';
                errorDiv.style.display = 'block';
                return;
            }
            if (newPassword !== confirmPassword) {
                errorDiv.innerText = '两次输入的密码不一致';
                errorDiv.style.display = 'block';
                return;
            }

            try {
                const res = await fetch('/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code, new_password: newPassword })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    const resetModal = bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal'));
                    resetModal.hide();
                    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                    loginModal.show();
                    // 清空表单
                    resetForm.reset();
                } else {
                    errorDiv.innerText = data.message || '重置失败';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                errorDiv.innerText = '网络错误';
                errorDiv.style.display = 'block';
            }
        });
    }

    // 重置弹窗中的“去登录”链接
    const backToLoginLink = document.getElementById('backToLoginLink');
    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            const resetModal = bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal'));
            resetModal.hide();
            const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            loginModal.show();
        });
    }



});