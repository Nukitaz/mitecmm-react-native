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
### Configurar eas.json

```bash
{
  "cli": {
    "version": ">= 24.12.1",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### iniciar la compilacion en los servidores
```bash
eas build -p android --profile preview
```

