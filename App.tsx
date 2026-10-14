import React from "react";
import { Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";

// Fondo con textura de puntos
import { DottedBackground } from "./src/components/DottedBackground";

// Importa tus pantallas
import Index from "./src/pages/Index";
import Mapa from "./src/pages/Mapa";
import Edificio from "./src/pages/Edificio";
import Profesores from "./src/pages/Profesores";

const Stack = createNativeStackNavigator();

// Envoltorio para que cada pantalla conserve su propio lienzo de puntos
const withBackground = (Component: React.ComponentType<any>) => {
  return (props: any) => (
    <DottedBackground>
      <Component {...props} />
    </DottedBackground>
  );
};

const IndexScreen = withBackground(Index);
const MapaScreen = withBackground(Mapa);
const EdificioScreen = withBackground(Edificio);
const ProfesoresScreen = withBackground(Profesores);

const linking = {
  prefixes: ["http://localhost:8081", "http://localhost:8080", "tu-app://"],
  config: {
    screens: {
      Index: "",
      Mapa: "mapa",
      Edificio: "mapa/:id",
      Profesores: "profesores",
    },
  },
};

const ROUTE_TITLES: Record<string, string> = {
  Index: "MiTecmm",
  Mapa: "MiTecmm · Mapa General",
  Edificio: "MiTecmm · Planos por Edificio",
  Profesores: "MiTecmm · Directorio Docente",
};

function AppNavigator() {
  const { isDarkMode } = useTheme();

  const updateTitle = (state: any) => {
    if (Platform.OS === "web" && state) {
      const route = state.routes[state.index];
      const title = ROUTE_TITLES[route.name] || "MiTecmm";
      document.title = title;
    }
  };

  return (
    <NavigationContainer
      linking={linking}
      onReady={() => {
        if (Platform.OS === "web") {
          document.title = "MiTecmm";
        }
      }}
      onStateChange={(state) => updateTitle(state)}
    >
      <Stack.Navigator
        initialRouteName="Index"
        screenOptions={{
          headerShown: false,
          // "none" suprime el cross-fade traslúcido y los saltos entre pestañas
          animation: "none",
          // Color de respaldo idéntico al tema para evitar parpadeos grises del sistema
          contentStyle: {
            backgroundColor: isDarkMode ? "#08080a" : "#f8fafc",
          },
        }}
      >
        <Stack.Screen
          name="Index"
          component={IndexScreen}
          options={{ title: "MiTecmm" }}
        />
        <Stack.Screen
          name="Mapa"
          component={MapaScreen}
          options={{ title: "MiTecmm · Mapa General" }}
        />
        <Stack.Screen
          name="Edificio"
          component={EdificioScreen}
          options={{ title: "MiTecmm · Planos por Edificio" }}
        />
        <Stack.Screen
          name="Profesores"
          component={ProfesoresScreen}
          options={{ title: "MiTecmm · Directorio Docente" }}
        />
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