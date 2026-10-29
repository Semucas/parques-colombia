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

1. Entra a <https://console.firebase.google.com> y crea un proyecto (puedes desactivar Google Analytics).
2. En *Configuración del proyecto > Tus apps* agrega una app **Web** (`</>`) y copia el objeto `firebaseConfig`.
3. Pégalo en `www/js/firebase-config.js` (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`).
4. En *Compilación > Realtime Database* pulsa **Crear base de datos**, elige la región más cercana y en la pestaña **Reglas** pega el contenido de `database.rules.json` (sirve para el trabajo; para producción conviene restringir el acceso con Firebase Auth) y publica.
5. Prueba con dos celulares (o dos pestañas): uno entra a *Jugar online > Crear sala* y comparte el código de 4 letras; el otro entra con *Unirme*. El anfitrión pulsa *Empezar partida*; los puestos libres los juegan bots que mueve el anfitrión.

### Probar el modo online sin Firebase

Abre `http://localhost:5173/index.html?mock` en **dos pestañas** del mismo navegador: usan una base de datos simulada (`www/js/firebase-mock.js`) que imita Firebase, así se puede probar toda la lógica online (salas, asientos, turnos, bots) sin cuenta ni internet. En la app normal ese archivo no hace nada.

## Reglas implementadas

- De 1 a 4 fichas por jugador (se elige al empezar) y **dos dados**. Cada dado se juega por separado con una ficha, y hay que usar los dos.
- **De la cárcel se sale con un par** (los dos dados iguales), a la casilla SALIDA: con **1-1 o 6-6 salen todas** las fichas de la cárcel y con cualquier otro par (2-2, 3-3, 4-4, 5-5) salen **2**. Si no hay fichas en juego, el jugador tiene **hasta 3 intentos** por turno para sacar un par. Con un par y fichas en el tablero se puede sacar de la cárcel (tocando una ficha de la cárcel) o mover con los dados.
- Cada jugador tiene su pasillo y su FIN en el brazo pegado a su cárcel: Caribe (amarillo, abajo-izquierda) la izquierda, Pacífico (azul, arriba-izquierda) arriba, Andina (rojo, arriba-derecha) la derecha y Amazonía (verde, abajo-derecha) abajo.
- La SALIDA está en la 5.ª casilla del brazo, en el lado de su cárcel; los SEGUROS laterales, en el lado contrario. Las fichas avanzan en **sentido contrario a las manecillas del reloj** y entran a su pasillo por la punta de su brazo.
- **El turno se repite solo si salen dos dados iguales (par).** Capturar o llegar a la meta no lo repiten.
- **Tres pares seguidos:** el jugador saca del juego una ficha, como si hubiera llegado a la casilla FIN, y pasa el turno.
- Si caes en una casilla de otro jugador que no sea SEGURO (punta del brazo, SALIDA o el SEGURO lateral), **lo mandas a la cárcel**.
- Para entrar a la meta se necesita la tirada exacta.
- Empieza el jugador y el **turno pasa hacia la derecha** (en el sentido de las manecillas del reloj): por ejemplo, desde arriba a la izquierda sigue arriba a la derecha, luego abajo a la derecha y luego abajo a la izquierda.
- Offline: botón ⏸️ para pausar (la partida también se pausa sola si sales de la app).

## Pendiente

- Wireframes en papel y Figma en escala de grises (pantallas: Splash, Home, Perfil, Niveles, Lobby, Juego, Puntajes, Créditos).
- Subir commits propios con frecuencia (criterio "participación en repositorio").
- Justificación del uso de IA: poder explicar `engine.js` (reglas), `app.js` (turnos) y `online.js` (salas).

## Perfil

El jugador escoge su tipo de colombiano (costeño, paisa, rolo, caleño, llanero, santandereano, boyacense, pastuso, chocoano o amazónico); su emoji es su personaje en el tablero y sale en el Home y en la sala online.

## Créditos técnicos

- Música del inicio: "Atlas • Colombia" de Vadim_Makes_Sound, vía Pixabay (Licencia de contenido de Pixabay). El archivo está en `www/assets/audio/musica.mp3`.
- Música de la partida (más urbana): `www/assets/audio/musica-juego.mp3`; si no existe, suena un beat de reggaetón generado por código (composición propia).
- Ilustraciones (paisaje, sombrero vueltiao, grano de café, patrón de mochila y las 10 escenas de las regiones en `www/assets/img/tipos`): vectores originales del proyecto, sin material de terceros.
- Uso de IA: se usó Claude como apoyo para generar la base del código; Sebastián Muñoz lo revisó, lo entiende y lo adaptó.
