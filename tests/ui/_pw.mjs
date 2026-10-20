// Playwright installato globalmente (npm i -g playwright): lo si trova da npm root -g.
import { createRequire } from "module";
import { execSync } from "child_process";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) { pw = require(execSync("npm root -g").toString().trim() + "/playwright"); }
// MOTORE=webkit: le stesse suite con il motore di Safari (iPhone). Serve
// WebKit installato (npx playwright install webkit, più install-deps su Linux).
if (process.env.MOTORE) pw = { ...pw, chromium: pw[process.env.MOTORE] };
export default pw;
