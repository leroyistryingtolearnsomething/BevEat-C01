// Starts the backend (API on :4000) and frontend (site on :5173) together. Ctrl+C stops both.
const { spawn } = require("node:child_process");

for (const dir of ["backend", "frontend"]) {
  // the Vite proxy expects the API on 4000, so a PORT set for the whole shell must not move it
  const env = { ...process.env, PORT: "4000" };
  spawn("npm run dev", { cwd: `${__dirname}/${dir}`, stdio: "inherit", shell: true, env });
}
