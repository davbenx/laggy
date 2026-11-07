// Playwright installato globalmente (npm i -g playwright): lo si trova da npm root -g.
import { createRequire } from "module";
import { execSync } from "child_process";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) { pw = require(execSync("npm root -g").toString().trim() + "/playwright"); }
// MOTORE=webkit: le stesse suite con il motore di Safari (iPhone). Serve
// WebKit installato (npx playwright install webkit, più install-deps su Linux).
if (process.env.MOTORE) pw = { ...pw, chromium: pw[process.env.MOTORE] };

// Fissa l'orologio a mezzogiorno (12:00) nei contesti browser per impostazione predefinita.
// Tra mezzanotte e la sveglia per l'app è ancora «ieri» (giornoVero()), quindi
// i test eseguiti di notte avrebbero falsi negativi se usano la data/ora reale.
// I test che richiedono un orario specifico (es. setFixedTime / install) lo sovrascrivono.
if (pw && pw.chromium) {
  const browserType = pw.chromium;
  const origLaunch = browserType.launch.bind(browserType);
  browserType.launch = async function(options) {
    const browser = await origLaunch(options);
    const origNewContext = browser.newContext.bind(browser);
    browser.newContext = async function(ctxOptions) {
      const ctx = await origNewContext(ctxOptions);
      if (!process.env.NO_MOCK_CLOCK) {
        const mezzogiorno = new Date();
        mezzogiorno.setHours(12, 0, 0, 0);
        try { await ctx.clock.setFixedTime(mezzogiorno); } catch (_) {}
      }
      return ctx;
    };
    return browser;
  };
}

export default pw;

