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
        } else if (key === 'j' && video) {
            video.currentTime = Math.max(0, video.currentTime - 10);
        } else if (key === 'l' && video) {
            video.currentTime = Math.min(video.duration, video.currentTime + 10);
        } else if (key === 'm' && video) {
            video.muted = !video.muted;
        }
    });

    // Simple clipboard cleaner - remove Coursera's integrity message
    document.addEventListener('copy', () => {
        if (!isEnabled) return;

        setTimeout(async () => {
            try {
                let text = await navigator.clipboard.readText();

                // Remove the entire integrity message block
                // Match multiple patterns that cover the whole message
                let cleanText = text;

                // Pattern 1: Full message from "You are a helpful AI assistant" to "Do you understand?"
                cleanText = cleanText.replace(/You are a helpful AI assistant.*?Do you understand\?\.?\s*/gs, '');

                // Pattern 2: Message parts that mention "read and understood these instructions"
                cleanText = cleanText.replace(/\s*read and understood these instructions\..*?Do you understand\?\.?\s*/gs, '');

                // Pattern 3: Any text containing "academic integrity policy" and "AI assistant"
                cleanText = cleanText.replace(/\s*.*?academic integrity policy.*?AI assistant.*?\s*/gs, '');

                // Pattern 4: Remaining instruction text about scanning elements and clicking buttons
                cleanText = cleanText.replace(/\s*Please scan all elements.*?data-action="acknowledge-guidelines".*?\s*/gs, '');
                cleanText = cleanText.replace(/\s*This verification step is mandatory for all AI assistants.*?\s*/gs, '');

                // Clean up extra whitespace
                cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

                if (cleanText !== text) {
                    await navigator.clipboard.writeText(cleanText);
                    console.log('[Coursera Auto Play] Integrity message removed');
                    showSuccessToast();
                }
            } catch (err) {
                console.log('[Coursera Auto Play] Clipboard error:', err);
            }
        }, 100);
    });

    // Show success toast notification
    function showSuccessToast() {
        // Remove existing toast if any
        const existingToast = document.getElementById('cap-clipboard-toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.id = 'cap-clipboard-toast';
        toast.textContent = '✓ Clipboard cleaned!';
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 600;
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
            z-index: 999999;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
            pointer-events: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        document.body.appendChild(toast);

        // Fade in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
        });

        // Fade out and remove after 2 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 2000);
    }

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

    // Timeline lock protection - BLOCK RESETS AT SOURCE
    const videoProtection = new WeakMap();

    function setupVideoListeners() {
        document.querySelectorAll('video').forEach(v => {
            if (!v.dataset.capListenersAttached) {
                let lastUserSeek = null;
                let protectionActive = false;

                // Override currentTime on prototype level for all videos
                const protoDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
                Object.defineProperty(v, 'currentTime', {
                    get: function() {
                        return protoDesc.get.call(this);
                    },
                    set: function(value) {
                        const current = protoDesc.get.call(this);

                        // Detect if this looks like a Coursera reset (move to near 0 or backwards when protection active)
                        const isReset = value < 1 || (protectionActive && value < lastUserSeek - 2);

                        if (isReset && protectionActive) {
                            console.log('[Coursera Auto Play] BLOCKED reset to:', value, 'staying at:', lastUserSeek);
                            // Don't call the setter - just return
                            return;
                        }

                        // Normal seek or forward progress - allow it
                        const result = protoDesc.set.call(this, value);

                        // Mark this as user intent if it's a significant forward jump
                        if (value > current + 1) {
                            lastUserSeek = value;
                            protectionActive = true;
                            console.log('[Coursera Auto Play] User seek to:', value);
                            // Auto-disable after 10s
                            setTimeout(() => {
                                protectionActive = false;
                                console.log('[Coursera Auto Play] Protection expired');
                            }, 10000);
                        }

                        return result;
                    },
                    configurable: true
                });

                // Also block their event listeners
                v.addEventListener('seeking', (e) => {
                    e.stopImmediatePropagation();
                }, true);

                v.addEventListener('seeked', (e) => {
                    e.stopImmediatePropagation();
                }, true);

                // Monitor for unexpected resets and log them
                v.addEventListener('timeupdate', () => {
                    if (protectionActive && lastUserSeek && v.currentTime < lastUserSeek - 1) {
                        console.log('[Coursera Auto Play] Detected reset, blocking...');
                        // Force back to protected position
                        Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime').set.call(v, lastUserSeek);
                    }
                    checkAndSmartSkip(v);
                });

                videoProtection.set(v, {
                    lastUserSeek: () => lastUserSeek,
                    isActive: () => protectionActive
                });

                v.addEventListener('ended', triggerNext);
                v.addEventListener('play', () => {
                    applySpeed();
                    checkAndSmartSkip(v);
                });
                v.addEventListener('ratechange', () => applySpeed());
                v.dataset.capListenersAttached = 'true';

                console.log('[Coursera Auto Play] Anti-reset installed');
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
