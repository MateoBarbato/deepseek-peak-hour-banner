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

La misma página en chino enuncia la regla en **hora de Beijing** — 北京时间周一至周五 9:00–12:00、14:00–18:00 — que son los mismos instantes (Beijing es UTC+8, sin horario de verano). Las dos redacciones también coinciden en el día de la semana para estas franjas, porque sumarle ocho horas a un rango de 01:00–10:00 UTC nunca cruza la medianoche. [`test/rule.test.mjs`](test/rule.test.mjs) parsea **las dos** frases y verifica que coincidan entre sí y con el bundle, minuto a minuto durante un año.

Si DeepSeek cambia el horario, se edita `PEAK_WINDOWS_UTC` en [`lib/client.js`](lib/client.js) (minutos desde medianoche UTC), se actualiza la regla citada en [`test/rule.test.mjs`](test/rule.test.mjs) y se reinstala.

## Requisitos

- DeepSeek Harness con el perfil `web` (`dsh --profile web`).
- Un perfil con `patchReload: live` (el perfil `web` que se distribuye lo es).

## Instalación

La raíz del repositorio **es** el paquete, se declara a sí mismo como `dsh.bundle` y su bundle de navegador va commiteado: no hay paso de build ni permiso de build que otorgar.

```sh
git clone https://github.com/MateoBarbato/deepseek-peak-hour-banner.git
dsh plugin --profile web add ./deepseek-peak-hour-banner
```

`dsh plugin` reenvía a pnpm dentro del directorio del perfil, que linkea el checkout y agrega el paquete a `dsh.profile.bundles`. El patch del bundle ([`cordis.patch.yml`](cordis.patch.yml)) inserta después la fila del plugin, así que no hace falta nada más. Como la instalación es un link a tu checkout, las ediciones posteriores del repositorio se toman al guardar: el poll de client-HMR del host recarga el bundle del navegador en menos de un segundo.

El mismo comando acepta las otras formas de distribución, ninguna de las cuales pide permiso de build:

```sh
dsh plugin --profile web add @mateobarbato/dsh-client-ui-peak-hour        # registry
dsh plugin --profile web add ./deepseek-peak-hour-banner-1.0.0.tgz        # pnpm pack
dsh plugin --profile web add github:MateoBarbato/deepseek-peak-hour-banner
```

Verificá la capa sin arrancar y después reiniciá el GUI (una capa de bundle se compone al arrancar; solo el patch del perfil recarga en caliente):

```sh
dsh --profile web --dump-config   # muestra una capa "# == @mateobarbato/dsh-client-ui-peak-hour"
```

## Desinstalar

```sh
dsh plugin --profile web remove @mateobarbato/dsh-client-ui-peak-hour
```

## Cómo funciona

| Archivo | Rol |
| --- | --- |
| [`package.json`](package.json) | Declara `dsh.bundle` (la capa instalable), `dsh.client.platform: web` y el export `./client` que descubre `dsh-client-modules`. |
| [`cordis.patch.yml`](cordis.patch.yml) | La capa del bundle: la fila `insert` que monta el plugin en un perfil. |
| [`lib/index.js`](lib/index.js) | Mitad host: `apply()` vacío, solo para que la fila monte en el Loader. |
| [`lib/client.js`](lib/client.js) | Mitad navegador: script clásico que registra una fábrica perezosa en `window.__ModuleLoader__`. |
| [`test/schedule.test.mjs`](test/schedule.test.mjs) | Prueba del horario: bordes de franja, hueco viernes→lunes y escaneo minuto a minuto. |
| [`test/rule.test.mjs`](test/rule.test.mjs) | Conformidad con la regla: las dos redacciones oficiales parseadas y comparadas contra el bundle minuto a minuto durante un año. |
| [`test/render.test.mjs`](test/render.test.mjs) | Prueba de render: los dos asientos renderizados con React real y reloj congelado, uno por estado. |

Cuatro contratos hacen que esto sea un plugin y no un fork:

- **Lado bundle** — `package.json` declara `dsh.bundle.patch`, que responde "¿qué aporta este paquete?" con una capa de patch. Eso es lo que hace que `dsh plugin add` agregue el paquete a `dsh.profile.bundles` en lugar de instalarlo como una dependencia inerte.
- **Lado host** — `package.json` declara `dsh.client` con `platform: "web"` y exporta `./client`, así que la mitad host de client-modules sirve el bundle en `/plugins/@mateobarbato/dsh-client-ui-peak-hour/client.js` y lo pone en `window.__DSH_BOOT__`.
- **Lado navegador** — el bundle registra una fábrica (`factory(require) → exports`) cuyos exports son un plugin Cordis normal (`apply` + `inject`). `react` es palabra semilla de la tabla de módulos, así que no hace falta `dsh.client.external`, y el cuerpo de la fábrica corre al materializarse, no al cargar el script.
- **Geometría de cada asiento** — la tarjeta copia la caja del dock del GoalBar que viene con el harness (side clearance más cuatro dock insets), así que su ancho máximo resuelve a `--dsh-chat-content-width` y queda alineada con la tarjeta del compositor y la fila de acciones del mensaje, en vez de ocupar todo el panel. La pastilla del pie copia en cambio la fila de `StatsPills`: mismo ancho de columna, mismo centrado, mismo `--dsw-alias-label-tertiary` y misma escala de 13px, así que se lee como un stat más y no como un segundo cartel.

### Por qué la pastilla no está dentro de `StatsPills`

`StatsPills` renderiza su elemento `root` dentro de `@deepseek-ai/dsh-client-ui-chat` y no expone ningún slot adentro, así que un plugin no puede agregarle un hijo a esa fila: el slot que esa fila ocupa es `conversation.composer.dock`. Ocuparlo pone la pastilla en la misma zona y el mismo bloque del pie, justo después de los stats; por eso el asiento copia la geometría de esa fila en lugar de anidarse en ella.

## Desarrollo

```sh
npm install    # react + react-dom, solo para la prueba de render
npm test       # conformidad con la regla + horario + los dos asientos en ambos estados
```

La mitad navegador no tiene build: `lib/client.js` va commiteado tal cual. Con una instalación linkeada las ediciones se toman al guardar: el poll de client-HMR del host recarga el bundle del navegador en menos de un segundo, y recargar la página es el plan B. Solo un cambio en [`cordis.patch.yml`](cordis.patch.yml) necesita reinicio, porque las capas de bundle se componen al arrancar.

## Publicación

El paquete está listo para `npm publish`: el nombre está scopeado a su autor, `files` incluye `lib/`, el patch y la documentación, y no hay salida de build que generar (o `pnpm pack` si preferís repartir un tarball).

## Estado

Verificado en `dsh 0.1.5-rc.1` (perfil web): la lógica del horario y los dos asientos están cubiertos por los tests, y el paquete compone en la lista de entradas de un perfil como capa de bundle a través del motor real de patches de Cordis. No hay test end-to-end en navegador.

## Licencia

[MIT](LICENSE)
