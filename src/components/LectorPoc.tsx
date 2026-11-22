import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import Tesseract from 'tesseract.js';
import { UploadCloud, CheckCircle, AlertTriangle } from 'lucide-react-native';

export const LectorPoC = () => {
  const [status, setStatus] = useState<string>('Esperando imagen...');
  const [progress, setProgress] = useState<number>(0);
  const [resultText, setResultText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleImageUpload = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setResultText('');
    setStatus('Iniciando Web Worker...');
    setProgress(0);

    try {
      // Tesseract.recognize levanta un Web Worker en segundo plano automáticamente
      const { data: { text } } = await Tesseract.recognize(
        file,
        'spa', // Idioma español
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setStatus('Procesando OCR en segundo plano...');
              // m.progress va de 0 a 1
              setProgress(Math.round(m.progress * 100));
            } else {
              setStatus(m.status);
            }
          }
        }
      );

      setResultText(text);
      setStatus('¡Lectura completada!');
    } catch (error) {
      console.error(error);
      setStatus('Error al procesar la imagen.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.badgeText}>PRUEBA DE CONCEPTO: OCR</Text>
        <View style={styles.divider} />
        <Text style={styles.verTodosText}>TESSERACT.JS + WORKERS</Text>
      </View>

      <View style={styles.card}>
        {Platform.OS === 'web' ? (
          <div style={{ marginBottom: 20 }}>
            <input 
              type="file" 
              accept="image/png, image/jpeg" 
              onChange={handleImageUpload} 
              disabled={isProcessing}
              style={{ color: '#e4e4e7', fontFamily: 'monospace' }}
            />
          </div>
        ) : (
          <Text style={styles.errorText}>Esta prueba solo corre en la web.</Text>
        )}

        <View style={styles.progressSection}>
          <Text style={styles.statusText}>{status}</Text>
          
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.percentageText}>{progress}%</Text>
        </View>

        {isProcessing && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#a855f7" />
            <Text style={styles.loadingText}>Intenta hacer scroll o clics por aquí. ¡No debería trabarse!</Text>
          </View>
        )}

        {resultText ? (
          <View style={styles.resultBox}>
            <View style={styles.resultHeader}>
              <CheckCircle size={16} color="#10b981" />
              <Text style={styles.resultTitle}>RESULTADO CRUDO</Text>
            </View>
            <Text style={styles.resultText}>{resultText}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#c084fc',
    letterSpacing: 2,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.3)',
    marginHorizontal: 10,
  },
  verTodosText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#a855f7',
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 4,
    padding: 24,
  },
  errorText: {
    color: '#f43f5e',
    fontWeight: 'bold',
  },
  progressSection: {
    marginBottom: 20,
  },
  statusText: {
    color: '#a1a1aa',
    fontSize: 13,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#27272a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#a855f7',
  },
  percentageText: {
    color: '#e4e4e7',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
  },
  loadingText: {
    color: '#c084fc',
    fontSize: 12,
  },
  resultBox: {
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    paddingTop: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resultTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#10b981',
    fontWeight: 'bold',
    letterSpacing: 1.5,
    fontSize: 12,
  },
  resultText: {
    color: '#e4e4e7',
    fontSize: 13,
    lineHeight: 20,
  },
});