# deepseek-peak-hour-banner

Plugin del GUI web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) que mantiene a la vista las tarifas de **hora pico (PEAK)** de DeepSeek, en dos asientos sobre un mismo reloj:

| Estado | Asiento | Aspecto |
| --- | --- | --- |
| Hora pico | `conversation.input.dock` — la franja de contexto sobre el compositor, junto a Todo / Goal / Queue | Tarjeta ámbar: `⚡ HORA PICO · tarifas al doble · Termina en 1 h 12 min · 04:00 UTC / 01:00 local` |
| Fuera de pico | `conversation.composer.dock` — el pie del compositor, al lado de la fila `StatsPills` que ya trae el harness | Pastilla discreta: `✓ Fuera de hora pico · próxima 22:00 local (en 1 h 12 min)` |

Nunca se renderizan los dos a la vez, y cada uno cambia de estado solo en el siguiente límite UTC: la tarjeta aparece sobre el compositor exactamente mientras el proveedor cobra tarifa pico, y el resto del tiempo el horario espera discreto en el pie.

Los textos son literales en [`lib/client.js`](lib/client.js) y vienen en español.

[English](README.md) | Español

## De dónde sale el horario

De la página oficial de precios ([api-docs.deepseek.com/quick_start/pricing](https://api-docs.deepseek.com/quick_start/pricing)): el precio off-peak es la mitad del de peak, y **las horas pico son 01:00–04:00 y 06:00–10:00 UTC, de lunes a viernes**; todo lo demás es off-peak.

Las franjas se evalúan siempre en UTC, porque es lo que factura el proveedor; la hora local solo se muestra, nunca decide.

Si DeepSeek cambia el horario, se edita `PEAK_WINDOWS_UTC` en [`lib/client.js`](lib/client.js) (minutos desde medianoche UTC) y se reinstala.

## Requisitos

- DeepSeek Harness con el perfil `web` (`dsh --profile web`).
- Un perfil con `patchReload: live` (el perfil `web` que se distribuye lo es).

## Instalación

La raíz del repositorio **es** el paquete, y su bundle de navegador va commiteado: no hay paso de build.

```sh
git clone https://github.com/MateoBarbato/deepseek-peak-hour-banner.git
cd deepseek-peak-hour-banner

PKG="$HOME/.dsh/profiles/web/node_modules/dsh-client-ui-peak-hour"
mkdir -p "$PKG/lib"
cp package.json "$PKG/"
cp lib/index.js lib/client.js "$PKG/lib/"
```

Después se monta la fila en el patch del perfil (`~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: ui-peak-hour
      name: dsh-client-ui-peak-hour
```

Refrescá la página del GUI. Con `patchReload: live` el host recompone el árbol apenas el YAML es válido; el navegador igual necesita el refresco para recibir la nueva fila del grafo de arranque.

## Desinstalar

1. Quitar la fila `ui-peak-hour` de `~/.dsh/profiles/web/cordis.patch.yml` (dejar el archivo en `[]`).
2. `rm -rf ~/.dsh/profiles/web/node_modules/dsh-client-ui-peak-hour`
3. Refrescar la página.

## Cómo funciona

| Archivo | Rol |
| --- | --- |
| [`package.json`](package.json) | Declara `dsh.client.platform: web` y el export `./client` que descubre `dsh-client-modules`. |
| [`lib/index.js`](lib/index.js) | Mitad host: `apply()` vacío, solo para que la fila monte en el Loader. |
| [`lib/client.js`](lib/client.js) | Mitad navegador: script clásico que registra una fábrica perezosa en `window.__ModuleLoader__`. |
| [`test/schedule.test.mjs`](test/schedule.test.mjs) | Prueba del horario: bordes de franja, hueco viernes→lunes y escaneo minuto a minuto. |
| [`test/render.test.mjs`](test/render.test.mjs) | Prueba de render: los dos asientos renderizados con React real y reloj congelado, uno por estado. |

Tres contratos hacen que esto sea un plugin y no un fork:

- **Lado host** — `package.json` declara `dsh.client` con `platform: "web"` y exporta `./client`, así que la mitad host de client-modules sirve el bundle en `/plugins/dsh-client-ui-peak-hour/client.js` y lo pone en `window.__DSH_BOOT__`.
- **Lado navegador** — el bundle registra una fábrica (`factory(require) → exports`) cuyos exports son un plugin Cordis normal (`apply` + `inject`). `react` es palabra semilla de la tabla de módulos, así que no hace falta `dsh.client.external`, y el cuerpo de la fábrica corre al materializarse, no al cargar el script.
- **Geometría de cada asiento** — la tarjeta copia la caja del dock del GoalBar que viene con el harness (side clearance más cuatro dock insets), así que su ancho máximo resuelve a `--dsh-chat-content-width` y queda alineada con la tarjeta del compositor y la fila de acciones del mensaje, en vez de ocupar todo el panel. La pastilla del pie copia en cambio la fila de `StatsPills`: mismo ancho de columna, mismo centrado, mismo `--dsw-alias-label-tertiary` y misma escala de 13px, así que se lee como un stat más y no como un segundo cartel.

### Por qué la pastilla no está dentro de `StatsPills`

`StatsPills` renderiza su elemento `root` dentro de `@deepseek-ai/dsh-client-ui-chat` y no expone ningún slot adentro, así que un plugin no puede agregarle un hijo a esa fila: el slot que esa fila ocupa es `conversation.composer.dock`. Ocuparlo pone la pastilla en la misma zona y el mismo bloque del pie, justo después de los stats; por eso el asiento copia la geometría de esa fila en lugar de anidarse en ella.

## Desarrollo

```sh
npm install    # react + react-dom, solo para la prueba de render
npm test       # lógica del horario + los dos asientos renderizados en ambos estados
```

La mitad navegador no tiene build: `lib/client.js` va commiteado tal cual. Después de editarlo, volvé a copiar `package.json` y `lib/` al perfil (ver Instalación); el poll de client-HMR del host toma los bytes nuevos en menos de un segundo, y recargar la página es el plan B.

## Estado

Verificado en `dsh 0.1.5-rc.1` (perfil web): la lógica del horario y los dos asientos están cubiertos por los tests, y el paquete resuelve y compone en la lista raíz del perfil a través del motor real de patches de Cordis. No hay test end-to-end en navegador.

## Licencia

[MIT](LICENSE)
