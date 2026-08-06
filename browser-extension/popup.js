document.addEventListener('DOMContentLoaded', async () => {
  const searchInput = document.getElementById('searchInput');
  const resultList = document.getElementById('resultList');
  const empty = document.getElementById('empty');
  const loading = document.getElementById('loading');
  const openFullPage = document.getElementById('openFullPage');
  const settingsBtn = document.getElementById('settingsBtn');

  // 自动聚焦到搜索框
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
  }

  // 读取后端地址
  const { apiBase } = await chrome.storage.local.get('apiBase');
  const base = apiBase || 'http://localhost:5000';

  // 搜索
  searchInput.addEventListener('input', async () => {
    const keyword = searchInput.value.trim();
    if (!keyword) {
      resultList.innerHTML = '';
      empty.style.display = 'none';
      loading.style.display = 'none';
      return;
    }
    loading.style.display = 'block';
    empty.style.display = 'none';
    try {
      const res = await fetch(`${base}/api/search?keyword=${encodeURIComponent(keyword)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const bookmarks = data.bookmarks || [];
        if (bookmarks.length === 0) {
          resultList.innerHTML = '';
          empty.style.display = 'block';
        } else {
          resultList.innerHTML = bookmarks.map(b => `
            <li data-url="${b.url}">
              <span class="title">${b.title}</span>
              <span class="url">${b.url}</span>
            </li>
          `).join('');
          resultList.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', () => {
              chrome.tabs.create({ url: li.dataset.url });
            });
          });
          empty.style.display = 'none';
        }
      } else {
        resultList.innerHTML = '';
        empty.style.display = 'block';
        empty.textContent = '搜索失败，请检查登录';
      }
    } catch (err) {
      console.error(err);
      resultList.innerHTML = '';
      empty.style.display = 'block';
      empty.textContent = '网络错误';
    } finally {
      loading.style.display = 'none';
    }
  });

  openFullPage.addEventListener('click', () => {
    chrome.tabs.create({ url: base });
  });

  settingsBtn.addEventListener('click', () => {
    const newBase = prompt('请输入我的书签的网页地址', base);
    if (newBase) {
      chrome.storage.local.set({ apiBase: newBase });
      location.reload();
    }
  });
});