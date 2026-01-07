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

    // Localization will handle the name via popup.html spans if needed,
    // but we remove this override to prevent wiping out the exclusive-name span.

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
        const heroCard = document.querySelector('.hero-card');
        const pulse = document.querySelector('.pulse');

        if (isEnabled) {
            statusText.textContent = 'Learning Active';
            heroCard.style.boxShadow = '0 0 20px rgba(0, 173, 124, 0.2)';
            if (pulse) pulse.style.background = 'var(--success)';
        } else {
            statusText.textContent = 'Paused';
            heroCard.style.boxShadow = 'none';
            if (pulse) pulse.style.background = '#ff4b2b';
        }
    }
});
