'use strict';
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const fse        = require('fs-extra');
const { v4: uuid } = require('uuid');

const projectsRouter   = require('./routes/projects');
const simulateRouter   = require('./routes/simulate');
const filesRouter      = require('./routes/files');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Temp / upload directories ─────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const TEMP_DIR   = path.join(__dirname, '..', 'temp');
fse.ensureDirSync(UPLOAD_DIR);
fse.ensureDirSync(TEMP_DIR);

// Attach dirs to every request
app.use((req, _res, next) => {
  req.uploadDir = UPLOAD_DIR;
  req.tempDir   = TEMP_DIR;
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/projects',  projectsRouter);
app.use('/api/simulate',  simulateRouter);
app.use('/api/files',     filesRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }));

// ── Cleanup stale temp dirs (> 2 h) ──────────────────────────────────────────
setInterval(async () => {
  try {
    const entries = await fse.readdir(TEMP_DIR);
    const now     = Date.now();
    for (const e of entries) {
      const p    = path.join(TEMP_DIR, e);
      const stat = await fse.stat(p);
      if (now - stat.mtimeMs > 2 * 60 * 60 * 1000) await fse.remove(p);
    }
  } catch { /* ignore */ }
}, 30 * 60 * 1000);

app.listen(PORT, () => console.log(`ChipRank Lab backend  →  http://localhost:${PORT}`));
