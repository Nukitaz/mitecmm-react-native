import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function AccesoDenegado() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  // Recibimos el mensaje por parámetros, o mostramos uno por defecto
  const mensaje = route.params?.mensaje || "No tienes los permisos necesarios para acceder a esta sección.";
  const titulo = route.params?.titulo || "Acceso Denegado";

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Ícono de advertencia simple (puedes cambiarlo por un icono real si usas expo-icons) */}
        <Text style={styles.icono}>🔒</Text>
        
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.subtitulo}>{mensaje}</Text>

        <TouchableOpacity 
          style={styles.boton} 
          onPress={() => navigation.replace('Index')} // Regresa al login principal
        >
          <Text style={styles.textoBoton}>Volver al Inicio</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'transparent', 
  },
  card: {
    width: '100%',
    maxWidth: 400, 
    backgroundColor: '#ffffff',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  icono: {
    fontSize: 50,
    marginBottom: 15,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#d32f2f', // Rojo para indicar error/bloqueo
  },
  subtitulo: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
  },
  boton: {
    backgroundColor: '#7b2cbf', // Morado principal TecMM
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  textoBoton: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});