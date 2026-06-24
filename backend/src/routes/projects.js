'use strict';
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fse     = require('fs-extra');
const { v4: uuid } = require('uuid');
const archiver     = require('archiver');
const unzipper     = require('unzipper');

const router = express.Router();

// ── Multer setup ──────────────────────────────────────────────────────────────
const ALLOWED_EXT = new Set(['.v', '.sv', '.vh', '.vhd', '.mem', '.hex', '.txt', '.f']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projDir = path.join(req.uploadDir, req.params.projectId || req.body.projectId || uuid());
    fse.ensureDirSync(projDir);
    req._projDir = projDir;
    cb(null, projDir);
  },
  filename: (_req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ALLOWED_EXT.has(ext));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
});

// ── GET /api/projects ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const entries = await fse.readdir(req.uploadDir, { withFileTypes: true });
    const projects = await Promise.all(
      entries.filter(e => e.isDirectory()).map(async e => {
        const projPath = path.join(req.uploadDir, e.name);
        const files    = await listFilesRecursive(projPath, projPath);
        const meta     = await loadMeta(projPath);
        return { id: e.name, name: meta.name || e.name, files, createdAt: meta.createdAt };
      })
    );
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects ────────────────────────────────────────────────────────
// Create empty project
router.post('/', async (req, res) => {
  try {
    const id      = uuid();
    const projDir = path.join(req.uploadDir, id);
    await fse.ensureDir(projDir);
    const meta = { name: req.body.name || 'Untitled Project', createdAt: new Date().toISOString() };
    await saveMeta(projDir, meta);
    res.json({ id, ...meta, files: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:projectId ──────────────────────────────────────────────
router.get('/:projectId', async (req, res) => {
  try {
    const projDir = path.join(req.uploadDir, req.params.projectId);
    if (!await fse.pathExists(projDir)) return res.status(404).json({ error: 'Project not found' });
    const files = await listFilesRecursive(projDir, projDir);
    const meta  = await loadMeta(projDir);
    res.json({ id: req.params.projectId, ...meta, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/projects/:projectId ──────────────────────────────────────────
router.delete('/:projectId', async (req, res) => {
  try {
    const projDir = path.join(req.uploadDir, req.params.projectId);
    await fse.remove(projDir);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects/:projectId/files ───────────────────────────────────────
// Upload one or more HDL files
router.post('/:projectId/files', upload.array('files', 200), async (req, res) => {
  try {
    const projDir = path.join(req.uploadDir, req.params.projectId);
    await fse.ensureDir(projDir);
    const files = await listFilesRecursive(projDir, projDir);
    res.json({ ok: true, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/projects/:projectId/files/:filename ──────────────────────────────
// Save/update file content
router.put('/:projectId/files/:filename(*)', async (req, res) => {
  try {
    const projDir  = path.join(req.uploadDir, req.params.projectId);
    const filePath = path.join(projDir, req.params.filename);
    // Guard against path traversal
    if (!filePath.startsWith(projDir)) return res.status(400).json({ error: 'Invalid path' });
    await fse.ensureDir(path.dirname(filePath));
    await fse.writeFile(filePath, req.body.content || '', 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:projectId/files/:filename ──────────────────────────────
// Read file content
router.get('/:projectId/files/:filename(*)', async (req, res) => {
  try {
    const projDir  = path.join(req.uploadDir, req.params.projectId);
    const filePath = path.join(projDir, req.params.filename);
    if (!filePath.startsWith(projDir)) return res.status(400).json({ error: 'Invalid path' });
    if (!await fse.pathExists(filePath)) return res.status(404).json({ error: 'File not found' });
    const content = await fse.readFile(filePath, 'utf8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/projects/:projectId/files/:filename ───────────────────────────
router.delete('/:projectId/files/:filename(*)', async (req, res) => {
  try {
    const projDir  = path.join(req.uploadDir, req.params.projectId);
    const filePath = path.join(projDir, req.params.filename);
    if (!filePath.startsWith(projDir)) return res.status(400).json({ error: 'Invalid path' });
    await fse.remove(filePath);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects/:projectId/rename-file ─────────────────────────────────
router.post('/:projectId/rename-file', async (req, res) => {
  try {
    const projDir = path.join(req.uploadDir, req.params.projectId);
    const oldPath = path.join(projDir, req.body.oldName);
    const newPath = path.join(projDir, req.body.newName);
    if (!oldPath.startsWith(projDir) || !newPath.startsWith(projDir))
      return res.status(400).json({ error: 'Invalid path' });
    await fse.move(oldPath, newPath, { overwrite: false });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:projectId/export ───────────────────────────────────────
router.get('/:projectId/export', async (req, res) => {
  try {
    const projDir = path.join(req.uploadDir, req.params.projectId);
    const meta    = await loadMeta(projDir);
    res.attachment(`${meta.name || req.params.projectId}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(projDir, false);
    await archive.finalize();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects/import ─────────────────────────────────────────────────
const zipUpload = multer({ dest: '/tmp/', limits: { fileSize: 100 * 1024 * 1024 } });
router.post('/import', zipUpload.single('archive'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const id      = uuid();
    const projDir = path.join(req.uploadDir, id);
    await fse.ensureDir(projDir);
    await fse.createReadStream(req.file.path)
      .pipe(unzipper.Extract({ path: projDir }))
      .promise();
    await fse.remove(req.file.path);
    const meta = { name: req.body.name || 'Imported Project', createdAt: new Date().toISOString() };
    await saveMeta(projDir, meta);
    const files = await listFilesRecursive(projDir, projDir);
    res.json({ id, ...meta, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function listFilesRecursive(dir, base, prefix = '') {
  const results = [];
  if (!await fse.pathExists(dir)) return results;
  const entries = await fse.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === '.chipranklab') continue;
    const rel  = prefix ? `${prefix}/${e.name}` : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const children = await listFilesRecursive(full, base, rel);
      results.push({ name: e.name, path: rel, type: 'dir', children });
    } else {
      const stat = await fse.stat(full);
      results.push({ name: e.name, path: rel, type: 'file', size: stat.size });
    }
  }
  return results;
}

async function loadMeta(projDir) {
  const mp = path.join(projDir, '.chipranklab', 'meta.json');
  if (await fse.pathExists(mp)) return fse.readJson(mp);
  return {};
}

async function saveMeta(projDir, meta) {
  const mp = path.join(projDir, '.chipranklab', 'meta.json');
  await fse.ensureDir(path.dirname(mp));
  await fse.writeJson(mp, meta, { spaces: 2 });
}

module.exports = router;
