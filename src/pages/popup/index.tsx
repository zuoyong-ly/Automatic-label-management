import React from 'react';
import { createRoot } from 'react-dom/client';
import '@pages/popup/index.css';
import Popup from '@pages/popup/Popup';
import refreshOnUpdate from 'virtual:reload-on-update-in-view';
// import chrome from 'webextension-polyfill'

refreshOnUpdate('pages/popup');

function init() {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  chrome.runtime.sendMessage('openOptionsPage');

  const root = createRoot(appContainer);
  root.render(<Popup />);
}

init();
