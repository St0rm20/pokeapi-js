# Pokédex móvil

Port para celular del diseño "Pokédex móvil"; está hecho solamente con HTML, CSS y JavaScript sin librerías. Los datos se consultan en tiempo real a [PokeAPI](https://pokeapi.co); no existe ningún dato de Pokémon escrito a mano dentro del código.

## Funciones

- **Cajas con carga progresiva**: se cargan 30 Pokémon por caja; al acercarse al final del desplazamiento se pide la caja siguiente a `pokemon-species`.
- **Panel del seleccionado**: un toque selecciona al Pokémon y muestra sus tipos; un segundo toque (o el botón "VER DETALLE") abre su ficha.
- **Búsqueda**: se acepta nombre parcial (`char`) o número (`25`, `#25`). El índice completo se descarga una sola vez; luego el filtrado ocurre en el teléfono.
- **Detalle**: muestra la ilustración oficial, la categoría, la altura, el peso, la descripción en español, las habilidades (indicando la oculta) y las estadísticas base.
- **Sin conexión**: cada respuesta se guarda en `localStorage`; un *service worker* (programa que el navegador ejecuta en segundo plano para interceptar peticiones) guarda también los sprites y la app. Sin internet aparece el aviso "Mostrando datos guardados".
- **Error de red**: si una caja no se puede cargar se muestra la tarjeta "ERROR DE RED" con el botón "REINTENTAR".
- **Instalable**: incluye un `manifest.webmanifest`; desde el navegador del celular se puede usar "Agregar a la pantalla de inicio".

## Cómo abrirla en el celular

El *service worker* solo funciona cuando la página se sirve por `http(s)`; por eso se recomienda publicarla con GitHub Pages (Settings → Pages → rama del proyecto, carpeta raíz). También se puede probar en la misma red local con:

```bash
python3 -m http.server 8080
```

Después se abre `http://IP-DEL-COMPUTADOR:8080` desde el navegador del celular.

## Estructura

```
index.html            vistas principal y de detalle
css/styles.css        estilos del diseño retro
js/data.js            colores y nombres en español de tipos y estadísticas
js/api.js             acceso a PokeAPI con caché local
js/app.js             lógica de la interfaz (cajas, búsqueda, detalle, rutas)
sw.js                 service worker para el modo sin conexión
manifest.webmanifest  datos para instalar la app
```
