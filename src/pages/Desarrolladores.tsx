import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Navbar from '../components/Navbar';
import { PanelDesarrolladores } from '../components/PanelDesarrolladores';
import { useTheme } from '../context/ThemeContext';

export default function Desarrolladores() {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useTheme();

  return (
    <View style={[styles.container, isDarkMode ? styles.containerDark : styles.containerLight]}>
      <Navbar />
      <View style={styles.content}>
        <PanelDesarrolladores onClose={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerDark: {
    backgroundColor: '#08080a',
  },
  containerLight: {
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 20,
  },
});