// Cross-browser compatibility shim
const api = typeof browser !== "undefined" ? browser : chrome;

const showDownloadToggle = document.getElementById("showDownloadToggle");
const autoRedirectToggle = document.getElementById("autoRedirectToggle");
const autoUnmute = document.getElementById("autoUnmuteToggle");
const autoCommentsToggle = document.getElementById("autoCommentsToggle");
const autoReelsToggle = document.getElementById("autoReelsToggle");
const startButton = document.getElementById("startStopButton");
const progressBarToggle = document.getElementById("progressBarToggle");
const anonStoryToggle = document.getElementById("anonStoryToggle");
const startButtonText = startButton.querySelector("span");

api.storage.sync.get("showDownload", (result) => {
    showDownloadToggle.checked = result.showDownload !== undefined ? result.showDownload : true;
});

api.storage.sync.get("autoReelsStart", (result) => {
    const isAutoReels = result.autoReelsStart !== undefined ? result.autoReelsStart : true;
    autoReelsToggle.checked = isAutoReels;
    startButtonText.textContent = isAutoReels ? "Stop" : "Start";
    
    if (isAutoReels) {
        startButton.classList.add("running");
    } else {
        startButton.classList.remove("running");
    }
});

api.storage.sync.get("autoRedirect", (result) => {
    autoRedirectToggle.checked = result.autoRedirect !== undefined ? result.autoRedirect : false;
});

api.storage.sync.get("autoUnmute", (result) => {
    autoUnmute.checked = result.autoUnmute !== undefined ? result.autoUnmute : true;
});

api.storage.sync.get("autoComments", (result) => {
    autoCommentsToggle.checked = result.autoComments !== undefined ? result.autoComments : false;
});

api.storage.sync.get("showProgressBar", (result) => {
    progressBarToggle.checked = result.showProgressBar !== undefined ? result.showProgressBar : true;
});

api.storage.sync.get("anonStoryViewer", (result) => {
    anonStoryToggle.checked = result.anonStoryViewer !== undefined ? result.anonStoryViewer : false;
});

showDownloadToggle.onclick = () => {
    api.runtime.sendMessage({ event: "showDownload", showDownloadValue: showDownloadToggle.checked });
};

autoRedirectToggle.onclick = () => {
    api.runtime.sendMessage({ event: "autoRedirect", autoRedirectValue: autoRedirectToggle.checked });
};

autoUnmute.onclick = () => {
    api.runtime.sendMessage({ event: "autoMute", autoUnmuteValue: autoUnmute.checked });
};

autoCommentsToggle.onclick = () => {
    api.runtime.sendMessage({ event: "autoComments", autoCommentsValue: autoCommentsToggle.checked });
};

autoReelsToggle.onclick = () => {
    api.runtime.sendMessage({ event: "autoReelsStart", autoReelsValue: autoReelsToggle.checked });
};

progressBarToggle.onclick = () => {
    api.storage.sync.set({ showProgressBar: progressBarToggle.checked });
};

anonStoryToggle.onclick = () => {
    api.storage.sync.set({ anonStoryViewer: anonStoryToggle.checked }, () => {
        // Reload open Instagram tabs so the document_start script re-runs
        api.tabs.query({ url: "*://www.instagram.com/*" }, (tabs) => {
            (tabs || []).forEach(tab => {
                if (tab && typeof tab.id === "number") api.tabs.reload(tab.id);
            });
        });
    });
};

startButton.addEventListener("click", () => {
    const isStarting = startButtonText.textContent === "Start";
    
    startButtonText.textContent = isStarting ? "Stop" : "Start";
    
    if (isStarting) {
        startButton.classList.add("running");
    } else {
        startButton.classList.remove("running");
    }
    
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // Guard: tabs[0] may be undefined on some Firefox builds when activeTab
      // is not yet granted for the current tab (e.g. new tab page).
      if (!tabs || !tabs[0]) return;
      api.tabs.sendMessage(tabs[0].id, {
        event: "toggleAutoReels",
        action: isStarting ? "start" : "stop",
      });
    });
});
