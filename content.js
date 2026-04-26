// Cross-browser compatibility shim
// In content scripts, `browser` is available in Firefox and `chrome` in Chrome/Edge.
const api = typeof browser !== "undefined" ? browser : chrome;

const CURRENT_HOST = window.location.hostname;

// Determine which site we are on and run the correct script safely
if (CURRENT_HOST.includes("fastdl.app") || CURRENT_HOST.includes("sssinstagram.com")) {
    runDownloaderScript();
} else {
    runInstagramScript();
}

// ========================================================================= //
//                         DOWNLOADER AUTOMATION LOGIC                       //
// ========================================================================= //
function runDownloaderScript() {
    const urlParams = new URLSearchParams(window.location.search);
    const autoUrl = urlParams.get('url');

    if (autoUrl) {
        console.log("Insta Auto-Scroller: Automating download for", autoUrl);
        
        let attempts = 0;
        let phase = 1; // Phase 1: Submit URL, Phase 2: Click Final Download
        
        const autoRunner = setInterval(() => {
            attempts++;
            
            if (phase === 1) {
                const inputField = document.querySelector('input[name="url"], input[id="url"], input[type="url"], input[placeholder*="instagram"]');
                const submitBtn = document.querySelector('button[type="submit"], form button, .search-box button');

                if (inputField && submitBtn) {
                    // Type the URL into the box
                    inputField.value = autoUrl;
                    inputField.dispatchEvent(new Event('input', { bubbles: true }));
                    inputField.dispatchEvent(new Event('change', { bubbles: true }));

                    // Click Submit
                    setTimeout(() => submitBtn.click(), 300);
                    
                    phase = 2; 
                    attempts = 0; 
                }
            } 
            else if (phase === 2) {
                // Wait for the result to render and hunt for the actual MP4 download anchor link
                const allLinks = document.querySelectorAll('a[href]');
                let finalBtn = Array.from(allLinks).find(a => {
                    const text = a.textContent.toLowerCase().trim();
                    return (text === 'download' || text === 'download .mp4' || text === 'download video') 
                            && a.href.length > 50 
                            && !a.href.includes('?url=');
                });

                if (finalBtn) {
                    console.log("Insta Auto-Scroller: Found final download link, clicking it!");
                    clearInterval(autoRunner);
                    finalBtn.click(); // Triggers the browser's save dialog!
                }
            }

            // Stop trying after 20 seconds (40 loops)
            if (attempts > 40) {
                console.log("Insta Auto-Scroller: Timed out waiting for element.");
                clearInterval(autoRunner); 
            }
        }, 500);
    }
}

// ========================================================================= //
//                             INSTAGRAM LOGIC                               //
// ========================================================================= //
function runInstagramScript() {
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

    // One-time redirect on real page load only — NOT inside any observer.
    // Because this runs only once at script startup, clicking Home later
    // will never trigger it again. The next fresh tab open will redirect again.
    api.storage.sync.get(["autoRedirect"], (result) => {
      if (result.autoRedirect && window.location.pathname === "/") {
        window.location.replace("https://www.instagram.com/reels/");
      }
    });

    function checkURLAndManageApp() {
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
        let showDownloadBtn = true;
        let showProgressBar = true;

        function getStoredSettings() {
          api.storage.sync.get(["autoReelsStart", "autoComments", "autoUnmute", "showDownload", "showProgressBar"], (result) => {
            autoReelsStart = result.autoReelsStart;
            autoComments = result.autoComments;
            autoUnmute = result.autoUnmute;
            showDownloadBtn = result.showDownload !== undefined ? result.showDownload : true;
            showProgressBar = result.showProgressBar !== undefined ? result.showProgressBar : true;
            
            if (autoReelsStart) startAutoScrolling();
            if (autoUnmute) {
              autoUnmuteAction().catch((error) => console.log(error));
            }
          });
        }

        getStoredSettings();

        api.storage.onChanged.addListener((changes, areaName) => {
          if (areaName === "sync") {
            if (changes.autoReelsStart) autoReelsStart = changes.autoReelsStart.newValue;
            if (changes.autoComments) autoComments = changes.autoComments.newValue;
            if (changes.autoUnmute) autoUnmute = changes.autoUnmute.newValue;
            if (changes.showDownload) showDownloadBtn = changes.showDownload.newValue;
            if (changes.showProgressBar) showProgressBar = changes.showProgressBar.newValue;
          }
        });

        api.runtime.onMessage.addListener((data, sender, sendResponse) => {
          if (data.event === "toggleAutoReels") {
            if (data.action === "start") {
              api.storage.sync.set({ autoReelsStart: true });
              autoReelsStart = true;
              startAutoScrolling();
            } else if (data.action === "stop") {
              api.storage.sync.set({ autoReelsStart: false });
              autoReelsStart = false;
              stopAutoScrolling();
            }
          }
        });

        // ----------- Auto Scrolling ----------- //

        function startAutoScrolling() {
          if (!applicationIsOn) {
            applicationIsOn = true;
            api.storage.sync.set({ applicationIsOn: true });
          }
          setTimeout(() => {
            if (autoReelsStart) beginAutoScrollLoop();
          }, 500);
        }

        function stopAutoScrolling() {
          if (applicationIsOn) {
            applicationIsOn = false;
            api.storage.sync.set({ applicationIsOn: false });
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

        // DOM INJECTOR
        function injectDownloadButtons() {
            if (!appIsRunning) return;
            
            if (!showDownloadBtn) {
                document.querySelectorAll('.custom-dl-btn').forEach(btn => btn.remove());
                document.querySelectorAll('main video').forEach(v => v.dataset.hasDownloadBtn = "");
                return;
            }

            const videos = document.querySelectorAll("main video");
            videos.forEach(video => {
                if (video.dataset.hasDownloadBtn) return;
                
                const wrapper = video.parentElement;
                if (wrapper) {
                    const dlBtn = document.createElement("div");
                    dlBtn.className = "custom-dl-btn";
                    
                    const originalIcon = `
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    `;
                    
                    dlBtn.innerHTML = originalIcon;
                    
                    Object.assign(dlBtn.style, {
                        position: "absolute",
                        bottom: "65px",
                        right: "12px",
                        width: "32px",
                        height: "32px",
                        zIndex: "999",
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        color: "white",
                        borderRadius: "50%",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                        transition: "transform 0.2s ease, background-color 0.2s ease"
                    });

                    dlBtn.onmouseenter = () => {
                        dlBtn.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
                        dlBtn.style.transform = "scale(1.1)";
                    };
                    dlBtn.onmouseleave = () => {
                        dlBtn.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
                        dlBtn.style.transform = "scale(1)";
                    };

                    dlBtn.onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        let reelUrl = window.location.href;
                        
                        const copyToClipboard = async (text) => {
                            try { await navigator.clipboard.writeText(text); return true; } 
                            catch (err) {
                                const textArea = document.createElement("textarea");
                                textArea.value = text;
                                document.body.appendChild(textArea);
                                textArea.select();
                                try { document.execCommand('copy'); document.body.removeChild(textArea); return true; } 
                                catch (e) { document.body.removeChild(textArea); return false; }
                            }
                        };

                        const copied = await copyToClipboard(reelUrl);

                        if (copied) {
                            dlBtn.innerHTML = `
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>`;
                            setTimeout(() => { dlBtn.innerHTML = originalIcon; }, 2000);

                            const toast = document.createElement('div');
                            toast.textContent = "Reel URL Copied!";
                            Object.assign(toast.style, {
                                position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)",
                                backgroundColor: "#4ade80", color: "#000", padding: "10px 20px", borderRadius: "20px",
                                fontWeight: "bold", fontFamily: "sans-serif", fontSize: "14px", zIndex: "99999",
                                opacity: "0", transition: "opacity 0.3s ease", boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                            });
                            document.body.appendChild(toast);
                            setTimeout(() => toast.style.opacity = "1", 10);
                            setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 300); }, 2500);
                        }
                        
                        window.open("https://fastdl.app/?url=" + encodeURIComponent(reelUrl), "_blank");
                    };
                    
                    wrapper.appendChild(dlBtn);
                    video.dataset.hasDownloadBtn = "true";
                }
            });
        }

        function openCommentsForVideo(video) {
          findComment = setTimeout(() => {
            if (!appIsRunning) return;

            const commentButton = Array.from(
              document.querySelectorAll(COMMENT_BUTTON_SELECTOR)
            ).find((button) => {
              const rect = button.getBoundingClientRect();
              return (rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth);
            });

            if (commentButton) commentButton.closest('div[role="button"]').click();
          }, 1000); 
        }

        function checkAndObserveNewVideos() {
          const videos = document.querySelectorAll("main video");
          videos.forEach((video) => { if (!video.dataset.processed) observeVideo(video); });
        }

        // ----------- Video Progress Bar ----------- //

        function injectProgressBar(video) {
            if (video.dataset.hasBar) return;
            video.dataset.hasBar = "1";

            const bar = document.createElement("div");
            bar.className = "ig-progressbar";

            const fill = document.createElement("div");
            fill.className = "ig-progressbar-fill";

            const handle = document.createElement("div");
            handle.className = "ig-progressbar-handle";

            fill.appendChild(handle);
            bar.appendChild(fill);

            const wrapper = video.parentElement;
            if (!wrapper) return;
            wrapper.style.position = "relative";
            wrapper.appendChild(bar);

            let isDragging = false;

            function updateBar() {
                if (!isDragging && video.duration > 0) {
                    const percent = video.currentTime / video.duration;
                    fill.style.width = (percent * 100) + "%";
                    handle.style.left = (percent * bar.clientWidth) + "px";
                }
                requestAnimationFrame(updateBar);
            }
            updateBar();

            function setScrubPosition(clientX) {
                const rect = bar.getBoundingClientRect();
                let percent = (clientX - rect.left) / rect.width;
                percent = Math.min(Math.max(percent, 0), 1);
                fill.style.width = (percent * 100) + "%";
                handle.style.left = (percent * rect.width) + "px";
                video.currentTime = percent * video.duration;
            }

            bar.addEventListener("mousedown", (e) => {
                isDragging = true;
                setScrubPosition(e.clientX);
            });

            handle.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                isDragging = true;
            });

            document.addEventListener("mousemove", (e) => {
                if (isDragging) setScrubPosition(e.clientX);
            });

            document.addEventListener("mouseup", () => {
                isDragging = false;
            });
        }

        function injectProgressBars() {
            if (!appIsRunning) return;
            if (!showProgressBar) {
                document.querySelectorAll("main video").forEach(v => {
                    if (v.dataset.hasBar) {
                        const bar = v.parentElement && v.parentElement.querySelector(".ig-progressbar");
                        if (bar) bar.remove();
                        delete v.dataset.hasBar;
                    }
                });
                return;
            }
            document.querySelectorAll("main video").forEach(v => injectProgressBar(v));
        }

        setInterval(() => {
            checkAndObserveNewVideos();
            injectDownloadButtons();
            injectProgressBars();
        }, 500);

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
}