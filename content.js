(function () {
    'use strict';

    let isEnabled = true;

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

    // Initial load from storage
    chrome.storage.local.get(['overrideEnabled'], (result) => {
        isEnabled = result.overrideEnabled !== false;
        applyOverrides();
        console.log('[Coursera Auto Play] Initial state:', isEnabled ? 'Enabled' : 'Disabled');
    });

    // Listen for changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.overrideEnabled) {
            isEnabled = changes.overrideEnabled.newValue;
            console.log('[Coursera Auto Play] State changed:', isEnabled ? 'Enabled' : 'Disabled');
            if (isEnabled) {
                applyOverrides();
            } else {
                // For a full "disable", a page refresh is often cleanest in extensions
                // but we update the flag for the event listeners immediately.
                location.reload();
            }
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
