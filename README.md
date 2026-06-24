# ChipRank Lab — RTL Simulation Platform

Real Verilog/SystemVerilog simulation using **Icarus Verilog**.
No fake simulation. No LLM for execution. Real VCD waveforms.

---

## QUICK START (3 commands)

### Option A — Local (requires Node.js + iverilog)

```bash
# 1. Install Icarus Verilog
#    Ubuntu/Debian:
sudo apt install iverilog

#    macOS:
brew install icarus-verilog

#    Windows: download installer from https://bleyer.org/icarus/

# 2. Install Node dependencies
cd chipranklab/backend
npm install

# 3. Start backend
node src/server.js
```

Then open `frontend/chipranklab.html` in your browser.

---

### Option B — Docker (no local install needed)

```bash
cd chipranklab
docker compose up --build
```

Then open `frontend/chipranklab.html` in your browser.

---

## HOW TO GET WAVEFORMS

1. Open `chipranklab.html` in your browser
2. Status bar bottom-right must show **backend: online (Icarus Verilog)**
3. Write your DUT in the left editor
4. Write your testbench in the right editor — **must include**:
   ```verilog
   $dumpfile("sim.vcd");
   $dumpvars(0, testbench);
   ```
5. Click **▶ Simulate**
6. Waveform tab opens automatically with signal traces

---

## PROJECT STRUCTURE

```
chipranklab/
├── frontend/
│   └── chipranklab.html     ← Open this in browser
├── backend/
│   ├── src/
│   │   ├── server.js        ← Express entry point
│   │   ├── routes/
│   │   │   ├── projects.js  ← File management API
│   │   │   ├── simulate.js  ← Compile + run API
│   │   │   └── files.js     ← File download API
│   │   └── services/
│   │       ├── simulator.js     ← Icarus Verilog / Verilator wrapper
│   │       ├── vcdParser.js     ← Real VCD file parser
│   │       └── moduleDetector.js← HDL module scanner
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── start.sh
└── README.md
```

---

## REQUIREMENTS

| Tool         | Version  | Install |
|-------------|----------|---------|
| Node.js      | 18+      | nodejs.org |
| iverilog     | any      | `apt install iverilog` / `brew install icarus-verilog` |
| Verilator    | optional | `apt install verilator` |

