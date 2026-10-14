# 🗺️ MiTecmm - Sistema de Navegación del Tecnológico de Jalisco

Sistema de navegación interactivo y directorio docente para el Instituto Tecnológico de Jalisco. Proyecto desarrollado con React Native, Expo, Supabase y soporte para despliegue web y móvil (Android APK).

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado el siguiente software en la computadora de desarrollo:

- **Node.js** (Versión 18.x o superior): [Descargar Node.js](https://nodejs.org/)
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

