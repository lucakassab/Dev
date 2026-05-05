import * as THREE from "./vendor/three/three.module.min.js";

(() => {
  const root = document.querySelector("#tour-tester");
  if (!root) {
    return;
  }

  const MAX_SCENES = 6;
  const MAX_IMAGE_SIZE_MB = 50;
  const MAX_IMAGE_SIZE = MAX_IMAGE_SIZE_MB * 1024 * 1024;
  const DB_NAME = "lukassab-tour-tester-v1";
  const DB_VERSION = 1;
  const IMAGE_STORE = "images";
  const STORAGE_KEY = "lukassab-tour-tester-config-v1";
  const icons = {
    arrow: "→",
    info: "i",
    dot: "•",
    view: "⌾"
  };

  const els = {
    dropzone: root.querySelector("[data-tour-dropzone]"),
    imageInput: root.querySelector("[data-tour-image-input]"),
    uploadTrigger: root.querySelector("[data-tour-upload-trigger]"),
    sceneCount: root.querySelector("[data-tour-scene-count]"),
    sceneList: root.querySelector("[data-tour-scene-list]"),
    viewerShell: root.querySelector("[data-tour-viewer-shell]"),
    viewer: root.querySelector("[data-tour-viewer]"),
    hotspotLayer: root.querySelector("[data-tour-hotspot-layer]"),
    emptyState: root.querySelector("[data-tour-empty-state]"),
    watermark: root.querySelector("[data-tour-watermark]"),
    status: root.querySelector("[data-tour-status]"),
    cta: root.querySelector("[data-tour-cta]"),
    jsonInput: root.querySelector("[data-tour-json-input]"),
    importButton: root.querySelector("[data-tour-import]"),
    exportButton: root.querySelector("[data-tour-export]"),
    fullscreenButton: root.querySelector("[data-tour-fullscreen]"),
    resetButton: root.querySelector("[data-tour-reset]"),
    modeButtons: root.querySelectorAll("[data-tour-mode]"),
    inspectorEmpty: root.querySelector("[data-tour-inspector-empty]"),
    inspectorContent: root.querySelector("[data-tour-inspector-content]"),
    sceneName: root.querySelector("[data-tour-scene-name]"),
    sceneFormat: root.querySelector("[data-tour-scene-format]"),
    setInitial: root.querySelector("[data-tour-set-initial]"),
    hotspotCount: root.querySelector("[data-tour-hotspot-count]"),
    hotspotList: root.querySelector("[data-tour-hotspot-list]")
  };

  const dialog = {
    node: document.querySelector("[data-tour-hotspot-dialog]"),
    form: document.querySelector("[data-tour-hotspot-form]"),
    title: document.querySelector("[data-tour-dialog-title]"),
    label: document.querySelector("[data-hotspot-label]"),
    target: document.querySelector("[data-hotspot-target]"),
    icon: document.querySelector("[data-hotspot-icon]"),
    deleteButton: document.querySelector("[data-hotspot-delete]"),
    cancelButton: document.querySelector("[data-hotspot-cancel]")
  };

  const state = {
    scenes: [],
    activeSceneId: "",
    initialSceneId: "",
    mode: "edit",
    editingHotspot: null,
    pendingHotspotPosition: null,
    db: null,
    texture: null,
    textureToken: 0,
    restoreComplete: false
  };

  const viewer = {
    scene: null,
    camera: null,
    renderer: null,
    sphere: null,
    material: null,
    yaw: 0,
    pitch: 0,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    moved: false,
    resizeObserver: null,
    frame: null
  };

  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const imageKey = (name, size) => `${name}::${size}`;
  const getActiveScene = () => state.scenes.find((scene) => scene.id === state.activeSceneId) || null;
  const getInitialScene = () => state.scenes.find((scene) => scene.id === state.initialSceneId) || state.scenes[0] || null;

  const setStatus = (message, tone = "info") => {
    els.status.textContent = message || "";
    els.status.dataset.tone = tone;
    if (message) {
      window.clearTimeout(setStatus.timeout);
      setStatus.timeout = window.setTimeout(() => {
        els.status.textContent = "";
      }, 3600);
    }
  };

  const openDb = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE, { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const dbPut = (record) => {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(IMAGE_STORE, "readwrite");
      tx.objectStore(IMAGE_STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  };

  const dbGet = (key) => {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(IMAGE_STORE, "readonly");
      const request = tx.objectStore(IMAGE_STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  };

  const dbGetAll = () => {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(IMAGE_STORE, "readonly");
      const request = tx.objectStore(IMAGE_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  };

  const dbClear = () => {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(IMAGE_STORE, "readwrite");
      tx.objectStore(IMAGE_STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  };

  const revokeSceneUrls = () => {
    state.scenes.forEach((scene) => {
      if (scene.imageUrl) {
        URL.revokeObjectURL(scene.imageUrl);
      }
    });
  };

  const serializeTour = ({ includePrivate = false } = {}) => ({
    version: 1,
    initialSceneId: state.initialSceneId || state.scenes[0]?.id || "",
    scenes: state.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      imageName: scene.imageName,
      imageSize: scene.imageSize,
      imageFormat: scene.imageFormat,
      ...(includePrivate ? { imageKey: scene.imageKey || imageKey(scene.imageName, scene.imageSize) } : {}),
      hotspots: scene.hotspots.map((hotspot) => ({
        id: hotspot.id,
        label: hotspot.label,
        targetSceneId: hotspot.targetSceneId,
        icon: hotspot.icon,
        xPercent: Number(hotspot.xPercent.toFixed(3)),
        yPercent: Number(hotspot.yPercent.toFixed(3))
      }))
    }))
  });

  const persist = () => {
    if (!state.restoreComplete) {
      return;
    }
    if (!state.scenes.length) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeTour({ includePrivate: true })));
  };

  const downloadJson = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const loadImage = (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    image.src = url;
  });

  const getCropRect = (image, format) => {
    if (format === "sideBySide") {
      return { sx: 0, sy: 0, sw: Math.floor(image.width / 2), sh: image.height };
    }
    if (format === "topDown") {
      return { sx: 0, sy: 0, sw: image.width, sh: Math.floor(image.height / 2) };
    }
    return { sx: 0, sy: 0, sw: image.width, sh: image.height };
  };

  const buildTexture = async (scene) => {
    if (!scene?.imageUrl) {
      return null;
    }

    const image = await loadImage(scene.imageUrl);
    const crop = getCropRect(image, scene.imageFormat);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, crop.sw);
    canvas.height = Math.max(1, crop.sh);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  };

  const directionFromPercent = (xPercent, yPercent) => {
    const yaw = (xPercent / 100) * Math.PI * 2 - Math.PI;
    const pitch = Math.PI / 2 - (yPercent / 100) * Math.PI;
    const cosPitch = Math.cos(pitch);
    return new THREE.Vector3(
      Math.sin(yaw) * cosPitch,
      Math.sin(pitch),
      -Math.cos(yaw) * cosPitch
    ).normalize();
  };

  const percentFromDirection = (direction) => {
    const dir = direction.clone().normalize();
    const yaw = Math.atan2(dir.x, -dir.z);
    const pitch = Math.asin(clamp(dir.y, -1, 1));
    const xPercent = ((yaw + Math.PI) / (Math.PI * 2)) * 100;
    const yPercent = ((Math.PI / 2 - pitch) / Math.PI) * 100;
    return {
      xPercent: clamp(xPercent, 0, 100),
      yPercent: clamp(yPercent, 0, 100)
    };
  };

  const resizeViewer = () => {
    if (!viewer.renderer || !viewer.camera) {
      return;
    }
    const rect = els.viewerShell.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    viewer.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    viewer.renderer.setSize(width, height, false);
    viewer.camera.aspect = width / height;
    viewer.camera.updateProjectionMatrix();
  };

  const updateCamera = () => {
    viewer.pitch = clamp(viewer.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    viewer.camera.rotation.order = "YXZ";
    viewer.camera.rotation.y = viewer.yaw;
    viewer.camera.rotation.x = viewer.pitch;
  };

  const updateHotspotPositions = () => {
    const activeScene = getActiveScene();
    const buttons = els.hotspotLayer.querySelectorAll("[data-hotspot-id]");
    const rect = els.viewerShell.getBoundingClientRect();
    const cameraDirection = new THREE.Vector3();
    viewer.camera.getWorldDirection(cameraDirection);

    buttons.forEach((button) => {
      const hotspot = activeScene?.hotspots.find((item) => item.id === button.dataset.hotspotId);
      if (!hotspot) {
        button.hidden = true;
        return;
      }

      const direction = directionFromPercent(hotspot.xPercent, hotspot.yPercent);
      const isVisible = direction.dot(cameraDirection) > 0.05;
      const position = direction.multiplyScalar(500).project(viewer.camera);
      const x = (position.x * 0.5 + 0.5) * rect.width;
      const y = (-position.y * 0.5 + 0.5) * rect.height;
      const inFrame = isVisible && position.z < 1 && x >= -80 && x <= rect.width + 80 && y >= -80 && y <= rect.height + 80;

      button.hidden = !inFrame;
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
    });
  };

  const renderLoop = () => {
    if (!viewer.renderer || !viewer.scene || !viewer.camera) {
      return;
    }
    updateCamera();
    viewer.renderer.render(viewer.scene, viewer.camera);
    updateHotspotPositions();
    viewer.frame = window.requestAnimationFrame(renderLoop);
  };

  const setupViewer = () => {
    viewer.scene = new THREE.Scene();
    viewer.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1100);
    viewer.material = new THREE.MeshBasicMaterial({ color: 0x080b12, side: THREE.BackSide });
    viewer.sphere = new THREE.Mesh(new THREE.SphereGeometry(500, 80, 48), viewer.material);
    viewer.scene.add(viewer.sphere);
    viewer.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    viewer.renderer.setClearColor(0x000000, 0);
    els.viewer.appendChild(viewer.renderer.domElement);
    resizeViewer();

    viewer.resizeObserver = new ResizeObserver(resizeViewer);
    viewer.resizeObserver.observe(els.viewerShell);

    viewer.renderer.domElement.addEventListener("pointerdown", (event) => {
      if (!getActiveScene()?.imageUrl) {
        return;
      }
      viewer.dragging = true;
      viewer.pointerId = event.pointerId;
      viewer.startX = event.clientX;
      viewer.startY = event.clientY;
      viewer.lastX = event.clientX;
      viewer.lastY = event.clientY;
      viewer.moved = false;
      viewer.renderer.domElement.setPointerCapture(event.pointerId);
    });

    viewer.renderer.domElement.addEventListener("pointermove", (event) => {
      if (!viewer.dragging || event.pointerId !== viewer.pointerId) {
        return;
      }
      const dx = event.clientX - viewer.lastX;
      const dy = event.clientY - viewer.lastY;
      if (Math.abs(event.clientX - viewer.startX) + Math.abs(event.clientY - viewer.startY) > 6) {
        viewer.moved = true;
      }
      viewer.yaw -= dx * 0.004;
      viewer.pitch -= dy * 0.004;
      viewer.lastX = event.clientX;
      viewer.lastY = event.clientY;
    });

    viewer.renderer.domElement.addEventListener("pointerup", (event) => {
      if (!viewer.dragging || event.pointerId !== viewer.pointerId) {
        return;
      }
      viewer.dragging = false;
      viewer.renderer.domElement.releasePointerCapture(event.pointerId);

      if (!viewer.moved && state.mode === "edit") {
        const activeScene = getActiveScene();
        if (!activeScene?.imageUrl) {
          return;
        }
        const rect = viewer.renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector3(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -(((event.clientY - rect.top) / rect.height) * 2 - 1),
          0.5
        );
        const direction = ndc.unproject(viewer.camera).sub(viewer.camera.position).normalize();
        openHotspotDialog({ position: percentFromDirection(direction) });
      }
    });

    viewer.renderer.domElement.addEventListener("wheel", (event) => {
      event.preventDefault();
      viewer.camera.fov = clamp(viewer.camera.fov + Math.sign(event.deltaY) * 4, 36, 92);
      viewer.camera.updateProjectionMatrix();
    }, { passive: false });

    renderLoop();
  };

  const applySceneTexture = async () => {
    const activeScene = getActiveScene();
    const token = ++state.textureToken;
    els.emptyState.hidden = Boolean(activeScene?.imageUrl);
    els.viewer.classList.toggle("is-empty", !activeScene?.imageUrl);

    if (state.texture) {
      state.texture.dispose();
      state.texture = null;
    }

    if (!activeScene?.imageUrl) {
      viewer.material.map = null;
      viewer.material.color.set(0x080b12);
      viewer.material.needsUpdate = true;
      return;
    }

    try {
      const texture = await buildTexture(activeScene);
      if (token !== state.textureToken || getActiveScene()?.id !== activeScene.id) {
        texture?.dispose();
        return;
      }
      state.texture = texture;
      viewer.material.map = texture;
      viewer.material.color.set(0xffffff);
      viewer.material.needsUpdate = true;
    } catch (error) {
      setStatus(error.message || "Não foi possível exibir a cena.", "error");
    }
  };

  const renderHotspots = () => {
    const activeScene = getActiveScene();
    els.hotspotLayer.textContent = "";
    if (!activeScene) {
      return;
    }

    activeScene.hotspots.forEach((hotspot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tour-hotspot";
      button.dataset.hotspotId = hotspot.id;
      button.setAttribute("aria-label", hotspot.label);
      button.innerHTML = `<span aria-hidden="true">${icons[hotspot.icon] || icons.arrow}</span><strong>${hotspot.label}</strong>`;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.mode === "preview") {
          selectScene(hotspot.targetSceneId, { fromPreview: true });
        } else {
          openHotspotDialog({ hotspot });
        }
      });
      els.hotspotLayer.appendChild(button);
    });
  };

  const renderSceneList = () => {
    els.sceneList.textContent = "";
    els.sceneCount.textContent = `${state.scenes.length} / ${MAX_SCENES}`;

    if (!state.scenes.length) {
      const empty = document.createElement("p");
      empty.className = "tour-muted";
      empty.textContent = "Nenhuma cena adicionada ainda.";
      els.sceneList.appendChild(empty);
      return;
    }

    state.scenes.forEach((scene) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "tour-scene-card";
      item.classList.toggle("is-active", scene.id === state.activeSceneId);
      item.setAttribute("aria-pressed", String(scene.id === state.activeSceneId));
      item.addEventListener("click", () => selectScene(scene.id));

      const thumb = document.createElement("span");
      thumb.className = "tour-scene-thumb";
      if (scene.imageUrl) {
        const image = document.createElement("img");
        image.src = scene.imageUrl;
        image.alt = "";
        image.loading = "lazy";
        thumb.appendChild(image);
      } else {
        thumb.textContent = "360";
      }

      const copy = document.createElement("span");
      copy.className = "tour-scene-copy";
      copy.innerHTML = `<strong>${scene.name}</strong><small>${scene.imageFormatLabel || formatLabel(scene.imageFormat)} · ${scene.hotspots.length} hotspot${scene.hotspots.length === 1 ? "" : "s"}</small>`;

      const marker = document.createElement("span");
      marker.className = "tour-initial-marker";
      marker.textContent = scene.id === state.initialSceneId ? "Inicial" : "";

      item.append(thumb, copy, marker);
      els.sceneList.appendChild(item);
    });
  };

  const renderInspector = () => {
    const scene = getActiveScene();
    els.inspectorEmpty.hidden = Boolean(scene);
    els.inspectorContent.hidden = !scene;
    if (!scene) {
      return;
    }

    els.sceneName.value = scene.name;
    els.sceneFormat.value = scene.imageFormat;
    els.setInitial.textContent = scene.id === state.initialSceneId ? "Cena inicial selecionada" : "Definir como cena inicial";
    els.setInitial.disabled = scene.id === state.initialSceneId;
    els.hotspotCount.textContent = String(scene.hotspots.length);
    els.hotspotList.textContent = "";

    if (!scene.hotspots.length) {
      const empty = document.createElement("p");
      empty.className = "tour-muted";
      empty.textContent = "Clique no viewer para criar o primeiro hotspot.";
      els.hotspotList.appendChild(empty);
      return;
    }

    scene.hotspots.forEach((hotspot) => {
      const target = state.scenes.find((item) => item.id === hotspot.targetSceneId);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "tour-hotspot-row";
      row.innerHTML = `<span>${icons[hotspot.icon] || icons.arrow}</span><strong>${hotspot.label}</strong><small>${target?.name || "Destino não encontrado"}</small>`;
      row.addEventListener("click", () => openHotspotDialog({ hotspot }));
      els.hotspotList.appendChild(row);
    });
  };

  const updateCta = () => {
    const hotspotCount = state.scenes.reduce((total, scene) => total + scene.hotspots.length, 0);
    els.cta.hidden = !(state.scenes.length >= 2 && hotspotCount >= 1);
  };

  const render = ({ keepTexture = false } = {}) => {
    renderSceneList();
    renderInspector();
    renderHotspots();
    updateCta();
    els.watermark.hidden = state.mode !== "preview";
    els.viewerShell.classList.toggle("is-preview", state.mode === "preview");
    els.modeButtons.forEach((button) => {
      const isActive = button.dataset.tourMode === state.mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    if (!keepTexture) {
      applySceneTexture();
    } else {
      els.emptyState.hidden = Boolean(getActiveScene()?.imageUrl);
    }
    persist();
  };

  const formatLabel = (format) => {
    if (format === "sideBySide") {
      return "Side-by-side";
    }
    if (format === "topDown") {
      return "Top-down";
    }
    return "Mono";
  };

  const selectScene = (sceneId, { fromPreview = false } = {}) => {
    if (!state.scenes.some((scene) => scene.id === sceneId)) {
      return;
    }
    state.activeSceneId = sceneId;
    if (fromPreview) {
      viewer.yaw = 0;
      viewer.pitch = 0;
    }
    render();
  };

  const attachImageToScene = async (scene, file) => {
    const key = imageKey(file.name, file.size);
    if (state.db) {
      await dbPut({
        key,
        name: file.name,
        size: file.size,
        type: file.type,
        updatedAt: Date.now(),
        blob: file
      });
    }
    if (scene.imageUrl) {
      URL.revokeObjectURL(scene.imageUrl);
    }
    scene.imageKey = key;
    scene.imageName = file.name;
    scene.imageSize = file.size;
    scene.imageUrl = URL.createObjectURL(file);
    scene.missingImage = false;
  };

  const createSceneFromFile = async (file) => {
    const scene = {
      id: uid("scene"),
      name: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") || `Cena ${state.scenes.length + 1}`,
      imageName: file.name,
      imageSize: file.size,
      imageFormat: "mono",
      imageUrl: "",
      imageKey: imageKey(file.name, file.size),
      missingImage: false,
      hotspots: []
    };
    await attachImageToScene(scene, file);
    state.scenes.push(scene);
    if (!state.initialSceneId) {
      state.initialSceneId = scene.id;
    }
    state.activeSceneId = scene.id;
  };

  const processFiles = async (files) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const messages = [];

    for (const file of imageFiles) {
      if (file.size > MAX_IMAGE_SIZE) {
        messages.push(`${file.name} excede ${MAX_IMAGE_SIZE_MB} MB.`);
        continue;
      }

      const missingScene = state.scenes.find((scene) => !scene.imageUrl && scene.imageName === file.name && (!scene.imageSize || scene.imageSize === file.size));
      if (missingScene) {
        await attachImageToScene(missingScene, file);
        messages.push(`${file.name} reassociada a uma cena importada.`);
        continue;
      }

      if (state.scenes.length >= MAX_SCENES) {
        messages.push(`Limite de ${MAX_SCENES} cenas atingido.`);
        break;
      }

      await createSceneFromFile(file);
    }

    if (!imageFiles.length) {
      messages.push("Selecione arquivos de imagem válidos.");
    }

    render();
    setStatus(messages.length ? messages.join(" ") : "Imagens adicionadas ao tour.", messages.some((message) => message.includes("excede") || message.includes("Limite")) ? "warning" : "success");
  };

  const populateTargetOptions = (currentTargetId = "") => {
    const activeScene = getActiveScene();
    dialog.target.textContent = "";
    state.scenes
      .filter((scene) => scene.id !== activeScene?.id)
      .forEach((scene) => {
        const option = document.createElement("option");
        option.value = scene.id;
        option.textContent = scene.name;
        dialog.target.appendChild(option);
      });

    if (currentTargetId && state.scenes.some((scene) => scene.id === currentTargetId && scene.id !== activeScene?.id)) {
      dialog.target.value = currentTargetId;
    }
  };

  const openHotspotDialog = ({ hotspot = null, position = null } = {}) => {
    const activeScene = getActiveScene();
    if (!activeScene || state.scenes.length < 2) {
      setStatus("Adicione pelo menos duas cenas para criar um hotspot com destino.", "warning");
      return;
    }

    state.editingHotspot = hotspot?.id || null;
    state.pendingHotspotPosition = position || (hotspot ? { xPercent: hotspot.xPercent, yPercent: hotspot.yPercent } : null);
    dialog.title.textContent = hotspot ? "Editar hotspot" : "Novo hotspot";
    dialog.label.value = hotspot?.label || "";
    dialog.icon.value = hotspot?.icon || "arrow";
    populateTargetOptions(hotspot?.targetSceneId || "");
    dialog.deleteButton.hidden = !hotspot;

    if (!dialog.target.options.length) {
      setStatus("Crie outra cena para definir o destino do hotspot.", "warning");
      return;
    }

    if (dialog.node.showModal) {
      dialog.node.showModal();
    } else {
      dialog.node.setAttribute("open", "");
    }
    dialog.label.focus();
  };

  const closeHotspotDialog = () => {
    dialog.node.close?.();
    dialog.node.removeAttribute("open");
    state.editingHotspot = null;
    state.pendingHotspotPosition = null;
  };

  const saveHotspot = () => {
    const activeScene = getActiveScene();
    if (!activeScene) {
      return;
    }

    const label = dialog.label.value.trim();
    const targetSceneId = dialog.target.value;
    if (!label || !targetSceneId) {
      setStatus("Informe label e destino do hotspot.", "warning");
      return;
    }

    const existing = activeScene.hotspots.find((hotspot) => hotspot.id === state.editingHotspot);
    if (existing) {
      existing.label = label;
      existing.targetSceneId = targetSceneId;
      existing.icon = dialog.icon.value;
    } else if (state.pendingHotspotPosition) {
      activeScene.hotspots.push({
        id: uid("hotspot"),
        label,
        targetSceneId,
        icon: dialog.icon.value,
        xPercent: state.pendingHotspotPosition.xPercent,
        yPercent: state.pendingHotspotPosition.yPercent
      });
    }

    closeHotspotDialog();
    render({ keepTexture: true });
    setStatus("Hotspot salvo.", "success");
  };

  const deleteHotspot = () => {
    const activeScene = getActiveScene();
    if (!activeScene || !state.editingHotspot) {
      return;
    }
    activeScene.hotspots = activeScene.hotspots.filter((hotspot) => hotspot.id !== state.editingHotspot);
    closeHotspotDialog();
    render({ keepTexture: true });
    setStatus("Hotspot removido.", "success");
  };

  const exportTour = () => {
    if (!state.scenes.length) {
      setStatus("Adicione cenas antes de exportar.", "warning");
      return;
    }
    downloadJson("tour-config.json", serializeTour());
    setStatus("Arquivo tour-config.json exportado.", "success");
  };

  const normalizeImportedScene = (scene, index, imageRecords) => {
    const key = scene.imageKey || imageKey(scene.imageName || "", scene.imageSize || 0);
    const record = imageRecords.find((item) => item.key === key || (item.name === scene.imageName && item.size === scene.imageSize) || item.name === scene.imageName);
    const sceneId = scene.id || uid("scene");
    const sceneIds = new Set((scene.hotspots || []).map((hotspot) => hotspot.targetSceneId));
    const imported = {
      id: sceneId,
      name: scene.name || `Cena ${index + 1}`,
      imageName: scene.imageName || `imagem-${index + 1}`,
      imageSize: Number(scene.imageSize || 0),
      imageFormat: ["mono", "sideBySide", "topDown"].includes(scene.imageFormat) ? scene.imageFormat : "mono",
      imageKey: record?.key || key,
      imageUrl: record?.blob ? URL.createObjectURL(record.blob) : "",
      missingImage: !record?.blob,
      hotspots: []
    };

    imported.hotspots = (scene.hotspots || []).map((hotspot) => ({
      id: hotspot.id || uid("hotspot"),
      label: hotspot.label || "Hotspot",
      targetSceneId: hotspot.targetSceneId,
      icon: icons[hotspot.icon] ? hotspot.icon : "arrow",
      xPercent: clamp(Number(hotspot.xPercent || 50), 0, 100),
      yPercent: clamp(Number(hotspot.yPercent || 50), 0, 100)
    })).filter((hotspot) => sceneIds.has(hotspot.targetSceneId) || hotspot.targetSceneId);

    return imported;
  };

  const importTour = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.version !== 1 || !Array.isArray(data.scenes)) {
        throw new Error("Arquivo JSON de tour inválido.");
      }

      const imageRecords = state.db ? await dbGetAll() : [];
      revokeSceneUrls();
      const importedScenes = data.scenes.slice(0, MAX_SCENES).map((scene, index) => normalizeImportedScene(scene, index, imageRecords));
      const validIds = new Set(importedScenes.map((scene) => scene.id));
      importedScenes.forEach((scene) => {
        scene.hotspots = scene.hotspots.filter((hotspot) => validIds.has(hotspot.targetSceneId));
      });

      state.scenes = importedScenes;
      state.initialSceneId = validIds.has(data.initialSceneId) ? data.initialSceneId : importedScenes[0]?.id || "";
      state.activeSceneId = state.initialSceneId;
      render();

      const missingCount = importedScenes.filter((scene) => scene.missingImage).length;
      setStatus(
        missingCount
          ? `Tour importado. ${missingCount} imagem${missingCount === 1 ? "" : "s"} precisa${missingCount === 1 ? "" : "m"} ser reassociada${missingCount === 1 ? "" : "s"} pelo nome.`
          : "Tour importado com imagens reassociadas.",
        missingCount ? "warning" : "success"
      );
    } catch (error) {
      setStatus(error.message || "Não foi possível importar o JSON.", "error");
    }
  };

  const resetTour = async () => {
    const confirmed = window.confirm("Resetar este tour? As cenas, hotspots e imagens salvas neste navegador serão removidos.");
    if (!confirmed) {
      return;
    }

    revokeSceneUrls();
    state.scenes = [];
    state.activeSceneId = "";
    state.initialSceneId = "";
    state.mode = "edit";
    localStorage.removeItem(STORAGE_KEY);
    if (state.db) {
      await dbClear();
    }
    render();
    setStatus("Tour resetado.", "success");
  };

  const restore = async () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      state.restoreComplete = true;
      render();
      return;
    }

    try {
      const data = JSON.parse(stored);
      if (!Array.isArray(data.scenes)) {
        throw new Error("Configuração local inválida.");
      }

      const imageRecords = await dbGetAll();
      state.scenes = data.scenes.slice(0, MAX_SCENES).map((scene, index) => normalizeImportedScene(scene, index, imageRecords));
      const validIds = new Set(state.scenes.map((scene) => scene.id));
      state.scenes.forEach((scene) => {
        scene.hotspots = scene.hotspots.filter((hotspot) => validIds.has(hotspot.targetSceneId));
      });
      state.initialSceneId = validIds.has(data.initialSceneId) ? data.initialSceneId : state.scenes[0]?.id || "";
      state.activeSceneId = state.initialSceneId || state.scenes[0]?.id || "";
      state.restoreComplete = true;
      render();
    } catch {
      state.restoreComplete = true;
      localStorage.removeItem(STORAGE_KEY);
      render();
    }
  };

  const bindEvents = () => {
    els.uploadTrigger.addEventListener("click", () => els.imageInput.click());
    els.imageInput.addEventListener("change", () => {
      processFiles(els.imageInput.files);
      els.imageInput.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      els.dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        els.dropzone.classList.add("is-dragging");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      els.dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        els.dropzone.classList.remove("is-dragging");
      });
    });

    els.dropzone.addEventListener("drop", (event) => {
      processFiles(event.dataTransfer.files);
    });

    els.modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.mode = button.dataset.tourMode;
        const initialScene = state.mode === "preview" ? getInitialScene() : getActiveScene();
        if (initialScene) {
          state.activeSceneId = initialScene.id;
        }
        render();
      });
    });

    els.sceneName.addEventListener("input", () => {
      const scene = getActiveScene();
      if (!scene) {
        return;
      }
      scene.name = els.sceneName.value.trim() || "Cena sem nome";
      render({ keepTexture: true });
    });

    els.sceneFormat.addEventListener("change", () => {
      const scene = getActiveScene();
      if (!scene) {
        return;
      }
      scene.imageFormat = els.sceneFormat.value;
      render();
      setStatus(`Formato atualizado para ${formatLabel(scene.imageFormat)}.`, "success");
    });

    els.setInitial.addEventListener("click", () => {
      const scene = getActiveScene();
      if (!scene) {
        return;
      }
      state.initialSceneId = scene.id;
      render({ keepTexture: true });
      setStatus("Cena inicial atualizada.", "success");
    });

    els.exportButton.addEventListener("click", exportTour);
    els.importButton.addEventListener("click", () => els.jsonInput.click());
    els.jsonInput.addEventListener("change", () => {
      const [file] = els.jsonInput.files;
      if (file) {
        importTour(file);
      }
      els.jsonInput.value = "";
    });

    els.fullscreenButton.addEventListener("click", () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        return;
      }
      els.viewerShell.requestFullscreen?.();
    });

    els.resetButton.addEventListener("click", resetTour);

    dialog.form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveHotspot();
    });
    dialog.cancelButton.addEventListener("click", closeHotspotDialog);
    dialog.deleteButton.addEventListener("click", deleteHotspot);
  };

  const init = async () => {
    setupViewer();
    bindEvents();
    try {
      state.db = await openDb();
      await restore();
    } catch {
      state.restoreComplete = true;
      render();
      setStatus("IndexedDB indisponível. A demo funciona, mas não salvará imagens ao recarregar.", "warning");
    }
  };

  init();
})();
