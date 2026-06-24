'use strict';
const express = require('express');
const path    = require('path');
const fse     = require('fs-extra');

const router = express.Router();

// Download single file from a project
router.get('/:projectId/:filename(*)', async (req, res) => {
  try {
    const projDir  = path.join(req.uploadDir, req.params.projectId);
    const filePath = path.join(projDir, req.params.filename);
    if (!filePath.startsWith(projDir)) return res.status(400).json({ error: 'Invalid path' });
    if (!await fse.pathExists(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
