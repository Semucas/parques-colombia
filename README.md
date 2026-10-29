# Parqués Parce 🎲🇨🇴

Parqués colombiano para 4 jugadores. Se puede jugar **offline** (contra bots, 3 niveles) u **online** con otros jugadores (Firebase).
Proyecto final de Aplicaciones Móviles – Entrega #4.

## Cómo cumple el enunciado

| Requisito | Dónde |
|---|---|
| 5 secciones (Splash, Home, Juego, Puntaje, Créditos) | `www/index.html` (+ selección de nivel y lobby online) |
| Mínimo 3 niveles / tiempo / vidas | 3 niveles de bots + temporizador por turno (`LEVELS` en `app.js`) |
| UI personalizada | `www/css/style.css` (colores y regiones de Colombia) |
| Persistencia entre vistas | `www/js/store.js` (localStorage: nombre, región, niveles desbloqueados, puntajes) |
| Animaciones y sonidos | CSS (rebote, dado, confeti, sacudida) y `www/js/audio.js` (WebAudio) |
| Easter eggs | 7 toques al logo (fiesta vallenata) · 5 toques al ☕ en Créditos · nombre "Juan Valdez" · tres 6 seguidos |
| Bonus multijugador Firebase | `www/js/online.js` |

## Probarlo en el computador

```bash
npm install
npm start        # abre http://localhost:5173 (usa vista móvil en el navegador)
npm test         # pruebas del motor (600 partidas simuladas + reglas)
```

## Generar el APK y publicar en Google Play

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android      # abre Android Studio
```

En Android Studio: *Build > Generate Signed Bundle / APK > Android App Bundle (.aab)*. Guarda el keystore en un lugar seguro (no lo subas al repo).
Sube el `.aab` en Google Play Console (cuenta de desarrollador, ficha de tienda, capturas, política de privacidad y clasificación de contenido).
Ícono y splash nativo: `npm i -D @capacitor/assets` y `npx capacitor-assets generate` con `assets/icon.png` (1024×1024).

## Configurar el modo online (Firebase)

1. Crea un proyecto en <https://console.firebase.google.com> y agrega una app **Web**.
2. Activa **Realtime Database** y pega la configuración en `www/js/firebase-config.js`.
3. Reglas para desarrollo (ajústalas antes de publicar):
   ```json
   { "rules": { "rooms": { ".read": true, ".write": true } } }
   ```
4. Uno crea la sala y comparte el código de 4 letras; los demás se unen. Los puestos libres los juegan bots que mueve el anfitrión.

## Reglas implementadas

- De 1 a 4 fichas por jugador (se elige al empezar) y **dos dados**. Cada dado se juega por separado con una ficha, y hay que usar los dos.
- **Con un 5** en un dado sale una ficha de la cárcel, a su casilla SALIDA.
- **El turno se repite solo si salen dos dados iguales (par).** Capturar o llegar a la meta no lo repiten.
- **Tres pares seguidos:** el jugador saca del juego una ficha, como si hubiera llegado a la LLEGADA, y pasa el turno.
- Si caes en una casilla de otro jugador que no sea SEGURO (punta del brazo, SALIDA o el SEGURO lateral), **lo mandas a la cárcel**.
- Para entrar a la meta se necesita la tirada exacta.
- Offline: botón ⏸️ para pausar (la partida también se pausa sola si sales de la app).

## Pendiente del equipo

- Poner los nombres reales del equipo en `index.html` (Créditos) y agregar las fotos en `www/assets/img`.
- Wireframes en papel y Figma en escala de grises (pantallas: Splash, Home, Niveles, Lobby, Juego, Puntajes, Créditos).
- Cada integrante debe hacer commits propios (criterio "participación en repositorio").
- Justificación del uso de IA: cada integrante debe poder explicar `engine.js` (reglas), `app.js` (turnos) y `online.js` (salas).
