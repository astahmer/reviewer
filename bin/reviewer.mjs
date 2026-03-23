#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const WAIT_TIMEOUT_MS = 15000;

const args = new Set(process.argv.slice(2));
const shouldOpenBrowser = !args.has("--no-open");

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = resolve(packageRoot, "dist/server/server.js");

const ensureBuilt = async () => {
  try {
    await access(serverEntry);
  } catch {
    console.error("Reviewer CLI requires a built app. Run `pnpm build` first.");
    process.exit(1);
  }
};

const getFreePort = async () => {
  const server = createServer();

  return await new Promise((resolvePort, rejectPort) => {
    server.once("error", rejectPort);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        rejectPort(new Error("Failed to resolve a free port"));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          rejectPort(error);
          return;
        }

        resolvePort(port);
      });
    });
  });
};

const waitForServer = async (url) => {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }

  throw new Error(`Timed out waiting for Reviewer to start at ${url}`);
};

const openBrowser = (url) => {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";

  const commandArgs =
    process.platform === "win32" ? ["/c", "start", "", url] : [url];

  const child = spawn(command, commandArgs, {
    detached: true,
    stdio: "ignore",
  });

  child.unref();
};

await ensureBuilt();

const repoPath = process.cwd();
const port = await getFreePort();
const appUrl = `http://${HOST}:${port}/?repoPath=${encodeURIComponent(repoPath)}`;

const serverProcess = spawn(process.execPath, [serverEntry], {
  cwd: packageRoot,
  env: {
    ...process.env,
    PORT: String(port),
    HOST,
    NODE_ENV: process.env.NODE_ENV || "production",
  },
  stdio: "inherit",
});

const shutdown = (signal) => {
  if (!serverProcess.killed) {
    serverProcess.kill(signal);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

serverProcess.on("exit", (code, signal) => {
  if (signal) {
    process.exit(0);
  }

  process.exit(code ?? 0);
});

await waitForServer(appUrl);
console.log(`Reviewer running at ${appUrl}`);

if (shouldOpenBrowser) {
  openBrowser(appUrl);
}
