import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Navbar from '../components/Navbar'; // Ajusta la ruta si es necesario

export default function Desarrolladores() {
  return (
    <View style={styles.container}>
      {/* La barra de navegación se coloca en la parte superior */}
      <Navbar />
      
      {/* El contenido de la pantalla va debajo */}
      <View style={styles.content}>
        <Text style={styles.text}>Pantalla de Desarrolladores</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});