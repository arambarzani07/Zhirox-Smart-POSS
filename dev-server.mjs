import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawArgs = process.argv.slice(2);
const args = ["dev"];

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === "--host") {
    args.push("-H");
  } else if (arg.startsWith("--host=")) {
    args.push(`-H=${arg.slice(7)}`);
  } else if (arg === "--port") {
    args.push("-p");
  } else {
    args.push(arg);
  }
}

if (!args.includes("-p") && !args.includes("--port")) {
  args.push("-p", "3000");
}
if (!args.includes("-H") && !args.includes("--hostname")) {
  args.push("-H", "0.0.0.0");
}

const nextBin = path.join(__dirname, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextBin, ...args], {
  stdio: "inherit",
  env: process.env,
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

