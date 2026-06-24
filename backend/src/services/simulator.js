'use strict';
/**
 * SimulatorService
 * Wraps Icarus Verilog (iverilog/vvp) and Verilator.
 * All HDL compilation and simulation is performed by the real toolchain —
 * NO LLM or browser-side code is involved in the execution path.
 */
const { spawn, execFile }  = require('child_process');
const path    = require('path');
const fse     = require('fs-extra');
const { promisify } = require('util');
const execFileAsync  = promisify(execFile);

const SIM_TIMEOUT_MS  = 60_000;   // 60 s per step
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024; // 5 MB stdout cap

class SimulatorService {
  constructor(simulator, workDir) {
    // 'iverilog' | 'verilator'
    this.sim     = simulator === 'verilator' ? 'verilator' : 'iverilog';
    this.workDir = workDir;
  }

  // ── Compile ────────────────────────────────────────────────────────────────
  async compile(relFiles, topModule, extraArgs = '') {
    if (this.sim === 'verilator') {
      return this._compileVerilator(relFiles, topModule, extraArgs);
    }
    return this._compileIverilog(relFiles, topModule, extraArgs);
  }

  // ── Run ───────────────────────────────────────────────────────────────────
  async run(simTime, vcdScope) {
    if (this.sim === 'verilator') {
      return this._runVerilator(simTime);
    }
    return this._runIverilog();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ICARUS VERILOG
  // ══════════════════════════════════════════════════════════════════════════

  async _compileIverilog(relFiles, topModule, extraArgs) {
    const version = await this._toolVersion('iverilog', ['-V']);

    // Build include dirs from file list
    const includeDirs = [...new Set(relFiles.map(f => path.dirname(f)))];
    const incFlags    = includeDirs.flatMap(d => ['-I', d]);

    // Classify .vh as includes — add their dirs but don't list as source
    const sources = relFiles.filter(f => path.extname(f) !== '.vh');
    const extra   = extraArgs.trim() ? extraArgs.trim().split(/\s+/) : [];

    const args = [
      '-g2012',           // SystemVerilog 2012
      '-Wall',
      ...incFlags,
      ...(topModule ? ['-s', topModule] : []),
      '-o', 'sim.vvp',
      ...extra,
      ...sources,
    ];

    const { logs, success } = await this._runTool('iverilog', args);

    if (success) {
      // Persist simulator choice for the run step
      await fse.writeJson(path.join(this.workDir, '.sim_meta.json'), {
        simulator: 'iverilog', topModule, compiledAt: new Date().toISOString(),
      });
    }

    return { success, logs, warnings: logs.filter(l => l.level === 'warning'), simulatorVersion: version };
  }

  async _runIverilog() {
    const vvpPath = path.join(this.workDir, 'sim.vvp');
    if (!await fse.pathExists(vvpPath)) {
      return { success: false, logs: [{ level: 'error', text: 'Compiled binary not found. Please compile first.' }] };
    }

    const { logs, success } = await this._runTool('vvp', ['-n', 'sim.vvp', '+vcd']);
    return { success, logs };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  VERILATOR
  // ══════════════════════════════════════════════════════════════════════════

  async _compileVerilator(relFiles, topModule, extraArgs) {
    const version = await this._toolVersion('verilator', ['--version']);

    if (!topModule) {
      return {
        success: false,
        logs: [{ level: 'error', text: 'Verilator requires a top module to be specified.' }],
        simulatorVersion: version,
      };
    }

    const includeDirs = [...new Set(relFiles.map(f => path.dirname(f)))];
    const incFlags    = includeDirs.flatMap(d => ['-I', d]);
    const sources     = relFiles.filter(f => path.extname(f) !== '.vh');
    const extra       = extraArgs.trim() ? extraArgs.trim().split(/\s+/) : [];

    // Verilator lint + C compilation
    const args = [
      '--cc',
      '--exe',
      '--build',
      '--sv',
      '-Wall',
      '--trace',             // enable VCD tracing
      '--trace-depth', '20',
      '--top-module', topModule,
      '-Mdir', 'obj_dir',
      ...incFlags,
      ...extra,
      ...sources,
    ];

    const { logs, success } = await this._runTool('verilator', args);

    if (success) {
      await fse.writeJson(path.join(this.workDir, '.sim_meta.json'), {
        simulator: 'verilator', topModule, compiledAt: new Date().toISOString(),
      });
    }

    return { success, logs, warnings: logs.filter(l => l.level === 'warning'), simulatorVersion: version };
  }

  async _runVerilator(simTime) {
    const meta      = await fse.readJson(path.join(this.workDir, '.sim_meta.json'));
    const exeName   = `V${meta.topModule}`;
    const exePath   = path.join(this.workDir, 'obj_dir', exeName);

    if (!await fse.pathExists(exePath)) {
      return { success: false, logs: [{ level: 'error', text: 'Verilator executable not found. Recompile.' }] };
    }

    const { logs, success } = await this._runTool(exePath, [], { cwd: this.workDir });
    return { success, logs };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SHARED HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  _runTool(cmd, args, opts = {}) {
    return new Promise((resolve) => {
      const logs    = [];
      let   outBuf  = '';
      let   errBuf  = '';
      let   killed  = false;
      let   outSize = 0;

      const proc = spawn(cmd, args, {
        cwd: opts.cwd || this.workDir,
        env: { ...process.env, HOME: this.workDir },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        killed = true;
        proc.kill('SIGKILL');
        logs.push({ level: 'error', text: `Simulator timed out after ${SIM_TIMEOUT_MS / 1000}s` });
      }, SIM_TIMEOUT_MS);

      proc.stdout.on('data', chunk => {
        outSize += chunk.length;
        if (outSize < MAX_OUTPUT_BYTES) outBuf += chunk.toString();
      });

      proc.stderr.on('data', chunk => {
        errBuf += chunk.toString();
      });

      proc.on('close', code => {
        clearTimeout(timer);

        // Parse stdout lines (simulation $display output)
        for (const line of outBuf.split('\n')) {
          if (!line.trim()) continue;
          logs.push({ level: classifyLine(line), text: line });
        }

        // Parse stderr (compiler diagnostics)
        for (const line of errBuf.split('\n')) {
          if (!line.trim()) continue;
          logs.push({ level: classifyDiag(line), text: line });
        }

        if (killed) {
          resolve({ success: false, logs });
        } else {
          resolve({ success: code === 0, logs });
        }
      });

      proc.on('error', err => {
        clearTimeout(timer);
        logs.push({ level: 'error', text: `Failed to run ${cmd}: ${err.message}` });
        if (err.code === 'ENOENT') {
          logs.push({ level: 'error', text: `"${cmd}" not found. Install Icarus Verilog or Verilator and ensure it is on PATH.` });
        }
        resolve({ success: false, logs });
      });
    });
  }

  async _toolVersion(cmd, args) {
    try {
      const { stdout, stderr } = await execFileAsync(cmd, args, { timeout: 5000 });
      return (stdout || stderr).split('\n')[0].trim();
    } catch {
      return `${cmd} (version unknown)`;
    }
  }
}

// ── Log classifiers ───────────────────────────────────────────────────────────

function classifyLine(line) {
  const l = line.toLowerCase();
  if (/\berror\b/.test(l))   return 'error';
  if (/\bwarning\b/.test(l)) return 'warning';
  if (/pass/i.test(l))       return 'pass';
  if (/fail/i.test(l))       return 'fail';
  return 'info';
}

function classifyDiag(line) {
  // Icarus: filename:line: error/warning: message
  // Verilator: %Error %Warning
  if (/:?\s*error/i.test(line) || line.startsWith('%Error'))    return 'error';
  if (/:?\s*warning/i.test(line) || line.startsWith('%Warning')) return 'warning';
  if (/:?\s*note/i.test(line))   return 'info';
  return 'info';
}

module.exports = SimulatorService;
