// online.js - 在线版数据适配器

// 全局登录状态标志
window.isLoggedIn = false;
window.isOnline = true;
let isUpdatingUserStatus = false;

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
            status: bookmark.status || 'private'   // 动态读取
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

function updatePageTitle() {
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
        titleEl.innerText = t('title_enhanced');
    }
}

// 初始化所有 Tooltip
function initAllTooltips() {
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        // 避免重复初始化
        const existing = bootstrap.Tooltip.getInstance(el);
        if (existing) {
            existing.dispose();
        }
        new bootstrap.Tooltip(el);
    });
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
            window.isLoggedIn = true;
            btn.innerHTML = `<i class="fas fa-sign-out-alt"></i> ${t('logout')}`;
            btn.title = `当前用户：${userData.username}`;
        } else {
            window.currentUserId = null;
            window.isAdmin = false;
            window.isLoggedIn = false;
            btn.innerHTML = `<i class="fas fa-sign-in-alt"></i> ${t('login')}`;
            btn.title = t('login');
        }
    } catch (e) {
        window.currentUserId = null;
        window.isAdmin = false;
        window.isLoggedIn = false;
        btn.innerHTML = `<i class="fas fa-sign-in-alt"></i> ${t('login')}`;
        btn.title = t('login');
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

    // 先获取用户状态（这会设置 window.isLoggedIn）
    await updateUserStatusButton();

    if (window._initialized) return;
    window._initialized = true;

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
    initAllTooltips();

    // 用户状态按钮点击事件
    const userStatusBtn = document.getElementById('userStatusBtn');
    if (userStatusBtn) {
        userStatusBtn.addEventListener('click', async () => {
            const res = await fetch('/user');
            if (res.ok) {
                // 已登录，登出
                if (confirm(t('confirm_logout'))) {
                    await fetch('/logout', { method: 'GET' });
                    window.isLoggedIn = false;
                    window.currentUserId = null;
                    window.isAdmin = false;
                    await window.bookmarkApp.loadData();
                    await updateUserStatusButton();
                    // 刷新当前视图
                    if (window.bookmarkApp.activeCategoryKey) {
                        window.bookmarkApp.setActiveCategory(window.bookmarkApp.activeCategoryKey);
                    }
                }
            } else {
                // 未登录，显示登录弹窗
                const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                loginModal.show();
            }
        });
    }

    // 切换注册模态框
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const loginModalEl = document.getElementById('loginModal');
            const registerModalEl = document.getElementById('registerModal');

            if (!registerModalEl) {
                console.error('注册模态框不存在');
                return;
            }

            if (loginModalEl) {
                const loginModal = bootstrap.Modal.getInstance(loginModalEl);
                if (loginModal) {
                    loginModal.hide();
                    loginModalEl.addEventListener('hidden.bs.modal', () => {
                        new bootstrap.Modal(registerModalEl).show();
                    }, { once: true });
                } else {
                    new bootstrap.Modal(registerModalEl).show();
                }
            } else {
                new bootstrap.Modal(registerModalEl).show();
            }
        });
    }

    const showLoginBtn = document.getElementById('showLoginBtn');
    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const registerModalEl = document.getElementById('registerModal');
            const loginModalEl = document.getElementById('loginModal');

            if (!loginModalEl) {
                console.error('登录模态框不存在');
                return;
            }

            if (registerModalEl) {
                const registerModal = bootstrap.Modal.getInstance(registerModalEl);
                if (registerModal) {
                    registerModal.hide();
                    registerModalEl.addEventListener('hidden.bs.modal', () => {
                        new bootstrap.Modal(loginModalEl).show();
                    }, { once: true });
                } else {
                    new bootstrap.Modal(loginModalEl).show();
                }
            } else {
                new bootstrap.Modal(loginModalEl).show();
            }
        });
    }

    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        new bootstrap.Tooltip(el);
    });

    // 忘记密码链接
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            const loginModalEl = document.getElementById('loginModal');
            const resetModalEl = document.getElementById('resetPasswordModal');

            if (!resetModalEl) {
                console.error('重置密码模态框不存在');
                return;
            }

            if (loginModalEl) {
                const loginModal = bootstrap.Modal.getInstance(loginModalEl);
                if (loginModal) {
                    loginModal.hide();
                    loginModalEl.addEventListener('hidden.bs.modal', () => {
                        const resetModal = new bootstrap.Modal(resetModalEl);
                        resetModal.show();
                    }, { once: true });
                } else {
                    const resetModal = new bootstrap.Modal(resetModalEl);
                    resetModal.show();
                }
            } else {
                const resetModal = new bootstrap.Modal(resetModalEl);
                resetModal.show();
            }
        });
    }

    // ========== 登录表单 ==========
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');

            // 隐藏之前的错误
            errorDiv.classList.add('d-none');
            errorDiv.innerText = '';

            // 校验
            if (!username) {
                errorDiv.innerText = t('username_required');
                errorDiv.classList.remove('d-none');
                return;
            }
            if (!password) {
                errorDiv.innerText = t('password_required');
                errorDiv.classList.remove('d-none');
                return;
            }

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + t('logging_in');

            try {
                const res = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ username, password })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    window.isLoggedIn = true;
                    const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
                    loginModal.hide();
                    await window.bookmarkApp.loadData();
                    if (window.bookmarkApp.activeCategoryKey) {
                        window.bookmarkApp.refreshBookmarks(window.bookmarkApp.activeCategoryKey);
                    } else {
                        window.bookmarkApp.refreshBookmarks('__recommend__');
                    }
                    await updateUserStatusButton();
                } else {
                    errorDiv.innerText = data.message || t('login_failed');
                    errorDiv.classList.remove('d-none');
                }
            } catch (err) {
                console.error(err);
                errorDiv.innerText = t('network_error');
                errorDiv.classList.remove('d-none');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        });
    }

    // ========== 注册表单 ==========
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const verificationCode = document.getElementById('regVerificationCode').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;
            const errorDiv = document.getElementById('registerError');

            errorDiv.style.display = 'none';
            errorDiv.innerText = '';

            // 用户名校验
            if (!username) {
                errorDiv.innerText = t('username_required');
                errorDiv.style.display = 'block';
                return;
            }
            if (username.length < 3 || username.length > 80) {
                errorDiv.innerText = t('username_length_error');
                errorDiv.style.display = 'block';
                return;
            }

            // 邮箱校验
            if (!email) {
                errorDiv.innerText = t('email_required');
                errorDiv.style.display = 'block';
                return;
            }
            const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
            if (!emailRegex.test(email)) {
                errorDiv.innerText = t('email_invalid');
                errorDiv.style.display = 'block';
                return;
            }

            // 验证码校验
            if (!verificationCode) {
                errorDiv.innerText = t('code_required');
                errorDiv.style.display = 'block';
                return;
            }

            // 密码校验
            if (!password) {
                errorDiv.innerText = t('password_required');
                errorDiv.style.display = 'block';
                return;
            }
            if (password.length < 8) {
                errorDiv.innerText = t('password_too_short');
                errorDiv.style.display = 'block';
                return;
            }
            if (password !== confirmPassword) {
                errorDiv.innerText = t('password_mismatch');
                errorDiv.style.display = 'block';
                return;
            }

            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + t('registering');

            try {
                const res = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ username, email, password, verification_code: verificationCode })
                });
                const data = await res.json();
                if (data.success) {
                    const registerModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
                    registerModal.hide();
                    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                    loginModal.show();
                    document.getElementById('loginUsername').value = username;
                    document.getElementById('loginPassword').value = '';
                    // 清空注册表单
                    registerForm.reset();
                } else {
                    // 前端翻译特定错误消息
                    let errorMessage = data.message;
                    if (errorMessage === '用户名已存在') {
                        errorMessage = t('username_exists');
                    } else if (errorMessage === '该邮箱已被注册') {
                        errorMessage = t('email_exists');
                    } else if (errorMessage === '验证码错误') {
                        errorMessage = t('code_error');
                    } else if (errorMessage === '验证码已过期，请重新获取') {
                        errorMessage = t('code_expired');
                    } else if (errorMessage === '密码长度至少为8位') {
                        errorMessage = t('password_too_short');
                    }
                    errorDiv.innerText = errorMessage;
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                console.error(err);
                errorDiv.innerText = t('network_error');
                errorDiv.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        });
    }

    // ========== 重置密码表单 ==========
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
            errorDiv.innerText = '';

            // 邮箱校验
            if (!email) {
                errorDiv.innerText = t('email_required');
                errorDiv.style.display = 'block';
                return;
            }
            const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
            if (!emailRegex.test(email)) {
                errorDiv.innerText = t('email_invalid');
                errorDiv.style.display = 'block';
                return;
            }

            // 验证码校验
            if (!code) {
                errorDiv.innerText = t('code_required');
                errorDiv.style.display = 'block';
                return;
            }

            // 密码校验
            if (!newPassword) {
                errorDiv.innerText = t('password_required');
                errorDiv.style.display = 'block';
                return;
            }
            if (newPassword.length < 8) {
                errorDiv.innerText = t('password_too_short');
                errorDiv.style.display = 'block';
                return;
            }
            if (newPassword !== confirmPassword) {
                errorDiv.innerText = t('password_mismatch');
                errorDiv.style.display = 'block';
                return;
            }

            const submitBtn = resetForm.querySelector('button[type="submit"]');
            const originalHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + t('resetting');

            try {
                const res = await fetch('/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code, new_password: newPassword })
                });
                const data = await res.json();
                if (data.success) {
                    alert(t('reset_success'));
                    const resetModal = bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal'));
                    resetModal.hide();
                    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                    loginModal.show();
                    resetForm.reset();
                } else {
                    errorDiv.innerText = data.message || t('reset_failed');
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                console.error(err);
                errorDiv.innerText = t('network_error');
                errorDiv.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        });
    }

    // ========== 获取验证码按钮 ==========
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    if (sendCodeBtn) {
        let countdown = 0;
        let canSend = true;

        sendCodeBtn.addEventListener('click', async () => {
            if (!canSend || countdown > 0) return;

            const email = document.getElementById('regEmail').value.trim();
            const errorDiv = document.getElementById('registerError');

            if (!email) {
                errorDiv.innerText = t('email_required');
                errorDiv.style.display = 'block';
                return;
            }
            const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
            if (!emailRegex.test(email)) {
                errorDiv.innerText = t('email_invalid');
                errorDiv.style.display = 'block';
                return;
            }

            errorDiv.style.display = 'none';

            canSend = false;
            const originalText = sendCodeBtn.innerText;
            sendCodeBtn.disabled = true;
            sendCodeBtn.innerText = t('sending');

            try {
                const res = await fetch('/send_verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message || t('code_sent'));
                    countdown = 60;
                    sendCodeBtn.innerText = `${countdown}${t('seconds_retry')}`;
                    const timer = setInterval(() => {
                        countdown--;
                        if (countdown <= 0) {
                            clearInterval(timer);
                            canSend = true;
                            sendCodeBtn.disabled = false;
                            sendCodeBtn.innerText = t('get_code');
                        } else {
                            sendCodeBtn.innerText = `${countdown}${t('seconds_retry')}`;
                        }
                    }, 1000);
                } else {
                    alert(data.message || t('send_failed'));
                    canSend = true;
                    sendCodeBtn.disabled = false;
                    sendCodeBtn.innerText = originalText;
                }
            } catch (err) {
                console.error(err);
                alert(t('network_error'));
                canSend = true;
                sendCodeBtn.disabled = false;
                sendCodeBtn.innerText = originalText;
            }
        });
    }

    // ========== 重置密码获取验证码按钮 ==========
    const sendResetCodeBtn = document.getElementById('sendResetCodeBtn');
    if (sendResetCodeBtn) {
        let countdown = 0;
        let canSend = true;

        sendResetCodeBtn.addEventListener('click', async () => {
            if (!canSend || countdown > 0) return;

            const email = document.getElementById('resetEmail').value.trim();
            const errorDiv = document.getElementById('resetError');

            if (!email) {
                errorDiv.innerText = t('email_required');
                errorDiv.style.display = 'block';
                return;
            }
            const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
            if (!emailRegex.test(email)) {
                errorDiv.innerText = t('email_invalid');
                errorDiv.style.display = 'block';
                return;
            }

            errorDiv.style.display = 'none';

            canSend = false;
            const originalText = sendResetCodeBtn.innerText;
            sendResetCodeBtn.disabled = true;
            sendResetCodeBtn.innerText = t('sending');

            try {
                const res = await fetch('/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message || t('code_sent'));
                    countdown = 60;
                    sendResetCodeBtn.innerText = `${countdown}${t('seconds_retry')}`;
                    const timer = setInterval(() => {
                        countdown--;
                        if (countdown <= 0) {
                            clearInterval(timer);
                            canSend = true;
                            sendResetCodeBtn.disabled = false;
                            sendResetCodeBtn.innerText = t('get_code');
                        } else {
                            sendResetCodeBtn.innerText = `${countdown}${t('seconds_retry')}`;
                        }
                    }, 1000);
                } else {
                    alert(data.message || t('send_failed'));
                    canSend = true;
                    sendResetCodeBtn.disabled = false;
                    sendResetCodeBtn.innerText = originalText;
                }
            } catch (err) {
                console.error(err);
                alert(t('network_error'));
                canSend = true;
                sendResetCodeBtn.disabled = false;
                sendResetCodeBtn.innerText = originalText;
            }
        });
    }

    // 重置弹窗中的“去登录”链接
    const backToLoginLink = document.getElementById('backToLoginLink');
    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            const resetModalEl = document.getElementById('resetPasswordModal');
            const loginModalEl = document.getElementById('loginModal');

            if (!loginModalEl) {
                console.error('登录模态框不存在');
                return;
            }

            if (resetModalEl) {
                const resetModal = bootstrap.Modal.getInstance(resetModalEl);
                if (resetModal) {
                    resetModal.hide();
                    resetModalEl.addEventListener('hidden.bs.modal', () => {
                        new bootstrap.Modal(loginModalEl).show();
                    }, { once: true });
                } else {
                    new bootstrap.Modal(loginModalEl).show();
                }
            } else {
                new bootstrap.Modal(loginModalEl).show();
            }
        });
    }

    updatePageTitle();

    const tooltipIcon = document.getElementById('privateTooltip');
    if (tooltipIcon) {
        tooltipIcon.setAttribute('title', t('private_tip'));
        tooltipIcon.setAttribute('data-bs-original-title', t('private_tip'));
        new bootstrap.Tooltip(tooltipIcon);
    }
});