# 🗺️ MiTecmm - Sistema de Navegación del Tecnológico de Jalisco

Sistema de navegación interactivo y directorio docente para el Instituto Tecnológico de Jalisco. Proyecto desarrollado con React Native, Expo, Supabase y soporte para despliegue web y móvil (Android APK).

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado el siguiente software en la computadora de desarrollo:

- **Node.js** (Versión 22.18 o superior; recomendado 24 LTS): [Descargar Node.js](https://nodejs.org/)
- **Git**: [Descargar Git](https://git-scm.com/)
- **Java Development Kit (JDK 17)** (Requerido solo para compilaciones locales de Android): [Descargar JDK 17](https://www.oracle.com/java/technologies/downloads/#java17)
- **Android Studio** (Opcional, necesario para emuladores y compilación local con Gradle): [Descargar Android Studio](https://developer.android.com/studio)

---

## 🚀 Instalación y Configuración desde Cero

Sigue estos pasos para clonar e instalar el proyecto en una nueva computadora:

### 1. Clonar el Repositorio
```bash
git clone [https://github.com/tu-usuario/mitecmm-react-native.git](https://github.com/tu-usuario/mitecmm-react-native.git)
cd mitecmm-react-native
```
### 2. Instalar Dependiencias
```bash
npm install
```

### Configurar Variables de Entorno

```bash
EXPO_PUBLIC_SUPABASE_URL=[https://tu-proyecto.supabase.co](https://tu-proyecto.supabase.co)
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
```

### Ejecucion en Desarrollo web
```bash
npx expo start --web
```

### Entorno Movil (Expo Go)
```bash
npx expo start
```

---

## ✅ Pruebas

```bash
npm test            # pruebas unitarias (≈1 s): validación, sanitizador SVG, etiquetas, servicios
npm run test:e2e    # pruebas en Chrome (≈10 min): seguridad, mapa 3D, errores, motor móvil
npm run typecheck   # TypeScript
npm run lint        # ESLint (configuración de Expo)
```

- Las pruebas usan una **copia fija de los planos reales** (`test/fixtures/planos`). Si se actualiza un plano en Supabase, cópialo ahí para que las pruebas lo cubran.
- `test:e2e` compila el sitio con un **Supabase ficticio**: no consulta ni modifica la base real. Necesita Google Chrome instalado (o la variable `CHROME_PATH`).
- Opciones: `npm run test:e2e -- --sin-compilar` reutiliza el último build; `npm run test:e2e -- mapa3d` ejecuta solo `test/e2e/mapa3d.test.cjs`.

## 🧭 Mapa 3D: planos y modo quiosco

**Reglas de los planos SVG (Inkscape):**
- Cada espacio es un `<rect>` con ID en minúsculas, dígitos y `_` (p. ej. `aula_a5`, `laboratorio_de_redes_lr`). Los servicios (`sanitario_`, `escalera_`, `bodega_`…) pueden ser `path` o grupos.
- Para poder **ver ambas plantas apiladas**, agrega en *cada* plano del edificio un rectángulo con ID `contorno_edificio` que cubra el contorno exterior, en la misma posición física en las dos plantas (puede estar oculto). Sin él, el botón no aparece.
  - Los 12 planos de `test/fixtures/planos` ya lo traen (hijo directo del `<svg>`, con `display:none`). Se calculó alineando los muros de ambas plantas (escala y desplazamiento); en el edificio L la planta alta está dibujada con otra proporción horizontal. Esos archivos son los que se suben al bucket `Maps` de Supabase Storage.
  - Si se vuelve a dibujar un plano, hay que recalcular el rectángulo de *las dos* plantas de ese edificio.
- El motor 3D se genera desde `src/components/mapa3d/runtime/`; después de editar esos archivos ejecuta `npm run vendor`.

**Modo quiosco** (pantallas fijas en el campus):

```
/mapa/a?kiosco=1&aqui=entrada_principal&inactividad=90
```

| Parámetro | Efecto |
|---|---|
| `kiosco=1` | Activa el modo quiosco |
| `aqui` | ID del elemento del plano donde se muestra "Usted está aquí" |
| `inactividad` | Segundos sin uso para volver a la vista inicial (15–600, por defecto 90) |

### Generar APK Android desde la nube

En windows/linux/mac:
```bash
npm install -g eas-cli
eas login
```
### iniciar la compilacion en los servidores
```bash
eas build -p android --profile preview
```

### Generar APK desde Local (Expo Prebuild + Gradle) en Windows

Generar la carpeta nativa de Android:
```bash
npx expo prebuild --platform android
```
modificar archivo grandle.properties al siguiente:
```bash
# Project-wide Gradle settings.

# IDE (e.g. Android Studio) users:
# Gradle settings configured through the IDE *will override*
# any settings specified in this file.

# For more details on how to configure your build environment visit
# http://www.gradle.org/docs/current/userguide/build_environment.html

# Specifies the JVM arguments used for the daemon process.
# Ajuste de memoria para evitar OutOfMemoryError: Metaspace en Windows
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8

# When configured, Gradle will run in incubating parallel mode.
# This option should only be used with decoupled projects. More details, visit
# http://www.gradle.org/docs/current/userguide/multi_project_builds.html#sec:decoupled_projects
org.gradle.parallel=true

# AndroidX package structure to make it clearer which packages are bundled with the
# Android operating system, and which are packaged with your app's APK
# https://developer.android.com/topic/libraries/support-library/androidx-rn
android.useAndroidX=true

# Enable AAPT2 PNG crunching
android.enablePngCrunchInReleaseBuilds=true

# Solo compilar para arquitecturas ARM reales (celulares) y x86_64 para emuladores modernos
reactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64

# Use this property to enable support to the new architecture.
# This will allow you to use TurboModules and the Fabric render in
# your application. You should enable this flag either if you want
# to write custom TurboModules/Fabric components OR use libraries that
# are providing them.
newArchEnabled=true

# Use this property to enable or disable the Hermes JS engine.
# If set to false, you will be using JSC instead.
hermesEnabled=true

# Use this property to enable edge-to-edge display support.
# This allows your app to draw behind system bars for an immersive UI.
# Note: Only works with ReactActivity and should not be used with custom Activity.
edgeToEdgeEnabled=true

# Enable GIF support in React Native images (~200 B increase)
expo.gif.enabled=true
# Enable webp support in React Native images (~85 KB increase)
expo.webp.enabled=true
# Enable animated webp support (~3.4 MB increase)
# Disabled by default because iOS doesn't support animated webp
expo.webp.animated=false

# Enable network inspector
EX_DEV_CLIENT_NETWORK_INSPECTOR=true

# Use legacy packaging to compress native libraries in the resulting APK.
expo.useLegacyPackaging=false

expo.inlineModules.watchedDirectories=[]
```

Compilar el APK de Release localmente
```bash
.\gradlew.bat assembleRelease
```
Al finalizar, encontrarás tu archivo .apk generado en la ruta:
android\app\build\outputs\apk\release\app-release.apk

