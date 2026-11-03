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
    } catch (e) {
      return;
    }
    if (!data || typeof data !== "object") return;
    if (data.type === "INIT" && !iniciado && typeof data.svg === "string") {
      iniciado = true;
      iniciar({
        svg: data.svg,
        isDark: data.isDark === true,
        selectedId: typeof data.selectedId === "string" && ID_VALIDO.test(data.selectedId) ? data.selectedId : "",
      });
    } else if (data.type === "SELECT_ROOM" && motor && typeof data.id === "string" && ID_VALIDO.test(data.id)) {
      // Selección pedida por la app: no se notifica de vuelta (evita ciclos).
      motor.seleccionar(data.id);
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

    function createClassroomBillboard(shortCode, category) {
      var texture = texturaDe("aula|" + category + "|" + shortCode, function () {
      var canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 128;
      var ctx = canvas.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(6, 6, 244, 116, 20);
      } else {
        ctx.rect(6, 6, 244, 116);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(category || "AULA", 128, 42);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 46px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(shortCode, 128, 92);
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

    function getServiceType(rawId) {
      var lower = (rawId || "").toLowerCase();
      if (lower.indexOf("bano") !== -1 || lower.indexOf("sanitario") !== -1 || lower.indexOf("wc") !== -1) return "restroom";
      if (lower.indexOf("medico") !== -1 || lower.indexOf("consultorio") !== -1) return "medical";
      if (lower.indexOf("vigilancia") !== -1 || lower.indexOf("paqueteria") !== -1) return "security";
      if (lower.indexOf("escalera") !== -1) return "stairs";
      if (lower.indexOf("carga") !== -1 || lower.indexOf("mantenimiento") !== -1) return "electric";
      return null;
    }

    function getShortCode(rawId) {
      var lower = (rawId || "").toLowerCase();
      var aulaM = lower.match(/aula_([a-z0-9]+)/);
      if (aulaM) return aulaM[1].toUpperCase();

      var siglas = {
        laboratorio_de_tecnologias_de_la_informacion_lti: "LTI",
        laboratorio_de_redes_lr: "LR",
        laboratorio_de_desarrollo_de_software_lds: "LDS",
        laboratorio_de_ingenieria_de_software_lis: "LIS",
        laboratorio_de_tecnologias_emergentes_let: "LET",
        laboratorio_de_inteligencia_artificial_lia: "LIA",
        laboratorio_de_computo_sistemas_lcs: "LCS",
        laboratorio_de_analisis_y_ciencia_de_datos_lacd: "LACD",
        laboratorio_de_worstation_ibm_lwi: "LWI",
        laboratorio_de_quimica: "QUÍMICA",
        laboratorio_de_fisica: "FÍSICA",
        laboratorio_de_manufactura: "MANUF.",
        laboratorio_de_metodos: "MÉTODOS",
        laboratorio_de_metrologia_lme: "LME",
        laboratorio_de_hidraulica_lh: "LH",
        mesa_de_ciclos: "CICLOS",
        area_de_procesos_de_manufactura: "PROCESOS",
        area_de_manufactura_cnc: "CNC",
        area_de_tableros_de_control_electrico: "TABLEROS",
        area_de_soldadura: "SOLDADURA",
        sala_de_docentes: "DOCENTES",
        sala_de_maestros: "MAESTROS",
        control_escolar: "CONTROL",
        jefatura_de_redes: "REDES",
        jefatura_de_servicios_escolares: "ESCOLARES",
        titulacion: "TITULACIÓN",
        cajas: "CAJAS",
        auditorio: "AUDITORIO",
      };
      if (siglas[lower]) return siglas[lower];

      var words = lower.replace(/^edificio_?/, "").replace(/_/g, " ").split(" ");
      if (words.length >= 2) return (words[0].slice(0, 4) + " " + words[1].slice(0, 3)).toUpperCase();
      return lower.slice(0, 7).toUpperCase();
    }

    // 7. Parseo del SVG y Construcción del Edificio
    function buildFloorFromSvg(svgText) {
      if (!svgText) {
        fallar("sin_aulas");
        return;
      }

      var sandbox = document.getElementById("svg-parser-sandbox");
      // El SVG llega saneado desde la app; además se interpreta con DOMParser
      // (no ejecuta scripts) antes de insertarlo para poder medirlo con getBBox.
      var parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
      var svgRoot = parsed.documentElement;
      if (!svgRoot || svgRoot.nodeName.toLowerCase() !== "svg" || parsed.getElementsByTagName("parsererror").length) {
        fallar("sin_aulas");
        return;
      }
      sandbox.textContent = "";
      sandbox.appendChild(document.importNode(svgRoot, true));
      var svgEl = sandbox.querySelector("svg");
      if (!svgEl) return;

      // IDs auto-generados por Inkscape/SVG que NO son espacios reales (ej: rect1234, path56)
      var autoIdRe = /^(rect|path|circle|ellipse|polygon|polyline|line|g|use|image|text|tspan|defs|symbol|marker|pattern|mask|filter|clipPath|linearGradient|radialGradient|stop|namedview|page|layer|metadata|desc|title)\d+$/i;

      // Prefijos de IDs que identifican elementos de servicio en formas NO-rect
      var SERVICE_PREFIXES = [
        "sanitario_", "bano_", "wc_",
        "escalera_",
        "bodega_", "almacen_", "deposito_", "cuarto_",
        "servicio_", "servicios_",
        "paqueteria_", "vigilancia_", "seguridad_",
        "consultorio_", "medico_", "enfermeria_",
        "mantenimiento_", "carga_", "tableros_",
        "subestacion_", "cisterna_",
      ];

      function isServiceId(id) {
        if (!id) return false;
        var lower = id.toLowerCase();
        for (var si = 0; si < SERVICE_PREFIXES.length; si++) {
          if (lower.indexOf(SERVICE_PREFIXES[si]) === 0) return true;
        }
        return false;
      }

      var seenIds = {};
      var rawRooms = [];
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      // Matriz del sistema de coordenadas raíz del SVG: todas las aulas se expresan
      // en ese espacio, respetando los transform de capas/grupos (Inkscape).
      var rootCtm = svgEl.getCTM();
      var rootInv = rootCtm ? rootCtm.inverse() : null;

      function matrizDe(el) {
        var ctm = el.getCTM();
        if (!ctm || !rootInv) return null;
        return rootInv.multiply(ctm);
      }

      function transformar(m, x, y) {
        if (!m) return { x: x, y: y };
        return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
      }

      /** Agrega un aula a partir de su caja local (x, y, w, h) y la matriz del elemento. */
      function addRoom(id, el, x, y, w, h) {
        if (seenIds[id]) return;
        var m = matrizDe(el);
        var sx = m ? Math.hypot(m.a, m.b) : 1;
        var sy = m ? Math.hypot(m.c, m.d) : 1;
        var ancho = w * sx, alto = h * sy;
        if (ancho <= 2 || alto <= 2) return;
        seenIds[id] = true;

        var centro = transformar(m, x + w / 2, y + h / 2);
        var angulo = m ? Math.atan2(m.b, m.a) : 0;
        rawRooms.push({ id: id, cx: centro.x, cy: centro.y, w: ancho, h: alto, angle: angulo });

        [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(function (c) {
          var p = transformar(m, c[0], c[1]);
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        });
      }

      // PASO 1: <rect id="...">
      var rectElements = svgEl.querySelectorAll("rect[id]");
      rectElements.forEach(function (rect) {
        var id = rect.getAttribute("id");
        if (!id || autoIdRe.test(id)) return;

        var x = parseFloat(rect.getAttribute("x")) || 0;
        var y = parseFloat(rect.getAttribute("y")) || 0;
        var w = parseFloat(rect.getAttribute("width")) || 0;
        var h = parseFloat(rect.getAttribute("height")) || 0;
        addRoom(id, rect, x, y, w, h);
      });

      // PASO 2: formas NO-rect con prefijo de servicio
      var nonRectSelector = ["path[id]", "polygon[id]", "polyline[id]", "circle[id]", "ellipse[id]", "g[id]"].join(", ");

      svgEl.querySelectorAll(nonRectSelector).forEach(function (el) {
        var id = el.getAttribute("id");
        if (!isServiceId(id)) return;
        if (seenIds[id]) return;

        // Los espacios suelen estar ocultos (display:none) en el plano y getBBox() de un
        // elemento oculto mide 0: se muestra solo mientras se mide (el sandbox es invisible).
        var displayPrevio = el.style.getPropertyValue("display");
        var prioridadPrevia = el.style.getPropertyPriority("display");
        el.style.setProperty("display", "inline", "important");
        var bbox;
        try { bbox = el.getBBox(); } catch (e) { bbox = null; }
        if (displayPrevio) el.style.setProperty("display", displayPrevio, prioridadPrevia);
        else el.style.removeProperty("display");
        if (!bbox) return;
        addRoom(id, el, bbox.x, bbox.y, bbox.width, bbox.height);
      });

      if (rawRooms.length === 0) {
        fallar("sin_aulas");
        return;
      }

      var buildingW = maxX - minX;
      var buildingD = maxY - minY;
      var buildingCenterX = (minX + maxX) / 2;
      var buildingCenterY = (minY + maxY) / 2;

      var targetSceneSize = 110;
      var scale = targetSceneSize / Math.max(buildingW, buildingD);

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
      var roomExtrudeHeight = 6.0;
      // Una sola caja unitaria y su contorno para TODAS las aulas (se escalan por aula).
      var cajaUnitaria = new THREE.BoxGeometry(1, 1, 1);
      var contornoUnitario = new THREE.EdgesGeometry(cajaUnitaria);

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
          var serviceType = getServiceType(room.id);
          var billboardSprite = null;

          if (serviceType) {
            billboardSprite = createServiceBillboard(serviceType);
          } else {
            var shortCode = getShortCode(room.id);
            var category = room.id.toLowerCase().indexOf("lab") !== -1 ? "LAB" : "AULA";
            billboardSprite = createClassroomBillboard(shortCode, category);
          }
          billboardSprite.position.set(worldX, roomExtrudeHeight + 4.2, worldZ);

          billboardSprite.userData = { id: room.id, name: room.id, isBillboard: true, roomMesh: roomMesh };
          floorGroup.add(billboardSprite);
          interactiveObjects.push(billboardSprite);
          roomMesh.userData.billboard = billboardSprite;
        } catch (e) {
          // Un aula defectuosa no impide construir el resto del edificio.
        }
      });

      renderer.shadowMap.needsUpdate = true;
      pedirRender();

      if (loader) {
        loader.style.opacity = "0";
        setTimeout(function () { loader.style.display = "none"; }, 400);
      }

      sendToHost({
        type: "KIOSK_READY",
        totalRooms: rawRooms.length,
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
        targetCameraLerp = new THREE.Vector3(targetMesh.position.x, 0, targetMesh.position.z);
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

    window.addEventListener("mousedown", function (e) {
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

    // Selección inicial (misma lógica de búsqueda que las selecciones posteriores)
    if (selectedTargetId) selectRoomById(selectedTargetId, true, false);

    motor = {
      seleccionar: function (id) { selectRoomById(id, true, false); },
      limpiar: limpiarSeleccion,
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

      if (currentSelectedMesh) {
        var ahora = performance.now();
        if (ahora - ultimoPulso >= INTERVALO_PULSO_MS) {
          ultimoPulso = ahora;
          materials.roomSelected.emissiveIntensity = 0.45 + 0.25 * Math.sin(ahora * 0.006);
          necesitaRender = true;
        }
        continuar = true;
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
