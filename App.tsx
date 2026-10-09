import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Importa tus pantallas
import Index from "./src/pages/Index";
import Mapa from "./src/pages/Mapa";
import Edificio from "./src/pages/Edificio";
import Profesores from "./src/pages/Profesores";

const Stack = createNativeStackNavigator();

// 1. Define el mapa de rutas (Sincroniza la URL con las pantallas)
const linking = {
  prefixes: ["http://localhost:8081", "http://localhost:8080", "tu-app://"],
  config: {
    screens: {
      Index: "",              // Ruta base: /
      Mapa: "mapa",           // Ruta: /mapa
      Edificio: "mapa/:id",   // Ruta dinámica: /mapa/p
      Profesores: "profesores", // Ruta: /profesores
    },
  },
};

export default function App() {
  return (
    // 2. Agrega la propiedad linking al contenedor
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Index"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Index" component={Index} />
        <Stack.Screen name="Mapa" component={Mapa} />
        <Stack.Screen name="Edificio" component={Edificio} />
        <Stack.Screen name="Profesores" component={Profesores} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
