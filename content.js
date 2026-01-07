(function () {
    'use strict';

    let isEnabled = true;
    let autoNextEnabled = false;
    let playbackSpeed = 1;

    function applyOverrides() {
        if (!isEnabled) return;

        // Override visibility state to always be 'visible'
        Object.defineProperty(document, 'visibilityState', {
            get: function () {
                return isEnabled ? 'visible' : originalVisibilityState;
            },
            configurable: true
        });

        // Override hidden property to always be false
        Object.defineProperty(document, 'hidden', {
            get: function () {
                return isEnabled ? false : originalHidden;
            },
            configurable: true
        });

        document.hasFocus = function () {
            return isEnabled ? true : originalHasFocus();
        };

        console.log('[Coursera Auto Play] Overrides applied.');
    }

    // Capture originals
    const originalVisibilityState = document.visibilityState;
    const originalHidden = document.hidden;
    const originalHasFocus = document.hasFocus;

    // Block events with capture to be first
    const handleEvent = (e) => {
        if (isEnabled) {
            e.stopImmediatePropagation();
        }
    };

    window.addEventListener('visibilitychange', handleEvent, true);
    window.addEventListener('blur', handleEvent, true);

    // --- New Features Logic ---

    function applySpeed() {
        if (!isEnabled) return;
        const videos = document.querySelectorAll('video');
        videos.forEach(v => {
            if (v.playbackRate !== parseFloat(playbackSpeed)) {
                v.playbackRate = parseFloat(playbackSpeed);
                console.log(`[Coursera Auto Play] Speed locked to ${playbackSpeed}x`);
            }
        });
    }

    function triggerNext() {
        if (!isEnabled || !autoNextEnabled) return;

        // Common Coursera "Next" button selectors
        // 1. Primary "Next" button in the footer
        // 2. Buttons with aria-label or text containing "Next"
        const nextSelectors = [
            'button[data-testid="next-item"]',
            'button[aria-label*="Next"]',
            '.rc-NextItemButton',
            'button.next-item'
        ];

        let nextButton = null;
        for (const selector of nextSelectors) {
            nextButton = document.querySelector(selector);
            if (nextButton) break;
        }

        // Fallback: search for button with "Next" text
        if (!nextButton) {
            const buttons = Array.from(document.querySelectorAll('button, a.rc-NavigationLink'));
            nextButton = buttons.find(b => b.textContent.trim().toLowerCase() === 'next');
        }

        if (nextButton) {
            console.log('[Coursera Auto Play] Video ended. Navigating to next item...');
            // Wait 2 seconds before clicking to avoid issues with Coursera's own state updates
            setTimeout(() => {
                nextButton.click();
            }, 2000);
        } else {
            console.warn('[Coursera Auto Play] Could not find "Next" button.');
        }
    }

    // Monitor for video elements and events
    const observer = new MutationObserver((mutations) => {
        if (!isEnabled) return;

        let hasNewVideos = false;
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeName === 'VIDEO') {
                    hasNewVideos = true;
                } else if (node.querySelectorAll) {
                    if (node.querySelectorAll('video').length > 0) {
                        hasNewVideos = true;
                    }
                }
            });
        });

        if (hasNewVideos) {
            applySpeed();
            setupVideoListeners();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    function setupVideoListeners() {
        const videos = document.querySelectorAll('video');
        videos.forEach(v => {
            if (!v.dataset.capListenersAttached) {
                v.addEventListener('ended', triggerNext);
                v.addEventListener('play', applySpeed);
                v.dataset.capListenersAttached = 'true';
            }
        });
    }

    // Initial load from storage
    chrome.storage.local.get(['overrideEnabled', 'autoNextEnabled', 'playbackSpeed'], (result) => {
        isEnabled = result.overrideEnabled !== false;
        autoNextEnabled = !!result.autoNextEnabled;
        playbackSpeed = result.playbackSpeed || 1;

        applyOverrides();
        applySpeed();
        setupVideoListeners();

        console.log('[Coursera Auto Play] Initial state:', { isEnabled, autoNextEnabled, playbackSpeed });
    });

    // Listen for changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.overrideEnabled) {
                isEnabled = changes.overrideEnabled.newValue;
                if (!isEnabled) location.reload();
                else applyOverrides();
            }
            if (changes.autoNextEnabled) {
                autoNextEnabled = changes.autoNextEnabled.newValue;
            }
            if (changes.playbackSpeed) {
                playbackSpeed = changes.playbackSpeed.newValue;
                applySpeed();
            }
            console.log('[Coursera Auto Play] Settings updated:', { isEnabled, autoNextEnabled, playbackSpeed });
        }
    });

    // Ensure requestAnimationFrame continues to run correctly
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = function (callback) {
        return originalRaf(function (timestamp) {
            try {
                callback(timestamp);
            } catch (e) {
                console.error('requestAnimationFrame callback error:', e);
            }
        });
    };

})();
