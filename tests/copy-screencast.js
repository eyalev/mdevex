// Copy screencast video from test-results to latest screenshots run directory
// Also regenerates the dashboard HTML

import { readdirSync, copyFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const screenshotsDir = join(projectRoot, 'screenshots');
const resultsDir = join(projectRoot, 'test-results');

// Find latest run dir
const runs = readdirSync(screenshotsDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort()
  .reverse();

if (runs.length === 0) { console.log('No screenshot runs found'); process.exit(0); }
const runDir = join(screenshotsDir, runs[0]);

// Find video in test-results
if (existsSync(resultsDir)) {
  for (const dir of readdirSync(resultsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const videoPath = join(resultsDir, dir.name, 'video.webm');
    if (existsSync(videoPath)) {
      copyFileSync(videoPath, join(runDir, 'screencast.webm'));
      console.log(`Copied screencast to ${runs[0]}/screencast.webm`);
      break;
    }
  }
}

// Regenerate dashboard
generateDashboard(screenshotsDir);
console.log('Dashboard updated: screenshots/index.html');

function formatRunLabel(run) {
  // "2026-03-17T22-47-02" → "Mar 17, 2026 · 22:47:02"
  try {
    const iso = run.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3');
    const d = new Date(iso);
    if (isNaN(d)) return run;
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  } catch { return run; }
}

function generateDashboard(screenshotsDir) {
  const runs = readdirSync(screenshotsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .reverse();

  const runsData = runs.map(run => {
    const runPath = join(screenshotsDir, run);
    const files = readdirSync(runPath).sort();
    const images = files.filter(f => f.endsWith('.png'));
    const videos = files.filter(f => f.endsWith('.webm'));
    return { run, images, videos };
  });

  const sidebarItems = runsData.map((r, i) => `
    <div class="run-item${i === 0 ? ' active' : ''}" data-run="${r.run}" onclick="showRun('${r.run}', this)">
      <div class="run-label">${formatRunLabel(r.run)}</div>
      <div class="run-meta">${r.images.length} screenshot${r.images.length !== 1 ? 's' : ''}${r.videos.length ? ' · 1 video' : ''}</div>
    </div>`).join('\n');

  const panels = runsData.map((r, i) => {
    const imageCards = r.images.map(img => {
      const label = img.replace('.png', '').replace(/^\d+-/, '');
      return `
        <div class="card">
          <a href="${r.run}/${img}" target="_blank">
            <img src="${r.run}/${img}" alt="${label}" loading="${i === 0 ? 'eager' : 'lazy'}">
          </a>
          <div class="label">${label}</div>
        </div>`;
    }).join('\n');

    const videoCards = r.videos.map(v => `
        <div class="card video-card">
          <video src="${r.run}/${v}" controls preload="metadata" muted playsinline></video>
          <div class="label">screencast</div>
        </div>`).join('\n');

    return `
    <div class="run-panel${i === 0 ? ' active' : ''}" data-run="${r.run}">
      <div class="panel-header">
        <span class="panel-title">${formatRunLabel(r.run)}</span>
        <span class="panel-slug">${r.run}</span>
      </div>
      <div class="grid">
        ${imageCards}
        ${videoCards}
      </div>
    </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>web-agent — Visual Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body { background: #1a1a1a; color: #ccc; font-family: system-ui, sans-serif; display: flex; flex-direction: column; }

    /* Header */
    .header { padding: 12px 16px; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .header h1 { color: #4ec9b0; font-size: 15px; }
    .header .total { color: #555; font-size: 12px; }

    /* Layout */
    .layout { display: flex; flex: 1; overflow: hidden; }

    /* Sidebar */
    .sidebar { width: 220px; flex-shrink: 0; border-right: 1px solid #2a2a2a; overflow-y: auto; background: #161616; }
    .sidebar-label { padding: 10px 12px 6px; font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 0.08em; }
    .run-item { padding: 10px 12px; cursor: pointer; border-left: 2px solid transparent; transition: background 0.1s; }
    .run-item:hover { background: #1e1e1e; }
    .run-item.active { background: #1e2a28; border-left-color: #4ec9b0; }
    .run-label { font-size: 12px; color: #bbb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .run-item.active .run-label { color: #4ec9b0; }
    .run-meta { font-size: 11px; color: #555; margin-top: 2px; }

    /* Main */
    .main { flex: 1; overflow-y: auto; padding: 16px; }
    .run-panel { display: none; }
    .run-panel.active { display: block; }
    .panel-header { margin-bottom: 14px; }
    .panel-title { font-size: 15px; color: #ddd; font-weight: 500; }
    .panel-slug { display: block; font-size: 11px; color: #555; font-family: monospace; margin-top: 3px; }

    /* Grid */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
    .card { background: #111; border: 1px solid #2a2a2a; border-radius: 6px; overflow: hidden; }
    .card img, .card video { width: 100%; display: block; }
    .card a:hover img { opacity: 0.85; }
    .label { padding: 5px 9px; font-size: 11px; color: #666; font-family: monospace; }

    /* Empty */
    .no-runs { padding: 40px; color: #555; font-style: italic; }

    /* Mobile: stack sidebar on top */
    @media (max-width: 600px) {
      .layout { flex-direction: column; }
      .sidebar { width: 100%; max-height: 140px; border-right: none; border-bottom: 1px solid #2a2a2a; display: flex; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; background: #161616; }
      .sidebar-label { display: none; }
      .run-item { flex-shrink: 0; border-left: none; border-bottom: 2px solid transparent; padding: 8px 12px; }
      .run-item.active { border-bottom-color: #4ec9b0; background: #1e2a28; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>web-agent</h1>
    <span class="total">${runs.length} run${runs.length !== 1 ? 's' : ''}</span>
  </div>
  <div class="layout">
    <div class="sidebar">
      <div class="sidebar-label">Runs</div>
      ${runs.length === 0 ? '<div class="run-item"><div class="run-label">No runs yet</div></div>' : sidebarItems}
    </div>
    <div class="main">
      ${runs.length === 0 ? '<p class="no-runs">No runs yet. Run: npm run visual</p>' : panels}
    </div>
  </div>
  <script>
    function showRun(run, el) {
      document.querySelectorAll('.run-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.run-panel').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      document.querySelector('.run-panel[data-run="' + run + '"]').classList.add('active');
    }
  </script>
</body>
</html>`;

  writeFileSync(join(screenshotsDir, 'index.html'), html);
}
