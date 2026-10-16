// Playwright installato globalmente (npm i -g playwright): lo si trova da npm root -g.
import { createRequire } from "module";
import { execSync } from "child_process";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) { pw = require(execSync("npm root -g").toString().trim() + "/playwright"); }
export default pw;
