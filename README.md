# ALERTA CERCA (Capacitor)

Versión **Capacitor + React + Vite** de la app de alertas comunitarias por proximidad que
estaba en Expo (`../SistemaAlertas`). Conserva toda la lógica de negocio y el mismo backend
de Supabase (migraciones y Edge Functions incluidas en `supabase/`). Ver
`ALERTA CERCA — Especificación para adaptar la app.md` para el diseño funcional.

## Stack

- React 19 + TypeScript estricto + Vite, React Router (rutas en `src/navegacion/`)
- Capacitor 8 (Android incluido en `android/`; iOS se agrega en una Mac)
- TanStack Query + Zustand (sesión), Supabase JS
- `h3-js` v4 (misma versión que la Edge Function, sin parches)
- Google Maps vía `@capacitor/google-maps` (SDK nativo en Android/iOS); Leaflet + OpenStreetMap como respaldo si no hay clave

## Equivalencias Expo → Capacitor

| Antes (Expo) | Ahora (Capacitor) | Dónde |
| --- | --- | --- |
| Expo Router (`app/`) | React Router | `src/navegacion/`, `src/pantallas/` |
| `react-native` (View/Text/StyleSheet) | HTML + CSS | `src/estilos/global.css`, `src/ui/` |
| AsyncStorage | `@capacitor/preferences` | `src/lib/supabase.ts` |
| `expo-location` | `@capacitor/geolocation` | `src/hooks/use-ubicacion.ts` |
| `expo-task-manager` (segundo plano) | `@capacitor-community/background-geolocation` | `src/tasks/ubicacion-background-task.ts` |
| `expo-notifications` (token Expo) | `@capacitor/push-notifications` (token FCM) + `@capacitor/local-notifications` | `src/hooks/use-registro-push.ts` |
| `expo-image-picker` | `@capacitor/camera` (input de archivo en web) | `src/services/camara.ts` |
| `react-native-view-shot` + `expo-image-manipulator` | `<canvas>` (cajas negras, 1280 px, JPEG 0.7, sin EXIF) | `src/components/redactor-foto.tsx` |
| `react-native-maps` (Google) | `@capacitor/google-maps` (misma clave) | `src/components/mapa-google.tsx`, `src/pantallas/tabs/mapa.tsx` |
| `Alert.alert` / `Share.share` | `@capacitor/dialog` / `@capacitor/share` | `src/ui/dialogos.ts` |

De paso, la redacción de fotos y la ubicación en segundo plano ya no dependen de un
development build.

## Requisitos

- Node.js 22+ y npm 10+
- Android Studio reciente con JDK 21 y Android SDK 36
- Para iOS: una Mac con Xcode 16+
- Supabase CLI (`npx supabase`) para migraciones y Edge Functions

## Variables de entorno

Ya viene un `.env` con tus valores de Supabase (copiados del proyecto Expo). Plantilla en
`.env.example`:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_PUSH_HABILITADO` — déjalo en `false` hasta configurar Firebase (ver abajo).
- `VITE_GOOGLE_MAPS_API_KEY` — la misma clave de la versión Expo. `android/app/build.gradle`
  la lee del `.env` y la pone en el `AndroidManifest.xml` al compilar.

Las variables se incrustan al compilar: después de cambiarlas vuelve a correr `npm run build`.

## Instalación y ejecución

```bash
npm install
npm run dev            # en el navegador: http://localhost:5173
npm run android        # compila, sincroniza y abre Android Studio
npm run android:run    # compila e instala directo en un dispositivo/emulador
```

Cada vez que cambies código web, corre `npm run cap:sync` (o `npm run android`) para copiar la
versión nueva a la app nativa.

### iOS (en una Mac)

```bash
npx cap add ios
npm run ios
```

Luego agrega en `ios/App/App/Info.plist`: `NSLocationWhenInUseUsageDescription`,
`NSLocationAlwaysAndWhenInUseUsageDescription`, `NSCameraUsageDescription` y
`NSPhotoLibraryUsageDescription` (puedes reutilizar los textos de `app.config.ts` de la versión
Expo), y en *Signing & Capabilities* activa **Background Modes → Location updates** y **Push
Notifications**.

## Google Maps

- **Android/iOS:** usa el SDK nativo de Google Maps. En Google Cloud Console la clave necesita
  *Maps SDK for Android* habilitado (y *Maps SDK for iOS* si compilas para iPhone). Si la
  restringiste por app Android, agrega el SHA-1 del keystore con el que compilas (el de debug
  también, para probar).
- **Navegador (`npm run dev`):** usa *Maps JavaScript API*; habilítala y permite
  `http://localhost:5173/*` si la clave tiene restricción de referente.
- En Android el mapa nativo se dibuja debajo del WebView; por eso la pantalla de mapa vuelve
  transparente el fondo de la página mientras está abierta (clase `con-mapa-nativo` en
  `global.css`). Si ves un hueco en lugar del mapa, revisa que ningún contenedor nuevo tenga
  fondo.
- Sin `VITE_GOOGLE_MAPS_API_KEY`, la app usa Leaflet + OpenStreetMap automáticamente.

## Notificaciones push (Firebase Cloud Messaging)

La app Expo usaba el servicio de push de Expo. Capacitor usa tokens nativos de FCM, así que hay
que configurar Firebase una vez:

1. Crea un proyecto en <https://console.firebase.google.com> y agrega una app Android con el
   paquete `com.alfonso207.sistemaalertas`.
2. Descarga `google-services.json` y cópialo a `android/app/google-services.json`.
3. En `.env` pon `VITE_PUSH_HABILITADO=true` y vuelve a compilar.
   *(Sin el archivo de Firebase, `PushNotifications.register()` cierra la app en Android; por
   eso está detrás de esta bandera.)*
4. En Firebase → Configuración del proyecto → Cuentas de servicio, genera una clave privada
   (JSON) y guárdala como secreto de Supabase:

   ```bash
   npx supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat ruta/al/service-account.json)"
   npx supabase functions deploy motor-distribucion
   ```

`motor-distribucion` ahora usa `supabase/functions/_shared/push.ts`, que envía por FCM los
tokens nativos y sigue mandando por Expo los `ExponentPushToken[...]` que queden de la versión
anterior, así que ambas apps pueden convivir durante la migración.

Canales de Android que crea la app: `alertas-criticas` (importancia máxima, para verificadas de
severidad alta) y `alertas`.

## Ubicación en segundo plano

Se activa al terminar el onboarding o desde **Ajustes → Activar actualización de ubicación en
segundo plano**. En Android aparece una notificación fija mientras está activa (requisito del
sistema). Igual que antes, solo se envía la celda H3 y solo cuando cambia; en segundo plano se
usa el HTTP nativo de Capacitor para que Android no frene las peticiones.
`capacitor.config.ts` tiene `android.useLegacyBridge: true`, que el plugin necesita para no
detenerse tras 5 minutos.

## Base de datos y Edge Functions

Sin cambios respecto a la versión Expo (salvo el envío por FCM descrito arriba):

```bash
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
npx supabase functions deploy motor-distribucion
npx supabase functions deploy eliminar-cuenta
```

Para dar de alta a un moderador y conectar `pg_cron` con el motor, siguen aplicando las
instrucciones del README de la versión Expo (`private.configuracion` y
`update public.perfiles set rol = 'moderador' ...`).

## Íconos y splash

Los originales están en `resources/` y ya se generaron en `android/app/src/main/res`. Si los
cambias:

```bash
npx @capacitor/assets generate --assetPath resources
```

## Scripts de calidad

```bash
npm run typecheck
npm run test
npm run build
```

## Limitaciones conocidas

Las mismas del prototipo Expo (anillos por `pg_cron` cada minuto, sin detección automática de
rostros/placas, sin OTP por SMS, horario de silencio en UTC, sin *critical alerts* de Apple), más:

- El observador de ubicación en segundo plano se detiene si el sistema cierra la app; se
  reanuda al volver a abrirla.
- En iOS, `@capacitor/push-notifications` entrega un token de APNs, no de FCM. Para push en iOS
  con este backend hay que usar `@capacitor-firebase/messaging` o enviar por APNs.
