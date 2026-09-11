# deepseek-peak-hour-banner

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web-GUI plugin that keeps DeepSeek's **peak-hour** rates in sight, in two seats over one clock:

| State | Seat | Look |
| --- | --- | --- |
| Peak | `conversation.input.dock` — the context strip above the composer, next to Todo / Goal / Queue | Amber card: `⚡ HORA PICO · tarifas al doble · Termina en 1 h 12 min · 04:00 UTC / 01:00 local` |
| Off-peak | `conversation.composer.dock` — the composer footer, beside the shipped `StatsPills` row | Muted pill: `✓ Fuera de hora pico · próxima 22:00 local (en 1 h 12 min)` |

Only one seat renders at a time, and each flips on its own at the next UTC boundary: the card sits above the composer exactly while the provider bills peak rates, and the schedule waits quietly in the footer the rest of the time.

Both strings are plain literals in [`lib/client.js`](lib/client.js) and ship in Spanish; edit them to localize.

English | [Español](README.es.md)

## The schedule

Taken from the official pricing page ([api-docs.deepseek.com/quick_start/pricing](https://api-docs.deepseek.com/quick_start/pricing)): off-peak rates are half of peak rates, and **peak hours are 01:00–04:00 and 06:00–10:00 UTC, Monday through Friday**. Every other hour is off-peak.

Windows are always evaluated in UTC, because that is what the provider bills in. Local clock time is only displayed, never used for the decision.

The same page in Chinese states the rule on the Beijing clock — 北京时间周一至周五 9:00–12:00、14:00–18:00 — which describes the same instants (Beijing is UTC+8, with no daylight saving). The two wordings also agree on the weekday for these windows, since adding eight hours to a 01:00–10:00 UTC range never crosses midnight. [`test/rule.test.mjs`](test/rule.test.mjs) parses **both** sentences and checks that they, and the bundle, agree minute by minute across a full year.

If DeepSeek ever changes the schedule, edit `PEAK_WINDOWS_UTC` in [`lib/client.js`](lib/client.js) (offsets in minutes from UTC midnight), update the quoted rule in [`test/rule.test.mjs`](test/rule.test.mjs), and reinstall.

## Requirements

- DeepSeek Harness with the `web` profile (`dsh --profile web`).
- A profile with `patchReload: live` (the shipped `web` profile is).

## Install

The repository root **is** the plugin package, it declares itself a `dsh.bundle`, and its browser bundle is committed — so there is no build step and no build permission to grant.

```sh
git clone https://github.com/MateoBarbato/deepseek-peak-hour-banner.git
dsh plugin --profile web add ./deepseek-peak-hour-banner
```

`dsh plugin` forwards to pnpm in the profile directory, which links the checkout and appends the package to `dsh.profile.bundles`. The bundle patch ([`cordis.patch.yml`](cordis.patch.yml)) then inserts the plugin row, so nothing else is needed. Because the install is a link to your checkout, later edits to this repository are picked up on save — the host's client-HMR poll reloads the browser bundle within a second.

The same command accepts the other distribution forms, none of which need a build permission:

```sh
dsh plugin --profile web add @mateobarbato/dsh-client-ui-peak-hour        # registry
dsh plugin --profile web add ./deepseek-peak-hour-banner-1.0.0.tgz        # pnpm pack
dsh plugin --profile web add github:MateoBarbato/deepseek-peak-hour-banner
```

Verify the layer without booting, then restart the GUI (a bundle layer is composed at boot; only the profile patch hot-reloads):

```sh
dsh --profile web --dump-config   # shows a "# == @mateobarbato/dsh-client-ui-peak-hour" layer
```

## Uninstall

```sh
dsh plugin --profile web remove @mateobarbato/dsh-client-ui-peak-hour
```

## How it works

| File | Role |
| --- | --- |
| [`package.json`](package.json) | Declares `dsh.bundle` (the installable layer), `dsh.client.platform: web`, and the `./client` export that `dsh-client-modules` discovers. |
| [`cordis.patch.yml`](cordis.patch.yml) | The bundle layer: the `insert` row that mounts the plugin in a profile. |
| [`lib/index.js`](lib/index.js) | Host half: an empty `apply()`, present only so the row mounts in the host Loader tree. |
| [`lib/client.js`](lib/client.js) | Browser half: a classic script registering one lazy factory on `window.__ModuleLoader__`. |
| [`test/schedule.test.mjs`](test/schedule.test.mjs) | Schedule test: window edges, the Friday→Monday gap, and a minute-by-minute scan. |
| [`test/rule.test.mjs`](test/rule.test.mjs) | Rule conformance: both published wordings parsed and compared against the bundle minute by minute for a year. |
| [`test/render.test.mjs`](test/render.test.mjs) | Render test: both seats server-rendered with real React under a frozen clock, one per state. |

Four contracts make this a plugin rather than a fork:

- **Bundle side** — `package.json` declares `dsh.bundle.patch`, which answers "what does this package contribute?" with a patch layer. That is what makes `dsh plugin add` append the package to a profile's `dsh.profile.bundles` instead of installing it as an inert dependency.
- **Host side** — `package.json` declares `dsh.client` with `platform: "web"` and exports `./client`, so the client-modules host half serves the bundle at `/plugins/@mateobarbato/dsh-client-ui-peak-hour/client.js` and puts it in `window.__DSH_BOOT__`.
- **Browser side** — the bundle registers a factory (`factory(require) → exports`) whose exports are an ordinary Cordis plugin (`apply` + `inject`). `react` is a platform seed word, so no `dsh.client.external` entry is needed, and the factory body runs at materialization rather than at script load.
- **Seat geometry** — the card copies the shipped GoalBar dock box (side clearance plus four dock insets), so its max width resolves to `--dsh-chat-content-width` and it lines up with the composer card and the message action row instead of spanning the pane. The footer pill copies the `StatsPills` row instead: same column width, same centering, same `--dsw-alias-label-tertiary` colour and 13px scale, so it reads as one more stat rather than a second banner.

### Why the pill is not inside `StatsPills`

`StatsPills` renders a `root` element in `@deepseek-ai/dsh-client-ui-chat` and exposes no slot inside it, so a plugin cannot add a child to that row — `conversation.composer.dock` is the slot that row occupies. Occupying it puts the pill in the same footer area and block, right after the stats, which is why the seat copies that row's geometry rather than nesting in it.

## Development

```sh
npm install    # react + react-dom, used only by the render test
npm test       # rule conformance + schedule + both seats rendered in both states
```

The browser half has no build step: `lib/client.js` is committed as-is. A linked install picks edits up on save — the host's client-HMR poll reloads the browser bundle within a second, and a page reload is the fallback. Only a change to [`cordis.patch.yml`](cordis.patch.yml) needs a restart, because bundle layers are composed at boot.

## Publishing

The package is ready for `npm publish`: the name is scoped to its author, `files` ships `lib/`, the patch and the docs, and there is no build output to produce (or `pnpm pack` if you would rather hand out a tarball).

## Status

Verified on `dsh 0.1.5-rc.1` (web profile): the schedule logic and both seats are covered by the test suite, and the package composes into a profile's entry list as a bundle layer through the real Cordis patch engine. There is no end-to-end browser test.

## License

[MIT](LICENSE)
