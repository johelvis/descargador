document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const downloadBtn = document.getElementById('downloadBtn');
    const folderBtn = document.getElementById('folderBtn');
    const folderPathText = document.getElementById('folderPathText');
    const autoDetectToggle = document.getElementById('autoDetectToggle');
    const statusMessage = document.getElementById('statusMessage');

    // Hidden inputs maintained for logic
    const urlInput = document.getElementById('urlInput');
    const playlistToggle = document.getElementById('playlistToggle'); // Always true logic

    // Preview Bar
    const infoPreview = document.getElementById('infoPreview');
    const infoTitle = document.getElementById('infoTitle');
    const infoCount = document.getElementById('infoCount');
    const confirmAddBtn = document.getElementById('confirmAddBtn');
    const cancelPreviewBtn = document.getElementById('cancelPreviewBtn');

    // Queue Container
    const queueList = document.getElementById('queueList');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const cancelAllBtn = document.getElementById('cancelAllBtn');
    const formatSpans = document.querySelectorAll('.pill-switch span');
    let eventSource = null; // Defined in outer scope of DOMContentLoaded

    // --- State Variables ---
    let selectedDownloadPath = null;
    let selectedFormat = 'mp3';
    let isProcessingPreview = false;
    let lastClipboardText = '';
    let currentPreviewData = null;
    let selectedQuality = 'best'; // New

    // Generic URL Regex (Matches http/https + domain)
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

    // --- Persistence & History State ---
    const STORAGE_KEY_SETTINGS = 'downloader_settings';
    const STORAGE_KEY_HISTORY = 'downloader_history';
    let history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)) || [];
    let settings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS)) || {
        path: null,
        format: 'mp3',
        autoDetect: true,
        quality: 'best' // New default
    };

    // Apply Saved Settings on Load
    if (settings.path) {
        selectedDownloadPath = settings.path;
        folderPathText.textContent = truncatePath(settings.path);
    }
    if (settings.format) {
        selectedFormat = settings.format;
        formatSpans.forEach(s => {
            if (s.textContent.trim().toLowerCase() === selectedFormat) s.classList.add('active');
            else s.classList.remove('active');
        });
    }
    if (settings.quality) { // New
        selectedQuality = settings.quality;
    }
    autoDetectToggle.checked = settings.autoDetect;

    // Save Settings Helper
    function saveSettings() {
        settings.path = selectedDownloadPath;
        settings.format = selectedFormat;
        settings.autoDetect = autoDetectToggle.checked;
        settings.quality = selectedQuality; // New
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    }

    // --- Event Listeners for Persistence ---
    autoDetectToggle.addEventListener('change', saveSettings);

    // Format Switch Logic (Updated to save)
    formatSpans.forEach(span => {
        span.addEventListener('click', () => {
            // Remove active from all
            formatSpans.forEach(s => s.classList.remove('active'));
            // Add to clicked
            span.classList.add('active');
            // Update state
            selectedFormat = span.textContent.trim().toLowerCase();
            saveSettings(); // Save!
        });
    });

    // --- Folder / Open Logic ---
    const openFolderBtn = document.getElementById('openFolderBtn');

    folderBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('http://localhost:3000/api/choose-directory');
            const data = await response.json();
            if (data.path) {
                selectedDownloadPath = data.path;
                folderPathText.textContent = truncatePath(data.path);
                saveSettings(); // Save!
            }
        } catch (e) { }
    });

    openFolderBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // prevent triggering choose-directory
        await fetch('http://localhost:3000/api/open-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: selectedDownloadPath })
        });
    });

    // --- Tabs Logic ---
    const tabs = document.querySelectorAll('.tab');
    const queueListDiv = document.getElementById('queueList');
    const historyListDiv = document.getElementById('historyList');
    const queueTools = [pauseBtn, resumeBtn, cancelAllBtn];
    const historyTools = [document.getElementById('clearHistoryBtn')];

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const mode = tab.getAttribute('data-tab');
            if (mode === 'queue') {
                queueListDiv.classList.remove('hidden');
                historyListDiv.classList.add('hidden');
                queueTools.forEach(b => b && b.classList.remove('hidden'));
                historyTools.forEach(b => b && b.classList.add('hidden'));
            } else {
                queueListDiv.classList.add('hidden');
                historyListDiv.classList.remove('hidden');
                queueTools.forEach(b => b && b.classList.add('hidden'));
                historyTools.forEach(b => b && b.classList.remove('hidden'));
                renderHistory();
            }
        });
    });

    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        if (confirm('¿Borrar historial?')) {
            history = [];
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
            renderHistory();
        }
    });

    function renderHistory() {
        historyListDiv.innerHTML = '';
        if (history.length === 0) {
            historyListDiv.innerHTML = `<div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i><p>Sin historial</p></div>`;
            return;
        }

        // Reverse to show newest first
        [...history].reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = 'queue-item completed';
            div.innerHTML = `
                 <div class="queue-header">
                    <span class="queue-title" title="${item.path || ''}">${item.title}</span>
                    <span class="queue-status completed">${item.format.toUpperCase()}</span>
                </div>
                <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">
                    ${new Date(item.date).toLocaleTimeString()} - ${new Date(item.date).toLocaleDateString()}
                </div>
            `;
            historyListDiv.appendChild(div);
        });
    }

    function addToHistory(job) {
        // job: { jobId, status, title, format, path }
        const item = {
            id: job.jobId,
            title: job.title,
            format: job.format,
            path: job.path,
            date: Date.now()
        };
        history.push(item);
        // Limit history to 50 items
        if (history.length > 50) history.shift();
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));

        // If on history tab, refresh
        if (!historyListDiv.classList.contains('hidden')) renderHistory();
    }


    // --- SSE & Queue Rendering ---
    /* ... (Previous SSE code) ... */
    function connectSSE() {
        if (eventSource) return;
        eventSource = new EventSource('http://localhost:3000/api/events');

        eventSource.addEventListener('queueUpdate', (e) => renderQueue(JSON.parse(e.data)));
        eventSource.addEventListener('progress', (e) => updateProgress(JSON.parse(e.data)));

        // Listen for completion to save history
        eventSource.addEventListener('jobCompleted', (e) => {
            addToHistory(JSON.parse(e.data));
        });

        // Listen for errors
        eventSource.addEventListener('jobError', (e) => {
            const data = JSON.parse(e.data);
            alert(`❌ Error al descargar "${data.title}":\n\n${data.error}`);
        });

        eventSource.onerror = () => { eventSource.close(); eventSource = null; setTimeout(connectSSE, 3000); };
    }
    connectSSE();

    /* ... (Rest of renderQueue, createItem, updateProgress as before) ... */

    if (navigator.clipboard) {
        setInterval(async () => {
            if (!autoDetectToggle.checked) return;
            if (isProcessingPreview) return; // Don't interrupt if user is deciding

            try {
                const text = await navigator.clipboard.readText();
                if (text && text !== lastClipboardText) {
                    if (urlRegex.test(text.trim())) {
                        lastClipboardText = text;
                        // Auto-fill and fetch
                        urlInput.value = text.trim();
                        fetchInfo(text.trim());
                    }
                }
            } catch (err) {
                // Clipboard read failed (focus issues?), ignore
            }
        }, 1500);
    }

    // --- Button Actions ---

    downloadBtn.addEventListener('click', async () => {
        // Priority: Manual Input > Clipboard
        let inputValue = urlInput.value.trim();

        if (inputValue) {
            // Use manual input
            fetchInfo(inputValue);
        } else {
            // Try clipboard
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    urlInput.value = text.trim();
                    fetchInfo(text.trim());
                    lastClipboardText = text;
                } else {
                    showStatus('Ingresa un enlace o copia uno', 'error');
                }
            } catch (e) {
                showStatus('Ingresa un enlace manualmente', 'error');
            }
        }
    });

    confirmAddBtn.addEventListener('click', () => {
        addToQueue();
        closePreview();
    });

    cancelPreviewBtn.addEventListener('click', () => {
        closePreview();
        urlInput.value = '';
    });

    folderBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('http://localhost:3000/api/choose-directory');
            const data = await response.json();
            if (data.path) {
                selectedDownloadPath = data.path;
                folderPathText.textContent = truncatePath(data.path);
            }
        } catch (e) { }
    });

    function truncatePath(path) {
        if (path.length > 25) return '...' + path.slice(-22);
        return path;
    }

    // --- Logic: Info & Queue ---

    async function fetchInfo(url) {
        isProcessingPreview = true;
        showStatus('Analizando enlace...', 'info');

        try {
            const response = await fetch('http://localhost:3000/api/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (response.ok) {
                const data = await response.json();
                currentPreviewData = data;

                // Show Preview Bar
                infoPreview.classList.remove('hidden');
                infoTitle.textContent = data.title;
                infoCount.textContent = data.isPlaylist
                    ? `Playlist (${data.videoCount} canciones)`
                    : 'Video Individual';
                statusMessage.classList.add('hidden'); // hide searching status

            } else {
                showStatus('Enlace no válido o privado', 'error');
                isProcessingPreview = false;
            }
        } catch (e) {
            showStatus('Error de conexión', 'error');
            isProcessingPreview = false;
        }
    }

    function closePreview() {
        infoPreview.classList.add('hidden');
        isProcessingPreview = false;
        currentPreviewData = null;
    }

    async function addToQueue() {
        if (!currentPreviewData) return;

        try {
            let items = [];
            let playlistTitle = null;

            if (currentPreviewData.entries) {
                itemsToAdd = currentPreviewData.entries.map(entry => ({
                    title: entry.title,
                    url: entry.url
                }));
            } else {
                itemsToAdd = [{ url: urlInput.value, title: currentPreviewData.title }];
            }

            const payload = {
                items: itemsToAdd,
                downloadPath: selectedDownloadPath,
                playlistTitle: currentPreviewData.isPlaylist ? currentPreviewData.title : null,
                format: selectedFormat,
                quality: selectedQuality // Send quality preference using global state
            };

            const response = await fetch('http://localhost:3000/api/queue/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const resData = await response.json();
                showStatus(`Añadido: ${resData.count} descargas`, 'success');
                setTimeout(() => statusMessage.classList.add('hidden'), 3000);

                // Clear Input & Reset Clipboard Check
                urlInput.value = '';
                lastClipboardText = ''; // Allow re-pasting same link if needed
                currentPreviewData = null; // Clear preview data
                infoPreview.classList.add('hidden'); // Hide preview bar
            }

        } catch (e) { showStatus('Fallo al añadir', 'error'); }
    }

    function showStatus(msg, type) {
        statusMessage.textContent = msg;
        statusMessage.className = `status-bar ${type}`; // remove hidden
        statusMessage.classList.remove('hidden');
        if (type === 'info') statusMessage.style.background = '#0288d1';
    }

    // --- SSE & Queue Rendering (Same as before but simplified HTML) ---

    function connectSSE() {
        if (eventSource) return;
        eventSource = new EventSource('http://localhost:3000/api/events');

        eventSource.addEventListener('queueUpdate', (e) => renderQueue(JSON.parse(e.data)));
        eventSource.addEventListener('progress', (e) => updateProgress(JSON.parse(e.data)));
        eventSource.onerror = () => { eventSource.close(); eventSource = null; setTimeout(connectSSE, 3000); };
    }
    connectSSE();

    function renderQueue(state) {
        const { active, waiting, isPaused } = state;
        const all = [...active, ...waiting];

        if (all.length === 0) {
            queueList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-music"></i><p>Listo para descargar</p></div>`;
            return;
        }

        queueList.innerHTML = '';
        active.forEach(job => queueList.appendChild(createItem(job, 'active')));
        waiting.forEach(job => queueList.appendChild(createItem(job, 'waiting')));

        // Controls
        if (isPaused) {
            pauseBtn.classList.add('hidden');
            resumeBtn.classList.remove('hidden');
        } else {
            pauseBtn.classList.remove('hidden');
            resumeBtn.classList.add('hidden');
        }
    }

    function createItem(job, type) {
        const div = document.createElement('div');
        div.className = `queue-item ${type}`;
        div.id = `job-${job.id}`;

        const progress = job.progress || 0;
        const width = `${progress}%`;

        div.innerHTML = `
            <div class="queue-header">
                <span class="queue-title" title="${job.title}">${job.title || 'Cargando...'}</span>
                <span class="queue-status ${job.status}">${job.status === 'downloading' ? Math.round(progress) + '%' : job.status}</span>
            </div>
            ${type === 'active' ? `<div class="progress-container"><div class="progress-bar" style="width: ${width}"></div></div>` : ''}
        `;
        return div;
    }

    function updateProgress({ jobId, progress, statusText }) {
        const el = document.getElementById(`job-${jobId}`);
        if (el) {
            const bar = el.querySelector('.progress-bar');
            const stat = el.querySelector('.queue-status');

            if (bar) bar.style.width = `${progress}%`;

            if (stat) {
                if (statusText) {
                    stat.innerText = statusText;
                    stat.style.color = '#f59e0b'; // Amber for processing
                } else {
                    stat.innerText = `${Math.round(progress)}%`;
                    stat.style.color = ''; // Reset color
                }
            }
        }
    }

    // --- Control Buttons Bindings ---
    async function sendAction(action) {
        await fetch('http://localhost:3000/api/queue/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
    }
    pauseBtn.addEventListener('click', () => sendAction('pause'));
    resumeBtn.addEventListener('click', () => sendAction('resume'));
    cancelAllBtn.addEventListener('click', () => {
        if (confirm('¿Borrar toda la cola?')) sendAction('cancel_all');
    });

});
