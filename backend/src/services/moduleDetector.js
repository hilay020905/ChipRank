'use strict';
/**
 * ModuleDetector
 * Scans HDL source files using regex patterns to extract module/entity names
 * and infer likely testbench vs design modules.
 *
 * This is ONLY used for top-module selection in the UI — not for simulation.
 * The actual compilation is delegated to iverilog/verilator.
 */
const fse  = require('fs-extra');
const path = require('path');

// Patterns for Verilog/SV module declarations
const MODULE_RE    = /^\s*module\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[#(;]/m;
const ALL_MOD_RE   = /^\s*module\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[#(;]/gm;
const TB_HINTS     = /\b(testbench|tb_|_tb|_test|_sim|bench)\b/i;
const DUMPVARS_RE  = /\$dumpvars/;
const INITIAL_CLK  = /initial\s+\w+\s*=\s*0\s*;/;

class ModuleDetector {
  static async detect(filePaths) {
    const modules = [];

    for (const fp of filePaths) {
      try {
        const src     = await fse.readFile(fp, 'utf8');
        const matches = [...src.matchAll(ALL_MOD_RE)];
        for (const m of matches) {
          const name    = m[1];
          const isTb    = TB_HINTS.test(name) || TB_HINTS.test(fp)
                        || DUMPVARS_RE.test(src) || INITIAL_CLK.test(src);
          const portRe  = new RegExp(`module\\s+${name}[\\s\\S]*?\\)\\s*;`, 'm');
          const portBlk = (src.match(portRe) || [''])[0];
          const ports   = extractPorts(portBlk);

          modules.push({
            name,
            file:        path.basename(fp),
            filePath:    fp,
            isTestbench: isTb,
            ports,
          });
        }
      } catch { /* skip unreadable */ }
    }

    // Sort: testbenches first, then alphabetical
    modules.sort((a, b) => {
      if (a.isTestbench !== b.isTestbench) return a.isTestbench ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return modules;
  }
}

function extractPorts(portBlock) {
  const ports = [];
  const re    = /\b(input|output|inout)\s+(?:wire|reg|logic)?\s*(?:signed)?\s*(?:\[([^\]]*)\])?\s*([a-zA-Z_$][a-zA-Z0-9_$,\s]*)/g;
  let m;
  while ((m = re.exec(portBlock)) !== null) {
    const dir   = m[1];
    const width = m[2] ? m[2].trim() : '0';
    const names = m[3].split(',').map(n => n.trim()).filter(Boolean);
    for (const n of names) {
      if (n && /^[a-zA-Z_$]/.test(n)) {
        ports.push({ name: n, dir, width: width || '0:0' });
      }
    }
  }
  return ports;
}

module.exports = ModuleDetector;
