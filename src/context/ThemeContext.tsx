import React, { createContext, useContext, useState, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const STORAGE_KEY = "app_theme";

// Función auxiliar para obtener el tema inicial de forma síncrona en Web
const getInitialTheme = (): Theme => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (savedTheme === "light" || savedTheme === "dark") {
        // Aplicar el estilo al body de inmediato para evitar el parpadeo visual
        const isLight = savedTheme === "light";
        document.body.style.backgroundColor = isLight ? "#f8fafc" : "#08080a";
        document.body.style.color = isLight ? "#0f172a" : "#ffffff";
        return savedTheme;
      }
    } catch (error) {
      console.error("Error al acceder a localStorage:", error);
    }
  }
  return "dark"; // Valor por defecto
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  isDarkMode: true,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Inicialización síncrona para evitar el parpadeo en la Web
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Cargar tema guardado en plataformas móviles (AsyncStorage)
  useEffect(() => {
    if (Platform.OS !== "web") {
      const loadMobileTheme = async () => {
        try {
          const savedTheme = (await AsyncStorage.getItem(STORAGE_KEY)) as Theme | null;
          if (savedTheme === "light" || savedTheme === "dark") {
            setTheme(savedTheme);
          }
        } catch (error) {
          console.error("Error al cargar tema en móvil:", error);
        }
      };
      loadMobileTheme();
    }
  }, []);

  // Alternar tema y persistir el estado
  const toggleTheme = async () => {
    setTheme((prev) => {
      const nextTheme: Theme = prev === "dark" ? "light" : "dark";

      if (Platform.OS === "web" && typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      } else {
        AsyncStorage.setItem(STORAGE_KEY, nextTheme).catch((err) =>
          console.error("Error al guardar tema en móvil:", err)
        );
      }

      return nextTheme;
    });
  };

  // Mantener actualizados los estilos del body al cambiar de tema
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const root = document.getElementById("root") || document.body;
      if (theme === "light") {
        document.body.style.backgroundColor = "#f8fafc";
        root.style.backgroundColor = "#f8fafc";
        document.body.style.color = "#0f172a";
      } else {
        document.body.style.backgroundColor = "#08080a";
        root.style.backgroundColor = "#08080a";
        document.body.style.color = "#ffffff";
      }
    }
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDarkMode: theme === "dark",
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);