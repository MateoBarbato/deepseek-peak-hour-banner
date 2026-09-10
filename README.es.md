# deepseek-peak-hour-banner

Plugin del GUI web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) que muestra un cartel sobre el compositor mientras DeepSeek está facturando tarifas de **hora pico (PEAK)**.

La franja vive en el slot `conversation.input.dock` —la pila de contexto sobre el compositor, junto a Todo / Goal / Queue— y cambia de estado sola en el siguiente límite UTC.

| Estado | Aspecto | Texto |
| --- | --- | --- |
| Hora pico | Tarjeta ámbar con borde de aviso | `⚡ HORA PICO · tarifas al doble · Termina en 1 h 12 min · 04:00 UTC / 01:00 local` |
| Fuera de pico | Línea gris discreta | `✓ Fuera de hora pico · tarifa reducida · Próxima hora pico en 52 min · 01:00 UTC / 22:00 local` |

El texto viene en español; se define con los literales de `PeakHourDock` en [`lib/client.js`](lib/client.js).

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

Dos contratos hacen que esto sea un plugin y no un fork:

- **Lado host** — `package.json` declara `dsh.client` con `platform: "web"` y exporta `./client`, así que la mitad host de client-modules sirve el bundle en `/plugins/dsh-client-ui-peak-hour/client.js` y lo pone en `window.__DSH_BOOT__`.
- **Lado navegador** — el bundle registra una fábrica (`factory(require) → exports`) cuyos exports son un plugin Cordis normal (`apply` + `inject`). `react` es palabra semilla de la tabla de módulos, así que no hace falta `dsh.client.external`, y el cuerpo de la fábrica corre al materializarse, no al cargar el script.

## Desarrollo

```sh
node test/schedule.test.mjs   # lógica del horario
node --check lib/client.js    # sintaxis del bundle
```

Después de editar, volvé a copiar `package.json` y `lib/` al perfil (ver Instalación) y refrescá la página. Hay que reinstalar porque la copia del perfil es un directorio real, no un symlink.

## Estado

Verificado en `dsh 0.1.5-rc.1` (perfil web): la lógica del horario está cubierta por los tests, y el paquete resuelve y compone en la lista raíz del perfil a través del motor real de patches de Cordis. El render dentro del GUI no tiene test automático.

## Licencia

[MIT](LICENSE)
