// 语言包
const i18n = {
    zh: {
        'title_enhanced': '我的书签 · 增强版',
        'title_local': '我的书签 · 本地版',
        'seo_description': '个人书签管理工具，支持收藏、分类、标签、公开分享等功能。本地版数据私有，增强版云端同步。',
        'seo_keywords': '书签,书签管理,导航,收藏夹,在线书签,个人导航,知识管理,网页收藏',
        'og_title': '我的书签 - 个人书签导航',
        'og_description': '高效管理您的书签，支持分类、标签、公开分享。',
        // 侧边栏
        'my_bookmarks': '我的书签',
        'local_version': '本地版',
        'enhanced_version': '增强版',
        'all': '全部',
        'recommend': '推荐',
        'uncategorized': '未分类',
        'ctrl_key': 'Ctrl',
        'shift_key': 'Shift',
        'v_key': 'V',
        'add_bookmark_shortcut': '{{ctrl}} + {{shift}} + {{v}} 新增书签',
        'ctrl_shift_v': 'Ctrl + Shift + V 新增书签',
        'load_categories': '加载分类中...',
        'loading': '⏳ 正在加载书签...',
        'uncategorized': '未分类',

        // 搜索框
        'search_placeholder': '点击左侧图标切换搜索引擎，默认搜索书签',
        'search_bookmarks': '搜索书签',
        'search': '搜索',
        'search_keyword_hint': '请输入关键字跳转至',
        'search_suffix': '搜索',

        // 头部按钮
        'manage_bookmarks': '管理书签',
        'add_bookmark': '新增书签',
        'import_bookmarks': '导入书签',
        'export_bookmarks': '导出书签',
        'manage_categories': '管理分类',

        // 分类管理
        'category_list': '分类列表',
        'add_category': '新增分类',
        'category_name': '分类名称',
        'category_icon': '分类图标',
        'parent_category': '上级分类',
        'priority': '优先级',
        'no_parent': '无',
        'edit': '编辑',
        'delete': '删除',
        'category_search_placeholder': '🔍 搜索分类...',
        'operation': '操作',
        'noun_category': '📁 名词分类',
        'verb_category': '🎯 动词分类',
        'recommend_category': '✨ 推荐分类',
        'icon_image': '图片',
        'icon_music': '音乐',
        'icon_video': '视频',
        'icon_document': '文档',
        'icon_game': '游戏',
        'icon_favorite': '收藏',
        'icon_read': '阅读',
        'icon_listen': '聆听',
        'icon_watch': '观看',
        'icon_learn': '学习',
        'icon_download': '下载',
        'icon_search': '搜索',
        'icon_work': '工作',
        'icon_entertainment': '娱乐',
        'icon_social': '社交',
        'icon_shopping': '购物',
        'icon_tech': '科技',
        'icon_more': '更多',
        'select_icon': '请选择图标',
        'custom_icon_placeholder': '图标字体类名或链接，如 fas fa-star 或 https://',
        'custom_btn': '自定义',
        'no_parent': '-- 无 --',
        'select_category': '-- 选择已有分类 --',

        // 书签弹窗
        'add_bookmark_title': '📋 新增书签',
        'edit_bookmark_title': '✏️ 编辑书签',
        'bookmark_info_title': 'ℹ️ 书签详情',
        'url_label': '网址',
        'title_label': '标题',
        'description_label': '描述',
        'tags_label': '标签',
        'tags_placeholder': '多个标签用 / 分割，例如：前端/React/Vue',
        'category_label': '分类',
        'select_category': '-- 选择已有分类 --',
        'quick_add_category': '新增',
        'private_label': '私密',
        'private_tip': '仅自己可见。取消勾选将变为公开书签。',
        'delete_btn': '删除',
        'cancel_btn': '取消',
        'save_btn': '保存',
        'confirm_delete': '确定删除？',
        'title_placeholder': '自动抓取或手动输入',

        // 提示消息
        'no_bookmarks': '✨ 还没有书签，点击「新增书签」开始收藏吧！',
        'no_match': '🔍 没有找到相关书签，试试其他关键词吧～',
        'save_success': '✅ 保存成功！',
        'delete_success': '✅ 删除成功！',
        'delete_failed': '❌ 删除失败',
        'url_required': '网址不能为空',
        'network_error': '网络错误，请稍后重试',
        'category_exist': '分类已存在',
        'category_required': '分类名称不能为空',
        'confirm_delete': '确定删除？',
        'delete_btn': '删除',
        'cancel_btn': '取消',
        'save_btn': '保存',
        'close': '关闭',
        'login': '登录',
        'register': '注册',
        'reset_password': '重置密码',
        'confirm_edit': '保存',
        'confirm_add': '保存',
        'fetching_metadata': '正在获取网页信息...',
        'fetch_success': '✅ 信息获取完成',
        'fetch_failed': '⚠️ 获取失败，请手动填写信息',
        'fetch_error': '⚠️ 网络错误，请手动填写信息',

        // 登录相关
        'login': '登录',
        'not_logged_in': '尚未登录',
        'register': '注册',
        'logout': '退出登录',
        'username': '用户名',
        'password': '密码',
        'confirm_password': '确认密码',
        'email': '邮箱',
        'verification_code': '验证码',
        'get_code': '获取验证码',
        'welcome_back': '欢迎回来',
        'create_account': '创建账户',
        'no_account': '没有账号？',
        'has_account': '已有账号？',
        'forgot_password': '忘记密码？',
        'login_success': '登录成功',
        'login_failed': '用户名或密码错误',
        'register_success': '注册成功',
        'password_too_short': '密码长度至少为8位',
        'password_mismatch': '两次输入的密码不一致',
        'email_invalid': '邮箱格式不正确',
        'reset_password': '重置密码',
        'remember_password': '想起密码了？',
        'new_password': '新密码',
        'back_to_login': '去登录',
        'username_placeholder': '请输入用户名',
        'password_placeholder': '请输入密码',
        'email_placeholder': '请输入邮箱，用于获取验证码',
        'email_placeholder_reset': '请输入注册邮箱获取验证码',
        'verification_code_placeholder': '请输入验证码',
        'confirm_password_placeholder': '请再次输入密码',
        'new_password_placeholder': '至少8位',
        'url_placeholder': 'https:// 或 http://',
        'title_placeholder': '自动抓取或手动输入',
        'description_placeholder': '请输入描述',
        'tags_placeholder': '多个标签用 / 分割，例如：前端/React/Vue',
        'confirm_logout': '确定要退出登录吗？',
        'username_required': '请输入用户名',
        'password_required': '请输入密码',
        'email_required': '请填写邮箱',
        'code_required': '请输入验证码',
        'logging_in': '登录中...',
        'registering': '注册中...',
        'resetting': '重置中...',
        'sending': '发送中...',
        'get_code': '获取验证码',
        'seconds_retry': '秒后重试',
        'code_sent': '验证码已发送',
        'send_failed': '发送失败',
        'reset_success': '密码重置成功',
        'reset_failed': '重置失败',
        'username_length_error': '用户名长度应为3-80个字符',
        'username_exists': '用户名已存在',
        'email_exists': '该邮箱已被注册',
        'code_error': '验证码错误',
        'code_expired': '验证码已过期，请重新获取',

        // 增强版提示
        'enhanced_title': '🚀 关于增强版',
        'enhanced_desc': '数据存储在服务器，支持多设备同步与高级功能。',
        'enhanced_features': '私密书签；共享书签；云端存储；跨设备访问；支持导入浏览器书签；自动抓取网页图标/描述',
        'enhanced_note': '需注册登录、依赖网络；公开书签需管理员审核后展示。',
        'enhanced_offline_tip': '如果你更看重离线与隐私，可体验纯本地版本：',
        'goto_local': '本地版',
        'enhanced_tip': '💡 提示：点击左上角「我的书签」或「增强版」徽章可再次查看本说明。',
        'advantages_title': '✅ 优点：',
        'disadvantages_title': '❌ 注意：',

        // 本地版提示
        'local_title': '📌 关于本地版',
        'local_desc': '数据存储在您的浏览器中，完全由您掌控，不上传任何服务器。',
        'local_features': '数据私有、无需登录、支持自动抓取网页标题/描述/图标、支持导入浏览器书签',
        'local_note': '更换设备或清除浏览器缓存会导致书签丢失；无法多端同步。',
        'local_warning': '⚠️ 在更换设备或清理浏览器前，请务必使用右上角「管理书签 → 导出书签」备份数据。',
        'goto_enhanced_desc': '如需多端同步、共享书签等高级功能，推荐使用：',
        'goto_enhanced': '增强版',
        'local_tip': '💡 提示：点击左上角「我的书签」或「本地版」徽章可再次查看本说明。',

        // 其他
        'shared_by': '共享人',
        'anonymous_user': '匿名用户',
        'edit_category': '编辑分类',
        'category_name_placeholder': '输入名称'
    },
    en: {
        'title_enhanced': 'My Bookmarks · Plus',
        'title_local': 'My Bookmarks · Local',
        'seo_description': 'Personal bookmark management tool, supports bookmarking, categorization, tagging, and public sharing. Local version keeps data private, enhanced version offers cloud sync.',
        'seo_keywords': 'bookmarks,bookmark manager,navigation,favorites,online bookmarks,personal navigation,knowledge management,web bookmark',
        'og_title': 'My Bookmarks - Personal Bookmark Navigator',
        'og_description': 'Efficiently manage your bookmarks with categories, tags, and public sharing.',

        // Sidebar
        'my_bookmarks': 'My Bookmarks',
        'local_version': 'Local',
        'enhanced_version': 'Plus',
        'all': 'All',
        'recommend': 'Recommend',
        'ctrl_shift_v': 'Ctrl + Shift + V Add Bookmark',
        'ctrl_key': 'Ctrl',
        'shift_key': 'Shift',
        'v_key': 'V',
        'add_bookmark_shortcut': '{{ctrl}} + {{shift}} + {{v}} Add Bookmark',
        'load_categories': 'Loading categories...',
        'loading': '⏳ Loading bookmarks...',

        // Search
        'search_placeholder': 'Click left icon to switch engine, default search bookmarks',
        'search_bookmarks': 'Search Bookmarks',
        'search': 'Search',
        'search_keyword_hint': 'Enter keyword to search on',
        'search_suffix': '',

        // Header buttons
        'manage_bookmarks': 'Manage Bookmarks',
        'add_bookmark': 'Add Bookmark',
        'import_bookmarks': 'Import Bookmarks',
        'export_bookmarks': 'Export Bookmarks',
        'manage_categories': 'Manage Categories',

        // Category management
        'category_list': 'Category List',
        'add_category': 'Add Category',
        'category_name': 'Category Name',
        'category_icon': 'Category Icon',
        'parent_category': 'Parent Category',
        'priority': 'Priority',
        'no_parent': 'None',
        'edit': 'Edit',
        'delete': 'Delete',
        'close': 'Close',
        'category_search_placeholder': '🔍 Search categories...',
        'operation': 'Actions',
        'uncategorized': 'Uncategorized',
        'noun_category': '📁 Noun',
        'verb_category': '🎯 Verb',
        'recommend_category': '✨ Recommended',
        'icon_image': 'Image',
        'icon_music': 'Music',
        'icon_video': 'Video',
        'icon_document': 'Document',
        'icon_game': 'Game',
        'icon_favorite': 'Favorite',
        'icon_read': 'Read',
        'icon_listen': 'Listen',
        'icon_watch': 'Watch',
        'icon_learn': 'Learn',
        'icon_download': 'Download',
        'icon_search': 'Search',
        'icon_work': 'Work',
        'icon_entertainment': 'Entertainment',
        'icon_social': 'Social',
        'icon_shopping': 'Shopping',
        'icon_tech': 'Tech',
        'icon_more': 'More',
        'select_icon': 'Select Icon',
        'custom_icon_placeholder': 'Icon class or URL, eg: fas fa-star or https://',
        'custom_btn': 'Custom',
        'no_parent': '-- None --',
        'select_category': '-- Select Category --',

        // Bookmark modal
        'add_bookmark_title': '📋 Add Bookmark',
        'edit_bookmark_title': '✏️ Edit Bookmark',
        'bookmark_info_title': 'ℹ️ Bookmark Info',
        'url_label': 'URL',
        'title_label': 'Title',
        'description_label': 'Description',
        'tags_label': 'Tags',
        'tags_placeholder': 'Separate multiple tags with /, eg: frontend/React/Vue',
        'category_label': 'Category',
        'select_category': '-- Select Category --',
        'quick_add_category': 'Add',
        'private_label': 'Private',
        'private_tip': 'Visible only to you. Uncheck to make it public.',
        'delete_btn': 'Delete',
        'cancel_btn': 'Cancel',
        'save_btn': 'Save',
        'confirm_delete': 'Confirm delete?',
        'title_placeholder': 'Auto-fetch or manual input',

        // Messages
        'no_bookmarks': '✨ No bookmarks yet, click "Add Bookmark" to get started!',
        'no_match': '🔍 No matching bookmarks found, try different keywords.',
        'save_success': '✅ Saved successfully!',
        'delete_success': '✅ Deleted successfully!',
        'delete_failed': '❌ Delete failed',
        'url_required': 'URL is required',
        'network_error': 'Network error, please try again later',
        'category_exist': 'Category already exists',
        'category_required': 'Category name is required',
        'confirm_delete': 'Confirm delete?',
        'delete_btn': 'Delete',
        'cancel_btn': 'Cancel',
        'save_btn': 'Save',
        'close': 'Close',
        'login': 'Login',
        'register': 'Register',
        'reset_password': 'Reset Password',
        'confirm_edit': 'Save',
        'confirm_add': 'Save',
        'fetching_metadata': 'Fetching page info...',
        'fetch_success': '✅ Info fetched successfully',
        'fetch_failed': '⚠️ Failed to fetch, please fill in manually',
        'fetch_error': '⚠️ Network error, please fill in manually',

        // Login/Register
        'login': 'Login',
        'register': 'Register',
        'logout': 'Logout',
        'username': 'Username',
        'password': 'Password',
        'confirm_password': 'Confirm Password',
        'email': 'Email',
        'verification_code': 'Verification Code',
        'get_code': 'Get Code',
        'welcome_back': 'Welcome Back',
        'create_account': 'Create Account',
        'no_account': 'No account?',
        'has_account': 'Already have an account?',
        'forgot_password': 'Forgot password?',
        'login_success': 'Login successful',
        'login_failed': 'Invalid username or password',
        'register_success': 'Registration successful',
        'password_too_short': 'Password must be at least 8 characters',
        'password_mismatch': 'Passwords do not match',
        'email_invalid': 'Invalid email format',
        'reset_password': 'Reset Password',
        'remember_password': 'Remember password?',
        'back_to_login': 'Back to Login',
        'username_placeholder': 'Enter username',
        'password_placeholder': 'Enter password',
        'email_placeholder': 'Enter email to get verification code',
        'email_placeholder_reset': 'Enter registered email to get verification code',
        'verification_code_placeholder': 'Enter verification code',
        'confirm_password_placeholder': 'Confirm password',
        'new_password_placeholder': 'At least 8 characters',
        'url_placeholder': 'https:// or http://',
        'title_placeholder': 'Auto-fetch or manual input',
        'description_placeholder': 'Enter description',
        'tags_placeholder': 'Separate tags with /, e.g., frontend/React/Vue',
        'confirm_logout': 'Are you sure you want to log out?',
        'username_required': 'Please enter username',
        'password_required': 'Please enter password',
        'email_required': 'Please enter email',
        'code_required': 'Please enter verification code',
        'logging_in': 'Logging in...',
        'registering': 'Registering...',
        'resetting': 'Resetting...',
        'sending': 'Sending...',
        'get_code': 'Get Code',
        'seconds_retry': 's retry',
        'code_sent': 'Verification code sent',
        'send_failed': 'Send failed',
        'reset_success': 'Password reset successfully',
        'reset_failed': 'Reset failed',
        'username_length_error': 'Username must be 3-80 characters',
        'username_exists': 'Username already exists',
        'email_exists': 'Email already registered',
        'code_error': 'Verification code error',
        'code_expired': 'Verification code expired, please get a new one',


        // Enhanced version modal
        'enhanced_title': '🚀 About Enhanced Version',
        'enhanced_desc': 'Data is stored on the server, supporting multi-device synchronization.',
        'enhanced_features': 'Private bookmarks; Shared bookmarks; Cloud storage; Cross-device access; Browser bookmark import; Auto-fetch metadata',
        'enhanced_note': 'Requires login and network; Public bookmarks need admin approval.',
        'enhanced_offline_tip': 'If you value offline and privacy more, you can try the pure local version:',
        'goto_local': 'Local Version',
        'enhanced_tip': '💡 Tip: Click "My Bookmarks" or "Plus" badge to view this notice again.',
        'advantages_title': '✅ Advantages:',
        'disadvantages_title': '❌ Notes:',

        // Local version modal
        'local_title': '📌 About Local Version',
        'local_desc': 'Data is stored in your browser, fully under your control, never uploaded to any server.',
        'local_features': 'Private data, no login required, supports auto-fetching metadata, supports browser bookmark import',
        'local_note': 'Switching devices or clearing browser cache will cause bookmark loss; no cross-device sync.',
        'local_warning': '⚠️ Before switching devices or clearing browser cache, please use "Manage Bookmarks → Export Bookmarks" to back up your data.',
        'goto_enhanced_desc': 'For multi-device sync, shared bookmarks and other advanced features, we recommend:',
        'goto_enhanced': 'Plus Version',
        'local_tip': '💡 Tip: Click "My Bookmarks" or "Local" badge to view this notice again.',

        // Other
        'shared_by': 'Shared by',
        'anonymous_user': 'Anonymous',
        'edit_category': 'Edit Category',
        'category_name_placeholder': 'Enter name'
    }
};

// 当前语言
let currentLang = localStorage.getItem('app_lang') || 'zh';

// 翻译函数
function t(key) {
    return i18n[currentLang][key] || key;
}

// 设置语言
function setLanguage(lang) {
    if (i18n[lang]) {
        currentLang = lang;
        localStorage.setItem('app_lang', lang);
        return true;
    }
    return false;
}

// 获取当前语言
function getCurrentLang() {
    return currentLang;
}

// 更新图标选择器文字的函数
function updateIconSelectorText() {
    // 更新列标题
    const headers = document.querySelectorAll('.icon-column .column-header');
    const headerKeys = ['noun_category', 'verb_category', 'recommend_category'];
    headers.forEach((header, index) => {
        if (headerKeys[index]) {
            header.innerHTML = t(headerKeys[index]);
        }
    });

    // 更新图标选项的文字
    const iconMappings = {
        '图片': 'icon_image',
        '音乐': 'icon_music',
        '视频': 'icon_video',
        '文档': 'icon_document',
        '游戏': 'icon_game',
        '收藏': 'icon_favorite',
        '阅读': 'icon_read',
        '聆听': 'icon_listen',
        '观看': 'icon_watch',
        '学习': 'icon_learn',
        '下载': 'icon_download',
        '搜索': 'icon_search',
        '工作': 'icon_work',
        '娱乐': 'icon_entertainment',
        '社交': 'icon_social',
        '购物': 'icon_shopping',
        '科技': 'icon_tech',
        '更多': 'icon_more'
    };

    document.querySelectorAll('.icon-option').forEach(opt => {
        const textSpan = opt.querySelector('span');
        if (textSpan) {
            const originalText = textSpan.innerText;
            if (iconMappings[originalText]) {
                textSpan.innerText = t(iconMappings[originalText]);
            }
        }
    });
}

// 更新页面所有带有 data-i18n 属性的元素
function updatePageText() {
    // 处理所有带有 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (!key) return;
        const translatedText = t(key);

        // 处理输入框和文本域的 placeholder
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            if (el.placeholder !== undefined) {
                el.placeholder = translatedText;
            }
        }
        // 处理按钮和链接
        else if (el.tagName === 'BUTTON' || el.tagName === 'A') {
            const icon = el.querySelector('i');
            if (icon) {
                const iconHtml = icon.outerHTML;
                el.innerHTML = `${iconHtml} ${translatedText}`;
            } else {
                el.innerText = translatedText;
            }
        }
        // 处理 span、div、label、h5、th 等元素
        else if (el.tagName === 'SPAN' || el.tagName === 'DIV' || el.tagName === 'LABEL' || el.tagName === 'H5' || el.tagName === 'TH') {
            const icon = el.querySelector('i');
            if (icon && el.childNodes.length === 1) {
                // 只有图标，不处理
                return;
            } else if (icon) {
                const iconHtml = icon.outerHTML;
                el.innerHTML = `${iconHtml} ${translatedText}`;
            } else {
                el.innerText = translatedText;
            }
        }
        else if (el.tagName === 'SPAN') {
            // 如果 span 内有图标，保留图标
            const icon = el.querySelector('i');
            if (icon) {
                const iconHtml = icon.outerHTML;
                el.innerHTML = `${iconHtml} ${translatedText}`;
            } else {
                el.innerText = translatedText;
            }
        }
        // 处理其他元素
        else {
            el.innerText = translatedText;
        }
    });

    // 更新私密提示 Tooltip
    const tooltipIcon = document.getElementById('privateTooltip');
    if (tooltipIcon) {
        const newTitle = t('private_tip');
        tooltipIcon.setAttribute('title', newTitle);
        tooltipIcon.setAttribute('data-bs-original-title', newTitle);
        const existingTooltip = bootstrap.Tooltip.getInstance(tooltipIcon);
        if (existingTooltip) {
            existingTooltip.setContent({ '.tooltip-inner': newTitle });
        } else {
            new bootstrap.Tooltip(tooltipIcon);
        }
    }

    // 更新搜索引擎下拉菜单的文字（如果函数存在）
    if (typeof window.renderEngineDropdown === 'function') {
        window.renderEngineDropdown();
    }

    // 更新图标选择器的文字（新增分类弹窗）
    updateIconSelectorText();

    // ===== 添加强制更新 =====
    // 强制更新新增分类弹窗中的"请选择图标"
    const selectIconText = document.getElementById('newCatSelectedIconText');
    if (selectIconText && selectIconText.getAttribute('data-i18n') === 'select_icon') {
        selectIconText.innerText = t('select_icon');
    }

    // 强制更新编辑分类弹窗中的"请选择图标"
    const editSelectIconText = document.getElementById('editCatSelectedIconText');
    if (editSelectIconText && editSelectIconText.getAttribute('data-i18n') === 'select_icon') {
        editSelectIconText.innerText = t('select_icon');
    }

    // 更新 SEO 标签
    updateSEOMeta();
}

function updateSEOMeta() {
    // 更新 description
    let descEl = document.querySelector('meta[name="description"]');
    if (descEl) {
        descEl.setAttribute('content', t('seo_description'));
    }

    // 更新 keywords
    let keywordsEl = document.querySelector('meta[name="keywords"]');
    if (keywordsEl) {
        keywordsEl.setAttribute('content', t('seo_keywords'));
    }

    // 更新 Open Graph 标题
    let ogTitleEl = document.querySelector('meta[property="og:title"]');
    if (ogTitleEl) {
        ogTitleEl.setAttribute('content', t('og_title'));
    }

    // 更新 Open Graph 描述
    let ogDescEl = document.querySelector('meta[property="og:description"]');
    if (ogDescEl) {
        ogDescEl.setAttribute('content', t('og_description'));
    }

    // 更新 Twitter Card 标题
    let twitterTitleEl = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitleEl) {
        twitterTitleEl.setAttribute('content', t('og_title'));
    }

    // 更新 Twitter Card 描述
    let twitterDescEl = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescEl) {
        twitterDescEl.setAttribute('content', t('og_description'));
    }
}

// 页面加载完成后自动应用翻译
document.addEventListener('DOMContentLoaded', () => {
    updatePageText();
});