import React, { createContext, useContext, useState, useEffect } from "react";
import { Platform } from "react-native";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  isDarkMode: true,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>("dark");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Efecto que cambia el estilo del body y la app en la Web
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