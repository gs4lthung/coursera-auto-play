(function () {
    'use strict';

    let isEnabled = true;
    let autoNextEnabled = false;
    let playbackSpeed = 1;
    let quizSkipEnabled = false;
    let smartSkipEnabled = false;
    let skipDuration = 10;

    // --- Bridge Injection (API Overrides in MAIN world) ---
    function injectBridge() {
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                const originalVisibilityState = document.visibilityState;
                const originalHidden = document.hidden;
                const originalHasFocus = document.hasFocus;

                function getEnabled() {
                    return document.documentElement.getAttribute('cap-enabled') === 'true';
                }

                Object.defineProperty(document, 'visibilityState', {
                    get: () => getEnabled() ? 'visible' : originalVisibilityState,
                    configurable: true
                });

                Object.defineProperty(document, 'hidden', {
                    get: () => getEnabled() ? false : originalHidden,
                    configurable: true
                });

                document.hasFocus = function() {
                    return getEnabled() ? true : originalHasFocus.call(document);
                };

                // Block events in capture phase
                const handleEvent = (e) => {
                    if (getEnabled()) e.stopImmediatePropagation();
                };
                window.addEventListener('visibilitychange', handleEvent, true);
                window.addEventListener('blur', handleEvent, true);

                console.log('[Coursera Auto Play] API Bridge Injected.');
            })();
        `;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    }

    function syncBridgeState() {
        document.documentElement.setAttribute('cap-enabled', isEnabled.toString());
    }

    // --- Core Features Logic ---

    function applySpeed() {
        if (!isEnabled) return;
        const videos = document.querySelectorAll('video');
        const speed = parseFloat(playbackSpeed);
        videos.forEach(v => {
            if (v.playbackRate !== speed) {
                v.playbackRate = speed;
                console.log(`[Coursera Auto Play] Speed locked to ${speed}x`);
            }
        });
    }

    function triggerNext() {
        if (!isEnabled || !autoNextEnabled) return;

        const nextSelectors = [
            'button[data-testid="next-item"]',
            'button[aria-label*="Next"]',
            '.rc-NextItemButton',
            'button.next-item',
            '[class*="next-item"] button',
            '[class*="NavigationLink"]'
        ];

        let nextButton = null;
        for (const selector of nextSelectors) {
            nextButton = document.querySelector(selector);
            if (nextButton) break;
        }

        if (!nextButton) {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            nextButton = buttons.find(b => {
                const text = b.textContent.trim().toLowerCase();
                return text === 'next' || text === 'tiếp theo' || text === 'bài tiếp theo';
            });
        }

        if (nextButton) {
            console.log('[Coursera Auto Play] Video ended. Navigating to next item...');
            setTimeout(() => nextButton.click(), 2000);
        }
    }

    // --- Ultimate Features Logic ---

    function checkAndSkipQuizzes() {
        if (!isEnabled || !quizSkipEnabled) return;
        const selectors = [
            'button.rc-QuizQuestionContinueButton',
            'button.rc-VideoInVideoQuizContinueButton',
            'button[aria-label*="Continue"]',
            'button[aria-label*="Tiếp tục"]',
            '.rc-FormNotification-button',
            '[class*="quiz"] button',
            '[class*="Continue"]'
        ];
        selectors.forEach(s => {
            const btn = document.querySelector(s);
            if (btn && btn.offsetParent !== null) {
                console.log('[Coursera Auto Play] Quiz detected. Auto-skipping...');
                btn.click();
            }
        });
    }

    function checkAndSmartSkip(v) {
        if (!isEnabled || !smartSkipEnabled || v.dataset.capSmartSkipped) return;
        const skipTime = parseFloat(skipDuration);
        if (v.currentTime < skipTime) {
            console.log(`[Coursera Auto Play] Skipping ${skipTime}s intro...`);
            v.currentTime = skipTime;
            v.dataset.capSmartSkipped = 'true';
        }
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (!isEnabled) return;
        const active = document.activeElement;
        if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable) return;

        const key = e.key.toLowerCase();
        const video = document.querySelector('video');

        if (key === 'n') {
            triggerNext();
        } else if (key === 'p' && video) {
            video.paused ? video.play() : video.pause();
        } else if (key === 's') {
            const currentSpeed = parseFloat(playbackSpeed);
            const nextSpeed = currentSpeed >= 2 ? 1 : currentSpeed + 0.25;
            chrome.storage.local.set({ playbackSpeed: nextSpeed.toString() });
        }
    });

    // Monitor for changes
    const observer = new MutationObserver((mutations) => {
        if (!isEnabled) return;
        let hasNewVideos = false;
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeName === 'VIDEO' || (node.querySelectorAll && node.querySelectorAll('video').length > 0)) {
                    hasNewVideos = true;
                }
                checkAndSkipQuizzes();
            });
        });
        if (hasNewVideos) {
            applySpeed();
            setupVideoListeners();
        }
    });

    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    setInterval(checkAndSkipQuizzes, 2000);

    function setupVideoListeners() {
        document.querySelectorAll('video').forEach(v => {
            if (!v.dataset.capListenersAttached) {
                v.addEventListener('ended', triggerNext);
                v.addEventListener('play', () => {
                    applySpeed();
                    checkAndSmartSkip(v);
                });
                v.addEventListener('timeupdate', () => checkAndSmartSkip(v));
                // Anti-reset lock
                v.addEventListener('ratechange', () => applySpeed());
                v.dataset.capListenersAttached = 'true';
            }
        });
    }

    // Load from storage
    function loadSettings() {
        chrome.storage.local.get([
            'overrideEnabled',
            'autoNextEnabled',
            'playbackSpeed',
            'quizSkipEnabled',
            'smartSkipEnabled',
            'skipDuration'
        ], (result) => {
            isEnabled = result.overrideEnabled !== false;
            autoNextEnabled = !!result.autoNextEnabled;
            playbackSpeed = result.playbackSpeed || 1;
            quizSkipEnabled = !!result.quizSkipEnabled;
            smartSkipEnabled = !!result.smartSkipEnabled;
            skipDuration = result.skipDuration || 10;

            syncBridgeState();
            applySpeed();
            setupVideoListeners();

            console.log('[Coursera Auto Play] Settings loaded:', { isEnabled });
        });
    }

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, ns) => {
        if (ns === 'local') {
            if (changes.overrideEnabled) {
                isEnabled = changes.overrideEnabled.newValue;
                syncBridgeState();
                if (!isEnabled) location.reload();
            }
            if (changes.autoNextEnabled) autoNextEnabled = changes.autoNextEnabled.newValue;
            if (changes.playbackSpeed) {
                playbackSpeed = changes.playbackSpeed.newValue;
                applySpeed();
            }
            if (changes.quizSkipEnabled) quizSkipEnabled = changes.quizSkipEnabled.newValue;
            if (changes.smartSkipEnabled) smartSkipEnabled = changes.smartSkipEnabled.newValue;
            if (changes.skipDuration) skipDuration = changes.skipDuration.newValue;
        }
    });

    // Run
    injectBridge();
    loadSettings();

})();
