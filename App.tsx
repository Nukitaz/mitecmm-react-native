import React, { useEffect } from "react";
import { Platform } from "react-native";
import { NavigationContainer, LinkingOptions, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";

// Fondo con textura de puntos
import { DottedBackground } from "./src/components/DottedBackground";

// COMPONENTE DE PRUEBA DE OCR (Asegúrate de que el archivo en tu carpeta sea LectorPoc.tsx)
//import { LectorPoC } from './src/components/LectorPoc';

// IMPORTA TU CLIENTE DE SUPABASE (Verifica que la ruta sea correcta según tu proyecto)
import { supabase } from './src/integrations/supabase/client';
// Importa tus pantallas
import Index from "./src/pages/Index";
import Mapa from "./src/pages/Mapa";
import Edificio from "./src/pages/Edificio";
import Profesores from "./src/pages/Profesores";
import AdminsA from "./src/pages/AdminsA";
import Desarrolladores from "./src/pages/Desarrolladores";
import Sugerencias from "./src/pages/Sugerencias";
import SetPassword from "./src/pages/SetPassword";
import AccesoDenegado from "./src/pages/AccesoDenegado"; 

const Stack = createNativeStackNavigator();

// Envoltorio para que cada pantalla conserve su propio lienzo de puntos
const withBackground = (Component: React.ComponentType<any>) => {
  const ConFondo = (props: any) => (
    <DottedBackground>
      <Component {...props} />
    </DottedBackground>
  );
  ConFondo.displayName = `ConFondo(${Component.displayName || Component.name || "Pantalla"})`;
  return ConFondo;
};

const IndexScreen = withBackground(Index);
const MapaScreen = withBackground(Mapa);
const EdificioScreen = withBackground(Edificio);
const ProfesoresScreen = withBackground(Profesores);
const AdminsAScreen = withBackground(AdminsA);
const DesarrolladoresScreen = withBackground(Desarrolladores);
const SugerenciasScreen = withBackground(Sugerencias);
const SetPasswordScreen = withBackground(SetPassword);
const AccesoDenegadoScreen = withBackground(AccesoDenegado); 

const linking: LinkingOptions<any> = {
  prefixes: [
    "https://nukitaz.github.io/mitecmm-react-native",
    "http://localhost:8081",
    "http://localhost:8080",
    "tu-app://",
  ],
  config: {
    initialRouteName: "Index",
    screens: {
      Index: "",
      Mapa: "mapa",
      Edificio: "mapa/:id",
      Profesores: "profesores",
      AdminAuth: "admin",
      Desarrolladores: "desarrolladores",
      Sugerencias: "sugerencias",
      SetPassword: "set-password",
      AccesoDenegado: "acceso-denegado", 
    },
  },
};

const ROUTE_TITLES: Record<string, string> = {
  Index: "MiTecmm",
  Mapa: "MiTecmm · Mapa General",
  Edificio: "MiTecmm · Planos por Edificio",
  Profesores: "MiTecmm · Directorio Docente",
  AdminAuth: "MiTecmm · Administración",
  Desarrolladores: "MiTecmm · Desarrolladores",
  Sugerencias: "MiTecmm · Sugerencias",
};

function AppNavigator() {
  const { isDarkMode } = useTheme();
  const navigationRef = useNavigationContainerRef<any>();

  // Intercepta el evento de recuperación de contraseña
  useEffect(() => {

  const hash = Platform.OS === 'web' ? window.location.hash : '';

    // 1. Detector de enlaces caducados
    if (hash.includes('error_description=')) {
      window.history.replaceState(null, '', window.location.pathname);
      if (navigationRef.isReady()) {
        navigationRef.navigate("AccesoDenegado", {
          titulo: "Enlace Caducado",
          mensaje: "Este enlace ya fue utilizado o ha expirado."
        });
      }
      return; 
    }

    // 2. INTERCEPTOR ESTRICTO DE CONTRASEÑA
    if (hash.includes('type=recovery')) {
      if (navigationRef.isReady()) {
        navigationRef.navigate("SetPassword");
      }
      return; 
    }
    
    // 3. Listener de Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange((event: any, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (navigationRef.isReady()) {
          navigationRef.navigate("SetPassword");
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const updateTitle = (state: any) => {
    // Código comentado original
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
    >
      <Stack.Navigator
        initialRouteName="Index"
        screenOptions={{
          headerShown: false,
          animation: "none",
          contentStyle: {
            backgroundColor: isDarkMode ? "#08080a" : "#f8fafc",
          },
        }}
      >
        <Stack.Screen name="Index" component={IndexScreen} options={{title: "Mitecmm"}} />
        <Stack.Screen name="Mapa" component={MapaScreen} />
        <Stack.Screen name="Edificio" component={EdificioScreen} />
        <Stack.Screen name="Profesores" component={ProfesoresScreen} />
        <Stack.Screen name="AdminAuth" component={AdminsAScreen} options={{title: "Administración"}} />
        <Stack.Screen name="Desarrolladores" component={DesarrolladoresScreen} />
        <Stack.Screen name="Sugerencias" component={SugerenciasScreen} options={{title: "Panel de Sugerencias"}} />
        <Stack.Screen name="SetPassword" component={SetPasswordScreen} options={{title: "Establecer Contraseña"}} /> 
        <Stack.Screen name="AccesoDenegado" component={AccesoDenegadoScreen} options={{title: "Acceso Denegado"}} /> 
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}