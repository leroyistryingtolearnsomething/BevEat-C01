// Starts the backend (API on :4000) and frontend (site on :5173) together. Ctrl+C stops both.
const { spawn } = require("node:child_process");

for (const dir of ["backend", "frontend"]) {
  spawn("npm run dev", { cwd: `${__dirname}/${dir}`, stdio: "inherit", shell: true });
}
