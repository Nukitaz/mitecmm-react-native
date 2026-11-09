/*
 * MiTecmm · Motor 3D del quiosco (Three.js, script clásico ES5).
 *
 * Archivo ESTÁTICO: no se interpola ningún dato en él. El plano SVG (ya saneado),
 * el tema y el aula seleccionada llegan por postMessage con { type: "INIT", ... }.
 *
 * Se distribuye de dos formas (ver scripts/vendor-kiosk.mjs):
 *  - Web:   public/vendor/kiosk-runtime.js, cargado por public/vendor/kiosk.html
 *  - Móvil: inline dentro del HTML del WebView (src/vendor/kioskBundle.native.ts)
 *
 * Después de editar este archivo ejecuta:  npm run vendor
 */
(function () {
  "use strict";

  var ID_VALIDO = /^[a-z0-9_]{1,80}$/;
  var esNativo = !!(window.ReactNativeWebView && window.ReactNativeWebView.postMessage);
  var iniciado = false;
  /** Se asigna al terminar iniciar(): { seleccionar(id), limpiar() } */
  var motor = null;

  function sendToHost(data) {
    var msg = JSON.stringify(data);
    if (esNativo) {
      window.ReactNativeWebView.postMessage(msg);
    } else if (window.parent && window.parent !== window) {
      // El iframe es sandbox (origen opaco): el host valida event.source.
      window.parent.postMessage(msg, "*");
    }
  }

  var fallido = false;

  /**
   * Informa a la app que el 3D no puede mostrarse (la app vuelve al plano 2D).
   * motivo: "three" | "webgl" | "sin_aulas" | "construccion" | "contexto"
   */
  function fallar(motivo, detalle) {
    if (fallido) return;
    fallido = true;
    var loader = document.getElementById("loader");
    if (loader) {
      loader.style.display = "flex";
      loader.style.opacity = "1";
      loader.innerHTML = "";
      var texto = document.createElement("span");
      texto.textContent = "No se pudo mostrar el modo 3D.";
      loader.appendChild(texto);
    }
    sendToHost({ type: "KIOSK_ERROR", motivo: motivo, detalle: detalle ? String(detalle).slice(0, 200) : "" });
  }

  function onHostMessage(event) {
    // Web: solo se aceptan mensajes de la ventana que contiene el iframe.
    if (!esNativo && event.source !== window.parent) return;
    var data;
    try {
      data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    } catch (_e) {
      return;
    }
    if (!data || typeof data !== "object") return;
    if (data.type === "INIT" && !iniciado && typeof data.svg === "string") {
      iniciado = true;
      var inactividad = Number(data.inactividadMs);
      iniciar({
        svg: data.svg,
        isDark: data.isDark === true,
        selectedId: typeof data.selectedId === "string" && ID_VALIDO.test(data.selectedId) ? data.selectedId : "",
        // Otra planta del edificio (para apilarlas) y si es la superior.
        svgSecundario: typeof data.svgSecundario === "string" ? data.svgSecundario : "",
        secundariaEsSuperior: data.plantaActiva !== "alta",
        plantaActiva: data.plantaActiva === "alta" ? "alta" : "baja",
        // "campus": el plano es el mapa general y sus espacios son edificios.
        modo: data.modo === "campus" ? "campus" : "edificio",
        // Abrir directamente con ambas plantas apiladas (vista interior desde el campus).
        vistaApilada: data.vistaApilada === true,
        // "Usted está aquí": ID de un elemento del plano (validado).
        aqui: typeof data.aqui === "string" && ID_VALIDO.test(data.aqui) ? data.aqui : "",
        // Modo quiosco: volver a la vista inicial tras X ms sin uso (0 = desactivado).
        inactividadMs: inactividad >= 5000 && inactividad <= 3600000 ? inactividad : 0,
        titulo: typeof data.titulo === "string" ? data.titulo.slice(0, 80) : "",
        // Salones con muros de cristal (p. ej. edificio L).
        murosCristal: data.murosCristal === true,
      });
    } else if (data.type === "SELECT_ROOM" && motor && typeof data.id === "string" && ID_VALIDO.test(data.id)) {
      // Selección pedida por la app: no se notifica de vuelta (evita ciclos).
      motor.seleccionar(data.id);
      motor.actividad();
    } else if (data.type === "CLEAR_SELECTION" && motor) {
      motor.limpiar();
    }
  }

  window.addEventListener("message", onHostMessage);
  document.addEventListener("message", onHostMessage); // Android WebView

  // Tema inicial (antes de INIT) para evitar destellos: clase en <body> o #dark/#light en la URL.
  if (location.hash === "#light") document.body.className = "light";
  if (location.hash === "#dark") document.body.className = "dark";

  sendToHost({ type: "KIOSK_LOADED" });

  // ===================================================================
  function iniciar(cfg) {
    /** Marca la escena como modificada y programa un cuadro. */
    function pedirRender() {
      necesitaRender = true;
      programar();
    }
    function programar() {
      if (!frameProgramado && !fallido) {
        frameProgramado = true;
        requestAnimationFrame(cuadro);
      }
    }

    if (typeof THREE === "undefined") {
      fallar("three");
      return;
    }
    var isDark = cfg.isDark;
    document.body.className = isDark ? "dark" : "light";

    var bgColor = isDark ? "#08080a" : "#f1f4f8";
    var slabColor = isDark ? "#121620" : "#dbe0ea";
    var corridorColor = isDark ? "#192030" : "#ffffff";
    var wallColor = isDark ? "#334155" : "#94a3b8";
    var topColor = isDark ? "#475569" : "#cbd5e1";
    var edgeColor = isDark ? "#1e293b" : "#64748b";

    var selectedTargetId = cfg.selectedId;
    // Preferencia del sistema "reducir movimiento": sin pulsos ni desplazamientos animados.
    var movimientoReducido = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    var container = document.getElementById("canvas-container");
    var loader = document.getElementById("loader");

    var width = container.clientWidth || window.innerWidth;
    var height = container.clientHeight || window.innerHeight;

    // 1. Escena y Niebla arquitectónica
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.Fog(bgColor, 150, 480);

    // 2. Cámara Isométrica
    var camera = new THREE.PerspectiveCamera(40, width / height, 1, 1000);
    var cameraTarget = new THREE.Vector3(0, 0, 0);
    var targetCameraLerp = null;

    /** El campus es más grande que un edificio: la cámara inicial queda más lejos. */
    var RADIO_INICIAL = cfg.modo === "campus" ? 205 : 170;
    var spherical = {
      radius: RADIO_INICIAL,
      theta: Math.PI / 4,
      phi: Math.PI / 3.2,
    };

    // Dibujo bajo demanda: solo se renderiza cuando algo cambia (cámara, selección,
    // tamaño, pulso del aula seleccionada). Con la escena quieta: 0 cuadros.
    var necesitaRender = true;
    var frameProgramado = false;
    var cuadrosDibujados = 0;

    function updateCameraPosition() {
      camera.position.x = cameraTarget.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = cameraTarget.y + spherical.radius * Math.cos(spherical.phi);
      camera.position.z = cameraTarget.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(cameraTarget);
      pedirRender();
    }
    updateCameraPosition();

    // 3. Renderizador WebGL, con calidad ajustada al dispositivo
    var dpr = window.devicePixelRatio || 1;
    // Gama baja: pocos núcleos o poca memoria (deviceMemory solo existe en Chromium/Android).
    var gamaBaja = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
    // Con densidad de píxeles >= 2 el antialias apenas se nota y cuesta mucho.
    var usarAntialias = dpr < 2 && !gamaBaja;

    /** Limita los píxeles dibujados (pantallas 4K de quiosco): máx. ~2560x1440 efectivos. */
    function calcularPixelRatio(w, h) {
      var pr = Math.min(dpr, gamaBaja ? 1.5 : 2);
      var maxPixeles = gamaBaja ? 2.1e6 : 3.7e6;
      while (pr > 1 && w * h * pr * pr > maxPixeles) pr -= 0.25;
      return Math.max(1, pr);
    }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: usarAntialias, alpha: false, powerPreference: gamaBaja ? "low-power" : "high-performance" });
    } catch (e) {
      fallar("webgl", e && e.message);
      return;
    }
    renderer.setPixelRatio(calcularPixelRatio(width, height));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = gamaBaja ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    // Las sombras son estáticas (nada se mueve): se calculan una vez, no en cada cuadro.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    container.appendChild(renderer.domElement);

    // 4. Luces
    var ambientLight = new THREE.AmbientLight(isDark ? 0x64748b : 0xffffff, isDark ? 0.75 : 0.9);
    scene.add(ambientLight);

    var sunLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.0 : 1.3);
    sunLight.position.set(120, 220, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = gamaBaja ? 512 : 1024;
    sunLight.shadow.mapSize.height = gamaBaja ? 512 : 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 450;
    sunLight.shadow.camera.left = -120;
    sunLight.shadow.camera.right = 120;
    sunLight.shadow.camera.top = 120;
    sunLight.shadow.camera.bottom = -120;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    var fillLight = new THREE.DirectionalLight(isDark ? 0x38bdf8 : 0xdbeafe, 0.4);
    fillLight.position.set(-100, 80, -100);
    scene.add(fillLight);

    // 5. Materiales
    var materials = {
      slab: new THREE.MeshStandardMaterial({ color: new THREE.Color(slabColor), roughness: 0.85, metalness: 0.05 }),
      corridor: new THREE.MeshStandardMaterial({ color: new THREE.Color(corridorColor), roughness: 0.65, metalness: 0.02 }),
      roomWall: new THREE.MeshStandardMaterial({ color: new THREE.Color(wallColor), roughness: 0.55, metalness: 0.1 }),
      roomTop: new THREE.MeshStandardMaterial({ color: new THREE.Color(topColor), roughness: 0.7, metalness: 0.05 }),
      roomSelected: new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xf97316),
        emissive: new THREE.Color(0xf97316),
        emissiveIntensity: 0.5,
        roughness: 0.25,
        metalness: 0.1,
      }),
      edge: new THREE.LineBasicMaterial({ color: new THREE.Color(edgeColor), linewidth: 1, transparent: true, opacity: 0.45 }),
    };

    var floorGroup = new THREE.Group();
    scene.add(floorGroup);

    var interactiveObjects = [];
    var roomMeshes = {};
    var currentSelectedMesh = null;

    // 6. Generadores de Billboards (texturas compartidas por contenido)
    var cacheTexturas = {};
    function texturaDe(clave, dibujar) {
      if (cacheTexturas[clave]) return cacheTexturas[clave];
      var texture = new THREE.CanvasTexture(dibujar());
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      cacheTexturas[clave] = texture;
      return texture;
    }

    /** Ajusta el tamaño de letra para que el texto quepa en `anchoMax` (mín. `minimo` px). */
    function fuenteQueCabe(ctx, texto, maximo, minimo, anchoMax) {
      var tam = maximo;
      ctx.font = "bold " + tam + "px -apple-system, BlinkMacSystemFont, sans-serif";
      while (tam > minimo && ctx.measureText(texto).width > anchoMax) {
        tam -= 2;
        ctx.font = "bold " + tam + "px -apple-system, BlinkMacSystemFont, sans-serif";
      }
      if (ctx.measureText(texto).width <= anchoMax) return texto;
      // Aun con la letra mínima no cabe: se recorta con "…"
      var recortado = texto;
      while (recortado.length > 1 && ctx.measureText(recortado + "…").width > anchoMax) recortado = recortado.slice(0, -1);
      return recortado + "…";
    }

    function createClassroomBillboard(codigo, categoria) {
      var texture = texturaDe("aula|" + categoria + "|" + codigo, function () {
        var canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 128;
        var ctx = canvas.getContext("2d");

        // Tarjeta clara en modo claro; oscura y con borde suave en modo oscuro.
        ctx.fillStyle = isDark ? "#1e293b" : "#ffffff";
        ctx.strokeStyle = isDark ? "#475569" : "#cbd5e1";
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(6, 6, 244, 116, 20);
        } else {
          ctx.rect(6, 6, 244, 116);
        }
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        if (categoria) {
          ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
          var cat = fuenteQueCabe(ctx, categoria, 20, 14, 220);
          ctx.fillText(cat, 128, 42);
          ctx.fillStyle = isDark ? "#f1f5f9" : "#0f172a";
          var cod = fuenteQueCabe(ctx, codigo, 46, 20, 228);
          ctx.fillText(cod, 128, 94);
        } else {
          // Sin categoría: el nombre ocupa la tarjeta, centrado verticalmente.
          ctx.fillStyle = isDark ? "#f1f5f9" : "#0f172a";
          var solo = fuenteQueCabe(ctx, codigo, 40, 18, 228);
          ctx.textBaseline = "middle";
          ctx.fillText(solo, 128, 66);
        }
        return canvas;
      });

      var mat = new THREE.SpriteMaterial({ map: texture, depthTest: true });
      var sprite = new THREE.Sprite(mat);
      sprite.scale.set(11, 5.5, 1);
      return sprite;
    }

    function createServiceBillboard(serviceType) {
      var texture = texturaDe("servicio|" + serviceType, function () {
      var canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 160;
      var ctx = canvas.getContext("2d");

      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(6, 6, 148, 148, 28);
      } else {
        ctx.rect(6, 6, 148, 148);
      }
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (serviceType === "restroom") {
        ctx.font = "bold 56px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("WC", 80, 100);
      } else if (serviceType === "stairs") {
        ctx.lineWidth = 8;
        ctx.lineCap = "square";
        ctx.fillRect(36, 110, 34, 8);
        ctx.fillRect(36, 88, 8, 22);
        ctx.fillRect(62, 88, 34, 8);
        ctx.fillRect(62, 66, 8, 22);
        ctx.fillRect(88, 66, 34, 8);
        ctx.fillRect(88, 44, 8, 22);
        ctx.beginPath();
        ctx.moveTo(110, 36);
        ctx.lineTo(124, 50);
        ctx.lineTo(114, 50);
        ctx.lineTo(114, 60);
        ctx.lineTo(100, 60);
        ctx.lineTo(100, 50);
        ctx.lineTo(90, 50);
        ctx.closePath();
        ctx.fill();
      } else if (serviceType === "medical") {
        ctx.fillRect(66, 36, 28, 88);
        ctx.fillRect(36, 66, 88, 28);
      } else if (serviceType === "security") {
        ctx.beginPath();
        ctx.moveTo(80, 36);
        ctx.lineTo(120, 52);
        ctx.lineTo(120, 92);
        ctx.quadraticCurveTo(80, 130, 80, 130);
        ctx.quadraticCurveTo(80, 130, 40, 92);
        ctx.lineTo(40, 52);
        ctx.closePath();
        ctx.fill();
      } else if (serviceType === "electric") {
        ctx.beginPath();
        ctx.moveTo(86, 32);
        ctx.lineTo(54, 82);
        ctx.lineTo(82, 82);
        ctx.lineTo(74, 128);
        ctx.lineTo(106, 78);
        ctx.lineTo(78, 78);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(40, 96, 26, 28);
        ctx.fillRect(66, 68, 26, 56);
        ctx.fillRect(92, 40, 26, 84);
      }
      return canvas;
      });

      var mat = new THREE.SpriteMaterial({ map: texture, depthTest: true });
      var sprite = new THREE.Sprite(mat);
      sprite.scale.set(6.5, 6.5, 1);
      return sprite;
    }

    // Etiquetas y tipos de servicio: fuente única compartida con la app (etiquetas.js).
    var Etiquetas = window.MiTecmmEtiquetas;

    // 7. Medición de un plano SVG (planta activa y, si se apilan, la otra planta)
    var ALTURA_AULA = 6.0;
    /** Separación vertical entre plantas en la vista apilada (deja ver la de abajo). */
    var SEPARACION_PLANTAS = 46;
    // Una sola caja unitaria y su contorno para TODAS las aulas (se escalan por aula).
    var cajaUnitaria = new THREE.BoxGeometry(1, 1, 1);
    var contornoUnitario = new THREE.EdgesGeometry(cajaUnitaria);
    var planoActivo = null;
    var normalizacion = null; // { cx, cy, scale }: coordenadas del SVG -> mundo 3D

    // 7a. Formas propias de cada espacio (en lugar de una caja): escaleras, baños y salones.
    var matEscalon = [materials.roomWall, materials.roomWall, materials.roomTop, materials.roomWall, materials.roomWall, materials.roomWall];
    var matPisoBano = new THREE.MeshStandardMaterial({ color: new THREE.Color(isDark ? "#1f3b4d" : "#dbeafe"), roughness: 0.4, metalness: 0.05 });
    var matMuroBano = new THREE.MeshStandardMaterial({ color: new THREE.Color(isDark ? "#3f5873" : "#a5b4c8"), roughness: 0.6, metalness: 0.05 });
    var matLoza = new THREE.MeshStandardMaterial({ color: new THREE.Color("#f8fafc"), roughness: 0.25, metalness: 0.05 });
    var matPisoSalon = new THREE.MeshStandardMaterial({ color: new THREE.Color(isDark ? "#263247" : "#e2e8f0"), roughness: 0.6, metalness: 0.05 });
    var matMadera = new THREE.MeshStandardMaterial({ color: new THREE.Color(isDark ? "#9a6b45" : "#c08a5c"), roughness: 0.6, metalness: 0.02 });
    var matMetal = new THREE.MeshStandardMaterial({ color: new THREE.Color(isDark ? "#64748b" : "#475569"), roughness: 0.4, metalness: 0.4 });
    var matPizarron = new THREE.MeshStandardMaterial({ color: new THREE.Color("#1f5f46"), roughness: 0.8, metalness: 0.02 });
    // Muros de cristal (edificio L): translúcidos, con marco de aluminio.
    var matCristal = new THREE.MeshStandardMaterial({
      color: new THREE.Color(isDark ? "#7dd3fc" : "#38bdf8"),
      transparent: true,
      opacity: isDark ? 0.22 : 0.28,
      roughness: 0.05,
      metalness: 0.3,
      depthWrite: false,
    });
    var matMarco = new THREE.MeshStandardMaterial({ color: new THREE.Color(isDark ? "#94a3b8" : "#64748b"), roughness: 0.35, metalness: 0.6 });
    /** Resaltado de un muro de cristal: naranja, pero sigue dejando ver el interior. */
    var matCristalSeleccionado = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf97316),
      emissive: new THREE.Color(0xf97316),
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    /** Muebles y loza conservan su color al resaltar: se pinta el espacio (piso y muros). */
    var CONSERVAN_COLOR = [matLoza, matMadera, matMetal, matPizarron];
    /** El edificio tiene muros de cristal en sus salones (lo indica la app). */
    var murosCristal = cfg.murosCristal === true;
    /** Material invisible (sigue recibiendo toques) para la zona seleccionable de una forma propia. */
    var matInvisible = new THREE.MeshBasicMaterial({ visible: false });
    /** Caja unitaria sin índices: base para unir las piezas de una forma en pocas mallas. */
    var cajaPlana = cajaUnitaria.toNonIndexed();

    /** Caja (geometría compartida) en coordenadas locales de la forma. */
    function bloque(grupo, material, x, y, z, w, h, d) {
      var m = new THREE.Mesh(cajaUnitaria, material);
      m.scale.set(Math.max(w, 0.05), Math.max(h, 0.05), Math.max(d, 0.05));
      m.position.set(x, y + h / 2, z);
      m.raycast = function () {};
      m.userData.materialOriginal = material;
      grupo.add(m);
      return m;
    }

    /**
     * Une las piezas (cajas) de una forma en una malla por material: un salón con 40 pupitres
     * se dibuja con 4 o 5 llamadas en vez de cientos (importante en celulares).
     * Las cajas con un material por cara (escalones) se separan por cara.
     */
    function fusionar(grupo) {
      grupo.updateMatrixWorld(true);
      var porMaterial = []; // [{ material, piezas: [{ matriz, cara }] }]
      function lote(material) {
        for (var i = 0; i < porMaterial.length; i++) if (porMaterial[i].material === material) return porMaterial[i];
        var nuevo = { material: material, piezas: [] };
        porMaterial.push(nuevo);
        return nuevo;
      }
      grupo.traverse(function (o) {
        if (!o.isMesh || o.geometry !== cajaUnitaria) return;
        for (var cara = 0; cara < 6; cara++) {
          var mat = Array.isArray(o.material) ? o.material[cara] : o.material;
          lote(mat).piezas.push({ matriz: o.matrixWorld, cara: cara });
        }
      });
      var posBase = cajaPlana.attributes.position.array;
      var norBase = cajaPlana.attributes.normal.array;
      var v = new THREE.Vector3();
      var normalM = new THREE.Matrix3();
      var unida = new THREE.Group();
      porMaterial.forEach(function (l) {
        // Cada cara de la caja sin índices son 6 vértices consecutivos (orden px, nx, py, ny, pz, nz).
        var pos = new Float32Array(l.piezas.length * 18);
        var nor = new Float32Array(l.piezas.length * 18);
        l.piezas.forEach(function (p, k) {
          normalM.getNormalMatrix(p.matriz);
          for (var j = 0; j < 6; j++) {
            var s = (p.cara * 6 + j) * 3, t = (k * 6 + j) * 3;
            v.set(posBase[s], posBase[s + 1], posBase[s + 2]).applyMatrix4(p.matriz);
            pos[t] = v.x; pos[t + 1] = v.y; pos[t + 2] = v.z;
            v.set(norBase[s], norBase[s + 1], norBase[s + 2]).applyMatrix3(normalM).normalize();
            nor[t] = v.x; nor[t + 1] = v.y; nor[t + 2] = v.z;
          }
        });
        var geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        geo.computeBoundingSphere();
        var malla = new THREE.Mesh(geo, l.material);
        malla.raycast = function () {};
        malla.userData.materialOriginal = l.material;
        var transparente = l.material === matCristal;
        malla.castShadow = !transparente;
        malla.receiveShadow = !transparente;
        if (transparente) malla.renderOrder = 2; // después de lo opaco
        unida.add(malla);
      });
      return unida;
    }

    /**
     * Resalta (o restaura) un espacio. Una caja simple cambia de material; las formas propias
     * pintan sus muros y piso, y su caja sigue invisible (si no, taparía la forma).
     * Muebles y loza conservan su color; el cristal se pinta translúcido.
     */
    function pintarSeleccion(mesh, seleccionado) {
      var forma = mesh.userData.forma;
      if (!forma) {
        mesh.material = seleccionado ? materials.roomSelected : mesh.userData.defaultMaterial;
        return;
      }
      forma.traverse(function (o) {
        var original = o.userData.materialOriginal;
        if (!original || CONSERVAN_COLOR.indexOf(original) !== -1) return;
        if (!seleccionado) o.material = original;
        else o.material = original === matCristal ? matCristalSeleccionado : materials.roomSelected;
      });
    }

    /**
     * Escalera en U (dos tramos y un descanso), como en los planos. El tramo corre a lo
     * largo del lado mayor; la primera mitad sube hasta el descanso y la otra regresa.
     */
    function formaEscalera(W, D) {
      var g = new THREE.Group();
      var largo = Math.max(W, D), ancho = Math.min(W, D);
      var tramo = new THREE.Group(); // se construye con el largo en X y se gira si hace falta
      var H = ALTURA_AULA;
      var descanso = Math.min(largo * 0.22, ancho * 0.9);
      var recorrido = largo - descanso;
      var n = 9;
      var paso = recorrido / n;
      var anchoTramo = ancho / 2 - 0.25;
      var x0 = -largo / 2;
      for (var i = 0; i < n; i++) {
        // Tramo 1 (z negativo): sube de 0 a H/2 hacia el descanso.
        bloque(tramo, matEscalon, x0 + paso * (i + 0.5), 0, -ancho / 4, paso, (H / 2) * (i + 1) / n, anchoTramo);
        // Tramo 2 (z positivo): sube de H/2 a H regresando desde el descanso.
        bloque(tramo, matEscalon, x0 + recorrido - paso * (i + 0.5), 0, ancho / 4, paso, H / 2 + (H / 2) * (i + 1) / n, anchoTramo);
      }
      bloque(tramo, matEscalon, largo / 2 - descanso / 2, 0, 0, descanso, H / 2, ancho);
      // Muro central entre tramos
      bloque(tramo, matMuroBano, x0 + recorrido / 2, 0, 0, recorrido, H * 0.75, 0.3);
      if (D > W) tramo.rotation.y = Math.PI / 2;
      g.add(tramo);
      return g;
    }

    /** Baño: piso de azulejo, muros bajos abiertos, cubículos con inodoro y lavabo corrido. */
    function formaBano(W, D) {
      var g = new THREE.Group();
      var largo = Math.max(W, D), ancho = Math.min(W, D);
      var c = new THREE.Group(); // largo en X
      var hMuro = ALTURA_AULA * 0.7, e = 0.35;
      bloque(c, matPisoBano, 0, 0, 0, largo, 0.15, ancho);
      // Perímetro con un hueco de puerta al centro de un lado largo
      var puerta = Math.min(2.6, largo * 0.3);
      bloque(c, matMuroBano, 0, 0, -ancho / 2 + e / 2, largo, hMuro, e);
      bloque(c, matMuroBano, -(largo + puerta) / 4, 0, ancho / 2 - e / 2, (largo - puerta) / 2, hMuro, e);
      bloque(c, matMuroBano, (largo + puerta) / 4, 0, ancho / 2 - e / 2, (largo - puerta) / 2, hMuro, e);
      bloque(c, matMuroBano, -largo / 2 + e / 2, 0, 0, e, hMuro, ancho);
      bloque(c, matMuroBano, largo / 2 - e / 2, 0, 0, e, hMuro, ancho);
      // Cubículos a lo largo del muro del fondo
      var fondoCub = Math.min(ancho * 0.5, 4.2);
      var nCub = Math.max(1, Math.min(5, Math.floor((largo - 2 * e) / 2.8)));
      var anchoCub = (largo - 2 * e) / nCub;
      var zCub = -ancho / 2 + e + fondoCub / 2;
      for (var i = 0; i < nCub; i++) {
        var xc = -largo / 2 + e + anchoCub * (i + 0.5);
        if (i > 0) bloque(c, matMuroBano, xc - anchoCub / 2, 0, zCub, 0.18, hMuro * 0.7, fondoCub);
        // Inodoro: taza y tanque
        var t = Math.min(0.9, anchoCub * 0.35);
        bloque(c, matLoza, xc, 0, zCub - fondoCub / 2 + t * 1.1, t, 0.9, t * 1.3);
        bloque(c, matLoza, xc, 0, zCub - fondoCub / 2 + t * 0.35, t * 1.1, 1.6, t * 0.5);
      }
      // Lavabo corrido junto a la entrada (si cabe)
      if (ancho - fondoCub > 3) {
        bloque(c, matLoza, -largo / 4, 0, ancho / 2 - e - 0.6, Math.min(largo * 0.4, 5), 1.7, 1.0);
      }
      if (D > W) c.rotation.y = Math.PI / 2;
      g.add(c);
      return g;
    }

    /**
     * Salón: piso, muros con puerta, pizarrón, escritorio del docente y filas de pupitres
     * mirando al pizarrón. Con cristal=true los muros son translúcidos con marco de aluminio.
     */
    function formaSalon(W, D, cristal) {
      var g = new THREE.Group();
      var largo = Math.max(W, D), ancho = Math.min(W, D);
      var c = new THREE.Group(); // largo en X; el pizarrón queda en el lado x negativo
      var muro = cristal ? matCristal : materials.roomWall;
      var hMuro = cristal ? ALTURA_AULA * 0.8 : ALTURA_AULA * 0.7;
      var e = cristal ? 0.15 : 0.35;
      bloque(c, matPisoSalon, 0, 0, 0, largo, 0.12, ancho);

      // Muros: el frente (z positivo) lleva la puerta cerca de la esquina opuesta al pizarrón.
      var puerta = Math.min(2.4, largo * 0.25);
      var xPuerta = largo / 2 - e - 0.6 - puerta / 2; // centro del hueco
      var izq = (xPuerta - puerta / 2) - (-largo / 2), der = largo / 2 - (xPuerta + puerta / 2);
      var tramos = [
        [0, -ancho / 2 + e / 2, largo, e],
        [-largo / 2 + izq / 2, ancho / 2 - e / 2, izq, e],
        [largo / 2 - der / 2, ancho / 2 - e / 2, der, e],
        [-largo / 2 + e / 2, 0, e, ancho],
        [largo / 2 - e / 2, 0, e, ancho],
      ];
      tramos.forEach(function (t) { bloque(c, muro, t[0], 0, t[1], t[2], hMuro, t[3]); });
      if (cristal) {
        // Marco: perfil superior en cada tramo y postes en esquinas y en la puerta.
        tramos.forEach(function (t) { bloque(c, matMarco, t[0], hMuro - 0.2, t[1], t[2] + 0.06, 0.2, t[3] + 0.06); });
        var postes = [
          [-largo / 2 + e / 2, -ancho / 2 + e / 2], [largo / 2 - e / 2, -ancho / 2 + e / 2],
          [-largo / 2 + e / 2, ancho / 2 - e / 2], [largo / 2 - e / 2, ancho / 2 - e / 2],
          [xPuerta - puerta / 2, ancho / 2 - e / 2], [xPuerta + puerta / 2, ancho / 2 - e / 2],
        ];
        postes.forEach(function (p) { bloque(c, matMarco, p[0], 0, p[1], 0.25, hMuro, 0.25); });
      }

      // Pizarrón y escritorio del docente
      var xFrente = -largo / 2 + e;
      bloque(c, matPizarron, xFrente + 0.08, 1.6, 0, 0.14, Math.min(2.2, hMuro * 0.45), Math.min(ancho * 0.6, 8));
      var fondoEsc = Math.min(2.6, ancho * 0.3);
      if (largo > 6) bloque(c, matMadera, xFrente + 1.7, 0, -ancho * 0.15, 1.0, 1.25, fondoEsc);

      // Pupitres (tablero, asiento y respaldo) en una cuadrícula que cabe en el salón.
      var x0 = xFrente + 3.6, x1 = largo / 2 - e - 0.9;
      var z0 = -ancho / 2 + e + 0.9, z1 = ancho / 2 - e - 0.9;
      var columnas = Math.min(8, Math.floor((x1 - x0) / 2.3) + 1);
      var filas = Math.min(7, Math.floor((z1 - z0) / 2.0) + 1);
      if (x1 - x0 > 1 && z1 - z0 > 1 && columnas > 0 && filas > 0) {
        for (var i = 0; i < columnas; i++) {
          var x = columnas === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (columnas - 1);
          for (var j = 0; j < filas; j++) {
            var z = filas === 1 ? (z0 + z1) / 2 : z0 + (z1 - z0) * j / (filas - 1);
            bloque(c, matMadera, x, 1.25, z, 0.85, 0.12, 1.1);
            bloque(c, matMetal, x + 0.75, 0, z, 0.7, 0.8, 0.8);
            bloque(c, matMetal, x + 1.1, 0.8, z, 0.12, 0.9, 0.8);
          }
        }
      }
      if (D > W) c.rotation.y = Math.PI / 2;
      g.add(c);
      return g;
    }

    // Edificios del campus
    var ALTURA_PISO_CAMPUS = 3.4;
    var matVentana = new THREE.MeshStandardMaterial({ color: new THREE.Color(isDark ? "#0b3a53" : "#1e3a5f"), roughness: 0.15, metalness: 0.6 });
    var matFachadaCristal = new THREE.MeshStandardMaterial({ color: new THREE.Color(isDark ? "#38bdf8" : "#7dd3fc"), roughness: 0.08, metalness: 0.5, emissive: new THREE.Color(isDark ? "#0c4a6e" : "#000000"), emissiveIntensity: 0.4 });
    CONSERVAN_COLOR.push(matVentana);

    /**
     * Edificio del campus: plantas con losa marcada, franjas de ventanas en las cuatro
     * fachadas y pretil en la azotea. Con cristal=true la fachada es casi toda de vidrio.
     */
    function formaEdificioCampus(W, D, pisos, cristal) {
      var g = new THREE.Group();
      var hp = ALTURA_PISO_CAMPUS;
      var alto = hp * pisos;
      var muro = materials.roomWall;
      var losa = materials.roomTop;
      var vidrio = cristal ? matFachadaCristal : matVentana;
      bloque(g, muro, 0, 0, 0, W, alto, D);
      for (var p = 0; p < pisos; p++) {
        var y0 = p * hp;
        // Losa entre pisos (sobresale un poco) y franja de ventanas en cada fachada.
        if (p > 0) bloque(g, losa, 0, y0 - 0.15, 0, W + 0.5, 0.3, D + 0.5);
        var hv = cristal ? hp * 0.72 : hp * 0.42;
        var yv = y0 + (hp - hv) / 2 + 0.1;
        var sale = 0.12;
        if (cristal) {
          bloque(g, vidrio, 0, yv, -D / 2 - sale / 2, W * 0.94, hv, sale);
          bloque(g, vidrio, 0, yv, D / 2 + sale / 2, W * 0.94, hv, sale);
          bloque(g, vidrio, -W / 2 - sale / 2, yv, 0, sale, hv, D * 0.9);
          bloque(g, vidrio, W / 2 + sale / 2, yv, 0, sale, hv, D * 0.9);
        } else {
          // Ventanas individuales separadas por machones.
          var nX = Math.max(2, Math.round(W / 3.2)), nZ = Math.max(1, Math.round(D / 3.2));
          var paso, k;
          paso = W / nX;
          for (k = 0; k < nX; k++) {
            var x = -W / 2 + paso * (k + 0.5);
            bloque(g, vidrio, x, yv, -D / 2 - sale / 2, paso * 0.62, hv, sale);
            bloque(g, vidrio, x, yv, D / 2 + sale / 2, paso * 0.62, hv, sale);
          }
          paso = D / nZ;
          for (k = 0; k < nZ; k++) {
            var z = -D / 2 + paso * (k + 0.5);
            bloque(g, vidrio, -W / 2 - sale / 2, yv, z, sale, hv, paso * 0.62);
            bloque(g, vidrio, W / 2 + sale / 2, yv, z, sale, hv, paso * 0.62);
          }
        }
      }
      // Azotea: losa y pretil perimetral
      bloque(g, losa, 0, alto, 0, W + 0.4, 0.25, D + 0.4);
      var e = 0.35, hPretil = 0.7;
      bloque(g, muro, 0, alto + 0.25, -D / 2, W + 0.4, hPretil, e);
      bloque(g, muro, 0, alto + 0.25, D / 2, W + 0.4, hPretil, e);
      bloque(g, muro, -W / 2, alto + 0.25, 0, e, hPretil, D + 0.4);
      bloque(g, muro, W / 2, alto + 0.25, 0, e, hPretil, D + 0.4);
      return fusionar(g);
    }

    /** Edificios del campus con una sola planta. */
    var CAMPUS_UNA_PLANTA = { cafeteria_escuela: true };
    /** Edificios del campus con fachada de cristal. */
    var CAMPUS_CRISTAL = { edificio_l: true };

    /** Etiqueta 3D de un edificio del campus: "EDIFICIO / A", "CAFETERÍA". */
    function etiquetaEdificio(id) {
      var m = /^edificio_([a-z0-9]+)$/.exec(String(id).toLowerCase());
      if (m) return { categoria: "EDIFICIO", codigo: m[1].toUpperCase() };
      return Etiquetas.etiqueta(id);
    }

    /** Forma propia de un espacio: escalera, baño o (todo lo demás) salón. */
    function formaPropia(tipo, W, D) {
      var forma;
      if (tipo === "stairs") forma = formaEscalera(W, D);
      else if (tipo === "restroom") forma = formaBano(W, D);
      else forma = formaSalon(W, D, murosCristal);
      return fusionar(forma);
    }

    /**
     * Interpreta y mide un plano: espacios (centro, tamaño y rotación reales vía getCTM),
     * límites, y el contorno de referencia "contorno_edificio" si existe.
     */
    function medirPlano(svgText, sandbox) {
      if (!svgText) return null;
      // El SVG llega saneado desde la app; además se interpreta con DOMParser
      // (no ejecuta scripts) antes de insertarlo para poder medirlo con getBBox.
      var parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
      var svgRoot = parsed.documentElement;
      if (!svgRoot || svgRoot.nodeName.toLowerCase() !== "svg" || parsed.getElementsByTagName("parsererror").length) return null;
      sandbox.textContent = "";
      sandbox.appendChild(document.importNode(svgRoot, true));
      var svgEl = sandbox.querySelector("svg");
      if (!svgEl) return null;

      // Matriz del sistema de coordenadas raíz del SVG: todo se expresa en ese espacio,
      // respetando los transform de capas/grupos (Inkscape).
      var rootCtm = svgEl.getCTM();
      var rootInv = rootCtm ? rootCtm.inverse() : null;

      function transformar(m, x, y) {
        if (!m) return { x: x, y: y };
        return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
      }

      /** Caja real de un elemento en coordenadas raíz: centro, tamaño, ángulo y esquinas. */
      function cajaDe(el) {
        var x, y, w, h;
        if (el.tagName.toLowerCase() === "rect") {
          x = parseFloat(el.getAttribute("x")) || 0;
          y = parseFloat(el.getAttribute("y")) || 0;
          w = parseFloat(el.getAttribute("width")) || 0;
          h = parseFloat(el.getAttribute("height")) || 0;
        } else {
          // Los espacios suelen estar ocultos (display:none) y getBBox() de un elemento
          // oculto mide 0: se muestra solo mientras se mide (el sandbox es invisible).
          var displayPrevio = el.style.getPropertyValue("display");
          var prioridadPrevia = el.style.getPropertyPriority("display");
          el.style.setProperty("display", "inline", "important");
          var bbox;
          try { bbox = el.getBBox(); } catch (_e) { bbox = null; }
          if (displayPrevio) el.style.setProperty("display", displayPrevio, prioridadPrevia);
          else el.style.removeProperty("display");
          if (!bbox) return null;
          x = bbox.x; y = bbox.y; w = bbox.width; h = bbox.height;
        }
        var ctm = el.getCTM();
        var m = ctm && rootInv ? rootInv.multiply(ctm) : null;
        var sx = m ? Math.hypot(m.a, m.b) : 1;
        var sy = m ? Math.hypot(m.c, m.d) : 1;
        var centro = transformar(m, x + w / 2, y + h / 2);
        return {
          cx: centro.x,
          cy: centro.y,
          w: w * sx,
          h: h * sy,
          angle: m ? Math.atan2(m.b, m.a) : 0,
          esquinas: [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(function (c) { return transformar(m, c[0], c[1]); }),
        };
      }

      function limitesDe(cajas) {
        var l = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
        cajas.forEach(function (c) {
          c.esquinas.forEach(function (p) {
            l.minX = Math.min(l.minX, p.x); l.maxX = Math.max(l.maxX, p.x);
            l.minY = Math.min(l.minY, p.y); l.maxY = Math.max(l.maxY, p.y);
          });
        });
        return l;
      }

      var vistos = {};
      var rooms = [];
      var cajas = [];
      svgEl.querySelectorAll("[id]").forEach(function (el) {
        var id = el.getAttribute("id");
        if (vistos[id] || !Etiquetas.esEspacio(el.tagName, id)) return;
        var caja = cajaDe(el);
        if (!caja || caja.w <= 2 || caja.h <= 2) return;
        vistos[id] = true;
        rooms.push({ id: id, cx: caja.cx, cy: caja.cy, w: caja.w, h: caja.h, angle: caja.angle });
        cajas.push(caja);
      });

      var contornoEl = svgEl.querySelector('[id="contorno_edificio"]');
      var contornoCaja = contornoEl ? cajaDe(contornoEl) : null;

      return {
        rooms: rooms,
        limites: limitesDe(cajas),
        contorno: contornoCaja && contornoCaja.w > 2 && contornoCaja.h > 2 ? limitesDe([contornoCaja]) : null,
        /** Caja de cualquier elemento por ID (para "Usted está aquí"). */
        cajaPorId: function (id) {
          if (!ID_VALIDO.test(id)) return null;
          var el = svgEl.querySelector('[id="' + id + '"]');
          return el ? cajaDe(el) : null;
        },
        /** Límites del lienzo del SVG (viewBox) en coordenadas raíz. */
        lienzo: (function () {
          var vb = svgEl.viewBox && svgEl.viewBox.baseVal;
          if (vb && vb.width > 0 && vb.height > 0) return { minX: vb.x, minY: vb.y, maxX: vb.x + vb.width, maxY: vb.y + vb.height };
          return limitesDe(cajas);
        })(),
        /**
         * Dibuja el plano (sin textos ni espacios ocultos) en un canvas 2D con Path2D, con
         * los colores del tema según la luminosidad original. aCanvas(x, y) -> [px, py] es lineal.
         * No usa <img> del SVG: el canvas nunca queda "contaminado" y no hay red.
         */
        dibujarFondo: function (ctx, lim, escala, paleta) {
          var formas = svgEl.querySelectorAll("path, rect, polygon");
          for (var i = 0; i < formas.length; i++) {
            var el = formas[i];
            if (el.closest("defs")) continue;
            var est = window.getComputedStyle(el);
            // El sandbox es invisible (visibility: hidden se hereda): solo cuenta display:none
            // del propio elemento o de un grupo del SVG que lo contenga.
            var oculto = false;
            for (var an = el; an && an !== svgEl; an = an.parentNode) {
              if (an.nodeType === 1 && window.getComputedStyle(an).display === "none") { oculto = true; break; }
            }
            if (oculto) continue;
            var trazo;
            var tag = el.tagName.toLowerCase();
            try {
              if (tag === "path") {
                trazo = new Path2D(el.getAttribute("d") || "");
              } else if (tag === "rect") {
                trazo = new Path2D();
                trazo.rect(parseFloat(el.getAttribute("x")) || 0, parseFloat(el.getAttribute("y")) || 0, parseFloat(el.getAttribute("width")) || 0, parseFloat(el.getAttribute("height")) || 0);
              } else {
                trazo = new Path2D("M" + (el.getAttribute("points") || "").trim() + "Z");
              }
            } catch (_e) {
              continue;
            }
            var ctm = el.getCTM();
            var m = ctm && rootInv ? rootInv.multiply(ctm) : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
            ctx.setTransform(m.a * escala, m.b * escala, m.c * escala, m.d * escala, (m.e - lim.minX) * escala, (m.f - lim.minY) * escala);
            var relleno = paleta(est.fill, parseFloat(est.fillOpacity));
            if (relleno) {
              ctx.fillStyle = relleno;
              ctx.fill(trazo, est.fillRule === "evenodd" ? "evenodd" : "nonzero");
            }
            var linea = est.stroke && est.stroke !== "none" ? paleta(est.stroke, parseFloat(est.strokeOpacity)) : null;
            var grosor = parseFloat(est.strokeWidth) || 0;
            if (linea && grosor > 0) {
              ctx.strokeStyle = linea;
              ctx.lineWidth = grosor;
              ctx.stroke(trazo);
            }
          }
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        },
      };
    }

    var esCampus = cfg.modo === "campus";

    /**
     * Suelo del campus: el mapa general (calles, estacionamiento, andadores y huellas de los
     * edificios) dibujado en una textura sobre una losa del tamaño del lienzo del SVG.
     */
    function construirSueloCampus(plano, scale, cx, cy) {
      var lim = plano.lienzo;
      var anchoSvg = lim.maxX - lim.minX, altoSvg = lim.maxY - lim.minY;
      var maxLado = gamaBaja ? 1024 : 2048;
      var esc = maxLado / Math.max(anchoSvg, altoSvg);
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.round(anchoSvg * esc));
      canvas.height = Math.max(2, Math.round(altoSvg * esc));
      var ctx = canvas.getContext("2d");
      // Zonas abiertas en verde suave; lo dibujado (calles, edificios) en grises del tema.
      ctx.fillStyle = isDark ? "#132219" : "#dcebd6";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      var oscuro = isDark ? [16, 21, 31] : [71, 85, 105];
      var claro = isDark ? [40, 52, 72] : [241, 245, 249];
      function paleta(color, opacidad) {
        var m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(color || "");
        if (!m) return null;
        var a = (m[4] !== undefined ? parseFloat(m[4]) : 1) * (isNaN(opacidad) ? 1 : opacidad);
        if (a <= 0.01) return null;
        var L = (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) / 255;
        // Blanco puro = fondo del dibujo: se deja ver el verde.
        if (L > 0.97) return null;
        var c = [0, 1, 2].map(function (i) { return Math.round(oscuro[i] + (claro[i] - oscuro[i]) * L); });
        return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
      }
      try {
        plano.dibujarFondo(ctx, lim, esc, paleta);
      } catch (_e) {
        // Sin dibujo del suelo: queda el color base (el campus sigue siendo usable).
      }
      var textura = new THREE.CanvasTexture(canvas);
      textura.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      var w = anchoSvg * scale, d = altoSvg * scale;
      var px = ((lim.minX + lim.maxX) / 2 - cx) * scale, pz = ((lim.minY + lim.maxY) / 2 - cy) * scale;
      var losa = new THREE.Mesh(new THREE.BoxGeometry(w + 8, 2, d + 8), materials.slab);
      losa.position.set(px, -1.02, pz);
      losa.receiveShadow = true;
      floorGroup.add(losa);
      var suelo = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: textura, roughness: 0.9, metalness: 0 }));
      suelo.rotation.x = -Math.PI / 2;
      suelo.position.set(px, 0.03, pz);
      suelo.receiveShadow = true;
      floorGroup.add(suelo);
    }

    function buildFloorFromSvg(svgText) {
      var plano = medirPlano(svgText, document.getElementById("svg-parser-sandbox"));
      if (!plano || plano.rooms.length === 0) {
        fallar("sin_aulas");
        return;
      }
      planoActivo = plano;
      var rawRooms = plano.rooms;
      var minX = plano.limites.minX, maxX = plano.limites.maxX;
      var minY = plano.limites.minY, maxY = plano.limites.maxY;

      var buildingW = maxX - minX;
      var buildingD = maxY - minY;
      var buildingCenterX = (minX + maxX) / 2;
      var buildingCenterY = (minY + maxY) / 2;

      var targetSceneSize = 110;
      var scale = targetSceneSize / Math.max(buildingW, buildingD);
      normalizacion = { cx: buildingCenterX, cy: buildingCenterY, scale: scale };

      var floorW = buildingW * scale + 18;
      var floorD = buildingD * scale + 18;

      if (esCampus) {
        construirSueloCampus(plano, scale, buildingCenterX, buildingCenterY);
      } else {
        // A. Suelo Base (Slab)
        var slabGeo = new THREE.BoxGeometry(floorW, 2, floorD);
        var slabMesh = new THREE.Mesh(slabGeo, materials.slab);
        slabMesh.position.set(0, -1, 0);
        slabMesh.receiveShadow = true;
        floorGroup.add(slabMesh);

        // B. Capa de Pasillos
        var corridorGeo = new THREE.PlaneGeometry(floorW - 4, floorD - 4);
        var corridorMesh = new THREE.Mesh(corridorGeo, materials.corridor);
        corridorMesh.rotation.x = -Math.PI / 2;
        corridorMesh.position.set(0, 0.04, 0);
        corridorMesh.receiveShadow = true;
        floorGroup.add(corridorMesh);
      }

      // C. Aulas extruidas y billboards
      var roomExtrudeHeight = ALTURA_AULA;

      rawRooms.forEach(function (room) {
        try {
          var boxW = room.w * scale;
          var boxD = room.h * scale;

          var worldX = (room.cx - buildingCenterX) * scale;
          var worldZ = (room.cy - buildingCenterY) * scale;
          var serviceType = esCampus ? null : Etiquetas.tipoServicio(room.id);
          var idMin = room.id.toLowerCase();
          var pisos = esCampus ? (CAMPUS_UNA_PLANTA[idMin] ? 1 : 2) : 1;
          var altoEspacio = esCampus ? ALTURA_PISO_CAMPUS * pisos + 1 : roomExtrudeHeight;
          // Cada espacio tiene forma propia (salón, escalera, baño o edificio del campus); su
          // caja queda invisible (solo para tocarla y para resaltarla al seleccionarla).
          var forma = esCampus ? formaEdificioCampus(boxW, boxD, pisos, !!CAMPUS_CRISTAL[idMin]) : formaPropia(serviceType, boxW, boxD);
          var defaultMat = forma ? matInvisible : [
            materials.roomWall,
            materials.roomWall,
            materials.roomTop,
            materials.roomWall,
            materials.roomWall,
            materials.roomWall,
          ];

          var roomMesh = new THREE.Mesh(cajaUnitaria, defaultMat);
          roomMesh.scale.set(boxW, altoEspacio, boxD);
          roomMesh.position.set(worldX, altoEspacio / 2, worldZ);
          // SVG (x, y hacia abajo) -> mundo (x, z): una rotación θ del plano equivale a rotation.y = -θ
          roomMesh.rotation.y = -room.angle;
          roomMesh.castShadow = !forma;
          roomMesh.receiveShadow = !forma;
          roomMesh.userData = { id: room.id, name: room.id, defaultMaterial: defaultMat, isRoom: true };

          if (forma) {
            roomMesh.userData.forma = forma;
            forma.position.set(worldX, 0, worldZ);
            forma.rotation.y = -room.angle;
            floorGroup.add(forma);
          } else {
            var edgeLines = new THREE.LineSegments(contornoUnitario, materials.edge);
            // El contorno es decorativo: no participa en la selección (escalado, su umbral
            // de raycast crecería con el aula y "taparía" los clics).
            edgeLines.raycast = function () {};
            roomMesh.add(edgeLines);
          }

          floorGroup.add(roomMesh);
          roomMeshes[room.id.toLowerCase()] = roomMesh;
          interactiveObjects.push(roomMesh);

          // D. Billboard
          var billboardSprite = null;

          if (serviceType) {
            billboardSprite = createServiceBillboard(serviceType);
          } else {
            var et = esCampus ? etiquetaEdificio(room.id) : Etiquetas.etiqueta(room.id);
            billboardSprite = createClassroomBillboard(et.codigo, et.categoria);
          }
          billboardSprite.position.set(worldX, altoEspacio + 4.2, worldZ);

          billboardSprite.userData = { id: room.id, name: room.id, isBillboard: true, roomMesh: roomMesh };
          floorGroup.add(billboardSprite);
          interactiveObjects.push(billboardSprite);
          roomMesh.userData.billboard = billboardSprite;
        } catch (_e) {
          // Un aula defectuosa no impide construir el resto del edificio.
        }
      });

      renderer.shadowMap.needsUpdate = true;
      pedirRender();

      if (loader) {
        loader.style.opacity = "0";
        setTimeout(function () { loader.style.display = "none"; }, 400);
      }

      var apilable = cfg.svgSecundario ? construirPlantaFantasma(cfg.svgSecundario, cfg.secundariaEsSuperior) : false;
      var aquiEncontrado = colocarUstedEstaAqui(cfg.aqui);
      if (apilable) document.getElementById("btn-plantas").hidden = false;

      sendToHost({
        type: "KIOSK_READY",
        totalRooms: rawRooms.length,
        plantasApilables: apilable,
        aquiEncontrado: aquiEncontrado,
        // Centros en coordenadas del SVG: permiten verificar que el 3D coincide con el 2D.
        rooms: rawRooms.map(function (r) {
          return { id: r.id, cx: Math.round(r.cx * 10) / 10, cy: Math.round(r.cy * 10) / 10 };
        }),
      });
    }

    try {
      buildFloorFromSvg(cfg.svg);
    } catch (err) {
      fallar("construccion", err && err.message);
    }
    if (fallido) return;

    // 7b. Otra planta apilada: un piso sólido (losa, pasillo, espacios e iconos) separado
    // en vertical, como un directorio de plantas visto de lado. Los planos de cada planta
    // tienen su propio sistema de coordenadas: solo se alinean si AMBOS incluyen el
    // rectángulo de referencia "contorno_edificio". Sin él, no se ofrece.
    // Sin "= null": se asigna durante buildFloorFromSvg, que se ejecuta antes de esta línea.
    var grupoFantasma;
    var vistaPrevia = null; // cámara antes de apilar (se restaura al ocultar)

    /** Etiqueta "Planta baja/alta" junto a la losa de cada piso. */
    function crearEtiquetaPlanta(texto) {
      var textura = texturaDe("planta|" + texto, function () {
        var canvas = document.createElement("canvas");
        canvas.width = 384;
        canvas.height = 96;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = isDark ? "#1e293b" : "#0f172a";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(4, 4, 376, 88, 24); else ctx.rect(4, 4, 376, 88);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fuenteQueCabe(ctx, texto, 46, 20, 340), 192, 50);
        return canvas;
      });
      var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthTest: false }));
      sprite.scale.set(20, 5, 1);
      sprite.renderOrder = 20;
      sprite.raycast = function () {};
      return sprite;
    }

    function construirPlantaFantasma(svgTexto, esSuperior) {
      if (!planoActivo || !planoActivo.contorno || !normalizacion) return false;
      var otro = medirPlano(svgTexto, document.getElementById("svg-parser-sandbox-2"));
      if (!otro || !otro.contorno || !otro.rooms.length) return false;
      var a = planoActivo.contorno, b = otro.contorno;
      var kx = (a.maxX - a.minX) / (b.maxX - b.minX);
      var ky = (a.maxY - a.minY) / (b.maxY - b.minY);
      var n = normalizacion;
      /** Punto de la otra planta -> mundo 3D (alineado por el contorno del edificio). */
      function aMundo(x, y) {
        return { x: (a.minX + (x - b.minX) * kx - n.cx) * n.scale, z: (a.minY + (y - b.minY) * ky - n.cy) * n.scale };
      }

      var nivel = esSuperior ? SEPARACION_PLANTAS : -SEPARACION_PLANTAS;
      grupoFantasma = new THREE.Group();
      grupoFantasma.position.y = nivel;

      // Losa y pasillo del tamaño de la otra planta (mismos márgenes que la activa).
      var p0 = aMundo(otro.limites.minX, otro.limites.minY), p1 = aMundo(otro.limites.maxX, otro.limites.maxY);
      var losaW = Math.abs(p1.x - p0.x) + 18, losaD = Math.abs(p1.z - p0.z) + 18;
      var cx = (p0.x + p1.x) / 2, cz = (p0.z + p1.z) / 2;
      var losa = new THREE.Mesh(new THREE.BoxGeometry(losaW, 2, losaD), materials.slab);
      losa.position.set(cx, -1, cz);
      var pasillo = new THREE.Mesh(new THREE.PlaneGeometry(losaW - 4, losaD - 4), materials.corridor);
      pasillo.rotation.x = -Math.PI / 2;
      pasillo.position.set(cx, 0.04, cz);
      [losa, pasillo].forEach(function (o) { o.raycast = function () {}; grupoFantasma.add(o); });

      var materialEspacio = [materials.roomWall, materials.roomWall, materials.roomTop, materials.roomWall, materials.roomWall, materials.roomWall];
      otro.rooms.forEach(function (r) {
        var p = aMundo(r.cx, r.cy);
        var tipo = Etiquetas.tipoServicio(r.id);
        var w = r.w * kx * n.scale, d = r.h * ky * n.scale;
        var forma = formaPropia(tipo, w, d);
        var caja = new THREE.Mesh(cajaUnitaria, forma ? matInvisible : materialEspacio);
        caja.scale.set(w, ALTURA_AULA, d);
        caja.position.set(p.x, ALTURA_AULA / 2, p.z);
        caja.rotation.y = -r.angle;
        // Se puede tocar: la app abre esa planta con el espacio resaltado.
        caja.userData = { id: r.id, name: r.id, esEspacio: true, plantaOtra: true };
        interactiveObjects.push(caja);
        if (forma) {
          forma.position.set(p.x, 0, p.z);
          forma.rotation.y = -r.angle;
          grupoFantasma.add(forma);
        } else {
          var lineas = new THREE.LineSegments(contornoUnitario, materials.edge);
          lineas.raycast = function () {};
          caja.add(lineas);
        }
        grupoFantasma.add(caja);

        // Baños, escaleras y demás servicios se ven también en la otra planta.
        var et = tipo ? null : Etiquetas.etiqueta(r.id);
        var cartel = tipo ? createServiceBillboard(tipo) : createClassroomBillboard(et.codigo, et.categoria);
        cartel.position.set(p.x, ALTURA_AULA + 4.2, p.z);
        cartel.userData = { id: r.id, roomMesh: caja };
        interactiveObjects.push(cartel);
        grupoFantasma.add(cartel);
      });

      // Nombre de cada planta, a la izquierda de su losa.
      var nombreOtra = esSuperior ? "Planta alta" : "Planta baja";
      var nombreActiva = esSuperior ? "Planta baja" : "Planta alta";
      var etiquetaOtra = crearEtiquetaPlanta(nombreOtra);
      etiquetaOtra.position.set(cx - losaW / 2 - 15, 2, cz);
      grupoFantasma.add(etiquetaOtra);
      var etiquetaActiva = crearEtiquetaPlanta(nombreActiva + " (actual)");
      etiquetaActiva.position.set(-((planoActivo.limites.maxX - planoActivo.limites.minX) * n.scale + 18) / 2 - 15, 2 - nivel, 0);
      grupoFantasma.add(etiquetaActiva);

      grupoFantasma.visible = false;
      scene.add(grupoFantasma);
      return true;
    }

    function plantaOtra() {
      return cfg.plantaActiva === "alta" ? "baja" : "alta";
    }

    function alternarPlantas(mostrar) {
      if (!grupoFantasma) return;
      var antes = grupoFantasma.visible;
      grupoFantasma.visible = typeof mostrar === "boolean" ? mostrar : !grupoFantasma.visible;
      var btn = document.getElementById("btn-plantas");
      btn.setAttribute("aria-pressed", grupoFantasma.visible ? "true" : "false");
      btn.setAttribute("aria-label", grupoFantasma.visible ? "Ocultar la otra planta" : "Ver ambas plantas");
      if (grupoFantasma.visible && !antes) {
        // Vista de lado que encuadra ambas plantas (como un directorio de pisos).
        vistaPrevia = { radius: spherical.radius, theta: spherical.theta, phi: spherical.phi, target: cameraTarget.clone() };
        spherical.radius = 245;
        spherical.phi = 1.17;
        targetCameraLerp = null;
        cameraTarget.set(0, grupoFantasma.position.y / 2, 0);
        scene.fog.near = 260;
        scene.fog.far = 620;
        updateCameraPosition();
      } else if (!grupoFantasma.visible && antes) {
        scene.fog.near = 150;
        scene.fog.far = 480;
        if (vistaPrevia) {
          spherical.radius = vistaPrevia.radius;
          spherical.theta = vistaPrevia.theta;
          spherical.phi = vistaPrevia.phi;
          cameraTarget.copy(vistaPrevia.target);
          vistaPrevia = null;
        }
        targetCameraLerp = null;
        updateCameraPosition();
      }
      pedirRender();
    }

    // 7c. "Usted está aquí": pin, anillo y etiqueta sobre un elemento del plano.
    var anilloAqui; // idem: se asigna durante la construcción

    function colocarUstedEstaAqui(id) {
      if (!id || !planoActivo || !normalizacion) return false;
      var caja = planoActivo.cajaPorId(id);
      if (!caja) return false;
      var n = normalizacion;
      var x = (caja.cx - n.cx) * n.scale, z = (caja.cy - n.cy) * n.scale;
      var base = roomMeshes[id.toLowerCase()] ? ALTURA_AULA : 0.1;
      var verde = 0x10b981;

      var grupo = new THREE.Group();
      var poste = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 9, 12), new THREE.MeshStandardMaterial({ color: verde }));
      poste.position.set(0, 4.5, 0);
      var cabeza = new THREE.Mesh(new THREE.SphereGeometry(1.4, 20, 14), new THREE.MeshStandardMaterial({ color: verde, emissive: verde, emissiveIntensity: 0.4 }));
      cabeza.position.set(0, 9.5, 0);
      anilloAqui = new THREE.Mesh(
        new THREE.RingGeometry(1.6, 2.4, 40),
        new THREE.MeshBasicMaterial({ color: verde, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
      );
      anilloAqui.rotation.x = -Math.PI / 2;
      anilloAqui.position.set(0, 0.15, 0);
      [poste, cabeza, anilloAqui].forEach(function (o) { o.raycast = function () {}; grupo.add(o); });

      var textura = texturaDe("aqui", function () {
        var canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 80;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(4, 4, 312, 72, 36); else ctx.rect(4, 4, 312, 72);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fuenteQueCabe(ctx, "USTED ESTÁ AQUÍ", 34, 18, 280), 160, 42);
        return canvas;
      });
      var etiquetaAqui = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthTest: false }));
      etiquetaAqui.scale.set(14, 3.5, 1);
      etiquetaAqui.position.set(0, 13.5, 0);
      etiquetaAqui.renderOrder = 20;
      etiquetaAqui.raycast = function () {};
      grupo.add(etiquetaAqui);

      grupo.position.set(x, base, z);
      scene.add(grupo);
      return true;
    }

    // 8. Raycasting para Selección por Toque o Clic
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();

    /**
     * Busca el aula: 1) coincidencia exacta; 2) una clave que extienda el ID o sea
     * extendida por él respetando la frontera "_" (aula_1 NO coincide con aula_10),
     * solo si la candidata es ÚNICA: un ID ambiguo no selecciona nada al azar.
     */
    function buscarAula(cleanId) {
      if (roomMeshes[cleanId]) return roomMeshes[cleanId];
      var candidatas = Object.keys(roomMeshes).filter(function (k) {
        return k.indexOf(cleanId + "_") === 0 || cleanId.indexOf(k + "_") === 0;
      });
      return candidatas.length === 1 ? roomMeshes[candidatas[0]] : null;
    }

    function limpiarSeleccion() {
      if (currentSelectedMesh) pintarSeleccion(currentSelectedMesh, false);
      currentSelectedMesh = null;
      pedirRender();
    }

    /** notificar=false cuando la selección viene de la app (evita el ciclo app -> motor -> app). */
    function selectRoomById(id, animateCamera, notificar) {
      if (!id) return;
      var targetMesh = buscarAula(id.toLowerCase());
      if (!targetMesh) return;

      if (currentSelectedMesh && currentSelectedMesh !== targetMesh) {
        pintarSeleccion(currentSelectedMesh, false);
      }

      currentSelectedMesh = targetMesh;
      pintarSeleccion(currentSelectedMesh, true);

      if (animateCamera !== false) {
        moverCamaraA(new THREE.Vector3(targetMesh.position.x, 0, targetMesh.position.z));
      }
      pedirRender();

      if (notificar !== false) {
        sendToHost({ type: "AULA_CLICK", id: targetMesh.userData.id, name: targetMesh.userData.name, planta: cfg.plantaActiva });
      }
    }

    function handleRaycast(clientX, clientY) {
      // Tamaño actual (no el del arranque): tras rotar o redimensionar el clic sigue siendo exacto.
      var rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      var intersects = raycaster.intersectObjects(interactiveObjects, true);

      // Primer impacto que corresponda a un aula (o a su etiqueta).
      for (var i = 0; i < intersects.length; i++) {
        var hit = intersects[i].object;
        var targetMesh = hit.userData.roomMesh || (hit.userData.isRoom || hit.userData.plantaOtra ? hit : null);
        if (!targetMesh || !targetMesh.userData || !targetMesh.userData.id) continue;
        if (targetMesh.userData.plantaOtra) {
          // La otra planta solo se puede tocar mientras se ve (el raycaster no mira "visible").
          if (!grupoFantasma || !grupoFantasma.visible) continue;
          sendToHost({ type: "AULA_CLICK", id: targetMesh.userData.id, name: targetMesh.userData.id, planta: plantaOtra() });
          return;
        }
        selectRoomById(targetMesh.userData.id, true, true);
        return;
      }
    }

    // 9. Controles Táctiles y Ratón (Click vs Pan)
    var isDragging = false;
    var dragMode = "pan";
    var previousMousePosition = { x: 0, y: 0 };
    var pointerDownPos = { x: 0, y: 0 };
    var initialPinchDistance = null;

    function enControles(e) {
      return !!(e.target && e.target.closest && e.target.closest("#controles"));
    }

    window.addEventListener("mousedown", function (e) {
      if (enControles(e)) return;
      isDragging = true;
      dragMode = e.button === 2 || e.shiftKey ? "rotate" : "pan";
      previousMousePosition = { x: e.clientX, y: e.clientY };
      pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });

    window.addEventListener("mousemove", function (e) {
      if (!isDragging) return;
      var deltaX = e.clientX - previousMousePosition.x;
      var deltaY = e.clientY - previousMousePosition.y;

      if (dragMode === "rotate") {
        spherical.theta -= deltaX * 0.0075;
        spherical.phi = Math.max(0.45, Math.min(Math.PI / 2.15, spherical.phi - deltaY * 0.0075));
      } else {
        var forward = new THREE.Vector3(-Math.sin(spherical.theta), 0, -Math.cos(spherical.theta));
        var right = new THREE.Vector3(Math.cos(spherical.theta), 0, -Math.sin(spherical.theta));
        var panSpeed = spherical.radius * 0.0018;

        cameraTarget.addScaledVector(right, -deltaX * panSpeed);
        cameraTarget.addScaledVector(forward, -deltaY * panSpeed);
        targetCameraLerp = null;
      }

      updateCameraPosition();
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("mouseup", function (e) {
      if (isDragging) {
        var moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (moveDist < 6 && e.button === 0) {
          handleRaycast(e.clientX, e.clientY);
        }
      }
      isDragging = false;
    });

    window.addEventListener("wheel", function (e) {
      e.preventDefault();
      var zoomSpeed = spherical.radius * 0.0015;
      spherical.radius = Math.max(45, Math.min(320, spherical.radius + e.deltaY * zoomSpeed));
      updateCameraPosition();
    }, { passive: false });

    // Eventos Multi-Touch
    window.addEventListener("touchstart", function (e) {
      if (enControles(e)) return;
      if (e.touches.length === 1) {
        isDragging = true;
        dragMode = "pan";
        pointerDownPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        isDragging = true;
        dragMode = "multi";
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistance = Math.hypot(dx, dy);
        previousMousePosition = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    }, { passive: false });

    window.addEventListener("touchmove", function (e) {
      if (!isDragging) return;
      e.preventDefault();

      if (e.touches.length === 1 && dragMode === "pan") {
        var curX = e.touches[0].clientX;
        var curY = e.touches[0].clientY;
        var deltaX = curX - previousMousePosition.x;
        var deltaY = curY - previousMousePosition.y;

        var forward = new THREE.Vector3(-Math.sin(spherical.theta), 0, -Math.cos(spherical.theta));
        var right = new THREE.Vector3(Math.cos(spherical.theta), 0, -Math.sin(spherical.theta));
        var panSpeed = spherical.radius * 0.0022;

        cameraTarget.addScaledVector(right, -deltaX * panSpeed);
        cameraTarget.addScaledVector(forward, -deltaY * panSpeed);
        targetCameraLerp = null;

        updateCameraPosition();
        previousMousePosition = { x: curX, y: curY };
      } else if (e.touches.length === 2) {
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        var currentDistance = Math.hypot(dx, dy);

        if (initialPinchDistance) {
          var pinchDelta = initialPinchDistance - currentDistance;
          spherical.radius = Math.max(45, Math.min(320, spherical.radius + pinchDelta * 0.45));
          initialPinchDistance = currentDistance;
        }

        var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        var rotDeltaX = midX - previousMousePosition.x;
        var rotDeltaY = midY - previousMousePosition.y;

        spherical.theta -= rotDeltaX * 0.009;
        spherical.phi = Math.max(0.45, Math.min(Math.PI / 2.15, spherical.phi - rotDeltaY * 0.009));

        previousMousePosition = { x: midX, y: midY };
        updateCameraPosition();
      }
    }, { passive: false });

    window.addEventListener("touchend", function (e) {
      if (e.touches.length === 0) {
        if (isDragging && dragMode === "pan") {
          var moveDist = Math.hypot(previousMousePosition.x - pointerDownPos.x, previousMousePosition.y - pointerDownPos.y);
          if (moveDist < 8) {
            handleRaycast(previousMousePosition.x, previousMousePosition.y);
          }
        }
        isDragging = false;
        initialPinchDistance = null;
      } else if (e.touches.length === 1) {
        dragMode = "pan";
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });

    window.addEventListener("resize", function () {
      var w = container.clientWidth || window.innerWidth;
      var h = container.clientHeight || window.innerHeight;
      width = w;
      height = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(calcularPixelRatio(w, h));
      renderer.setSize(w, h);
      pedirRender();
    });

    // 9c. Controles de cámara (botones, teclado) y modo quiosco
    function moverCamaraA(destino) {
      if (movimientoReducido) {
        cameraTarget.copy(destino);
        targetCameraLerp = null;
        updateCameraPosition();
      } else {
        targetCameraLerp = destino;
        pedirRender();
      }
    }

    function vistaInicial() {
      spherical.radius = RADIO_INICIAL;
      spherical.theta = Math.PI / 4;
      spherical.phi = Math.PI / 3.2;
      moverCamaraA(new THREE.Vector3(0, 0, 0));
      updateCameraPosition();
    }

    function acercar(factor) {
      spherical.radius = Math.max(45, Math.min(320, spherical.radius * factor));
      updateCameraPosition();
    }

    function desplazar(dx, dz) {
      var forward = new THREE.Vector3(-Math.sin(spherical.theta), 0, -Math.cos(spherical.theta));
      var right = new THREE.Vector3(Math.cos(spherical.theta), 0, -Math.sin(spherical.theta));
      var paso = spherical.radius * 0.06;
      cameraTarget.addScaledVector(right, dx * paso);
      cameraTarget.addScaledVector(forward, dz * paso);
      targetCameraLerp = null;
      updateCameraPosition();
    }

    function rotar(angulo) {
      spherical.theta += angulo;
      updateCameraPosition();
    }

    // Inactividad (modo quiosco): limpia la selección y vuelve a la vista inicial.
    var temporizadorInactividad = null;
    function registrarActividad() {
      if (!cfg.inactividadMs) return;
      if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
      temporizadorInactividad = setTimeout(alQuedarInactivo, cfg.inactividadMs);
    }
    function alQuedarInactivo() {
      var habiaSeleccion = !!currentSelectedMesh;
      limpiarSeleccion();
      alternarPlantas(false);
      vistaInicial();
      if (habiaSeleccion) sendToHost({ type: "SELECCION_LIMPIADA", motivo: "inactividad" });
    }
    ["mousedown", "touchstart", "wheel", "keydown"].forEach(function (ev) {
      window.addEventListener(ev, registrarActividad, { passive: true });
    });
    registrarActividad();

    function enlazarBoton(id, accion) {
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", function (e) { e.stopPropagation(); accion(); });
    }
    enlazarBoton("btn-acercar", function () { acercar(0.8); });
    enlazarBoton("btn-alejar", function () { acercar(1.25); });
    enlazarBoton("btn-inicio", vistaInicial);
    enlazarBoton("btn-plantas", function () { alternarPlantas(); });

    // Teclado: flechas mueven, +/- acercan, Q/E giran, Inicio/R vista inicial, Esc quita la selección.
    window.addEventListener("keydown", function (e) {
      if (e.target && e.target.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
      var k = e.key;
      var manejada = true;
      if (k === "ArrowLeft") desplazar(-1, 0);
      else if (k === "ArrowRight") desplazar(1, 0);
      else if (k === "ArrowUp") desplazar(0, 1);
      else if (k === "ArrowDown") desplazar(0, -1);
      else if (k === "+" || k === "=") acercar(0.8);
      else if (k === "-" || k === "_") acercar(1.25);
      else if (k === "q" || k === "Q") rotar(0.15);
      else if (k === "e" || k === "E") rotar(-0.15);
      else if (k === "Home" || k === "r" || k === "R") vistaInicial();
      else if (k === "Escape" && currentSelectedMesh) {
        limpiarSeleccion();
        sendToHost({ type: "SELECCION_LIMPIADA", motivo: "teclado" });
      } else manejada = false;
      if (manejada) e.preventDefault();
    });

    // Descripción accesible del lienzo
    container.setAttribute("aria-label",
      "Mapa 3D" + (cfg.titulo ? " del " + cfg.titulo : "") +
      ". Flechas para mover, más y menos para acercar, Q y E para girar, Inicio para la vista inicial y Escape para quitar el resaltado.");

    // Selección inicial (misma lógica de búsqueda que las selecciones posteriores)
    if (selectedTargetId) selectRoomById(selectedTargetId, true, false);
    // Vista interior desde el campus: ambas plantas a la vez.
    if (cfg.vistaApilada && grupoFantasma) alternarPlantas(true);

    motor = {
      seleccionar: function (id) { selectRoomById(id, true, false); },
      limpiar: limpiarSeleccion,
      actividad: registrarActividad,
    };

    // Diagnóstico de solo lectura (pruebas automáticas y depuración en DevTools).
    window.__kiosco = Object.freeze({
      seleccion: function () {
        return currentSelectedMesh ? currentSelectedMesh.userData.id : null;
      },
      aulas: function () {
        return Object.keys(roomMeshes);
      },
      /** Cómo se ve un espacio: si su caja es visible y cuántas piezas de su forma propia están resaltadas. */
      aspecto: function (id) {
        var mesh = roomMeshes[String(id).toLowerCase()];
        if (!mesh) return null;
        var piezas = 0, resaltadas = 0;
        if (mesh.userData.forma) {
          mesh.userData.forma.traverse(function (o) {
            if (!o.isMesh) return;
            piezas++;
            if (o.material === materials.roomSelected) resaltadas++;
          });
        }
        return { cajaVisible: mesh.material.visible !== false && mesh.material !== matInvisible, piezas: piezas, resaltadas: resaltadas };
      },
      /** Métricas de rendimiento y memoria gráfica. */
      info: function () {
        return {
          cuadros: cuadrosDibujados,
          geometrias: renderer.info.memory.geometries,
          texturas: renderer.info.memory.textures,
          pixelRatio: renderer.getPixelRatio(),
          antialias: usarAntialias,
          gamaBaja: gamaBaja,
          sombrasPorCuadro: renderer.shadowMap.autoUpdate,
          plantasApiladasVisibles: !!(grupoFantasma && grupoFantasma.visible),
          aqui: !!anilloAqui,
          movimientoReducido: movimientoReducido,
          murosCristal: murosCristal,
          modo: cfg.modo,
          radio: Math.round(spherical.radius),
          objetivo: [Math.round(cameraTarget.x * 10) / 10, Math.round(cameraTarget.z * 10) / 10],
        };
      },
      /** Posiciones (x, z) en el mundo de las aulas activas y de la planta apilada. */
      posiciones: function () {
        var r = function (v) { return Math.round(v * 10) / 10; };
        return {
          aulas: Object.keys(roomMeshes).map(function (k) { return [r(roomMeshes[k].position.x), r(roomMeshes[k].position.z)]; }),
          fantasma: grupoFantasma ? grupoFantasma.children.filter(function (c) { return c.userData.esEspacio; }).map(function (c) { return [r(c.position.x), r(c.position.z)]; }) : null,
          // Espacios de la otra planta (IDs) y su altura en el mundo (separación vertical).
          fantasmaIds: grupoFantasma ? grupoFantasma.children.filter(function (c) { return c.userData.esEspacio; }).map(function (c) { return c.userData.id; }) : null,
          nivelOtraPlanta: grupoFantasma ? grupoFantasma.position.y : null,
          // Contorno del edificio de la planta activa en coordenadas 3D: [x0, z0, x1, z1]
          contorno: planoActivo && planoActivo.contorno && normalizacion ? (function (c, n) {
            return [r((c.minX - n.cx) * n.scale), r((c.minY - n.cy) * n.scale), r((c.maxX - n.cx) * n.scale), r((c.maxY - n.cy) * n.scale)];
          })(planoActivo.contorno, normalizacion) : null,
        };
      },
      /** Posición en pantalla (px del iframe) del centro superior de un aula. */
      pantalla: function (id, otraPlanta) {
        var clave = String(id).toLowerCase();
        var mesh = null;
        if (otraPlanta) {
          // Espacio de la planta apilada (posición en el mundo: el grupo está desplazado en Y).
          if (!grupoFantasma) return null;
          grupoFantasma.children.forEach(function (c) {
            if (c.userData.plantaOtra && String(c.userData.id).toLowerCase() === clave) mesh = c;
          });
        } else {
          mesh = roomMeshes[clave];
        }
        if (!mesh) return null;
        mesh.updateMatrixWorld(true);
        var centro = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
        var p = new THREE.Vector3(centro.x, centro.y + mesh.scale.y / 2, centro.z).project(camera);
        var r = container.getBoundingClientRect();
        return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
      },
    });

    // 9b. Pérdida y recuperación del contexto WebGL
    var contextoPerdido = false;
    var temporizadorContexto = null;
    var avisoContexto = document.createElement("div");
    avisoContexto.id = "aviso-contexto";
    avisoContexto.textContent = "Recuperando gráficos…";
    avisoContexto.hidden = true;
    document.body.appendChild(avisoContexto);

    renderer.domElement.addEventListener("webglcontextlost", function (e) {
      e.preventDefault(); // permite que el navegador restaure el contexto
      contextoPerdido = true;
      avisoContexto.hidden = false;
      temporizadorContexto = setTimeout(function () {
        if (contextoPerdido) fallar("contexto");
      }, 5000);
    });
    renderer.domElement.addEventListener("webglcontextrestored", function () {
      contextoPerdido = false;
      avisoContexto.hidden = true;
      if (temporizadorContexto) clearTimeout(temporizadorContexto);
      renderer.shadowMap.needsUpdate = true;
      pedirRender();
    });

    // Al cerrar o reemplazar la escena se libera la memoria gráfica de inmediato
    // (sin esperar al recolector), importante en móviles y quioscos encendidos todo el día.
    window.addEventListener("pagehide", function () {
      scene.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(function (m) {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      Object.keys(cacheTexturas).forEach(function (k) { cacheTexturas[k].dispose(); });
      renderer.dispose();
      renderer.forceContextLoss();
    });

    // 10. Bucle de Renderizado bajo demanda
    var INTERVALO_PULSO_MS = 50; // pulso del aula seleccionada a ~20 cuadros/s
    var ultimoPulso = 0;
    var ultimoCuadroCamara = 0;

    function cuadro() {
      frameProgramado = false;
      if (fallido || contextoPerdido || !renderer) return;
      var continuar = false;

      if (targetCameraLerp) {
        // Suavizado según el tiempo real (no por cuadro): dura lo mismo a 60 o a 15 cuadros/s.
        var t = performance.now();
        // Más de 250 ms desde el último cuadro = el movimiento recién empieza (paso normal).
        var dt = t - ultimoCuadroCamara <= 250 ? t - ultimoCuadroCamara : 16.7;
        ultimoCuadroCamara = t;
        cameraTarget.lerp(targetCameraLerp, 1 - Math.pow(1 - 0.07, dt / 16.7));
        updateCameraPosition();
        if (cameraTarget.distanceTo(targetCameraLerp) < 0.15) {
          targetCameraLerp = null;
          ultimoCuadroCamara = 0;
        } else {
          continuar = true;
        }
      }

      if ((currentSelectedMesh || anilloAqui) && !movimientoReducido) {
        var ahora = performance.now();
        if (ahora - ultimoPulso >= INTERVALO_PULSO_MS) {
          ultimoPulso = ahora;
          if (currentSelectedMesh) {
            materials.roomSelected.emissiveIntensity = 0.45 + 0.25 * Math.sin(ahora * 0.006);
            matCristalSeleccionado.emissiveIntensity = materials.roomSelected.emissiveIntensity;
          }
          if (anilloAqui) {
            var fase = (ahora % 1800) / 1800;
            anilloAqui.scale.setScalar(1 + fase * 1.6);
            anilloAqui.material.opacity = 0.75 * (1 - fase);
          }
          necesitaRender = true;
        }
        continuar = true;
      } else if (currentSelectedMesh) {
        materials.roomSelected.emissiveIntensity = 0.6;
        matCristalSeleccionado.emissiveIntensity = 0.6;
      }

      if (necesitaRender) {
        necesitaRender = false;
        renderer.render(scene, camera);
        cuadrosDibujados++;
      }
      if (continuar) programar();
    }
    pedirRender();
  }
})();
