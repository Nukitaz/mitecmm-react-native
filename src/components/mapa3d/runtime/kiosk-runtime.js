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
        // "Usted está aquí": ID de un elemento del plano (validado).
        aqui: typeof data.aqui === "string" && ID_VALIDO.test(data.aqui) ? data.aqui : "",
        // Modo quiosco: volver a la vista inicial tras X ms sin uso (0 = desactivado).
        inactividadMs: inactividad >= 5000 && inactividad <= 3600000 ? inactividad : 0,
        titulo: typeof data.titulo === "string" ? data.titulo.slice(0, 80) : "",
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

    var spherical = {
      radius: 170,
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
    // Una sola caja unitaria y su contorno para TODAS las aulas (se escalan por aula).
    var cajaUnitaria = new THREE.BoxGeometry(1, 1, 1);
    var contornoUnitario = new THREE.EdgesGeometry(cajaUnitaria);
    var planoActivo = null;
    var normalizacion = null; // { cx, cy, scale }: coordenadas del SVG -> mundo 3D

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
      };
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

      // C. Aulas extruidas y billboards
      var roomExtrudeHeight = ALTURA_AULA;

      rawRooms.forEach(function (room) {
        try {
          var boxW = room.w * scale;
          var boxD = room.h * scale;

          var worldX = (room.cx - buildingCenterX) * scale;
          var worldZ = (room.cy - buildingCenterY) * scale;
          var defaultMat = [
            materials.roomWall,
            materials.roomWall,
            materials.roomTop,
            materials.roomWall,
            materials.roomWall,
            materials.roomWall,
          ];

          var roomMesh = new THREE.Mesh(cajaUnitaria, defaultMat);
          roomMesh.scale.set(boxW, roomExtrudeHeight, boxD);
          roomMesh.position.set(worldX, roomExtrudeHeight / 2, worldZ);
          // SVG (x, y hacia abajo) -> mundo (x, z): una rotación θ del plano equivale a rotation.y = -θ
          roomMesh.rotation.y = -room.angle;
          roomMesh.castShadow = true;
          roomMesh.receiveShadow = true;
          roomMesh.userData = { id: room.id, name: room.id, defaultMaterial: defaultMat, isRoom: true };

          var edgeLines = new THREE.LineSegments(contornoUnitario, materials.edge);
          // El contorno es decorativo: no participa en la selección (escalado, su umbral
          // de raycast crecería con el aula y "taparía" los clics).
          edgeLines.raycast = function () {};
          roomMesh.add(edgeLines);

          floorGroup.add(roomMesh);
          roomMeshes[room.id.toLowerCase()] = roomMesh;
          interactiveObjects.push(roomMesh);

          // D. Billboard
          var serviceType = Etiquetas.tipoServicio(room.id);
          var billboardSprite = null;

          if (serviceType) {
            billboardSprite = createServiceBillboard(serviceType);
          } else {
            var et = Etiquetas.etiqueta(room.id);
            billboardSprite = createClassroomBillboard(et.codigo, et.categoria);
          }
          billboardSprite.position.set(worldX, roomExtrudeHeight + 4.2, worldZ);

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

    // 7b. Otra planta apilada (semitransparente). Los planos de cada planta tienen su
    // propio sistema de coordenadas: solo se alinean si AMBOS incluyen el rectángulo de
    // referencia "contorno_edificio" con el contorno del edificio. Sin él, no se ofrece.
    // Sin "= null": se asigna durante buildFloorFromSvg, que se ejecuta antes de esta línea.
    var grupoFantasma;

    function construirPlantaFantasma(svgTexto, esSuperior) {
      if (!planoActivo || !planoActivo.contorno || !normalizacion) return false;
      var otro = medirPlano(svgTexto, document.getElementById("svg-parser-sandbox-2"));
      if (!otro || !otro.contorno || !otro.rooms.length) return false;
      var a = planoActivo.contorno, b = otro.contorno;
      var kx = (a.maxX - a.minX) / (b.maxX - b.minX);
      var ky = (a.maxY - a.minY) / (b.maxY - b.minY);
      var n = normalizacion;

      var color = isDark ? 0xa78bfa : 0x7c3aed;
      var matLinea = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.6, depthTest: false });
      var matCaja = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.1, depthWrite: false, depthTest: false });
      var alturaPiso = esSuperior ? ALTURA_AULA + 6 : -ALTURA_AULA - 4;
      var alto = 4;

      grupoFantasma = new THREE.Group();
      otro.rooms.forEach(function (r) {
        // Coordenadas de la otra planta -> coordenadas de la planta activa (por el contorno)
        var x = a.minX + (r.cx - b.minX) * kx;
        var y = a.minY + (r.cy - b.minY) * ky;
        var caja = new THREE.Mesh(cajaUnitaria, matCaja);
        caja.scale.set(r.w * kx * n.scale, alto, r.h * ky * n.scale);
        caja.position.set((x - n.cx) * n.scale, alturaPiso + alto / 2, (y - n.cy) * n.scale);
        caja.rotation.y = -r.angle;
        caja.renderOrder = 10;
        caja.raycast = function () {};
        var lineas = new THREE.LineSegments(contornoUnitario, matLinea);
        lineas.renderOrder = 11;
        lineas.raycast = function () {};
        caja.add(lineas);
        grupoFantasma.add(caja);
      });
      grupoFantasma.visible = false;
      scene.add(grupoFantasma);
      return true;
    }

    function alternarPlantas(mostrar) {
      if (!grupoFantasma) return;
      grupoFantasma.visible = typeof mostrar === "boolean" ? mostrar : !grupoFantasma.visible;
      var btn = document.getElementById("btn-plantas");
      btn.setAttribute("aria-pressed", grupoFantasma.visible ? "true" : "false");
      btn.setAttribute("aria-label", grupoFantasma.visible ? "Ocultar la otra planta" : "Ver ambas plantas");
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
      if (currentSelectedMesh) {
        currentSelectedMesh.material = currentSelectedMesh.userData.defaultMaterial;
      }
      currentSelectedMesh = null;
      pedirRender();
    }

    /** notificar=false cuando la selección viene de la app (evita el ciclo app -> motor -> app). */
    function selectRoomById(id, animateCamera, notificar) {
      if (!id) return;
      var targetMesh = buscarAula(id.toLowerCase());
      if (!targetMesh) return;

      if (currentSelectedMesh && currentSelectedMesh !== targetMesh) {
        currentSelectedMesh.material = currentSelectedMesh.userData.defaultMaterial;
      }

      currentSelectedMesh = targetMesh;
      currentSelectedMesh.material = materials.roomSelected;

      if (animateCamera !== false) {
        moverCamaraA(new THREE.Vector3(targetMesh.position.x, 0, targetMesh.position.z));
      }
      pedirRender();

      if (notificar !== false) {
        sendToHost({ type: "AULA_CLICK", id: targetMesh.userData.id, name: targetMesh.userData.name });
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
        var targetMesh = hit.userData.roomMesh || (hit.userData.isRoom ? hit : null);
        if (targetMesh && targetMesh.userData && targetMesh.userData.id) {
          selectRoomById(targetMesh.userData.id, true, true);
          return;
        }
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
      spherical.radius = 170;
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
          radio: Math.round(spherical.radius),
          objetivo: [Math.round(cameraTarget.x * 10) / 10, Math.round(cameraTarget.z * 10) / 10],
        };
      },
      /** Posiciones (x, z) en el mundo de las aulas activas y de la planta apilada. */
      posiciones: function () {
        var r = function (v) { return Math.round(v * 10) / 10; };
        return {
          aulas: Object.keys(roomMeshes).map(function (k) { return [r(roomMeshes[k].position.x), r(roomMeshes[k].position.z)]; }),
          fantasma: grupoFantasma ? grupoFantasma.children.map(function (c) { return [r(c.position.x), r(c.position.z)]; }) : null,
        };
      },
      /** Posición en pantalla (px del iframe) del centro superior de un aula. */
      pantalla: function (id) {
        var mesh = roomMeshes[String(id).toLowerCase()];
        if (!mesh) return null;
        var p = new THREE.Vector3(mesh.position.x, mesh.position.y * 2, mesh.position.z).project(camera);
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

    function cuadro() {
      frameProgramado = false;
      if (fallido || contextoPerdido || !renderer) return;
      var continuar = false;

      if (targetCameraLerp) {
        cameraTarget.lerp(targetCameraLerp, 0.07);
        updateCameraPosition();
        if (cameraTarget.distanceTo(targetCameraLerp) < 0.15) {
          targetCameraLerp = null;
        } else {
          continuar = true;
        }
      }

      if ((currentSelectedMesh || anilloAqui) && !movimientoReducido) {
        var ahora = performance.now();
        if (ahora - ultimoPulso >= INTERVALO_PULSO_MS) {
          ultimoPulso = ahora;
          if (currentSelectedMesh) materials.roomSelected.emissiveIntensity = 0.45 + 0.25 * Math.sin(ahora * 0.006);
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
