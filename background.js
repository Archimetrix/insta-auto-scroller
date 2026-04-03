chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(["autoRedirect", "autoReelsStart", "applicationIsOn", "autoComments", "autoUnmute"], (result) => {
      if (result.autoRedirect === undefined) chrome.storage.sync.set({ autoRedirect: false });
      if (result.autoReelsStart === undefined) chrome.storage.sync.set({ autoReelsStart: true });
      if (result.applicationIsOn === undefined) chrome.storage.sync.set({ applicationIsOn: true });
      if (result.autoComments === undefined) chrome.storage.sync.set({ autoComments: false });
      if (result.autoUnmute === undefined) chrome.storage.sync.set({ autoUnmute: true });
    });
});

chrome.runtime.onMessage.addListener(data => {
  switch(data.event) {
    case "autoRedirect":
      chrome.storage.sync.set( {"autoRedirect" : data.autoRedirectValue} );
      break;
    case "autoMute":
      chrome.storage.sync.set( {"autoUnmute" : data.autoUnmuteValue} );
      break;
    case "autoComments":
      chrome.storage.sync.set( {"autoComments" : data.autoCommentsValue} );
      break;
    case "autoReelsStart":
      chrome.storage.sync.set( {"autoReelsStart" : data.autoReelsValue} );
      break;
  }
});