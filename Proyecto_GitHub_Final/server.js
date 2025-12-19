const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

const os = require('os');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- DEBUG LOGGING ---
// --- DEBUG LOGGING REMOVED FOR PRODUCTION ---

// --- Path Configuration ---
const isPackaged = process.pkg || /app\.asar/.test(__dirname);

// Downloads: Use User's Downloads folder to avoid permission/ASAR issues
const downloadsDir = path.join(os.homedir(), 'Downloads', 'YoutubeDownloads');
if (!fs.existsSync(downloadsDir)) {
    try {
        fs.mkdirSync(downloadsDir, { recursive: true });
    } catch (e) {
        console.error('Failed to create downloads dir:', e);
    }
}

// Binaries: Check resources path if packaged
let binDir;
if (isPackaged && process.resourcesPath) {
    binDir = path.join(process.resourcesPath, 'bin'); // ../resources/bin
} else {
    binDir = path.join(__dirname, 'bin'); // Development
}

const ytDlpPath = path.join(binDir, 'yt-dlp.exe');
// logToFile(`Mode: ${isPackaged ? 'Production' : 'Development'}`);
// logToFile(`BinDir: ${binDir}`);
// logToFile(`YtDlpPath: ${ytDlpPath} (Exists: ${fs.existsSync(ytDlpPath)})`);
// logToFile(`DownloadsDir: ${downloadsDir}`);

// --- SSE Setup ---
let clients = [];

app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    clients.push(newClient);

    sendEventToClient(newClient, 'queueUpdate', queueManager.getCheckState());

    req.on('close', () => {
        clients = clients.filter(c => c.id !== clientId);
    });
});

function broadcast(type, data) {
    clients.forEach(client => sendEventToClient(client, type, data));
}

function sendEventToClient(client, type, data) {
    client.res.write(`event: ${type}\n`);
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// --- Queue Manager ---
class QueueManager {
    constructor(concurrency = 10) {
        this.queue = [];
        this.activeJobs = [];
        this.concurrency = concurrency;
        this.isPaused = false;
        this.activeProcesses = {}; // Map jobId -> ChildProcess
    }

    addJob(jobData) {
        const job = {
            id: crypto.randomUUID(),
            ...jobData,
            status: 'waiting',
            progress: 0,
            addedAt: Date.now()
        };
        this.queue.push(job);
        broadcast('queueUpdate', this.getCheckState());
        this.processQueue();
        return job.id;
    }

    addBulk(items) {
        items.forEach(item => {
            this.queue.push({
                id: crypto.randomUUID(),
                ...item,
                status: 'waiting',
                progress: 0,
                addedAt: Date.now()
            });
        });
        broadcast('queueUpdate', this.getCheckState());
        this.processQueue();
    }

    pause() {
        this.isPaused = true;
        broadcast('queueUpdate', this.getCheckState());
    }

    resume() {
        this.isPaused = false;
        this.processQueue();
        broadcast('queueUpdate', this.getCheckState());
    }

    cancelAll() {
        this.isPaused = true; // Stop new ones
        this.queue = []; // Clear waiting

        // Kill active
        this.activeJobs.forEach(job => {
            const proc = this.activeProcesses[job.id];
            if (proc) {
                try {
                    proc.kill();
                } catch (e) { console.error('Error killing process', e); }
            }
        });
        this.activeJobs = [];
        this.activeProcesses = {};

        broadcast('queueUpdate', this.getCheckState());

        // Brief delay then ready to resume? Or stay paused? 
        // Let's reset pause state so user can add new things
        setTimeout(() => {
            this.isPaused = false;
            broadcast('queueUpdate', this.getCheckState());
        }, 1000);
    }

    getCheckState() {
        return {
            active: this.activeJobs,
            waiting: this.queue,
            isPaused: this.isPaused
        };
    }

    processQueue() {
        if (this.isPaused) return;
        if (this.activeJobs.length >= this.concurrency) return;
        if (this.queue.length === 0) return;

        const job = this.queue.shift();
        this.activeJobs.push(job);
        job.status = 'downloading';

        broadcast('queueUpdate', this.getCheckState());
        this.startDownload(job);

        this.processQueue();
    }

    startDownload(job) {
        const { url, title, downloadPath, playlistTitle, format } = job;
        const targetDir = downloadPath || downloadsDir;

        // Ensure we have a valid target directory
        if (!targetDir || targetDir.trim() === '') {
            targetDir = downloadsDir;
        }

        if (!fs.existsSync(targetDir)) {
            try { fs.mkdirSync(targetDir, { recursive: true }); } catch (e) {
                console.error('Failed to create target dir:', e);
                // Fallback to temp if main fails? For now just log.
            }
        }

        let outputTemplate;
        // Adjust extension based on format
        const extVar = format === 'mp4' ? 'mp4' : 'mp3';

        if (playlistTitle) {
            outputTemplate = path.join(targetDir, playlistTitle, '%(title)s.%(ext)s');
        } else {
            outputTemplate = path.join(targetDir, '%(title)s.%(ext)s');
        }

        // Base Args
        let args = [
            '--add-metadata',
            '-o', outputTemplate,
            '--ffmpeg-location', binDir,
            '--js-runtimes', 'node',
            '--newline',
            '--no-warnings',
            '--force-ipv4'
        ];

        if (format === 'mp4') {
            // Video Mode: Prioritize MP4 container with AAC audio for Windows compatibility
            // This avoids 'opus' audio in 'mp4' container which some players dislike.
            args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
            args.push('--merge-output-format', 'mp4');
        } else {
            // Audio Mode: Extract audio, convert to mp3 (force quality 0 = best)
            args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
        }

        args.push(url);

        const command = fs.existsSync(ytDlpPath) ? ytDlpPath : 'yt-dlp';
        console.log(`[Job ${job.id}] Starting (${format || 'mp3'}): ${title || url}`);

        const child = spawn(command, args);
        this.activeProcesses[job.id] = child;

        child.stdout.on('data', (data) => {
            const str = data.toString();
            // Try to capture title if we didn't have it
            // [download] Destination: ...\song.mp3

            const match = str.match(/\[download\]\s+(\d+\.\d+)%/);
            if (match) {
                const percentage = parseFloat(match[1]);
                if (percentage > job.progress) {
                    job.progress = percentage;
                    broadcast('progress', { jobId: job.id, progress: percentage });
                }
            }
        });

        child.stderr.on('data', (data) => {
            const errStr = data.toString();
            console.error(`[Job ${job.id} stderr]: ${errStr}`);
            if (!job.errorLog) job.errorLog = '';
            job.errorLog += errStr;
        });

        // 1. Handle Spawn Errors (Binary missing, path issues) - CRITICAL FIX
        child.on('error', (err) => {
            console.error(`[Job ${job.id}] Spawn Error:`, err);
            delete this.activeProcesses[job.id];
            this.activeJobs = this.activeJobs.filter(j => j.id !== job.id);

            broadcast('jobError', {
                jobId: job.id,
                error: `Critical Error: Could not start download process. \n${err.message}`,
                title: job.title
            });

            broadcast('queueUpdate', this.getCheckState());
            this.processQueue();
        });

        // 2. Handle Process Exit
        child.on('close', (code) => {
            if (!this.activeProcesses[job.id]) return; // Already handled by error?

            delete this.activeProcesses[job.id];
            this.activeJobs = this.activeJobs.filter(j => j.id !== job.id);

            if (code === 0) {
                job.status = 'completed';
                job.progress = 100;
                broadcast('jobCompleted', {
                    jobId: job.id,
                    status: 'completed',
                    title: job.title || 'Unknown',
                    format: job.format || 'mp3',
                    path: job.downloadPath || downloadsDir // Ensure path is sent
                });
            } else {
                console.error(`Job ${job.id} failed with code ${code}`);
                broadcast('jobError', {
                    jobId: job.id,
                    error: job.errorLog || `Process exited with code ${code}`,
                    title: job.title
                });
            }

            broadcast('queueUpdate', this.getCheckState());
            this.processQueue();
        });
    }
}

const queueManager = new QueueManager(10);

// --- Routes ---

app.get('/api/choose-directory', (req, res) => {
    const psScript = path.join(binDir, 'select_folder.ps1'); // Fixed: Use binDir
    console.log('[DEBUG] Running PS script at:', psScript);
    const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript]);
    let stdout = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.on('close', () => {
        const path = stdout.trim();
        res.json({ path: path || null });
    });
});

app.post('/api/open-folder', (req, res) => {
    const { path: folderPath } = req.body;
    const target = folderPath || downloadsDir;
    console.log('[DEBUG] Opening folder:', target);
    exec(`start "" "${target}"`, (err) => {
        if (err) console.error('Failed to open folder:', err);
    });
    res.json({ success: true });
});

app.post('/api/info', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    console.log('Fetching info for:', url);
    const command = fs.existsSync(ytDlpPath) ? ytDlpPath : 'yt-dlp';
    console.log(`[DEBUG] yt-dlp path check: ${ytDlpPath} -> Exists? ${fs.existsSync(ytDlpPath)}`);
    console.log(`[DEBUG] Final Command: ${command}`);

    // --flat-playlist: Don't download video details, just list IDs/titles (Fast)
    // --dump-single-json: Return one JSON object
    const args = [
        '--dump-single-json',
        '--flat-playlist',
        '--js-runtimes', 'node', // Fix for hang on some videos
        '--no-warnings',
        '--force-ipv4', // Speed up connection
        url
    ];

    let output = '';
    const child = spawn(command, args);

    child.stdout.on('data', (chunk) => output += chunk.toString());
    child.stderr.on('data', (chunk) => console.error('Info stderr:', chunk.toString()));

    child.on('close', (code) => {
        if (code !== 0) return res.status(500).json({ error: 'Failed to fetch info' });

        try {
            const data = JSON.parse(output);
            const isPlaylist = data._type === 'playlist';

            let result = {
                title: data.title,
                isPlaylist: isPlaylist,
                videoCount: isPlaylist ? data.entries.length : 1,
                entries: [] // Only populated if playlist
            };

            if (isPlaylist) {
                result.entries = data.entries.map(e => ({
                    id: e.id,
                    title: e.title,
                    url: e.url || `https://www.youtube.com/watch?v=${e.id}`
                }));
            } else {
                result.entries = [{
                    id: data.id,
                    title: data.title,
                    url: data.webpage_url || url
                }];
            }

            res.json(result);
        } catch (e) {
            res.status(500).json({ error: 'Failed to parse metadata' });
        }
    });
});

app.post('/api/queue/add', (req, res) => {
    const { items, downloadPath, playlistTitle } = req.body;
    // items: [{ title, url }, ...]

    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Items array required' });

    queueManager.addBulk(items.map(i => ({
        ...i,
        downloadPath,
        playlistTitle,
        format: req.body.format || 'mp3' // Pass format or default
    })));

    res.json({ success: true, count: items.length });
});

app.post('/api/queue/action', (req, res) => {
    const { action } = req.body;

    if (action === 'pause') queueManager.pause();
    if (action === 'resume') queueManager.resume();
    if (action === 'cancel_all') queueManager.cancelAll();

    res.json({ success: true, state: queueManager.getCheckState() });
});

// Legacy support (optional, but let's keep it simple and rely on new endpoints)
// app.post('/api/download', ...) -> Removed in favor of /api/queue/add flow

const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use. Assuming server is running from previous instance.`);
        // Do not exit, let Electron try to connect to the existing server
    } else {
        console.error('Server error:', e);
    }
});
