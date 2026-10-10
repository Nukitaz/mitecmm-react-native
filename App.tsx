import React from "react";
import { Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ThemeProvider } from "./src/context/ThemeContext";

// Importa tus pantallas
import Index from "./src/pages/Index";
import Mapa from "./src/pages/Mapa";
import Edificio from "./src/pages/Edificio";
import Profesores from "./src/pages/Profesores";

const Stack = createNativeStackNavigator();

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

export default function App() {
  const updateTitle = (state: any) => {
    if (Platform.OS === "web" && state) {
      const route = state.routes[state.index];
      const title = ROUTE_TITLES[route.name] || "MiTecmm";
      document.title = title;
    }
  };

  return (
    <ThemeProvider>
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
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen 
            name="Index" 
            component={Index} 
            options={{ title: "MiTecmm" }}
          />
          <Stack.Screen 
            name="Mapa" 
            component={Mapa} 
            options={{ title: "MiTecmm · Mapa General" }}
          />
          <Stack.Screen 
            name="Edificio" 
            component={Edificio} 
            options={{ title: "MiTecmm · Planos por Edificio" }}
          />
          <Stack.Screen 
            name="Profesores" 
            component={Profesores} 
            options={{ title: "MiTecmm · Directorio Docente" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}