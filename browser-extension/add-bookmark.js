document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('bookmarkForm');
  const statusDiv = document.getElementById('status');
  const errorDiv = document.getElementById('error');
  const cancelBtn = document.getElementById('cancelBtn');
  const categorySelect = document.getElementById('category');

  const params = new URLSearchParams(window.location.search);
  const url = params.get('url') || '';
  const title = params.get('title') || '';
  const tabId = params.get('tabId');

  document.getElementById('url').value = url;
  document.getElementById('title').value = title;

  // 获取后端地址
  const { apiBase } = await chrome.storage.local.get('apiBase');
  const base = apiBase || 'http://localhost:5000';

  // 加载分类列表
  try {
    const domain = new URL(base).hostname;
    const cookies = await chrome.cookies.getAll({ domain });
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const res = await fetch(`${base}/list`, {
      headers: { 'Cookie': cookieString }
    });
    if (res.ok) {
      const data = await res.json();
      const categories = Object.keys(data.categories || {});
      if (categories.length > 0) {
        categorySelect.innerHTML = '<option value="">选择分类</option>' +
          categories.map(c => `<option value="${c}">${c}</option>`).join('');
      } else {
        categorySelect.innerHTML = '<option value="">暂无分类</option>';
      }
    } else {
      categorySelect.innerHTML = '<option value="">未分类</option>';
    }
  } catch (e) {
    categorySelect.innerHTML = '<option value="">未分类</option>';
  }

  // 尝试抓取元数据（仅当为当前页面时）
  if (tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: parseInt(tabId) },
        func: () => {
          const meta = {
            description: '',
            keywords: '',
          };
          const desc = document.querySelector('meta[name="description"]');
          if (desc) meta.description = desc.getAttribute('content') || '';
          const kw = document.querySelector('meta[name="keywords"]');
          if (kw) meta.keywords = kw.getAttribute('content') || '';
          return meta;
        },
      });
      const meta = results[0].result;
      if (meta.description) document.getElementById('description').value = meta.description;
      if (meta.keywords) {
        const keywords = meta.keywords.split(/[，,、\s]+/).filter(k => k.trim()).slice(0, 10).join(',');
        document.getElementById('tags').value = keywords;
      }
    } catch (e) { /* 静默处理 */ }
  }

  // 提交表单
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const urlVal = document.getElementById('url').value.trim();
    if (!urlVal) {
      errorDiv.textContent = '请输入网址';
      errorDiv.style.display = 'block';
      return;
    }
    const titleVal = document.getElementById('title').value.trim() || urlVal;
    const description = document.getElementById('description').value.trim();
    const tagsRaw = document.getElementById('tags').value.trim();
    let tags = tagsRaw ? tagsRaw.split(/[，,、\s/]+/).filter(t => t.trim()).map(t => t.trim()) : [];
    tags = [...new Set(tags)]; // 去重

    let category = document.getElementById('category').value.trim();
    if (!category) category = '未分类';

    // 固定为私密
    const status = 'private';

    const domain = new URL(base).hostname;
    const cookies = await chrome.cookies.getAll({ domain });
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    try {
      const response = await fetch(`${base}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieString,
        },
        body: JSON.stringify({
          url: urlVal,
          title: titleVal,
          description,
          icon: '',
          tags,
          category,
          status,
        }),
      });
      if (response.ok) {
        statusDiv.textContent = '✅ 保存成功！';
        statusDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        setTimeout(() => window.close(), 1200);
      } else {
        const data = await response.json();
        errorDiv.textContent = data.message || '保存失败';
        errorDiv.style.display = 'block';
      }
    } catch (err) {
      errorDiv.textContent = '网络错误';
      errorDiv.style.display = 'block';
    }
  });

  cancelBtn.addEventListener('click', () => window.close());
});