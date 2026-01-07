document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggle-override');
    const statusText = document.getElementById('status-text');
    const autoNextToggle = document.getElementById('toggle-autonext');
    const speedSelect = document.getElementById('speed-select');
    const quizSkipToggle = document.getElementById('toggle-quizskip');
    const smartSkipToggle = document.getElementById('toggle-smartskip');
    const skipDurationInput = document.getElementById('skip-duration');

    // Localize UI strings
    document.querySelectorAll('.i18n-link').forEach(el => {
        const msg = el.getAttribute('data-msg');
        if (msg) {
            el.textContent = chrome.i18n.getMessage(msg);
        }
    });

    const authorText = document.querySelector('.author');
    if (authorText) {
        authorText.textContent = chrome.i18n.getMessage('madeBy') || 'Made by Gem Si';
    }

    // Load current state
    chrome.storage.local.get([
        'overrideEnabled',
        'autoNextEnabled',
        'playbackSpeed',
        'quizSkipEnabled',
        'smartSkipEnabled',
        'skipDuration'
    ], (result) => {
        // Main Override
        const isEnabled = result.overrideEnabled !== false;
        toggle.checked = isEnabled;
        updateStatusUI(isEnabled);

        // Auto Next
        autoNextToggle.checked = !!result.autoNextEnabled;

        // Playback Speed
        if (result.playbackSpeed) {
            speedSelect.value = result.playbackSpeed;
        }

        // Ultimate Features
        quizSkipToggle.checked = !!result.quizSkipEnabled;
        smartSkipToggle.checked = !!result.smartSkipEnabled;
        if (result.skipDuration) {
            skipDurationInput.value = result.skipDuration;
        }
    });

    // Handle toggle change
    toggle.addEventListener('change', () => {
        const isEnabled = toggle.checked;
        chrome.storage.local.set({ overrideEnabled: isEnabled }, () => {
            updateStatusUI(isEnabled);
        });
    });

    // Handle Auto-Next change
    autoNextToggle.addEventListener('change', () => {
        chrome.storage.local.set({ autoNextEnabled: autoNextToggle.checked });
    });

    // Handle Speed change
    speedSelect.addEventListener('change', () => {
        chrome.storage.local.set({ playbackSpeed: speedSelect.value });
    });

    // Handle Ultimate Feature changes
    quizSkipToggle.addEventListener('change', () => {
        chrome.storage.local.set({ quizSkipEnabled: quizSkipToggle.checked });
    });

    smartSkipToggle.addEventListener('change', () => {
        chrome.storage.local.set({ smartSkipEnabled: smartSkipToggle.checked });
    });

    skipDurationInput.addEventListener('change', () => {
        chrome.storage.local.set({ skipDuration: skipDurationInput.value });
    });

    function updateStatusUI(isEnabled) {
        if (isEnabled) {
            statusText.textContent = 'Extension is currently active. Your videos will keep playing even if you switch tabs.';
            statusText.style.color = '#94a3b8';
        } else {
            statusText.textContent = 'Extension is disabled. Coursera will pause videos when you switch tabs.';
            statusText.style.color = '#f87171'; // Reddish for disabled state
        }
    }
});
