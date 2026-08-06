// 创建右键菜单
chrome.contextMenus.create({
  id: 'add-to-bookmark',
  title: '添加到我的书签 (Ctrl+Shift+V)',
  contexts: ['page', 'link'],
});

// 监听快捷键命令
chrome.commands.onCommand.addListener((command) => {
  if (command === 'add-bookmark') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) openAddBookmarkWindow(tab);
    });
  } else if (command === 'open-search') {
    // 打开搜索弹窗（即 popup）
    chrome.action.openPopup();
  }
});

// 右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || tab.url;
  if (!url) return;
  openAddBookmarkWindow(tab, info);
});

// 新增书签弹窗打开函数
function openAddBookmarkWindow(tab, info = null) {
  const url = info?.linkUrl || tab.url;
  const title = info?.linkText || tab.title || '';
  chrome.windows.create({
    url: `add-bookmark.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&tabId=${tab.id}`,
    type: 'popup',
    width: 500,
    height: 600,
    left: 200,
    top: 200,
  });
}