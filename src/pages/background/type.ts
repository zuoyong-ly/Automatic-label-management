export type HostNameMapType = {
  [key: string]: chrome.tabs.Tab[];
};

export type HostNameWindowMapType = {
  [key: string]: HostNameMapType;
};

export type WindowIdToTabIdToHostNameMapType = {
  [key: string]: {
    [key: string]: string;
  };
};
