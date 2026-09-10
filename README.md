# deepseek-peak-hour-banner

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web-GUI plugin that shows a banner above the composer while DeepSeek is billing **peak-hour** rates.

The strip lives in the `conversation.input.dock` slot — the context stack above the composer, next to Todo / Goal / Queue — and flips state on its own at the next UTC boundary.

| State | Look | Text |
| --- | --- | --- |
| Peak | Amber card with a warning border | `⚡ HORA PICO · tarifas al doble · Termina en 1 h 12 min · 04:00 UTC / 01:00 local` |
| Off-peak | Muted grey line | `✓ Fuera de hora pico · tarifa reducida · Próxima hora pico en 52 min · 01:00 UTC / 22:00 local` |

The strip text ships in Spanish. It is set by the string literals in `PeakHourDock` in [`lib/client.js`](lib/client.js) — edit them to localize.

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

Two contracts make this a plugin rather than a fork:

- **Host side** — `package.json` declares `dsh.client` with `platform: "web"` and exports `./client`, so the client-modules host half serves the bundle at `/plugins/dsh-client-ui-peak-hour/client.js` and puts it in `window.__DSH_BOOT__`.
- **Browser side** — the bundle registers a factory (`factory(require) → exports`) whose exports are an ordinary Cordis plugin (`apply` + `inject`). `react` is a platform seed word, so no `dsh.client.external` entry is needed, and the factory body runs at materialization rather than at script load.
- **Dock geometry** — the strip copies the shipped GoalBar dock box (side clearance plus four dock insets), so its max width resolves to `--dsh-chat-content-width` and it lines up with the composer card and the message action row instead of spanning the pane. That geometry lives in the `DOCK_BOX` constant; the surface, border and type scale come from `--dsw-specific-tip`, `--dsw-alias-border-l1` and the dock label scale.

## Development

```sh
node test/schedule.test.mjs   # schedule logic
node --check lib/client.js    # bundle syntax
```

After editing, re-copy `package.json` and `lib/` into the profile (see Install) and reload the page. Reinstalling is required because the installed copy is a real directory, not a symlink.

## Status

Verified on `dsh 0.1.5-rc.1` (web profile): the schedule logic is covered by the test suite, and the package resolves and composes into the profile's root entry list through the real Cordis patch engine. Rendering inside the GUI has no automated test.

## License

[MIT](LICENSE)
