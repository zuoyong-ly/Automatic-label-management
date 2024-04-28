import reloadOnUpdate from 'virtual:reload-on-update-in-background-script';
import 'webextension-polyfill';
import { HostNameWindowMapType, WindowIdToTabIdToHostNameMapType } from './type';

reloadOnUpdate('pages/background');

/**
 * Extension reloading is necessary because the browser automatically caches the css.
 * If you do not use the css of the content script, please delete it.
 */
reloadOnUpdate('pages/content/style.scss');

const hostNameWindowMap: HostNameWindowMapType = {};
const windowIdToTabIdToHostNameMap: WindowIdToTabIdToHostNameMapType = {};

chrome.runtime.onMessage.addListener(async message => {
  if (message === 'openOptionsPage') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.windows.getAll((windows: chrome.windows.Window[]) => {
  windows.forEach(window => {
    chrome.tabs.query(
      {
        windowId: window.id,
      },
      tabs => {
        tabs.forEach(tab => {
          if (tab.pinned) {
            return;
          }
          addTabToHostNameMap(window.id, tab);
        });
        autoManageGroup(window.id);
      },
    );
    console.log(hostNameWindowMap);
  });
});

// 监听新标签页的创建
chrome.tabs.onCreated.addListener(function (tab) {
  addTabToHostNameMap(tab.windowId, tab);
  autoManageGroup(tab.windowId, tab);
});

// 监听标签页URL的改变
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.url) {
    addTabToHostNameMap(tab.windowId, tab, true);
    autoManageGroup(tab.windowId, tab);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // 如果没有 windowId 或者 windowId 对应的 hostNameWindowMap 不存在，直接返回
  if (!removeInfo.windowId || !hostNameWindowMap[removeInfo.windowId]) {
    return;
  }

  // 获取 windowId 对应的 tabId 到 hostName 的映射
  const tabIdByHostNameMap = windowIdToTabIdToHostNameMap[removeInfo.windowId];

  // 如果没有映射或者 tabId 对应的映射不存在，直接返回
  if (!tabIdByHostNameMap || !tabIdByHostNameMap[tabId]) {
    return;
  }

  // 获取 tabId 对应的 hostName
  const hostName = tabIdByHostNameMap[tabId];

  // 获取 windowId 对应的 hostName 到 tabs 数组的映射
  const hostNameMap = hostNameWindowMap[removeInfo.windowId];

  // 获取 hostName 对应的 tabs 数组
  const tabs = hostNameMap[hostName];

  // 如果 tabs 存在，过滤掉被移除的 tab
  if (tabs) {
    hostNameMap[hostName] = tabs.filter(tab => tab.id !== tabId);
  }
});

/**
 * 这个函数根据标签页的域名，自动管理标签页的群组。
 * 它遍历 `hostNameMap` 中的每个域名，检查第一个标签页是否已经有群组ID，如果没有，
 * 就在有超过3个标签页的情况下为该域名创建群组。创建群组后，更新群组标题为第一个标签页的标题。
 *
 * @param {number} windowId - 窗口的ID。
 * @param {HostNameMapType} hostNameMap - 域名到标签页数组的映射。
 */
async function autoManageGroup(windowId: number, changeTag?: chrome.tabs.Tab) {
  const hostNameMap = hostNameWindowMap[windowId];
  if (changeTag) {
    if (!changeTag.url) {
      return;
    }
  }
  const changeUrl = changeTag ? new URL(changeTag.url) : null;
  // 遍历 `hostNameMap` 中的每个域名
  Object.keys(hostNameMap).forEach(async hostName => {
    // 获取当前域名的标签页
    const tabs = hostNameMap[hostName];

    const options: chrome.tabs.GroupOptions = {
      // createProperties: {
      //   windowId, // 窗口的ID
      // },
      tabIds: tabs.map(tab => tab.id), // 标签页的ID
    };
    const oldGroupId = tabs.find(tab => tab.groupId > 0)?.groupId;
    if (oldGroupId > 0) {
      options.groupId = oldGroupId;
    }

    // 如果第一个标签页已经有了群组ID，就跳过创建群组
    if (oldGroupId > 0) {
      console.log('tabs groupId', options, hostName, changeUrl);
      if (changeUrl) {
        if (changeUrl.hostname != hostName) {
          return;
        }
      }
    }
    console.log('tabs', tabs, hostName);
    // 如果当前域名有超过3个标签页，就创建群组
    if (tabs.length >= 3) {
      console.log(tabs);
      // 使用标签页ID创建群组
      chrome.tabs.group(options, groupId => {
        if (!groupId) return;
        console.log(groupId);
        // 更新群组标题为第一个标签页的标题
        chrome.tabGroups.update(groupId, { title: tabs[0].title }, function () {
          // 记录群组标题已经更新
          console.log('已更新群组标题。');
        });
      });
    }
  });
}

/**
 * 这个函数将一个标签页添加到 hostNameMap 中，它是一个映射，将域名映射到包含标签页的数组。
 * 它接受一个窗口ID和要添加的标签页，并将标签页添加到 hostNameMap 中。如果 isChange
 * 参数为 true，它还会从之前的主机名的数组中删除标签页，并更新 tabIdByHostNameMap。
 *
 * @param {number} windowId - 窗口的ID。
 * @param {chrome.tabs.Tab} tab - 要添加的标签页。
 * @param {boolean} [isChange=false] - 一个标志，指示标签页的主机名是否已更改。
 */
function addTabToHostNameMap(windowId: number, tab: chrome.tabs.Tab, isChange: boolean = false) {
  if (!tab.url) return;
  // 如果 windowId 在 tabIdByHostNameMap 中不存在，创建一个空对象。
  if (!windowIdToTabIdToHostNameMap[windowId]) {
    windowIdToTabIdToHostNameMap[windowId] = {};
  }

  // 如果 isChange 参数为 true，从之前的主机名的数组中删除标签页，并更新 windowIdToTabIdToHostNameMap
  if (isChange) {
    const oldHostName = windowIdToTabIdToHostNameMap[windowId][tab.id];
    hostNameWindowMap[windowId][oldHostName] = (hostNameWindowMap[windowId][oldHostName] || []).filter(
      (t: chrome.tabs.Tab) => t.id !== tab.id,
    );
    delete windowIdToTabIdToHostNameMap[windowId][tab.id];
  }

  // 从标签页的URL创建一个URL对象。
  const url = new URL(tab.url);

  // 如果 windowId 在 hostNameWindowMap 中不存在，创建一个空对象。
  if (!hostNameWindowMap[windowId]) {
    hostNameWindowMap[windowId] = {};
  }

  // 从URL获取主机名，并将标签页添加到该主机名的数组中。如果主机名在 hostNameWindowMap[windowId] 中不存在，则创建一个空数组。
  // 使用扩展运算符将现有数组（如果存在）或空数组添加到数组中。
  hostNameWindowMap[windowId][url.hostname] = [...(hostNameWindowMap[windowId][url.hostname] || []), tab];
  windowIdToTabIdToHostNameMap[windowId][tab.id] = url.hostname;
}
