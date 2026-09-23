# Notturnisti

**The personal operating system for shift workers.**

Notturnisti turns your work schedule into a daily plan: when to sleep, when
to get light, when to have your last coffee, when to nap, when to eat. It is
built specifically for people whose schedule doesn't follow a normal day —
nurses, 118/112 operators, security staff, factory shift workers, truck
drivers, pilots — and for the Italian shift-work culture in particular.

[**Live app →** app.notturnisti.club](https://app.notturnisti.club) · [Blog & science →](https://notturnisti.club)

## What it does

You tell it your shift pattern (fixed, rotating, or a one-off shift), and it
runs that pattern through a circadian/sleep model to produce a concrete,
time-stamped plan for the day: sleep windows, nap windows, last-caffeine
cutoff, light exposure, meal timing, and a predicted alertness/drowsiness
curve. The plan updates as your shifts change, can be exported to your
calendar (ICS feed), and can be shared with a partner or colleague so you
can find the free time you actually have in common.

## Why it exists

Generic sleep and productivity apps assume a normal 9-to-5 day. Shift work
breaks every one of their assumptions — "go to bed early" is meaningless
advice when your shift starts at 21:00. Notturnisti exists to give shift
workers advice that actually matches their schedule, built by and for people
who live it.

## Science

The plan is generated from a circadian/sleep-pressure model, not a fixed
rulebook — it's a predictive estimate, not a biological measurement. Where a
recommendation is shown, it should be read as a model-based estimate
("predicted high drowsiness 04:10–05:20"), not as a precise physiological
readout. Background articles and sources are published on the
[blog](https://notturnisti.club).

## Privacy

Your shift schedule, sleep log and plan are computed and stored **on your
device**. Nothing is sent to a server unless you explicitly generate a
share/restore link — and that link's write key travels in the URL fragment
(`#…`), which browsers never send to a server, specifically so it can't leak
through server or proxy access logs. The backend only ever sees a
config id, a write key, and (for paid accounts) a hash of your email —
never your name, never your shift times in the clear, never your sleep data.

## Architecture

Static, dependency-free front end — no build step, no framework:

```
index.html        UI shell
engine.js          core scheduling / circadian engine
alertness.js       drowsiness/alertness model
history.js         sleep diary storage
notifications.js   local notifications (what to notify, when)
platform.js        web vs native app (Capacitor): notifications, calendar, widget
analytics.js       anonymous aggregate usage counters (opt-out in Options)
paid.js            account, checkout, restore-link flow
sw.js              service worker (offline, caching)
manifest.webmanifest  PWA manifest
functions/         Cloudflare Pages Functions (API):
  config/[id].js     read/write a saved plan (writeKey-gated)
  couple/[id].js     shared/partner view
  feed/[id].js       ICS calendar feed
  collect.js         anonymous usage counters (D1, per-day aggregates only)
  stats.js           private usage dashboard (/stats, token-gated)
  claim/[token].js   one-time license claim after checkout
  webhook-ls.js      Lemon Squeezy payment webhook (HMAC-verified)
  pending.js         pending-checkout bookkeeping
```

Deployed on Cloudflare Pages, packaged for Android as a Trusted Web
Activity (`club.notturnisti.twa`).

## Local-first

The app is fully usable offline once installed (PWA / TWA): your schedule,
diary and generated plans live in the browser, not in a database. The only
network calls are to the optional share/restore/couple endpoints, which you
trigger explicitly, and anonymous usage counters ("a plan was generated", no
identifiers, no schedule data — stored only as per-day totals, switchable off
in Options). See `docs/app-nativa.md` for the native-app plan.

## Roadmap

Active development follows a staged roadmap — instrumentation and test
coverage first, then a faster/simpler onboarding and a "what should I do
right now" home screen, then turning the existing sharing/pairing features
into a real growth loop, then content and SEO. See the project board /
pinned issues for the current sprint.

## Contributing

This repository is source-available (see [LICENSE](./LICENSE)): the code is
open for reading, review and learning, but is not open for reuse or
redistribution without permission. Bug reports and pull requests are welcome
via GitHub Issues/PRs; by submitting a PR you agree it may be merged and
distributed under the project's license.

## License

Source-available, all rights reserved — see [LICENSE](./LICENSE). Not
OSI-approved open source: you can read and study the code, but reuse,
redistribution or competing use requires permission.
