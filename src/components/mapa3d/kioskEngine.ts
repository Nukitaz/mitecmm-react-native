/**
 * Generador del motor 3D interactivo para el Quiosco (Three.js WebGL).
 * Diseñado con estética isométrica de quiosco táctil, extrusión de aulas,
 * billboards flotantes de locales, iconos naranjas de servicio y selección interactiva por Raycasting.
 */

export interface KioskEngineOptions {
  svgContent: string;
  isDarkMode: boolean;
  selectedRoomId?: string | null;
}

export function generateKioskHtml(options: KioskEngineOptions): string {
  const { svgContent, isDarkMode, selectedRoomId } = options;

  const escapedSvg = JSON.stringify(svgContent || "");

  const bgColor = isDarkMode ? "#08080a" : "#f1f4f8";
  const slabColor = isDarkMode ? "#121620" : "#dbe0ea";
  const corridorColor = isDarkMode ? "#192030" : "#ffffff";
  const wallColor = isDarkMode ? "#334155" : "#94a3b8";
  const topColor = isDarkMode ? "#475569" : "#cbd5e1";
  const edgeColor = isDarkMode ? "#1e293b" : "#64748b";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>MiTecmm 3D Kiosk</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: ${bgColor};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #canvas-container {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      touch-action: none;
    }
    /* El sandbox debe tener opacidad 0 y visibility hidden, NO display: none */
    #svg-parser-sandbox {
      position: absolute !important;
      top: -9999px !important;
      left: -9999px !important;
      width: 1000px !important;
      height: 1000px !important;
      opacity: 0 !important;
      pointer-events: none !important;
      visibility: hidden !important;
    }
    /* Insignia flotante de orientación de cámara */
    .view-badge {
      position: absolute;
      bottom: 16px;
      right: 16px;
      background: ${isDarkMode ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.9)"};
      color: ${isDarkMode ? "#94a3b8" : "#475569"};
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      pointer-events: none;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 6px;
      z-index: 10;
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
    }
    #loader {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: ${bgColor};
      color: ${isDarkMode ? "#94a3b8" : "#64748b"};
      font-size: 13px;
      font-weight: 500;
      transition: opacity 0.4s ease;
      z-index: 50;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid ${isDarkMode ? "#334155" : "#e2e8f0"};
      border-top-color: #f97316;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 12px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/three@0.148.0/build/three.min.js"></script>
</head>
<body>
  <div id="loader">
    <div class="spinner"></div>
    <span>Construyendo entorno 3D...</span>
  </div>
  <div id="canvas-container"></div>
  <div id="svg-parser-sandbox"></div>
  <div class="view-badge">
    <span class="badge-dot"></span>
    <span>VISTA ISOMÉTRICA 3D</span>
  </div>

  <script>
    (function() {
      var rawSvg = ${escapedSvg};
      var selectedTargetId = "${selectedRoomId || ''}";
      var isDark = ${isDarkMode};

      function sendToNative(data) {
        var msg = JSON.stringify(data);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(msg);
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, "*");
        }
      }

      var container = document.getElementById("canvas-container");
      var loader = document.getElementById("loader");

      var width = container.clientWidth || window.innerWidth;
      var height = container.clientHeight || window.innerHeight;

      // 1. Escena y Niebla arquitectónica
      var scene = new THREE.Scene();
      scene.background = new THREE.Color("${bgColor}");
      scene.fog = new THREE.Fog("${bgColor}", 150, 480);

      // 2. Cámara Isométrica
      var camera = new THREE.PerspectiveCamera(40, width / height, 1, 1000);
      var cameraTarget = new THREE.Vector3(0, 0, 0);
      var targetCameraLerp = null;

      var spherical = {
        radius: 170,
        theta: Math.PI / 4,
        phi: Math.PI / 3.2
      };

      function updateCameraPosition() {
        camera.position.x = cameraTarget.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
        camera.position.y = cameraTarget.y + spherical.radius * Math.cos(spherical.phi);
        camera.position.z = cameraTarget.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
        camera.lookAt(cameraTarget);
      }
      updateCameraPosition();

      // 3. Renderizador WebGL
      var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      // 4. Luces
      var ambientLight = new THREE.AmbientLight(isDark ? 0x64748b : 0xffffff, isDark ? 0.75 : 0.9);
      scene.add(ambientLight);

      var sunLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.0 : 1.3);
      sunLight.position.set(120, 220, 100);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
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
        slab: new THREE.MeshStandardMaterial({
          color: new THREE.Color("${slabColor}"),
          roughness: 0.85,
          metalness: 0.05
        }),
        corridor: new THREE.MeshStandardMaterial({
          color: new THREE.Color("${corridorColor}"),
          roughness: 0.65,
          metalness: 0.02
        }),
        roomWall: new THREE.MeshStandardMaterial({
          color: new THREE.Color("${wallColor}"),
          roughness: 0.55,
          metalness: 0.1
        }),
        roomTop: new THREE.MeshStandardMaterial({
          color: new THREE.Color("${topColor}"),
          roughness: 0.7,
          metalness: 0.05
        }),
        roomSelected: new THREE.MeshStandardMaterial({
          color: new THREE.Color(0xf97316),
          emissive: new THREE.Color(0xf97316),
          emissiveIntensity: 0.5,
          roughness: 0.25,
          metalness: 0.1
        }),
        edge: new THREE.LineBasicMaterial({
          color: new THREE.Color("${edgeColor}"),
          linewidth: 1,
          transparent: true,
          opacity: 0.45
        })
      };

      var floorGroup = new THREE.Group();
      scene.add(floorGroup);

      var interactiveObjects = [];
      var roomMeshes = {};
      var currentSelectedMesh = null;

      // 6. Generadores de Billboards
      function createClassroomBillboard(shortCode, category) {
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

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;

        var mat = new THREE.SpriteMaterial({ map: texture, depthTest: true });
        var sprite = new THREE.Sprite(mat);
        sprite.scale.set(11, 5.5, 1);
        return sprite;
      }

      function createServiceBillboard(serviceType) {
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
          // Icono de escaleras: peldaños en diagonal
          ctx.lineWidth = 8;
          ctx.lineCap = "square";
          // Peldaño 1 (abajo)
          ctx.fillRect(36, 110, 34, 8);
          ctx.fillRect(36, 88, 8, 22);
          // Peldaño 2 (medio)
          ctx.fillRect(62, 88, 34, 8);
          ctx.fillRect(62, 66, 8, 22);
          // Peldaño 3 (arriba)
          ctx.fillRect(88, 66, 34, 8);
          ctx.fillRect(88, 44, 8, 22);
          // Flecha de dirección
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

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;

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
          auditorio: "AUDITORIO"
        };
        if (siglas[lower]) return siglas[lower];

        var words = lower.replace(/^edificio_?/, "").replace(/_/g, " ").split(" ");
        if (words.length >= 2) return (words[0].slice(0, 4) + " " + words[1].slice(0, 3)).toUpperCase();
        return lower.slice(0, 7).toUpperCase();
      }

      // 7. Parseo del SVG y Construcción del Edificio
      function buildFloorFromSvg(svgText) {
        if (!svgText) return;

        var sandbox = document.getElementById("svg-parser-sandbox");
        sandbox.innerHTML = svgText;
        var svgEl = sandbox.querySelector("svg");
        if (!svgEl) return;

        // IDs auto-generados por Inkscape/SVG que NO son espacios reales (ej: rect1234, path56)
        var autoIdRe = /^(rect|path|circle|ellipse|polygon|polyline|line|g|use|image|text|tspan|defs|symbol|marker|pattern|mask|filter|clipPath|linearGradient|radialGradient|stop|namedview|page|layer|metadata|desc|title)\d+$/i;

        // Prefijos de IDs que identifican elementos de servicio en formas NO-rect
        // (sanitarios, escaleras, bodegas... dibujados como <path> o <g> en el SVG)
        var SERVICE_PREFIXES = [
          "sanitario_", "bano_", "wc_",
          "escalera_",
          "bodega_", "almacen_", "deposito_", "cuarto_",
          "servicio_", "servicios_",
          "paqueteria_", "vigilancia_", "seguridad_",
          "consultorio_", "medico_", "enfermeria_",
          "mantenimiento_", "carga_", "tableros_",
          "subestacion_", "cisterna_"
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

        function addRoom(id, x, y, w, h) {
          if (w <= 2 || h <= 2) return;
          if (seenIds[id]) return;
          seenIds[id] = true;
          rawRooms.push({ id: id, x: x, y: y, w: w, h: h });
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x + w);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y + h);
        }

        // ── PASO 1: <rect id="..."> ── comportamiento original ─────────────────
        // Se usan getAttribute x/y/width/height (confiable, sin depender de getBBox).
        // Se acepta cualquier ID que no sea auto-generado (rect123, path456, etc.)
        var rectElements = svgEl.querySelectorAll("rect[id]");
        rectElements.forEach(function(rect) {
          var id = rect.getAttribute("id");
          if (!id || autoIdRe.test(id)) return;

          var x = parseFloat(rect.getAttribute("x")) || 0;
          var y = parseFloat(rect.getAttribute("y")) || 0;
          var w = parseFloat(rect.getAttribute("width")) || 0;
          var h = parseFloat(rect.getAttribute("height")) || 0;
          addRoom(id, x, y, w, h);
        });

        // ── PASO 2: formas NO-rect (<path>, <polygon>, <g>, etc.) ──────────────
        // Solo se incluyen si su ID empieza con un prefijo de espacio de servicio
        // (sanitarios, escaleras, bodegas…). Esto evita que decoraciones del SVG
        // aparezcan como aulas en el mapa 3D.
        var nonRectSelector = [
          "path[id]", "polygon[id]", "polyline[id]",
          "circle[id]", "ellipse[id]", "g[id]"
        ].join(", ");

        svgEl.querySelectorAll(nonRectSelector).forEach(function(el) {
          var id = el.getAttribute("id");
          if (!isServiceId(id)) return;
          if (seenIds[id]) return;

          var bbox;
          try { bbox = el.getBBox(); } catch(e) { return; }
          addRoom(id, bbox.x, bbox.y, bbox.width, bbox.height);
        });

        if (rawRooms.length === 0) return;

        // 2. Dimensiones y Centro exacto de la huella del edificio
        var buildingW = maxX - minX;
        var buildingD = maxY - minY;
        var buildingCenterX = (minX + maxX) / 2;
        var buildingCenterY = (minY + maxY) / 2;

        // Escala normalizada para que ocupe ~110 unidades en pantalla
        var targetSceneSize = 110;
        var scale = targetSceneSize / Math.max(buildingW, buildingD);

        var floorW = buildingW * scale + 18;
        var floorD = buildingD * scale + 18;

        // A. Suelo Base (Slab) centrado exactamente en (0, 0)
        var slabGeo = new THREE.BoxGeometry(floorW, 2, floorD);
        var slabMesh = new THREE.Mesh(slabGeo, materials.slab);
        slabMesh.position.set(0, -1, 0);
        slabMesh.receiveShadow = true;
        floorGroup.add(slabMesh);

        // B. Capa de Pasillos / Circulación centrada exactamente en (0, 0)
        var corridorGeo = new THREE.PlaneGeometry(floorW - 4, floorD - 4);
        var corridorMesh = new THREE.Mesh(corridorGeo, materials.corridor);
        corridorMesh.rotation.x = -Math.PI / 2;
        corridorMesh.position.set(0, 0.04, 0);
        corridorMesh.receiveShadow = true;
        floorGroup.add(corridorMesh);

        // C. Construir cada Aula extruida y su Billboard flotante
        var roomExtrudeHeight = 6.0;

        rawRooms.forEach(function(room) {
          try {
            var boxW = room.w * scale;
            var boxD = room.h * scale;

            var roomCenterX = room.x + room.w / 2;
            var roomCenterY = room.y + room.h / 2;

            var worldX = (roomCenterX - buildingCenterX) * scale;
            var worldZ = (roomCenterY - buildingCenterY) * scale;

            var isSelected = (selectedTargetId && room.id.toLowerCase() === selectedTargetId.toLowerCase());
            var defaultMat = [
              materials.roomWall,
              materials.roomWall,
              materials.roomTop,
              materials.roomWall,
              materials.roomWall,
              materials.roomWall
            ];

            var roomGeo = new THREE.BoxGeometry(boxW, roomExtrudeHeight, boxD);
            var roomMesh = new THREE.Mesh(roomGeo, isSelected ? materials.roomSelected : defaultMat);
            roomMesh.position.set(worldX, roomExtrudeHeight / 2, worldZ);
            roomMesh.castShadow = true;
            roomMesh.receiveShadow = true;
            roomMesh.userData = {
              id: room.id,
              name: room.id,
              defaultMaterial: defaultMat,
              isRoom: true
            };

            var edgesGeo = new THREE.EdgesGeometry(roomGeo);
            var edgeLines = new THREE.LineSegments(edgesGeo, materials.edge);
            roomMesh.add(edgeLines);

            floorGroup.add(roomMesh);
            roomMeshes[room.id.toLowerCase()] = roomMesh;
            interactiveObjects.push(roomMesh);

            if (isSelected) {
              currentSelectedMesh = roomMesh;
              targetCameraLerp = new THREE.Vector3(worldX, 0, worldZ);
            }

            // D. Billboard (Logo / Icono de servicio)
            var serviceType = getServiceType(room.id);
            var billboardSprite = null;

            if (serviceType) {
              billboardSprite = createServiceBillboard(serviceType);
              billboardSprite.position.set(worldX, roomExtrudeHeight + 4.2, worldZ);
            } else {
              var shortCode = getShortCode(room.id);
              var category = room.id.toLowerCase().indexOf("lab") !== -1 ? "LAB" : "AULA";
              billboardSprite = createClassroomBillboard(shortCode, category);
              billboardSprite.position.set(worldX, roomExtrudeHeight + 4.2, worldZ);
            }

            if (billboardSprite) {
              billboardSprite.userData = {
                id: room.id,
                name: room.id,
                isBillboard: true,
                roomMesh: roomMesh
              };
              floorGroup.add(billboardSprite);
              interactiveObjects.push(billboardSprite);
              roomMesh.userData.billboard = billboardSprite;
            }

          } catch (e) {
            console.warn("Error generando aula/billboard:", e);
          }
        });

        console.log("Plano 3D construido con exito. Total de aulas:", rawRooms.length);

        if (loader) {
          loader.style.opacity = "0";
          setTimeout(function() { loader.style.display = "none"; }, 400);
        }

        sendToNative({ type: "KIOSK_READY", totalRooms: rawRooms.length });
      }

      try {
        buildFloorFromSvg(rawSvg);
      } catch (err) {
        console.error("Error construyendo plano 3D:", err);
      }

      // 8. Raycasting para Selección por Toque o Clic
      var raycaster = new THREE.Raycaster();
      var mouse = new THREE.Vector2();

      function selectRoomById(id, animateCamera) {
        if (!id) return;
        var cleanId = id.toLowerCase();
        var targetMesh = roomMeshes[cleanId];

        if (!targetMesh) {
          Object.keys(roomMeshes).forEach(function(k) {
            if (k.indexOf(cleanId) !== -1 || cleanId.indexOf(k) !== -1) {
              targetMesh = roomMeshes[k];
            }
          });
        }

        if (!targetMesh) return;

        if (currentSelectedMesh && currentSelectedMesh !== targetMesh) {
          currentSelectedMesh.material = currentSelectedMesh.userData.defaultMaterial;
        }

        currentSelectedMesh = targetMesh;
        currentSelectedMesh.material = materials.roomSelected;

        if (animateCamera !== false) {
          targetCameraLerp = new THREE.Vector3(targetMesh.position.x, 0, targetMesh.position.z);
        }

        sendToNative({
          type: "AULA_CLICK",
          id: targetMesh.userData.id,
          name: targetMesh.userData.name
        });
      }

      function handleRaycast(clientX, clientY) {
        var rect = container.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        var intersects = raycaster.intersectObjects(interactiveObjects, true);

        if (intersects.length > 0) {
          var hit = intersects[0].object;
          var targetMesh = hit.userData.roomMesh || (hit.userData.isRoom ? hit : null);
          if (targetMesh && targetMesh.userData && targetMesh.userData.id) {
            selectRoomById(targetMesh.userData.id, true);
          }
        }
      }

      // 9. Controles Táctiles y Ratón (Click vs Pan)
      var isDragging = false;
      var dragMode = "pan";
      var previousMousePosition = { x: 0, y: 0 };
      var pointerDownPos = { x: 0, y: 0 };
      var initialPinchDistance = null;

      window.addEventListener("mousedown", function(e) {
        isDragging = true;
        dragMode = (e.button === 2 || e.shiftKey) ? "rotate" : "pan";
        previousMousePosition = { x: e.clientX, y: e.clientY };
        pointerDownPos = { x: e.clientX, y: e.clientY };
      });

      window.addEventListener("contextmenu", function(e) {
        e.preventDefault();
      });

      window.addEventListener("mousemove", function(e) {
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

      window.addEventListener("mouseup", function(e) {
        if (isDragging) {
          var moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
          if (moveDist < 6 && e.button === 0) {
            handleRaycast(e.clientX, e.clientY);
          }
        }
        isDragging = false;
      });

      window.addEventListener("wheel", function(e) {
        e.preventDefault();
        var zoomSpeed = spherical.radius * 0.0015;
        spherical.radius = Math.max(45, Math.min(320, spherical.radius + e.deltaY * zoomSpeed));
        updateCameraPosition();
      }, { passive: false });

      // Eventos Multi-Touch
      window.addEventListener("touchstart", function(e) {
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
            y: (e.touches[0].clientY + e.touches[1].clientY) / 2
          };
        }
      }, { passive: false });

      window.addEventListener("touchmove", function(e) {
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

      window.addEventListener("touchend", function(e) {
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

      window.addEventListener("resize", function() {
        var w = container.clientWidth || window.innerWidth;
        var h = container.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });

      // 10. Bucle de Renderizado
      function animate() {
        requestAnimationFrame(animate);

        if (currentSelectedMesh) {
          materials.roomSelected.emissiveIntensity = 0.45 + 0.25 * Math.sin(Date.now() * 0.006);
        }

        if (targetCameraLerp) {
          cameraTarget.lerp(targetCameraLerp, 0.07);
          updateCameraPosition();
          if (cameraTarget.distanceTo(targetCameraLerp) < 0.15) {
            targetCameraLerp = null;
          }
        }

        renderer.render(scene, camera);
      }
      animate();

    })();
  </script>
</body>
</html>`;
}
