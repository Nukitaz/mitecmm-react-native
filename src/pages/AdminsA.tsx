import React, { useState, useEffect } from "react";
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, Modal, ActivityIndicator, Alert, Platform 
} from "react-native";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";
import { MapPin, Calendar, Plus, X, Eye, EyeOff, User, Shield, Check, Book } from "lucide-react-native";
import { avisosService } from "../services/avisosService";
import { supabase } from "../integrations/supabase/client";

export default function AdminsA() {
  const { isDarkMode } = useTheme();
  
  // Estados de Autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false); 
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("admin");
  
  // Formulario de inicio de sesión
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Estado de Pestañas dinámico
  const [activeTab, setActiveTab] = useState("AVISOS");
  const tabs = userRole === "superadmin" 
    ? ["CARRERAS", "DOCENTES", "AVISOS", "HORARIOS", "ADMINS"] 
    : ["DOCENTES", "AVISOS", "HORARIOS"];

  // Estados de Base de Datos
  const [avisos, setAvisos] = useState<any[]>([]);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [carreras, setCarreras] = useState<any[]>([]);
  const [cargandoCarreras, setCargandoCarreras] = useState(false);

  // Estados del Modal CRUD (Multiuso)
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Campos Modal Avisos
  const [categoria, setCategoria] = useState("Evento");
  const [showCategorias, setShowCategorias] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const categoriasOptions = ["Evento", "Urgente", "Trámite", "General"];

  // Campos Modal Admins
  const [nuevoAdminEmail, setNuevoAdminEmail] = useState("");
  const [nuevoAdminRol, setNuevoAdminRol] = useState<"admin" | "superadmin">("admin");

  // Campos Modal Carreras
  const [nombreCarrera, setNombreCarrera] = useState("");
  const [siglasCarrera, setSiglasCarrera] = useState("");

  // 1. Verificar sesión activa
  useEffect(() => {
    checkUserSession();
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        validarAdministrador(session.user.email);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setUserEmail(null);
        setUserRole("admin");
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const checkUserSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      validarAdministrador(session.user.email);
    }
  };

  // Cargar datos según la pestaña activa
  useEffect(() => {
    if (activeTab === "CARRERAS" && userRole === "superadmin") {
      fetchCarreras();
    }
  }, [activeTab]);

  // Autenticación Manual
  const handleEmailLogin = async () => {
    if (!email || !password) return alert("Por favor ingresa tu correo y contraseña.");
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
      if (error) alert("Credenciales incorrectas. Verifica tu correo y contraseña.");
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Link Mágico (Recuperar/Establecer password)
  const handleRecuperarPassword = async () => {
    if (!email) return alert("Ingresa tu correo en el campo superior para enviarte el enlace.");
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Platform.OS === 'web' ? window.location.origin + '/admin' : undefined
      });
      if (error) throw error;
      alert("Si el correo está autorizado, hemos enviado un enlace para gestionar tu contraseña.");
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Autenticación Google
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: Platform.OS === 'web' ? window.location.origin + '/admin' : undefined }
      });
      if (error) throw error;
    } catch (error) {
      alert("Error al intentar iniciar sesión con Google.");
      setIsLoading(false);
    }
  };

  // Validar y Obtener ROL
  const validarAdministrador = async (emailToValidate: string | undefined) => {
    if (!emailToValidate) return;
    setIsLoading(true);
    try {
      const { data: adminAuth, error } = await supabase.from('administradores').select('*').eq('email', emailToValidate.trim()).single();
      if (error || !adminAuth) {
        alert("Acceso denegado: Tu correo no tiene permisos de administrador.");
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        return;
      }
      setUserEmail(emailToValidate);
      setUserRole(adminAuth.rol || "admin");
      setIsAuthenticated(true);
      fetchAvisos();
      if (adminAuth.rol === "superadmin") fetchAdmins();
    } catch (error) {
      alert("Ocurrió un error al validar tus permisos.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => await supabase.auth.signOut();

  // Cargar Datos
  const fetchAvisos = async () => {
    setIsLoading(true);
    try {
      setAvisos(await avisosService.getAvisos());
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdmins = async () => {
    if (userRole !== "superadmin") return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('administradores').select('*');
      if (data) setAdminsList(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCarreras = async () => {
    try {
      setCargandoCarreras(true);
      const { data, error } = await supabase
        .from('carreras')
        .select('*')
        .order('nombre');

      if (error) {
        console.error('Error al obtener carreras:', error);
        return;
      }
      
      setCarreras(data || []);
    } catch (error) {
      console.error('Error inesperado:', error);
    } finally {
      setCargandoCarreras(false);
    }
  };

  // Modal (Abrir Nuevo)
  const abrirModalNuevo = () => {
    setEditingId(null);
    if (activeTab === "AVISOS") {
      setCategoria("Evento"); setTitulo(""); setFecha(""); setDescripcion("");
    } else if (activeTab === "ADMINS") {
      setNuevoAdminEmail(""); setNuevoAdminRol("admin");
    } else if (activeTab === "CARRERAS") {
      setNombreCarrera(""); setSiglasCarrera("");
    }
    setModalVisible(true);
  };

  // Modal (Abrir Editar)
  const abrirModalEditar = (item: any) => {
    setEditingId(item.id); 
    if (activeTab === "AVISOS") {
      setCategoria(item.categoria); setTitulo(item.titulo); setFecha(item.fecha); setDescripcion(item.descripcion);
    } else if (activeTab === "CARRERAS") {
      setNombreCarrera(item.nombre); setSiglasCarrera(item.siglas);
    }
    setModalVisible(true);
  };

  // Guardar Datos (Crear o Actualizar)
  const handleGuardar = async () => {
    setIsLoading(true);
    try {
      if (activeTab === "AVISOS") {
        if (!titulo || !fecha || !descripcion) { alert("Completa todos los campos."); setIsLoading(false); return; }
        const payload = { categoria, titulo, fecha, descripcion };
        if (editingId) await avisosService.updateAviso(editingId, payload);
        else await avisosService.createAviso(payload);
        fetchAvisos();
     } else if (activeTab === "CARRERAS") {
        if (!nombreCarrera || !siglasCarrera) { 
          alert("Completa todos los campos."); 
          setIsLoading(false); 
          return; 
        }
        
        const payload = { nombre: nombreCarrera, siglas: siglasCarrera.toUpperCase() };
        
        if (editingId) {
          const { error } = await supabase.from('carreras').update(payload).eq('id', editingId);
          if (error) throw error; // <-- Atrapa el error y lo lanza
        } else {
          const { error } = await supabase.from('carreras').insert([payload]);
          if (error) throw error; // <-- Atrapa el error y lo lanza
        }
        
        fetchCarreras();
      } else if (activeTab === "ADMINS") {
        if (!nuevoAdminEmail.includes("@")) { alert("Ingresa un correo válido."); setIsLoading(false); return; }
        
        const emailLimpio = nuevoAdminEmail.trim();
        const { error: dbError } = await supabase.from('administradores').insert([{ email: emailLimpio, rol: nuevoAdminRol }]);
        if (dbError) throw dbError;

        await supabase.auth.signUp({ email: emailLimpio, password: Math.random().toString(36).slice(-10) + 'A1!' });
        await supabase.auth.resetPasswordForEmail(emailLimpio, {
          redirectTo: Platform.OS === 'web' ? window.location.origin + '/admin' : undefined
        });

        alert(`¡Invitación enviada! El usuario ha sido registrado como ${nuevoAdminRol.toUpperCase()}.`);
        fetchAdmins();
      }
      setModalVisible(false);
    } catch (error: any) {
      alert("Error: " + (error.message || JSON.stringify(error)));
    } finally {
      setIsLoading(false);
    }
  };

  // Eliminar Datos
  const handleEliminar = async (id: string, tipo: 'aviso' | 'admin' | 'carrera') => {
    const nombreElemento = tipo === 'carrera' ? 'esta carrera' : `este ${tipo}`;
    const confirmar = Platform.OS === 'web' 
      ? window.confirm(`¿Estás seguro de eliminar ${nombreElemento}?`) 
      : await new Promise(resolve => Alert.alert("Eliminar", `¿Estás seguro?`, [{ text: "Cancelar", onPress: () => resolve(false) }, { text: "Eliminar", onPress: () => resolve(true) }]));

    if (confirmar) {
      setIsLoading(true);
      try {
        if (tipo === 'aviso') {
          await avisosService.deleteAviso(id); fetchAvisos();
        } else if (tipo === 'carrera') {
          const { error } = await supabase.from('carreras').delete().eq('id', id);
          if (error) throw error;
          fetchCarreras();
        } else {
          const { error } = await supabase.from('administradores').delete().eq('email', id);
          if (error) throw error;
          fetchAdmins();
        }
      } catch (error) {
        console.error(error);
        alert("Ocurrió un error al eliminar.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // --- RENDERIZADO DEL PANEL ---
  if (isAuthenticated) {
    return (
      <View style={[styles.container, !isDarkMode && styles.containerLight]}>
        <Navbar />
        <View style={styles.dashboardContent}>
          
          <View style={styles.header}>
            <Text style={[styles.title, !isDarkMode && styles.titleLight]}>Panel de Control</Text>
            <View style={styles.locationContainer}>
              <MapPin size={14} color="#ef4444" />
              <Text style={[styles.locationText, !isDarkMode && styles.locationTextLight]}>TecMM Campus Zapopan</Text>
            </View>
            <View style={styles.userHeaderInfo}>
              <Text style={[styles.userEmailText, !isDarkMode && styles.userEmailTextLight]}>
                {userEmail} <Text style={{ color: '#64748b' }}>({userRole.toUpperCase()})</Text>
              </Text>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtnSmall}>
                <Text style={styles.logoutTextSmall}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.tabContainer, !isDarkMode && styles.tabContainerLight]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
              {tabs.map((tab) => (
                <TouchableOpacity 
                  key={tab} onPress={() => { setActiveTab(tab); if(tab === 'ADMINS' && userRole === 'superadmin') fetchAdmins(); }}
                  style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
            
            {/* VISTA CARRERAS */}
            {activeTab === "CARRERAS" && userRole === "superadmin" && (
              cargandoCarreras ? (
                <ActivityIndicator size="large" color="#a855f7" style={{ marginTop: 40 }} />
              ) : carreras.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.subtitle, !isDarkMode && styles.subtitleLight]}>No hay carreras registradas.</Text>
                </View>
              ) : (
                carreras.map((carrera) => (
                  <View key={carrera.id} style={[styles.card, !isDarkMode && styles.cardLight]}>
                    <View style={[styles.cardAccent, { backgroundColor: isDarkMode ? "#3b82f6" : "#2563eb" }]} />
                    <View style={styles.cardBody}>
                      <View style={styles.cardHeader}>
                        <Book size={24} color={isDarkMode ? "#3b82f6" : "#2563eb"} />
                        <View style={styles.cardHeaderText}>
                          <Text style={[styles.cardTitle, !isDarkMode && styles.cardTitleLight]}>{carrera.nombre}</Text>
                          <Text style={[styles.cardSubtitle, !isDarkMode && styles.cardSubtitleLight]}>SIGLAS: {carrera.siglas}</Text>
                        </View>
                      </View>
                      <View style={[styles.cardFooter, !isDarkMode && styles.cardFooterLight]}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleEliminar(carrera.id, 'carrera')}>
                          <Text style={styles.deleteText}>DELETE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => abrirModalEditar(carrera)}>
                          <Text style={[styles.editText, { color: isDarkMode ? "#c084fc" : "#3b82f6" }]}>EDIT</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )
            )}

            {/* VISTA AVISOS */}
            {activeTab === "AVISOS" && (
              isLoading && avisos.length === 0 ? <ActivityIndicator size="large" color="#a855f7" style={{ marginTop: 40 }} /> : avisos.map((aviso) => (
                <View key={aviso.id} style={[styles.card, !isDarkMode && styles.cardLight]}>
                  <View style={[styles.cardAccent, { backgroundColor: aviso.categoria === "Urgente" ? "#ef4444" : (isDarkMode ? "#c084fc" : "#a855f7") }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                      <Calendar size={24} color={isDarkMode ? "#64748b" : "#94a3b8"} />
                      <View style={styles.cardHeaderText}>
                        <Text style={[styles.cardTitle, !isDarkMode && styles.cardTitleLight]}>{aviso.titulo}</Text>
                        <Text style={[styles.cardSubtitle, !isDarkMode && styles.cardSubtitleLight]}>{aviso.categoria.toUpperCase()} | Fecha: {aviso.fecha}</Text>
                      </View>
                    </View>
                    <View style={[styles.cardFooter, !isDarkMode && styles.cardFooterLight]}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleEliminar(aviso.id, 'aviso')}>
                        <Text style={styles.deleteText}>DELETE</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => abrirModalEditar(aviso)}>
                        <Text style={[styles.editText, { color: isDarkMode ? "#c084fc" : "#3b82f6" }]}>EDIT</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}

            {/* VISTA ADMINS (Solo Superadmins) */}
            {activeTab === "ADMINS" && userRole === "superadmin" && (
              isLoading && adminsList.length === 0 ? <ActivityIndicator size="large" color="#a855f7" style={{ marginTop: 40 }} /> : adminsList.map((admin) => (
                <View key={admin.id} style={[styles.card, !isDarkMode && styles.cardLight]}>
                  <View style={[styles.cardAccent, { backgroundColor: admin.rol === 'superadmin' ? "#a855f7" : "#10b981" }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                      <Shield size={24} color={isDarkMode ? (admin.rol === 'superadmin' ? "#a855f7" : "#10b981") : (admin.rol === 'superadmin' ? "#7e22ce" : "#059669")} />
                      <View style={styles.cardHeaderText}>
                        <Text style={[styles.cardTitle, !isDarkMode && styles.cardTitleLight]}>{admin.email}</Text>
                        <Text style={[styles.cardSubtitle, !isDarkMode && styles.cardSubtitleLight]}>Rol: {admin.rol ? admin.rol.toUpperCase() : "ADMIN"}</Text>
                      </View>
                    </View>
                    <View style={[styles.cardFooter, !isDarkMode && styles.cardFooterLight]}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, admin.email === userEmail && { opacity: 0.3 }]} 
                        onPress={() => admin.email !== userEmail && handleEliminar(admin.id, 'admin')}
                        disabled={admin.email === userEmail}
                      >
                        <Text style={styles.deleteText}>{admin.email === userEmail ? "TU CUENTA" : "REVOKAR ACCESO"}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}

            {activeTab !== "AVISOS" && activeTab !== "ADMINS" && activeTab !== "CARRERAS" && (
              <View style={styles.emptyState}>
                <Text style={[styles.subtitle, !isDarkMode && styles.subtitleLight]}>En construcción...</Text>
              </View>
            )}
          </ScrollView>

          {(activeTab === "AVISOS" || activeTab === "CARRERAS" || (activeTab === "ADMINS" && userRole === "superadmin")) && (
            <TouchableOpacity style={[styles.fab, !isDarkMode && styles.fabLight]} onPress={abrirModalNuevo}>
              <Plus size={24} color={isDarkMode ? "#08080a" : "#ffffff"} />
            </TouchableOpacity>
          )}
        </View>

        {/* MODAL */}
        <Modal visible={isModalVisible} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, !isDarkMode && styles.modalCardLight]}>
              <Text style={[styles.modalTitle, !isDarkMode && styles.modalTitleLight, { marginBottom: 20 }]}>
                {activeTab === "AVISOS" ? (editingId ? "EDITAR AVISO" : "NUEVO AVISO") : 
                 activeTab === "CARRERAS" ? (editingId ? "EDITAR CARRERA" : "NUEVA CARRERA") : 
                 "ENVIAR INVITACIÓN"}
              </Text>
              
              {activeTab === "AVISOS" && (
                <>
                   <Text style={[styles.inputLabel, !isDarkMode && styles.inputLabelLight]}>C A T E G O R Í A</Text>
                  <View style={{ zIndex: 10 }}>
                    <TouchableOpacity style={[styles.modalInput, !isDarkMode && styles.modalInputLight]} onPress={() => setShowCategorias(!showCategorias)}>
                      <Text style={{ color: isDarkMode ? "#f8fafc" : "#0f172a", fontSize: 15 }}>{categoria}</Text>
                    </TouchableOpacity>
                    {showCategorias && (
                      <View style={[styles.dropdown, !isDarkMode && styles.dropdownLight]}>
                        {categoriasOptions.map(opt => (
                          <TouchableOpacity key={opt} style={styles.dropdownOption} onPress={() => { setCategoria(opt); setShowCategorias(false); }}>
                            <Text style={{ color: isDarkMode ? "#f8fafc" : "#0f172a" }}>{opt}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <Text style={[styles.inputLabel, !isDarkMode && styles.inputLabelLight]}>T Í T U L O</Text>
                  <TextInput style={[styles.modalInput, !isDarkMode && styles.modalInputLight, { color: isDarkMode ? "#f8fafc" : "#0f172a" }]} placeholder="Ej. CREDENCIALES" placeholderTextColor={isDarkMode ? "#64748b" : "#94a3b8"} value={titulo} onChangeText={setTitulo} />
                  <Text style={[styles.inputLabel, !isDarkMode && styles.inputLabelLight]}>F E C H A</Text>
                  <TextInput style={[styles.modalInput, !isDarkMode && styles.modalInputLight, { color: isDarkMode ? "#f8fafc" : "#0f172a" }]} placeholder="Ej. 28 de abril de 2026" placeholderTextColor={isDarkMode ? "#64748b" : "#94a3b8"} value={fecha} onChangeText={setFecha} />
                  <Text style={[styles.inputLabel, !isDarkMode && styles.inputLabelLight]}>D E S C R I P C I Ó N</Text>
                  <TextInput style={[styles.modalInput, !isDarkMode && styles.modalInputLight, styles.textArea, { color: isDarkMode ? "#f8fafc" : "#0f172a" }]} placeholder="Detalles del aviso..." placeholderTextColor={isDarkMode ? "#64748b" : "#94a3b8"} multiline={true} numberOfLines={4} textAlignVertical="top" value={descripcion} onChangeText={setDescripcion} />
                </>
              )}

              {activeTab === "CARRERAS" && (
                <>
                  <Text style={[styles.inputLabel, !isDarkMode && styles.inputLabelLight]}>N O M B R E</Text>
                  <TextInput 
                    style={[styles.modalInput, !isDarkMode && styles.modalInputLight, { color: isDarkMode ? "#f8fafc" : "#0f172a", marginBottom: 15 }]} 
                    placeholder="Ej. Ingeniería en Sistemas..." placeholderTextColor={isDarkMode ? "#64748b" : "#94a3b8"} 
                    value={nombreCarrera} onChangeText={setNombreCarrera} 
                  />
                  <Text style={[styles.inputLabel, !isDarkMode && styles.inputLabelLight]}>S I G L A S</Text>
                  <TextInput 
                    style={[styles.modalInput, !isDarkMode && styles.modalInputLight, { color: isDarkMode ? "#f8fafc" : "#0f172a" }]} 
                    placeholder="Ej. ISC" placeholderTextColor={isDarkMode ? "#64748b" : "#94a3b8"} 
                    value={siglasCarrera} onChangeText={setSiglasCarrera} autoCapitalize="characters" 
                  />
                </>
              )}

              {activeTab === "ADMINS" && (
                <>
                  <Text style={[styles.inputLabel, !isDarkMode && styles.inputLabelLight]}>C O R R E O   D E L   I N V I T A D O</Text>
                  <TextInput 
                    style={[styles.modalInput, !isDarkMode && styles.modalInputLight, { color: isDarkMode ? "#f8fafc" : "#0f172a", marginBottom: 20 }]} 
                    placeholder="nuevo.admin@zapopan.tecmm.edu.mx" 
                    placeholderTextColor={isDarkMode ? "#64748b" : "#94a3b8"} 
                    keyboardType="email-address" autoCapitalize="none" value={nuevoAdminEmail} onChangeText={setNuevoAdminEmail} 
                  />
                  
                  <Text style={[styles.inputLabel, !isDarkMode && styles.inputLabelLight]}>R O L   A S I G N A D O</Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <TouchableOpacity 
                      style={[styles.roleBtn, nuevoAdminRol === 'admin' && styles.roleBtnActive, !isDarkMode && styles.roleBtnLight, !isDarkMode && nuevoAdminRol === 'admin' && styles.roleBtnActiveLight]} 
                      onPress={() => setNuevoAdminRol('admin')}
                    >
                      {nuevoAdminRol === 'admin' && <Check size={16} color={isDarkMode ? "#10b981" : "#059669"} />}
                      <Text style={[styles.roleBtnText, nuevoAdminRol === 'admin' && { color: isDarkMode ? "#10b981" : "#059669" }]}>Estándar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.roleBtn, nuevoAdminRol === 'superadmin' && styles.roleBtnActive, !isDarkMode && styles.roleBtnLight, !isDarkMode && nuevoAdminRol === 'superadmin' && styles.roleBtnActiveLight]} 
                      onPress={() => setNuevoAdminRol('superadmin')}
                    >
                      {nuevoAdminRol === 'superadmin' && <Check size={16} color={isDarkMode ? "#a855f7" : "#7e22ce"} />}
                      <Text style={[styles.roleBtnText, nuevoAdminRol === 'superadmin' && { color: isDarkMode ? "#a855f7" : "#7e22ce" }]}>SuperAdmin</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={{fontSize: 12, color: '#64748b', marginBottom: 10}}>
                    {nuevoAdminRol === 'admin' 
                      ? "Solo podrá gestionar Avisos, Horarios y Docentes." 
                      : "Tendrá control total, incluyendo gestión de Carreras y otros Administradores."}
                  </Text>
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.actionBtnModal}>
                  <Text style={styles.actionTextPurple}>CANCELAR</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleGuardar} style={styles.actionBtnModal} disabled={isLoading}>
                  <Text style={styles.actionTextPurple}>{isLoading ? "ENVIANDO..." : "ACEPTAR"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // --- RENDERIZADO INICIO SESIÓN ---
  return (
    <View style={[styles.container, !isDarkMode && styles.containerLight]}>
      <Navbar />
      <View style={styles.loginContent}>
        <View style={[styles.authCard, !isDarkMode && styles.authCardLight]}>
          <Text style={[styles.authMainTitle, !isDarkMode && styles.authMainTitleLight]}>Inicie sesión para acceder a su cuenta</Text>
          <View style={styles.formContainer}>
            <View style={[styles.inputGroup, !isDarkMode && styles.inputGroupLight]}>
              <TextInput style={[styles.authInput, { color: isDarkMode ? "#f8fafc" : "#333333" }]} placeholder="Correo electrónico" placeholderTextColor={isDarkMode ? "#64748b" : "#94a3b8"} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            </View>
            <View style={[styles.inputGroup, !isDarkMode && styles.inputGroupLight, { flexDirection: 'row', alignItems: 'center' }]}>
              <TextInput style={[styles.authInput, { flex: 1, color: isDarkMode ? "#f8fafc" : "#333333" }]} placeholder="Contraseña" placeholderTextColor={isDarkMode ? "#64748b" : "#94a3b8"} secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>{showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}</TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.btnPrimary, !isDarkMode && styles.btnPrimaryLight]} activeOpacity={0.8} onPress={handleEmailLogin} disabled={isLoading}>
              {isLoading ? <ActivityIndicator size="small" color={!isDarkMode ? "#ffffff" : "#000000"} /> : <Text style={[styles.btnPrimaryText, !isDarkMode && styles.btnPrimaryTextLight]}>Iniciar Sesión</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRecuperarPassword}>
              <Text style={styles.forgotPassword}>¿Olvidaste o aún no configuras tu contraseña?</Text>
            </TouchableOpacity>
            <View style={styles.dividerWrap}>
              <View style={[styles.line, !isDarkMode && styles.lineLight]} /><Text style={[styles.dividerText, !isDarkMode && styles.dividerTextLight]}>o continua con</Text><View style={[styles.line, !isDarkMode && styles.lineLight]} />
            </View>
            <TouchableOpacity style={[styles.btnGoogle, !isDarkMode && styles.btnGoogleLight]} activeOpacity={0.8} onPress={handleGoogleLogin} disabled={isLoading}>
              <Text style={{ color: '#4285F4', fontWeight: 'bold', fontSize: 18, marginRight: 8 }}>G</Text>
              <Text style={[styles.btnGoogleText, !isDarkMode && styles.btnGoogleTextLight]}>Iniciar sesión con Google</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08080a" }, containerLight: { backgroundColor: "#f8fafc" },
  title: { fontSize: 24, fontWeight: "900", color: "#ffffff", marginBottom: 4 }, titleLight: { color: "#0f172a" },
  subtitle: { fontSize: 15, color: "#94a3b8" }, subtitleLight: { color: "#64748b" },
  dashboardContent: { flex: 1, padding: 20, maxWidth: 800, width: "100%", alignSelf: "center" },
  header: { alignItems: "center", marginBottom: 20, marginTop: 10 },
  locationContainer: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }, locationText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" }, locationTextLight: { color: "#64748b" },
  userHeaderInfo: { marginTop: 12, alignItems: "center" }, userEmailText: { color: "#a855f7", fontSize: 12, fontWeight: "600", marginBottom: 4 }, userEmailTextLight: { color: "#6b21a8" },
  logoutBtnSmall: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(239, 68, 68, 0.1)" }, logoutTextSmall: { color: "#ef4444", fontSize: 11, fontWeight: "bold" },
  tabContainer: { backgroundColor: "#121217", borderRadius: 30, marginBottom: 24, padding: 6 }, tabContainerLight: { backgroundColor: "#1e293b" },
  tabScroll: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 24 }, tabBtnActive: { backgroundColor: "rgba(255,255,255,0.1)" },
  tabText: { color: "#94a3b8", fontWeight: "bold", fontSize: 13, letterSpacing: 0.5 }, tabTextActive: { color: "#ffffff" },
  listContainer: { flex: 1 }, listContent: { gap: 16, paddingBottom: 80 },
  card: { backgroundColor: "#121217", borderRadius: 16, flexDirection: "row", overflow: "hidden", borderWidth: 1, borderColor: "#27272a" }, cardLight: { backgroundColor: "#ffffff", borderColor: "#e2e8f0", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  cardAccent: { width: 4 }, cardBody: { flex: 1 }, cardHeader: { flexDirection: "row", padding: 20, gap: 16, alignItems: "center" }, cardHeaderText: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: "bold", color: "#f8fafc", marginBottom: 4 }, cardTitleLight: { color: "#0f172a" },
  cardSubtitle: { fontSize: 13, color: "#94a3b8", marginBottom: 2 }, cardSubtitleLight: { color: "#64748b" },
  cardFooter: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#27272a", paddingVertical: 12 }, cardFooterLight: { borderTopColor: "#f1f5f9" },
  actionBtn: { flex: 1, alignItems: "center", paddingVertical: 8 }, deleteText: { color: "#ef4444", fontWeight: "bold", fontSize: 13, letterSpacing: 1 }, editText: { fontWeight: "bold", fontSize: 13, letterSpacing: 1 },
  emptyState: { padding: 40, alignItems: "center" },
  fab: { position: "absolute", bottom: 24, right: 24, backgroundColor: "#f8fafc", width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 }, fabLight: { backgroundColor: "#0f172a" },
  loginContent: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center" },
  authCard: { width: "100%", maxWidth: 420, backgroundColor: "#121217", borderRadius: 12, padding: 32, borderWidth: 1, borderColor: "#27272a" }, authCardLight: { backgroundColor: "#ffffff", borderColor: "#e2e8f0", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  authMainTitle: { fontSize: 18, color: "#94a3b8", textAlign: "center", marginBottom: 24 }, authMainTitleLight: { color: "#64748b" },
  formContainer: { gap: 16 }, inputGroup: { backgroundColor: "#1a1a24", borderWidth: 1, borderColor: "#27272a", borderRadius: 8 }, inputGroupLight: { backgroundColor: "#ffffff", borderColor: "#cbd5e1" }, authInput: { padding: 14, fontSize: 15 },
  btnPrimary: { backgroundColor: "#ffffff", paddingVertical: 14, borderRadius: 8, alignItems: "center", marginTop: 4 }, btnPrimaryLight: { backgroundColor: "#d8d4ec" },
  btnPrimaryText: { color: "#000000", fontSize: 16, fontWeight: "600" }, btnPrimaryTextLight: { color: "#7a6b9c" },
  forgotPassword: { color: "#7a6b9c", fontSize: 13, marginTop: 4, textAlign: 'center' },
  dividerWrap: { flexDirection: "row", alignItems: "center", marginVertical: 20 }, line: { flex: 1, height: 1, backgroundColor: "#27272a" }, lineLight: { backgroundColor: "#e2e8f0" }, dividerText: { marginHorizontal: 12, color: "#64748b", fontSize: 13 }, dividerTextLight: { color: "#94a3b8" },
  btnGoogle: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: "#27272a", backgroundColor: "#121217" }, btnGoogleLight: { borderColor: "#cbd5e1", backgroundColor: "#ffffff" }, btnGoogleText: { color: "#ffffff", fontSize: 15, fontWeight: "500" }, btnGoogleTextLight: { color: "#333333" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { backgroundColor: "#121217", width: "100%", maxWidth: 450, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: "#27272a" }, modalCardLight: { backgroundColor: "#ffffff", borderColor: "#e2e8f0" },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#f8fafc", marginBottom: 4 }, modalTitleLight: { color: "#0f172a" },
  inputLabel: { fontSize: 12, color: "#a855f7", letterSpacing: 3, marginBottom: 8, marginTop: 16, fontWeight: "600" }, inputLabelLight: { color: "#6b21a8" },
  modalInput: { backgroundColor: "#1a1a24", borderRadius: 8, padding: 14, fontSize: 15, borderWidth: 1, borderColor: "#27272a" }, modalInputLight: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  textArea: { minHeight: 100 }, dropdown: { position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#1a1a24", borderWidth: 1, borderColor: "#27272a", borderRadius: 8, marginTop: 4, elevation: 5, zIndex: 20 }, dropdownLight: { backgroundColor: "#ffffff", borderColor: "#e2e8f0" }, dropdownOption: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#27272a" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 24 }, actionBtnModal: { paddingVertical: 8, paddingHorizontal: 12 }, actionTextPurple: { color: "#a855f7", fontWeight: "bold", letterSpacing: 1, fontSize: 14 },
  
  // Estilos Botones de Rol
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: "#1a1a24", borderWidth: 1, borderColor: "#27272a", borderRadius: 8 },
  roleBtnLight: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  roleBtnActive: { borderColor: "#a855f7", backgroundColor: "rgba(168, 85, 247, 0.1)" },
  roleBtnActiveLight: { borderColor: "#7e22ce", backgroundColor: "rgba(126, 34, 206, 0.1)" },
  roleBtnText: { color: "#94a3b8", fontWeight: "600", fontSize: 14 }
});