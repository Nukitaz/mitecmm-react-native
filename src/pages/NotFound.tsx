import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const NotFoundScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.errorCode}>404</Text>
        <Text style={styles.errorTitle}>Oops! Page not found</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Index')}
        >
          <Text style={styles.buttonText}>Return to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  errorCode: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#18181b',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    color: '#71717a',
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#0ea5e9',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default NotFoundScreen;
