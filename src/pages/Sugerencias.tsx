import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Linking, 
  Platform,
  Alert 
} from "react-native";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";
import { Send } from "lucide-react-native";

export default function Sugerencias() {
  const { isDarkMode } = useTheme();
  const [mensaje, setMensaje] = useState("");

  const enviarCorreo = async () => {
    if (!mensaje.trim()) {
     if (Platform.OS === "web") {
        window.alert("Por favor escribe una sugerencia antes de enviar.");
      } else {
        Alert.alert("Campo vacío", "Por favor escribe una sugerencia antes de enviar.");
      }
      return;
    }

    const email = "mitecmm@gmail.com";
    const subject = encodeURIComponent("Sugerencia/Reporte desde App MiTecmm");
    const body = encodeURIComponent(mensaje);

   if (Platform.OS === "web") {
      // Fuerza abrir la interfaz web de Gmail en una nueva pestaña
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
      setMensaje("");
    } else {
      // En móviles, usa el protocolo nativo para abrir la app instalada (Gmail, Apple Mail, etc.)
      const url = `mailto:${email}?subject=${subject}&body=${body}`;
      try {
        await Linking.openURL(url);
        setMensaje("");
      } catch (error) {
        Alert.alert("Error", "No se encontró una aplicación de correo instalada.");
      }
    }
  };

  return (
    <View style={[styles.container, !isDarkMode && styles.containerLight]}>
      <Navbar />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, !isDarkMode && styles.titleLight]}>
            Buzón de Sugerencias
          </Text>
          <Text style={[styles.subtitle, !isDarkMode && styles.subtitleLight]}>
            ¿Encontraste un error, un aula incorrecta o tienes una idea para mejorar MiTecmm? Escríbenos, leemos todos los correos.
          </Text>
        </View>

        <View style={styles.formContainer}>
          <TextInput
            style={[
              styles.textArea, 
              !isDarkMode && styles.textAreaLight,
              { color: isDarkMode ? "#f8fafc" : "#0f172a" }
            ]}
            placeholder="Escribe tu sugerencia aquí..."
            placeholderTextColor={isDarkMode ? "#64748b" : "#94a3b8"}
            multiline={true}
            numberOfLines={8}
            textAlignVertical="top"
            value={mensaje}
            onChangeText={setMensaje}
          />

          <TouchableOpacity 
            style={styles.submitBtn} 
            activeOpacity={0.8} 
            onPress={enviarCorreo}
          >
            <Send size={18} color="#ffffff" />
            <Text style={styles.submitBtnText}>Abrir correo y enviar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08080a",
  },
  containerLight: {
    backgroundColor: "#f8fafc",
  },
  content: {
    flex: 1,
    padding: 24,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    marginBottom: 32,
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  titleLight: {
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 15,
    color: "#94a3b8",
    lineHeight: 22,
  },
  subtitleLight: {
    color: "#64748b",
  },
  formContainer: {
    gap: 16,
  },
  textArea: {
    backgroundColor: "#121217",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    padding: 16,
    minHeight: 160,
    fontSize: 15,
    lineHeight: 22,
  },
  textAreaLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  submitBtn: {
    backgroundColor: "#a855f7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
});