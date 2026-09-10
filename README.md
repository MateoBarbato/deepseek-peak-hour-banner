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

If DeepSeek ever changes the schedule, edit `PEAK_WINDOWS_UTC` in [`lib/client.js`](lib/client.js) (offsets in minutes from UTC midnight) and reinstall.

## Requirements

- DeepSeek Harness with the `web` profile (`dsh --profile web`).
- A profile with `patchReload: live` (the shipped `web` profile is).

## Install

The repository root **is** the plugin package, and its browser bundle is committed — there is no build step.

```sh
git clone https://github.com/MateoBarbato/deepseek-peak-hour-banner.git
cd deepseek-peak-hour-banner

PKG="$HOME/.dsh/profiles/web/node_modules/dsh-client-ui-peak-hour"
mkdir -p "$PKG/lib"
cp package.json "$PKG/"
cp lib/index.js lib/client.js "$PKG/lib/"
```

Then mount the row in your profile patch (`~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: ui-peak-hour
      name: dsh-client-ui-peak-hour
```

Reload the GUI page. With `patchReload: live` the host recomposes the tree as soon as the YAML is valid; the browser still needs a refresh to receive the new row of the boot graph.

## Uninstall

1. Remove the `ui-peak-hour` row from `~/.dsh/profiles/web/cordis.patch.yml` (leave the file as `[]`).
2. `rm -rf ~/.dsh/profiles/web/node_modules/dsh-client-ui-peak-hour`
3. Reload the page.

## How it works

| File | Role |
| --- | --- |
| [`package.json`](package.json) | Declares `dsh.client.platform: web` and the `./client` export that `dsh-client-modules` discovers. |
| [`lib/index.js`](lib/index.js) | Host half: an empty `apply()`, present only so the row mounts in the host Loader tree. |
| [`lib/client.js`](lib/client.js) | Browser half: a classic script registering one lazy factory on `window.__ModuleLoader__`. |
| [`test/schedule.test.mjs`](test/schedule.test.mjs) | Schedule test: window edges, the Friday→Monday gap, and a minute-by-minute scan. |
| [`test/render.test.mjs`](test/render.test.mjs) | Render test: both seats server-rendered with real React under a frozen clock, one per state. |

Three contracts make this a plugin rather than a fork:

- **Host side** — `package.json` declares `dsh.client` with `platform: "web"` and exports `./client`, so the client-modules host half serves the bundle at `/plugins/dsh-client-ui-peak-hour/client.js` and puts it in `window.__DSH_BOOT__`.
- **Browser side** — the bundle registers a factory (`factory(require) → exports`) whose exports are an ordinary Cordis plugin (`apply` + `inject`). `react` is a platform seed word, so no `dsh.client.external` entry is needed, and the factory body runs at materialization rather than at script load.
- **Seat geometry** — the card copies the shipped GoalBar dock box (side clearance plus four dock insets), so its max width resolves to `--dsh-chat-content-width` and it lines up with the composer card and the message action row instead of spanning the pane. The footer pill copies the `StatsPills` row instead: same column width, same centering, same `--dsw-alias-label-tertiary` colour and 13px scale, so it reads as one more stat rather than a second banner.

### Why the pill is not inside `StatsPills`

`StatsPills` renders a `root` element in `@deepseek-ai/dsh-client-ui-chat` and exposes no slot inside it, so a plugin cannot add a child to that row — `conversation.composer.dock` is the slot that row occupies. Occupying it puts the pill in the same footer area and block, right after the stats, which is why the seat copies that row's geometry rather than nesting in it.

## Development

```sh
npm install    # react + react-dom, used only by the render test
npm test       # schedule logic + both seats rendered in both states
```

The browser half has no build step: `lib/client.js` is committed as-is. After editing it, re-copy `package.json` and `lib/` into the profile (see Install); the host's client-HMR poll picks the new bytes up within a second, and a page reload is the fallback.

## Status

Verified on `dsh 0.1.5-rc.1` (web profile): the schedule logic and both seats are covered by the test suite, and the package resolves and composes into the profile's root entry list through the real Cordis patch engine. There is no end-to-end browser test.

## License

[MIT](LICENSE)
