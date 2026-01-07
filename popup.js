document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggle-override');
    const statusText = document.getElementById('status-text');

    // Load current state
    chrome.storage.local.get(['overrideEnabled'], (result) => {
        const isEnabled = result.overrideEnabled !== false; // Default to true
        toggle.checked = isEnabled;
        updateStatusUI(isEnabled);
    });

    // Handle toggle change
    toggle.addEventListener('change', () => {
        const isEnabled = toggle.checked;
        chrome.storage.local.set({ overrideEnabled: isEnabled }, () => {
            updateStatusUI(isEnabled);
        });
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
