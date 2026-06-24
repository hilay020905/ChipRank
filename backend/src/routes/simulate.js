'use strict';
/**
 * /api/simulate  —  Real HDL compilation + simulation via Icarus Verilog or Verilator.
 * No LLM, no fake waveforms. Every result comes from the actual toolchain.
 */
const express = require('express');
const path    = require('path');
const fse     = require('fs-extra');
const { v4: uuid } = require('uuid');
const SimulatorService = require('../services/simulator');
const VcdParser        = require('../services/vcdParser');
const ModuleDetector   = require('../services/moduleDetector');

const router = express.Router();

// ── POST /api/simulate/detect-modules ────────────────────────────────────────
router.post('/detect-modules', async (req, res) => {
  try {
    const { projectId } = req.body;
    const projDir  = path.join(req.uploadDir, projectId);
    const hdlFiles = await collectHdlFiles(projDir);
    const modules  = await ModuleDetector.detect(hdlFiles);
    res.json({ modules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/simulate/compile ────────────────────────────────────────────────
router.post('/compile', async (req, res) => {
  const {
    projectId,
    topModule   = '',
    simulator   = 'iverilog',
    extraArgs   = '',
  } = req.body;

  const jobId   = uuid();
  const workDir = path.join(req.tempDir, jobId);

  try {
    await fse.ensureDir(workDir);

    const projDir  = path.join(req.uploadDir, projectId);
    const hdlFiles = await collectHdlFiles(projDir);

    if (!hdlFiles.length) {
      return res.status(400).json({
        success: false,
        logs: [{ level: 'error', text: 'No HDL source files found in project.' }],
      });
    }

    // Copy project into sandbox
    await fse.copy(projDir, workDir, {
      filter: src => !src.includes('.chipranklab'),
    });

    // Auto-detect top module if not specified
    let top = topModule;
    if (!top) {
      const modules = await ModuleDetector.detect(hdlFiles);
      const tb      = modules.find(m => m.isTestbench);
      top           = tb ? tb.name : (modules[0] ? modules[0].name : '');
    }

    const relFiles = hdlFiles.map(f => path.relative(projDir, f));
    const svc      = new SimulatorService(simulator, workDir);
    const result   = await svc.compile(relFiles, top, extraArgs);

    // Persist job metadata for run step
    await fse.writeJson(path.join(workDir, '.sim_meta.json'), {
      simulator,
      topModule: top,
      projectId,
      compiledAt: new Date().toISOString(),
    });

    res.json({
      jobId,
      success:   result.success,
      logs:      result.logs,
      warnings:  result.warnings,
      simulator: result.simulatorVersion,
    });
  } catch (err) {
    await fse.remove(workDir).catch(() => {});
    res.status(500).json({
      success: false,
      logs: [{ level: 'error', text: err.message }],
    });
  }
});

// ── POST /api/simulate/run ────────────────────────────────────────────────────
router.post('/run', async (req, res) => {
  const { jobId, simTime = '10ms' } = req.body;
  const workDir = path.join(req.tempDir, jobId);

  try {
    if (!await fse.pathExists(workDir)) {
      return res.status(404).json({
        success: false,
        logs: [{ level: 'error', text: 'Job not found. Please compile first.' }],
      });
    }

    const metaPath = path.join(workDir, '.sim_meta.json');
    const meta     = await fse.pathExists(metaPath)
      ? await fse.readJson(metaPath)
      : {};

    const svc    = new SimulatorService(meta.simulator || 'iverilog', workDir);
    const result = await svc.run(simTime);

    if (!result.success) {
      return res.json({ success: false, logs: result.logs });
    }

    // Parse VCD if produced
    const vcdPath = path.join(workDir, 'sim.vcd');
    if (!await fse.pathExists(vcdPath)) {
      return res.json({
        success:  true,
        logs:     result.logs,
        waveform: null,
        message:  'Simulation ran but produced no VCD. Add $dumpfile("sim.vcd"); $dumpvars(0, <top>); to your testbench.',
      });
    }

    const vcdRaw  = await fse.readFile(vcdPath, 'utf8');
    const waveform = VcdParser.parse(vcdRaw);

    res.json({
      success:  true,
      logs:     result.logs,
      waveform,
      vcdSize:  vcdRaw.length,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      logs: [{ level: 'error', text: err.message }],
    });
  }
});

// ── GET /api/simulate/vcd/:jobId ─────────────────────────────────────────────
router.get('/vcd/:jobId', async (req, res) => {
  const vcdPath = path.join(req.tempDir, req.params.jobId, 'sim.vcd');
  if (!await fse.pathExists(vcdPath)) {
    return res.status(404).json({ error: 'VCD not found' });
  }
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="sim.vcd"');
  fse.createReadStream(vcdPath).pipe(res);
});

// ── DELETE /api/simulate/job/:jobId ──────────────────────────────────────────
router.delete('/job/:jobId', async (req, res) => {
  await fse.remove(path.join(req.tempDir, req.params.jobId)).catch(() => {});
  res.json({ ok: true });
});

// ── Helper: collect all .v / .sv / .vh files recursively ─────────────────────
async function collectHdlFiles(dir) {
  const HDL_EXT = new Set(['.v', '.sv', '.vh', '.vhd']);
  const files   = [];
  async function walk(d) {
    if (!await fse.pathExists(d)) return;
    const entries = await fse.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === '.chipranklab') continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (HDL_EXT.has(path.extname(e.name).toLowerCase())) files.push(full);
    }
  }
  await walk(dir);
  return files;
}

module.exports = router;
