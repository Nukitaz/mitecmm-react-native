import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../integrations/supabase/client'; // Verifica tu ruta

export default function SetPassword() {
  const navigation = useNavigation<any>(); // Usamos el hook en lugar de props
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Función universal para alertas (Web y Móvil)
  const mostrarAlerta = (mensaje: string) => {
    if (Platform.OS === 'web') {
      window.alert(mensaje);
    } else {
      alert(mensaje);
    }
  };

  const handleGuardarContrasena = async () => {
    if (password.length < 6) {
      mostrarAlerta('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      mostrarAlerta('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      // 1. Verificamos que Supabase haya capturado el token del correo
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        mostrarAlerta('No hay una sesión activa. Por favor, vuelve a abrir el enlace de tu correo.');
        setLoading(false);
        return;
      }

      // 2. Guardamos la contraseña en la base de datos
      const { error } = await supabase.auth.updateUser({ password: password });

      if (error) {
        mostrarAlerta('Error al guardar: ' + error.message);
      } else {
        mostrarAlerta('¡Contraseña configurada exitosamente!');
        // 3. Redirigimos al panel de administración de forma segura
        navigation.replace('AdminAuth'); 
      }
    } catch (err) {
      mostrarAlerta('Error inesperado de conexión.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.titulo}>Configura tu acceso</Text>
        <Text style={styles.subtitulo}>Ingresa una nueva contraseña para tu cuenta de administrador TecMM.</Text>

        <TextInput
          style={styles.input}
          placeholder="Nueva contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Confirmar contraseña"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity 
          style={styles.boton} 
          onPress={handleGuardarContrasena}
          disabled={loading}
        >
          <Text style={styles.textoBoton}>
            {loading ? 'Guardando...' : 'Guardar y Entrar'}
          </Text>
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
    padding: 30,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#4A148C', 
  },
  subtitulo: {
    fontSize: 14,
    marginBottom: 30,
    textAlign: 'center',
    color: '#666',
  },
  input: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#333',
  },
  boton: {
    backgroundColor: '#7b2cbf',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  textoBoton: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});