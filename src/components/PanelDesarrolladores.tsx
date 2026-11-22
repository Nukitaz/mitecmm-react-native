import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface PanelDesarrolladoresProps {
  onClose?: () => void;
}

const DESARROLLADORES = [
  'Osmar De la cruz Sanchez',
  'Emiliano De la rosa',
  'Kevin Nuño',
];

export function PanelDesarrolladores({ onClose }: PanelDesarrolladoresProps) {
  const { isDarkMode } = useTheme();

  return (
    <View
      style={[
        styles.panel,
        isDarkMode ? styles.panelDark : styles.panelLight,
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, isDarkMode ? styles.textDark : styles.textLight]}>
          Desarrolladores
        </Text>
        <Text style={[styles.subtitle, isDarkMode ? styles.subtitleDark : styles.subtitleLight]}>
          [ SYS_ADMINS · CORE_TEAM ]
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.bannerWrapper}>
          <Image
            source={{ uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQaea3pSeOnSZOFtegvjmVkcGLtNTl9Kz2opQe9wtm4qq4lNV59BtY-OCA&s=10' }}
            resizeMode="contain"
            style={styles.banner}
          />
        </View>

        <View
          style={[
            styles.teamCard,
            isDarkMode ? styles.teamCardDark : styles.teamCardLight,
          ]}
        >
          {DESARROLLADORES.map((nombre) => (
            <Text
              key={nombre}
              style={[styles.member, isDarkMode ? styles.textDark : styles.textLight]}
            >
              {`> ${nombre}`}
            </Text>
          ))}
        </View>

        <Text style={[styles.campus, isDarkMode ? styles.campusDark : styles.campusLight]}>
          TecMM Campus Zapopan
        </Text>
      </View>

      {onClose && (
        <View
          style={[
            styles.footer,
            isDarkMode ? styles.footerDark : styles.footerLight,
          ]}
        >
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeText}>CERRAR</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  panelDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  panelLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  textDark: {
    color: '#f4f4f5',
  },
  textLight: {
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  subtitleDark: {
    color: '#71717a',
  },
  subtitleLight: {
    color: '#64748b',
  },
  content: {
    paddingHorizontal: 20,
  },
  bannerWrapper: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#27272a',
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  teamCard: {
    marginTop: 16,
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
  },
  teamCardDark: {
    backgroundColor: '#202024',
    borderColor: '#303036',
  },
  teamCardLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  member: {
    fontSize: 14,
    fontWeight: '800',
  },
  campus: {
    marginVertical: 18,
    textAlign: 'center',
    fontSize: 12,
  },
  campusDark: {
    color: '#71717a',
  },
  campusLight: {
    color: '#94a3b8',
  },
  footer: {
    minHeight: 52,
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 20,
  },
  footerDark: {
    borderTopColor: '#27272a',
  },
  footerLight: {
    borderTopColor: '#e2e8f0',
  },
  closeText: {
    color: '#7c3aed',
    fontSize: 13,
    fontWeight: '800',
  },
});