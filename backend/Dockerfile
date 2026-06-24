# ── Base: Ubuntu 22.04 LTS ───────────────────────────────────────────────────
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=20

# ── System packages ───────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # HDL simulators
    iverilog \
    verilator \
    # Build tools (for Verilator C++ output)
    gcc g++ make \
    # Node.js setup
    curl ca-certificates gnupg \
  && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
  && apt-get install -y nodejs \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# ── App ───────────────────────────────────────────────────────────────────────
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# Persistent storage dirs
RUN mkdir -p /app/uploads /app/temp

EXPOSE 3001

CMD ["node", "src/server.js"]
