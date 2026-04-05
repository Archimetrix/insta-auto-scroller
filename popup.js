const showDownloadToggle = document.getElementById("showDownloadToggle");
const autoRedirectToggle = document.getElementById("autoRedirectToggle");
const autoUnmute = document.getElementById("autoUnmuteToggle");
const autoCommentsToggle = document.getElementById("autoCommentsToggle");
const autoReelsToggle = document.getElementById("autoReelsToggle");
const startButton = document.getElementById("startStopButton");
const startButtonText = startButton.querySelector("span");

chrome.storage.sync.get("showDownload", (result) => {
    showDownloadToggle.checked = result.showDownload !== undefined ? result.showDownload : true;
});

chrome.storage.sync.get("autoReelsStart", (result) => {
    const isAutoReels = result.autoReelsStart !== undefined ? result.autoReelsStart : true;
    autoReelsToggle.checked = isAutoReels;
    startButtonText.textContent = isAutoReels ? "Stop" : "Start";
    
    if (isAutoReels) {
        startButton.classList.add("running");
    } else {
        startButton.classList.remove("running");
    }
});

chrome.storage.sync.get("autoRedirect", (result) => {
    autoRedirectToggle.checked = result.autoRedirect !== undefined ? result.autoRedirect : false;
});

chrome.storage.sync.get("autoUnmute", (result) => {
    autoUnmute.checked = result.autoUnmute !== undefined ? result.autoUnmute : true;
});

chrome.storage.sync.get("autoComments", (result) => {
    autoCommentsToggle.checked = result.autoComments !== undefined ? result.autoComments : false;
});

showDownloadToggle.onclick = () => {
    chrome.runtime.sendMessage({ event: "showDownload", showDownloadValue: showDownloadToggle.checked });
};

autoRedirectToggle.onclick = () => {
    chrome.runtime.sendMessage({ event: "autoRedirect", autoRedirectValue: autoRedirectToggle.checked });
};

autoUnmute.onclick = () => {
    chrome.runtime.sendMessage({ event: "autoMute", autoUnmuteValue: autoUnmute.checked });
};

autoCommentsToggle.onclick = () => {
    chrome.runtime.sendMessage({ event: "autoComments", autoCommentsValue: autoCommentsToggle.checked });
};

autoReelsToggle.onclick = () => {
    chrome.runtime.sendMessage({ event: "autoReelsStart", autoReelsValue: autoReelsToggle.checked });
};

startButton.addEventListener("click", () => {
    const isStarting = startButtonText.textContent === "Start";
    
    startButtonText.textContent = isStarting ? "Stop" : "Start";
    
    if (isStarting) {
        startButton.classList.add("running");
    } else {
        startButton.classList.remove("running");
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        event: "toggleAutoReels",
        action: isStarting ? "start" : "stop",
      });
    });
});