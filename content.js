// ----------- State Variables ----------- //
let isOnReels = false;
let appIsRunning = false; 
let findComment; 
let newVideoObserver; 
let instagramObserver; 

function stopApp() {
  if (appIsRunning) {
    appIsRunning = false;
    if (newVideoObserver) {
      newVideoObserver.disconnect();
    }
    if (findComment) {
      clearTimeout(findComment);
    }
  }
}

function checkURLAndManageApp() {
  // First, check if the Auto Redirect feature is enabled and we are on the home page (/)
  chrome.storage.sync.get(["autoRedirect"], (result) => {
    if (result.autoRedirect && window.location.pathname === "/") {
      // User is on the home feed and has redirect turned ON. 
      // Replace current state with Reels to prevent getting stuck in a back-button loop.
      window.location.replace("https://www.instagram.com/reels/");
      return; 
    }

    // If no redirect happened, proceed with normal extension logic
    const isOnInstagram = window.location.href.startsWith("https://www.instagram.com/");
    const isOnReelsPage = window.location.href.startsWith("https://www.instagram.com/reels/");

    if (isOnInstagram && isOnReelsPage && !isOnReels) {
      isOnReels = true;
      initializeExtension(); 
    } else if ((isOnInstagram && !isOnReelsPage) || !isOnInstagram) {
      if (isOnReels) {
        isOnReels = false;
        stopApp(); 
      }
    }
  });
}

let lastUrl = window.location.href;
instagramObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    checkURLAndManageApp(); 
  }
});

instagramObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

(function (history) {
  const pushState = history.pushState;
  const replaceState = history.replaceState;

  history.pushState = function () {
    pushState.apply(history, arguments);
    checkURLAndManageApp(); 
  };

  history.replaceState = function () {
    replaceState.apply(history, arguments);
    checkURLAndManageApp(); 
  };
})(window.history);

window.addEventListener("popstate", checkURLAndManageApp);
checkURLAndManageApp();

// ----------- App-Specific Logic ----------- //

function initializeExtension() {
  if (!appIsRunning) {
    appIsRunning = true;

    const VIDEOS_LIST_SELECTOR = "main video";
    const COMMENT_BUTTON_SELECTOR = "main svg[aria-label='Comment']";

    let applicationIsOn = true;
    let autoReelsStart;
    let autoComments;
    let autoUnmute;

    function getStoredAutoReelsStart() {
      chrome.storage.sync.get(["autoReelsStart"], (result) => {
        autoReelsStart = result.autoReelsStart;
        if (autoReelsStart) startAutoScrolling();
      });
    }

    function getStoredAutoComments() {
      chrome.storage.sync.get(["autoComments"], (result) => {
        autoComments = result.autoComments;
      });
    }

    function getStoredAutoUnmute() {
      chrome.storage.sync.get(["autoUnmute"], (result) => {
        autoUnmute = result.autoUnmute;
        if (autoUnmute) {
          autoUnmuteAction().catch((error) => console.log(error));
        }
      });
    }

    getStoredAutoReelsStart();
    getStoredAutoComments();
    getStoredAutoUnmute();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "sync") {
        if (changes.autoReelsStart) autoReelsStart = changes.autoReelsStart.newValue;
        if (changes.autoComments) autoComments = changes.autoComments.newValue;
        if (changes.autoUnmute) autoUnmute = changes.autoUnmute.newValue;
      }
    });

    chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
      if (data.event === "toggleAutoReels") {
        if (data.action === "start") {
          chrome.storage.sync.set({ autoReelsStart: true });
          getStoredAutoReelsStart();
          startAutoScrolling();
        } else if (data.action === "stop") {
          chrome.storage.sync.set({ autoReelsStart: false });
          getStoredAutoReelsStart();
          stopAutoScrolling();
        }
      }
    });

    function startAutoScrolling() {
      if (!applicationIsOn) {
        applicationIsOn = true;
        chrome.storage.sync.set({ applicationIsOn: true });
      }
      setTimeout(() => {
        if (autoReelsStart) beginAutoScrollLoop();
      }, 500);
    }

    function stopAutoScrolling() {
      if (applicationIsOn) {
        applicationIsOn = false;
        chrome.storage.sync.set({ applicationIsOn: false });
        getStoredAutoReelsStart();
      }
    }

    function beginAutoScrollLoop() {
      setInterval(() => {
        if (applicationIsOn) {
          const currentVideo = getCurrentVideo();
          if (currentVideo) {
            currentVideo.removeAttribute("loop");
            currentVideo.addEventListener("ended", onVideoEnd);
          }
        }
      }, 100); 
    }

    function onVideoEnd() {
      const currentVideo = getCurrentVideo();
      if (!currentVideo) return;

      const nextVideoInfo = getNextVideo(currentVideo);
      const nextVideo = nextVideoInfo[0];
      const nextVideoIndex = nextVideoInfo[1];

      if (nextVideo && autoReelsStart) {
        scrollToNextVideo(nextVideo, nextVideoIndex);
      }
    }

    function getNextVideo(currentVideo) {
      const videos = Array.from(document.querySelectorAll(VIDEOS_LIST_SELECTOR));
      const index = videos.findIndex((vid) => vid === currentVideo);
      return [videos[index + 1] || null, index + 1]; 
    }

    function scrollToNextVideo(nextVideo, nextVideoIndex) {
      if (nextVideo) {
        nextVideo.scrollIntoView({ behavior: "smooth", inline: "center", block: "center" });
      }
    }

    function getCurrentVideo() {
      return Array.from(document.querySelectorAll(VIDEOS_LIST_SELECTOR)).find(
        (video) => {
          const rect = video.getBoundingClientRect();
          return (rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth);
        }
      );
    }

    newVideoObserver = new IntersectionObserver(
      (entries, newVideoObserver) => {
        entries.forEach((entry) => {
          if (!appIsRunning) return;

          if (entry.isIntersecting && !entry.target.dataset.processed) {
            if (autoComments) openCommentsForVideo(entry.target);
            entry.target.dataset.processed = "true";
          } else if (!entry.isIntersecting) {
            entry.target.dataset.processed = "";
          }
        });
      },
      { threshold: 0.5 }
    );

    function observeVideo(video) {
      video.dataset.processed = "";
      newVideoObserver.observe(video);
    }

    function observeAllVideos() {
      const videos = document.querySelectorAll("main video");
      videos.forEach((video) => observeVideo(video));
    }

    observeAllVideos();

    function openCommentsForVideo(video) {
      findComment = setTimeout(() => {
        if (!appIsRunning) return;

        const commentButton = Array.from(
          document.querySelectorAll(COMMENT_BUTTON_SELECTOR)
        ).find((button) => {
          const rect = button.getBoundingClientRect();
          return (rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth);
        });

        if (commentButton) {
          commentButton.closest('div[role="button"]').click();
        }
      }, 1000); 
    }

    function checkAndObserveNewVideos() {
      const videos = document.querySelectorAll("main video");
      videos.forEach((video) => {
        if (!video.dataset.processed) observeVideo(video);
      });
    }

    setInterval(checkAndObserveNewVideos, 500);

    function autoUnmuteAction() {
      return new Promise((resolve) => {
        const checkButton = () => {
          const audioButton = Array.from(
            document.querySelectorAll("svg[aria-label='Audio is muted']")
          ).find((button) => {
            const rect = button.getBoundingClientRect();
            return (rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth);
          });

          if (audioButton) {
            const button = audioButton.closest("div[role='button']");
            button.click();
            resolve(button);
            return;
          }
          setTimeout(checkButton, 500);
        };
        checkButton();
      });
    }
  }
}