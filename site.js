(() => {
  const navToggle = document.querySelector("[data-nav-toggle]");
  const siteNav = document.querySelector("[data-site-nav]");

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  const setupHelpTooltips = () => {
    const helpButtons = Array.from(document.querySelectorAll("[data-help-tooltip]"));

    if (!helpButtons.length) {
      return;
    }

    const closeTooltips = (exceptButton = null) => {
      helpButtons.forEach((button) => {
        if (button !== exceptButton) {
          button.classList.remove("is-open");
          button.setAttribute("aria-expanded", "false");
        }
      });
    };

    helpButtons.forEach((button) => {
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = button.classList.toggle("is-open");
        button.setAttribute("aria-expanded", String(isOpen));
        closeTooltips(isOpen ? button : null);
      });
    });

    document.addEventListener("click", () => {
      closeTooltips();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeTooltips();
      }
    });
  };

  const setupPortfolioTabs = () => {
    const tabs = Array.from(document.querySelectorAll("[data-portfolio-tab]"));
    const panels = Array.from(document.querySelectorAll("[data-portfolio-panel]"));

    if (!tabs.length || !panels.length) {
      return;
    }

    const selectPanel = (panelId) => {
      tabs.forEach((tab) => {
        const isSelected = tab.dataset.portfolioTab === panelId;
        tab.classList.toggle("is-selected", isSelected);
        tab.setAttribute("aria-selected", String(isSelected));
      });

      panels.forEach((panel) => {
        panel.hidden = panel.id !== panelId;
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        selectPanel(tab.dataset.portfolioTab);
      });
    });
  };

  const setupPortfolioLightbox = () => {
    const images = Array.from(document.querySelectorAll(".portfolio-tile .tile-visual img"));

    if (!images.length) {
      return;
    }

    const lightbox = document.createElement("div");
    lightbox.className = "portfolio-lightbox";
    lightbox.hidden = true;
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "Visualizacao ampliada da imagem");
    lightbox.innerHTML = `
      <div class="portfolio-lightbox-surface" data-lightbox-surface>
        <div class="portfolio-lightbox-toolbar">
          <span class="portfolio-lightbox-title" data-lightbox-title></span>
          <div class="portfolio-lightbox-actions">
            <button type="button" data-lightbox-zoom-out aria-label="Reduzir zoom">-</button>
            <label class="portfolio-zoom-slider">
              <span>Zoom</span>
              <input type="range" min="1" max="4" step="0.05" value="1" data-lightbox-zoom-slider aria-label="Nível de zoom" />
            </label>
            <button type="button" data-lightbox-zoom-in aria-label="Aumentar zoom">+</button>
            <button type="button" data-lightbox-reset aria-label="Restaurar zoom">1:1</button>
            <button type="button" data-lightbox-close aria-label="Fechar visualizacao">x</button>
          </div>
        </div>
        <div class="portfolio-lightbox-stage" data-lightbox-stage>
          <img data-lightbox-image alt="" draggable="false" />
        </div>
      </div>
    `;
    document.body.appendChild(lightbox);

    const stage = lightbox.querySelector("[data-lightbox-stage]");
    const image = lightbox.querySelector("[data-lightbox-image]");
    const title = lightbox.querySelector("[data-lightbox-title]");
    const closeButton = lightbox.querySelector("[data-lightbox-close]");
    const zoomInButton = lightbox.querySelector("[data-lightbox-zoom-in]");
    const zoomOutButton = lightbox.querySelector("[data-lightbox-zoom-out]");
    const zoomSlider = lightbox.querySelector("[data-lightbox-zoom-slider]");
    const resetButton = lightbox.querySelector("[data-lightbox-reset]");
    const cards = images.map((item) => item.closest(".portfolio-tile")).filter(Boolean);
    let selectedCard = null;
    let lastFocused = null;
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    const getPanBounds = () => {
      const stageRect = stage.getBoundingClientRect();
      const imageWidth = image.clientWidth * scale;
      const imageHeight = image.clientHeight * scale;
      const minVisible = Math.min(96, stageRect.width * 0.32, stageRect.height * 0.32);
      const maxX = Math.max(0, (imageWidth + stageRect.width) / 2 - minVisible);
      const maxY = Math.max(0, (imageHeight + stageRect.height) / 2 - minVisible);

      return { maxX, maxY };
    };

    const clampPan = () => {
      const { maxX, maxY } = getPanBounds();
      translateX = clamp(translateX, -maxX, maxX);
      translateY = clamp(translateY, -maxY, maxY);
    };

    const applyTransform = () => {
      clampPan();
      image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      stage.classList.toggle("is-pannable", scale > 1);
      zoomSlider.value = String(scale);
      zoomSlider.style.setProperty("--zoom-progress", `${((scale - 1) / 3) * 100}%`);
    };

    const resetView = () => {
      scale = 1;
      translateX = 0;
      translateY = 0;
      applyTransform();
    };

    const setScale = (nextScale) => {
      scale = clamp(nextScale, 1, 4);

      if (scale === 1) {
        translateX = 0;
        translateY = 0;
      }

      applyTransform();
    };

    const blockNativeDrag = (event) => {
      event.preventDefault();
    };

    const selectCard = (card) => {
      cards.forEach((item) => {
        item.classList.toggle("is-image-selected", item === card);
        item.setAttribute("aria-pressed", String(item === card));
      });
      selectedCard = card;
    };

    const openLightbox = (card) => {
      const cardImage = card.querySelector(".tile-visual img");
      const cardTitle = card.querySelector(".tile-content h2, .tile-content h3")?.textContent.trim();

      if (!cardImage) {
        return;
      }

      selectCard(card);
      lastFocused = document.activeElement;
      image.src = cardImage.currentSrc || cardImage.src;
      image.alt = cardImage.alt || cardTitle || "";
      title.textContent = cardTitle || image.alt || "Imagem";
      resetView();
      lightbox.hidden = false;
      document.body.classList.add("is-lightbox-open");
      closeButton.focus({ preventScroll: true });
    };

    const closeLightbox = () => {
      if (lightbox.hidden) {
        return;
      }

      lightbox.hidden = true;
      document.body.classList.remove("is-lightbox-open");
      isPanning = false;
      stage.classList.remove("is-panning");
      image.removeAttribute("src");

      if (lastFocused instanceof HTMLElement) {
        lastFocused.focus({ preventScroll: true });
      }
    };

    cards.forEach((card) => {
      const cardImage = card.querySelector(".tile-visual img");
      const cardTitle = card.querySelector(".tile-content h2, .tile-content h3")?.textContent.trim();

      card.classList.add("has-image-card");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-haspopup", "dialog");
      card.setAttribute("aria-pressed", "false");
      card.setAttribute("aria-label", `Ampliar imagem: ${cardTitle || cardImage?.alt || "portfolio"}`);

      card.addEventListener("click", () => {
        openLightbox(card);
      });

      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLightbox(card);
        }
      });
    });

    zoomInButton.addEventListener("click", () => {
      setScale(scale + 0.25);
    });

    zoomOutButton.addEventListener("click", () => {
      setScale(scale - 0.25);
    });

    zoomSlider.addEventListener("input", () => {
      setScale(Number.parseFloat(zoomSlider.value));
    });

    resetButton.addEventListener("click", resetView);
    closeButton.addEventListener("click", closeLightbox);
    image.addEventListener("dragstart", blockNativeDrag);
    stage.addEventListener("dragstart", blockNativeDrag);

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !lightbox.hidden) {
        closeLightbox();
      }
    });

    stage.addEventListener("wheel", (event) => {
      if (lightbox.hidden) {
        return;
      }

      event.preventDefault();
      setScale(scale + (event.deltaY < 0 ? 0.18 : -0.18));
    }, { passive: false });

    stage.addEventListener("dblclick", () => {
      setScale(scale === 1 ? 2 : 1);
    });

    stage.addEventListener("pointerdown", (event) => {
      if (scale <= 1) {
        return;
      }

      event.preventDefault();
      isPanning = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = translateX;
      originY = translateY;
      stage.classList.add("is-panning");
      stage.setPointerCapture(event.pointerId);
    });

    stage.addEventListener("pointermove", (event) => {
      if (!isPanning) {
        return;
      }

      event.preventDefault();
      translateX = originX + event.clientX - startX;
      translateY = originY + event.clientY - startY;
      applyTransform();
    });

    const stopPanning = (event) => {
      isPanning = false;
      stage.classList.remove("is-panning");

      if (stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }
    };

    stage.addEventListener("pointerup", stopPanning);
    stage.addEventListener("pointercancel", stopPanning);
    window.addEventListener("resize", applyTransform);
  };

  const formatBRL = (value) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0
    }).format(value);
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const setupHeroCanvas = () => {
    const canvas = document.querySelector("[data-hero-canvas]");
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = null;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawLine = (points, color, lineWidth = 1) => {
      ctx.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    const draw = (time = 0) => {
      const pulse = reducedMotion.matches ? 0 : Math.sin(time * 0.0007) * 12;
      const cx = width * 0.64;
      const cy = height * 0.52;
      const roomW = Math.min(width * 0.46, 540);
      const roomH = Math.min(height * 0.42, 330);
      const depth = Math.min(width * 0.13, 140) + pulse;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(5, 7, 12, 0.08)";
      ctx.fillRect(0, 0, width, height);

      const back = [
        [cx - roomW * 0.36, cy - roomH * 0.34],
        [cx + roomW * 0.36, cy - roomH * 0.34],
        [cx + roomW * 0.36, cy + roomH * 0.34],
        [cx - roomW * 0.36, cy + roomH * 0.34],
        [cx - roomW * 0.36, cy - roomH * 0.34]
      ];
      const front = [
        [cx - roomW * 0.55 - depth * 0.2, cy - roomH * 0.52 - depth * 0.08],
        [cx + roomW * 0.55 + depth * 0.2, cy - roomH * 0.52 - depth * 0.08],
        [cx + roomW * 0.55 + depth * 0.2, cy + roomH * 0.52 + depth * 0.08],
        [cx - roomW * 0.55 - depth * 0.2, cy + roomH * 0.52 + depth * 0.08],
        [cx - roomW * 0.55 - depth * 0.2, cy - roomH * 0.52 - depth * 0.08]
      ];

      drawLine(front, "rgba(103, 232, 249, 0.26)", 1.2);
      drawLine(back, "rgba(134, 239, 172, 0.30)", 1.2);
      for (let i = 0; i < 4; i += 1) {
        drawLine([front[i], back[i]], "rgba(255, 255, 255, 0.16)", 1);
      }

      for (let i = 0; i < 9; i += 1) {
        const t = i / 8;
        const x = front[0][0] + (front[1][0] - front[0][0]) * t;
        drawLine([[x, front[0][1]], [cx + (x - cx) * 0.66, back[0][1]]], "rgba(255, 255, 255, 0.055)", 1);
      }

      for (let i = 0; i < 7; i += 1) {
        const t = i / 6;
        const y = front[0][1] + (front[3][1] - front[0][1]) * t;
        drawLine([[front[0][0], y], [front[1][0], y]], "rgba(103, 232, 249, 0.055)", 1);
      }

      ctx.beginPath();
      ctx.arc(cx + roomW * 0.18, cy - roomH * 0.10, 54 + pulse * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(251, 191, 36, 0.11)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx - roomW * 0.18, cy + roomH * 0.12, 72 - pulse * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(103, 232, 249, 0.10)";
      ctx.fill();

      if (!reducedMotion.matches) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    resize();
    draw();

    if (!reducedMotion.matches) {
      frame = window.requestAnimationFrame(draw);
    }

    window.addEventListener("resize", () => {
      resize();
      draw();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && frame) {
        window.cancelAnimationFrame(frame);
        frame = null;
      } else if (!document.hidden && !frame && !reducedMotion.matches) {
        frame = window.requestAnimationFrame(draw);
      }
    });
  };

  const setupBudget = () => {
    const builder = document.querySelector("#budget-builder");
    if (!builder) {
      return;
    }

    const unitPrice = 200;
    const cards = Array.from(builder.querySelectorAll("[data-budget-card]"));
    const featureChips = builder.querySelector("[data-feature-chips]");
    const detailTemplate = builder.querySelector("[data-inline-details-panel]");
    const quantities = Array.from(builder.querySelectorAll("[data-budget-qty]"));
    const featureLabels = {
      meta: "Meta Quest",
      tablet: "Tablet",
      web: "Web/PWA",
      android: "Android",
      ios: "iOS",
      windows: "Windows",
      vr: "VR",
      buttons: "Navegação simples",
      hotspots: "Navegação complexa",
      tcp: "Comunicação TCP",
      browser: "Navegador",
      bluetooth: "Sincronização Bluetooth",
      webrtc: "Comunicação WebRTC",
      "no-sync": "Sem comunicação"
    };
    const platformBadgeLabels = {
      meta: "Quest",
      tablet: "Tablet",
      android: "Android",
      ios: "iOS",
      windows: "Windows"
    };
    const platformFeatureKeys = Object.keys(platformBadgeLabels);
    const featureBadgeLabels = {
      buttons: "Navegação simples",
      hotspots: "Navegação complexa",
      tcp: "Comunicação TCP",
      web: "Web/PWA",
      browser: "Navegador",
      bluetooth: "Sincronização Bluetooth",
      webrtc: "Comunicação WebRTC",
      "no-sync": "Sem comunicação"
    };
    const functionalFeatureKeys = Object.keys(featureBadgeLabels);
    const optionDetails = {
      "1A": {
        title: "Navegação simples",
        description: "Inclui apenas o mínimo necessário para navegar pela experiência no Meta Quest, com comandos diretos para alternar cenas ou escolhas principais."
      },
      "1B": {
        title: "Navegação complexa",
        description: "Inclui navegação com hotspots ou uma interface mais sofisticada dentro da experiência VR para acessar cenas, informações ou ações contextuais."
      },
      "2A": {
        title: "Navegação simples em Quest + Tablet",
        description: "Inclui apenas o mínimo necessário para navegar em duas plataformas independentes, sem comunicação entre headset e tablet."
      },
      "2B": {
        title: "Navegação complexa em Quest + Tablet",
        description: "Inclui hotspots ou uma interface mais sofisticada nas duas plataformas independentes, sem comunicação entre headset e tablet."
      },
      "3A": {
        title: "TCP com navegação simples",
        description: "Inclui comunicação TCP entre Meta Quest e Tablet, com o mínimo necessário para controle remoto de cenas, imagens e recursos da experiência VR."
      },
      "3B": {
        title: "TCP com navegação complexa",
        description: "Inclui comunicação TCP entre Meta Quest e Tablet, com hotspots ou uma interface mais sofisticada para controle remoto contextual de cenas, imagens e recursos da experiência VR."
      },
      "4A": {
        title: "Web/PWA com navegação simples",
        description: "Inclui uma experiência Web/PWA mais enxuta, com o mínimo necessário para apresentar o tour no navegador e navegar pelos conteúdos principais."
      },
      "4B": {
        title: "Web/PWA com navegação complexa",
        description: "Inclui uma experiência Web/PWA avançada, com hotspots ou interface mais sofisticada, além de recursos como sincronização Bluetooth e comunicação WebRTC quando aplicável."
      }
    };
    const summary = {
      title: builder.querySelector("[data-summary-title]"),
      chips: builder.querySelector("[data-summary-chips]"),
      base: builder.querySelector("[data-summary-base]"),
      images: builder.querySelector("[data-summary-images]"),
      audios: builder.querySelector("[data-summary-audios]"),
      total: builder.querySelector("[data-summary-total]"),
      copy: builder.querySelector("[data-copy-summary]"),
      email: builder.querySelector("[data-budget-email]"),
      projectDetails: builder.querySelector("[data-budget-project-details]"),
      status: builder.querySelector("[data-copy-status]")
    };
    let selectedCard = cards.find((card) => card.classList.contains("is-selected")) || cards[0];

    if (detailTemplate) {
      cards.forEach((card) => {
        if (!card.querySelector("[data-inline-details-panel]")) {
          const clonedDetails = detailTemplate.cloneNode(true);
          clonedDetails.hidden = true;
          card.appendChild(clonedDetails);
        }
      });
    }

    const detailToggles = Array.from(builder.querySelectorAll("[data-details-toggle]"));

    const getQty = (key) => {
      const input = quantities.find((item) => item.dataset.budgetQty === key);
      if (!input) {
        return 0;
      }

      const min = Number.parseInt(input.min || "0", 10);
      const max = Number.parseInt(input.max || "999", 10);
      const value = Number.parseInt(input.value || "0", 10);
      const next = clamp(Number.isFinite(value) ? value : 0, min, max);
      input.value = String(next);
      return next;
    };

    const getCardModes = (card) => Array.from(card.querySelectorAll("[data-mode-option]"));

    const getSelectedMode = (card) => {
      const modes = getCardModes(card);
      return modes.find((mode) => mode.classList.contains("is-selected")) || modes[0];
    };

    const syncCardPrice = (card) => {
      const mode = getSelectedMode(card);
      const price = Number.parseInt(mode?.dataset.optionPrice || "0", 10);
      const priceNode = card.querySelector("[data-card-price]");

      if (priceNode) {
        priceNode.textContent = formatBRL(price);
      }
    };

    const syncModeState = (card, selectedMode) => {
      getCardModes(card).forEach((mode) => {
        const isSelected = mode === selectedMode;
        mode.classList.toggle("is-selected", isSelected);
        mode.setAttribute("aria-pressed", String(isSelected));
      });
      syncCardPrice(card);
      syncCardBadges(card);
    };

    const syncCardBadges = (card) => {
      const mode = getSelectedMode(card);
      const features = (mode?.dataset.optionFeatures || "").split(",").filter(Boolean);
      const stalePlatformBadges = card.querySelector("[data-card-platform-badges]");
      let badges = card.querySelector("[data-card-badges]");

      stalePlatformBadges?.remove();
      if (!badges) {
        badges = document.createElement("div");
        badges.className = "card-badge-panel";
        badges.dataset.cardBadges = "";
        card.appendChild(badges);
      }

      badges.textContent = "";

      const renderBadgeGroup = (label, items, type) => {
        if (!items.length) {
          return;
        }

        const group = document.createElement("div");
        group.className = `card-badge-group card-badge-group-${type}`;

        const groupLabel = document.createElement("span");
        groupLabel.className = "card-badge-label";
        groupLabel.textContent = label;
        group.appendChild(groupLabel);

        const chipRow = document.createElement("div");
        chipRow.className = "card-badge-row";
        items.forEach((feature) => {
          const badge = document.createElement("span");
          badge.className = `card-badge-chip is-${type}`;
          badge.textContent = type === "platform" ? platformBadgeLabels[feature] : featureBadgeLabels[feature];
          chipRow.appendChild(badge);
        });
        group.appendChild(chipRow);
        badges.appendChild(group);
      };

      renderBadgeGroup("Platform:", features.filter((feature) => platformFeatureKeys.includes(feature)), "platform");
      renderBadgeGroup("Features:", features.filter((feature) => functionalFeatureKeys.includes(feature)), "feature");
    };

    const syncDetailsPanel = () => {
      detailToggles.forEach((button) => {
        const card = button.closest("[data-budget-card]");
        const panel = card?.querySelector("[data-inline-details-panel]");
        const isOpen = Boolean(panel && !panel.hidden);
        button.classList.toggle("is-active", isOpen);
        button.setAttribute("aria-expanded", String(isOpen));
        button.textContent = isOpen ? "Ocultar detalhes" : "Detalhes";
      });
    };

    const syncCardDetailNotes = () => {
      cards.forEach((card) => {
        const mode = getSelectedMode(card);
        const features = (mode?.dataset.optionFeatures || "").split(",").filter(Boolean);
        const detail = optionDetails[mode?.dataset.optionCode || ""];
        const optionDetail = card.querySelector("[data-option-detail]");
        const hostingNote = card.querySelector("[data-web-hosting-note]");

        if (optionDetail && detail) {
          optionDetail.querySelector("strong").textContent = detail.title;
          optionDetail.querySelector("p").textContent = detail.description;
        }

        if (hostingNote) {
          hostingNote.hidden = !features.includes("web");
        }
      });
    };

    const setSelectedCard = (card) => {
      selectedCard = card;
      cards.forEach((item) => {
        const isSelected = item === card;
        item.classList.toggle("is-selected", isSelected);
        item.setAttribute("aria-checked", String(isSelected));
      });
      syncDetailsPanel();
      updateBudget();
    };

    const getSelectedFeatures = () => {
      const mode = getSelectedMode(selectedCard);
      return (mode?.dataset.optionFeatures || "").split(",").filter(Boolean);
    };

    const renderFeatureChips = (container) => {
      if (!container) {
        return;
      }

      container.textContent = "";
      getSelectedFeatures().forEach((feature) => {
        const chip = document.createElement("span");
        chip.className = "select-chip is-selected";
        chip.textContent = featureLabels[feature] || feature;
        container.appendChild(chip);
      });
    };

    const updateChips = () => {
      renderFeatureChips(featureChips);
      renderFeatureChips(summary.chips);
    };

    const buildBudgetState = () => {
      const mode = getSelectedMode(selectedCard);
      const features = getSelectedFeatures();
      const base = Number.parseInt(mode?.dataset.optionPrice || "0", 10);
      const images = getQty("images");
      const audios = getQty("audios");
      const imageCost = images * unitPrice;
      const audioCost = audios * unitPrice;
      const total = base + imageCost + audioCost;

      return {
        code: mode?.dataset.optionCode || "",
        title: mode?.dataset.optionTitle || "",
        isWebPwa: features.includes("web"),
        base,
        images,
        audios,
        imageCost,
        audioCost,
        total
      };
    };

    const updateBudget = () => {
      const state = buildBudgetState();
      updateChips();

      summary.title.textContent = state.title;
      summary.base.textContent = formatBRL(state.base);
      summary.images.textContent = formatBRL(state.imageCost);
      summary.audios.textContent = formatBRL(state.audioCost);
      summary.total.textContent = formatBRL(state.total);

      syncCardDetailNotes();

      return state;
    };

    const buildSummaryText = () => {
      const state = buildBudgetState();
      const email = summary.email?.value.trim();
      const projectDetails = summary.projectDetails?.value.trim();
      const lines = [
        "Orçamento LuKassab — Experiência 360° / VR",
        `E-mail do cliente: ${email || "não informado"}`,
        `Detalhes do projeto: ${projectDetails || "não informado"}`,
        `Opção escolhida: ${state.title}`,
        `Valor base: ${formatBRL(state.base)}`,
        `${state.images} imagens 360° x ${formatBRL(unitPrice)} = ${formatBRL(state.imageCost)}`,
        `${state.audios} áudios x ${formatBRL(unitPrice)} = ${formatBRL(state.audioCost)}`,
        `Valor estimado: ${formatBRL(state.total)}`,
        "Reimportação de mídias: até 4 vezes por imagem 360° ou áudio dentro do escopo aprovado."
      ];

      if (state.isWebPwa) {
        lines.push("Hosting Web/PWA: domínio, hospedagem, custos recorrentes e publicação serão definidos à parte.");
      }

      return lines.join("\n");
    };

    cards.forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("[data-mode-option], [data-details-toggle], [data-inline-quantity-panel], [data-inline-details-panel]")) {
          return;
        }
        setSelectedCard(card);
      });

      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelectedCard(card);
        }
      });

      getCardModes(card).forEach((mode) => {
        mode.addEventListener("click", (event) => {
          event.stopPropagation();
          syncModeState(card, mode);
          setSelectedCard(card);
        });
      });

      syncCardPrice(card);
      syncCardBadges(card);
    });

    detailToggles.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const card = button.closest("[data-budget-card]");
        if (!card) {
          return;
        }

        const panel = card.querySelector("[data-inline-details-panel]");
        if (panel) {
          panel.hidden = !panel.hidden;
        }
        setSelectedCard(card);
        syncDetailsPanel();
      });
    });

    quantities.forEach((input) => {
      input.addEventListener("input", updateBudget);
      input.addEventListener("change", updateBudget);
    });

    builder.querySelectorAll("[data-step-for]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const input = builder.querySelector(`[data-budget-qty="${button.dataset.stepFor}"]`);
        if (!input) {
          return;
        }

        const step = Number.parseInt(button.dataset.step || "0", 10);
        const value = Number.parseInt(input.value || "0", 10);
        const min = Number.parseInt(input.min || "0", 10);
        const max = Number.parseInt(input.max || "999", 10);
        input.value = String(clamp((Number.isFinite(value) ? value : 0) + step, min, max));
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });

    summary.copy?.addEventListener("click", async () => {
      if (summary.email?.value && !summary.email.checkValidity()) {
        summary.email.reportValidity();
        summary.status.textContent = "Informe um e-mail válido.";
        return;
      }

      const text = buildSummaryText();

      try {
        await navigator.clipboard.writeText(text);
        summary.status.textContent = "Orçamento pronto para envio.";
      } catch {
        window.prompt("Copie o orçamento:", text);
        summary.status.textContent = "Orçamento pronto.";
      }

      window.setTimeout(() => {
        summary.status.textContent = "";
      }, 1800);
    });

    syncDetailsPanel();
    updateBudget();
  };

  const setupGuidedBudget = () => {
    const builder = document.querySelector("#guided-budget");
    if (!builder) {
      return;
    }

    const unitPrice = 200;
    const projectName = builder.querySelector("[data-guided-project-name]");
    const email = builder.querySelector("[data-guided-email]");
    const projectDetails = builder.querySelector("[data-guided-project-details]");
    const navButtons = Array.from(builder.querySelectorAll("[data-guided-nav]"));
    const navSwitch = builder.querySelector("[data-guided-nav-switch]");
    const platformButtons = Array.from(builder.querySelectorAll("[data-guided-platform]"));
    const communicationButtons = Array.from(builder.querySelectorAll("[data-guided-communication]"));
    const extraButtons = Array.from(builder.querySelectorAll("[data-guided-extra]"));
    const quantities = Array.from(builder.querySelectorAll("[data-guided-qty]"));
    const preview = {
      title: builder.querySelector("[data-guided-preview-title]"),
      option: builder.querySelector("[data-guided-preview-option]"),
      chips: builder.querySelector("[data-guided-preview-chips]"),
      base: builder.querySelector("[data-guided-base]"),
      images: builder.querySelector("[data-guided-images]"),
      audios: builder.querySelector("[data-guided-audios]"),
      total: builder.querySelector("[data-guided-total]"),
      note: builder.querySelector("[data-guided-note]"),
      send: builder.querySelector("[data-guided-send]"),
      status: builder.querySelector("[data-guided-status]"),
      platformWarning: builder.querySelector("[data-guided-platform-warning]"),
      platformStep: builder.querySelector("[data-guided-platform-step]")
    };

    const labels = {
      nav: {
        simple: "Navegação simples",
        complex: "Navegação complexa"
      },
      platform: {
        meta: "Meta Quest",
        tablet: "Tablet",
        web: "Web",
        android: "Android",
        ios: "iOS",
        windows: "Windows"
      },
      communication: {
        none: "Sem comunicação",
        tcp: "Comunicação TCP",
        bluetooth: "Sincronização Bluetooth",
        webrtc: "Comunicação WebRTC"
      },
      extra: {
        hotspots: "Hotspots informativos",
        "control-panel": "Painel de controle",
        "pwa-install": "PWA instalável",
        "lighting-states": "Estados de iluminação"
      }
    };

    const getSelectedValue = (buttons, key) => {
      if (key === "guidedNav" && navSwitch) {
        return navSwitch.checked ? "complex" : "simple";
      }

      const selected = buttons.find((button) => button.classList.contains("is-selected"));
      return selected?.dataset[key] || "";
    };

    const getSelectedList = (buttons, key) => {
      return buttons
        .filter((button) => button.classList.contains("is-selected"))
        .map((button) => button.dataset[key])
        .filter(Boolean);
    };

    const syncPressedState = (buttons) => {
      buttons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.classList.contains("is-selected")));
      });
    };

    const getQty = (key) => {
      const input = quantities.find((item) => item.dataset.guidedQty === key);
      if (!input) {
        return 0;
      }

      const min = Number.parseInt(input.min || "0", 10);
      const max = Number.parseInt(input.max || "999", 10);
      const value = Number.parseInt(input.value || "0", 10);
      const next = clamp(Number.isFinite(value) ? value : 0, min, max);
      input.value = String(next);
      return next;
    };

    const setSingleSelection = (buttons, selectedButton) => {
      buttons.forEach((button) => {
        button.classList.toggle("is-selected", button === selectedButton);
        button.setAttribute("aria-pressed", String(button === selectedButton));
      });
    };

    const selectPlatform = (value) => {
      const button = platformButtons.find((item) => item.dataset.guidedPlatform === value);
      button?.classList.add("is-selected");
      button?.setAttribute("aria-pressed", "true");
    };

    const normalizeGuidedSelections = () => {
      const communication = getSelectedValue(communicationButtons, "guidedCommunication");
      const extras = getSelectedList(extraButtons, "guidedExtra");

      if (communication === "tcp") {
        selectPlatform("meta");
        selectPlatform("tablet");
      }

      if (communication === "bluetooth" || communication === "webrtc" || extras.includes("pwa-install")) {
        selectPlatform("web");
      }

      syncPressedState(platformButtons);
    };

    const buildGuidedState = () => {
      const navigation = getSelectedValue(navButtons, "guidedNav") || "simple";
      const communication = getSelectedValue(communicationButtons, "guidedCommunication") || "none";
      const selectedPlatforms = getSelectedList(platformButtons, "guidedPlatform");
      const platforms = new Set(selectedPlatforms);
      const extras = getSelectedList(extraButtons, "guidedExtra");
      const usesPwa = extras.includes("pwa-install");

      if (communication === "tcp") {
        platforms.add("meta");
        platforms.add("tablet");
      }

      if (communication === "bluetooth" || communication === "webrtc" || usesPwa) {
        platforms.add("web");
      }

      const isComplex = navigation === "complex";
      const hasPlatformSelection = platforms.size > 0;
      const usesWebDelivery = platforms.has("web")
        || platforms.has("android")
        || platforms.has("ios")
        || platforms.has("windows")
        || usesPwa
        || communication === "bluetooth"
        || communication === "webrtc";
      const usesTcp = communication === "tcp";
      const usesMeta = platforms.has("meta");
      const usesTablet = platforms.has("tablet");
      let code = "";
      let title = "";
      let base = 0;
      let note = "";

      if (!hasPlatformSelection) {
        title = "Selecione uma plataforma";
        base = 0;
        note = "Escolha pelo menos uma plataforma para gerar uma prévia válida do orçamento.";
      } else if (usesTcp) {
        code = isComplex ? "3B" : "3A";
        title = `Meta Quest + Tablet via TCP com ${labels.nav[navigation].toLowerCase()}`;
        base = isComplex ? 12500 : 10000;
        note = "Comunicação TCP pressupõe Meta Quest + Tablet para controle ou sincronização da experiência.";
      } else if (usesWebDelivery) {
        code = isComplex ? "4B" : "4A";
        title = `${usesPwa ? "Website / PWA" : "Website"} com ${labels.nav[navigation].toLowerCase()}`;
        base = isComplex ? 20000 : 15000;
        note = `A prévia usa a solução ${usesPwa ? "Web/PWA" : "web"}. Hosting, domínio e publicação continuam definidos à parte.`;
      } else if (usesMeta && usesTablet) {
        code = isComplex ? "2B" : "2A";
        title = `Meta Quest + Tablet sem comunicação com ${labels.nav[navigation].toLowerCase()}`;
        base = isComplex ? 7500 : 5000;
        note = "A prévia considera duas plataformas independentes, sem sincronização entre os dispositivos.";
      } else if (usesMeta) {
        code = isComplex ? "1B" : "1A";
        title = `Meta Quest com ${labels.nav[navigation].toLowerCase()}`;
        base = isComplex ? 5000 : 2500;
        note = "A prévia usa a solução dedicada ao headset Meta Quest.";
      } else {
        code = isComplex ? "P2" : "P1";
        title = `Projeto personalizado com ${labels.nav[navigation].toLowerCase()}`;
        base = isComplex ? 7500 : 5000;
        note = "A combinação não corresponde exatamente a uma opção base fixa; a prévia usa uma estimativa personalizada.";
      }

      const images = getQty("images");
      const audios = getQty("audios");
      const imageCost = images * unitPrice;
      const audioCost = audios * unitPrice;

      return {
        project: projectName?.value.trim() || "Projeto sem nome",
        email: email?.value.trim() || "",
        details: projectDetails?.value.trim() || "",
        navigation,
        communication,
        platforms: Array.from(platforms),
        extras,
        usesWebDelivery,
        code,
        title,
        base,
        images,
        audios,
        imageCost,
        audioCost,
        total: base + imageCost + audioCost,
        note,
        isValid: hasPlatformSelection
      };
    };

    const renderGuidedChips = (state) => {
      preview.chips.textContent = "";

      const chipValues = [
        labels.nav[state.navigation],
        ...state.platforms.map((platform) => labels.platform[platform]),
        state.communication === "none" ? "" : labels.communication[state.communication],
        ...state.extras.map((extra) => labels.extra[extra])
      ].filter(Boolean);

      chipValues.forEach((value) => {
        const chip = document.createElement("span");
        chip.className = "select-chip is-selected";
        chip.textContent = value;
        preview.chips.appendChild(chip);
      });
    };

    const updateGuidedPreview = () => {
      const state = buildGuidedState();
      preview.title.textContent = state.project;
      preview.option.textContent = state.title;
      preview.base.textContent = formatBRL(state.base);
      preview.images.textContent = formatBRL(state.imageCost);
      preview.audios.textContent = formatBRL(state.audioCost);
      preview.total.textContent = formatBRL(state.total);
      preview.note.textContent = state.note;
      preview.platformWarning.hidden = state.isValid;
      preview.platformStep.classList.toggle("is-invalid", !state.isValid);
      preview.send.disabled = !state.isValid;
      preview.send.setAttribute("aria-disabled", String(!state.isValid));
      renderGuidedChips(state);
      return state;
    };

    const buildGuidedSummaryText = () => {
      const state = buildGuidedState();
      const lines = [
        "Orçamento LuKassab — Etapas guiadas",
        `Projeto: ${state.project}`,
        `E-mail do cliente: ${state.email || "não informado"}`,
        `Detalhes do projeto: ${state.details || "não informado"}`,
        `Navegação: ${labels.nav[state.navigation]}`,
        `Plataformas: ${state.platforms.map((platform) => labels.platform[platform]).join(", ")}`,
        `Comunicação: ${labels.communication[state.communication]}`,
        `Opções extras: ${state.extras.length ? state.extras.map((extra) => labels.extra[extra]).join(", ") : "nenhuma"}`,
        `Opção estimada: ${state.title}`,
        `Valor base: ${formatBRL(state.base)}`,
        `${state.images} imagens 360° x ${formatBRL(unitPrice)} = ${formatBRL(state.imageCost)}`,
        `${state.audios} áudios x ${formatBRL(unitPrice)} = ${formatBRL(state.audioCost)}`,
        `Valor estimado: ${formatBRL(state.total)}`,
        "Reimportação de mídias: até 4 vezes por imagem 360° ou áudio dentro do escopo aprovado."
      ];

      if (state.usesWebDelivery) {
        lines.push("Hosting Web/PWA: domínio, hospedagem, custos recorrentes e publicação serão definidos à parte.");
      }

      return lines.join("\n");
    };

    navButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setSingleSelection(navButtons, button);
        updateGuidedPreview();
      });
    });

    navSwitch?.addEventListener("change", updateGuidedPreview);

    platformButtons.forEach((button) => {
      button.addEventListener("click", () => {
        button.classList.toggle("is-selected");
        normalizeGuidedSelections();
        updateGuidedPreview();
      });
    });

    communicationButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setSingleSelection(communicationButtons, button);
        normalizeGuidedSelections();
        updateGuidedPreview();
      });
    });

    extraButtons.forEach((button) => {
      button.addEventListener("click", () => {
        button.classList.toggle("is-selected");
        button.setAttribute("aria-pressed", String(button.classList.contains("is-selected")));
        normalizeGuidedSelections();
        updateGuidedPreview();
      });
    });

    builder.querySelectorAll("[data-guided-step-for]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = builder.querySelector(`[data-guided-qty="${button.dataset.guidedStepFor}"]`);
        if (!input) {
          return;
        }

        const step = Number.parseInt(button.dataset.step || "0", 10);
        const value = Number.parseInt(input.value || "0", 10);
        const min = Number.parseInt(input.min || "0", 10);
        const max = Number.parseInt(input.max || "999", 10);
        input.value = String(clamp((Number.isFinite(value) ? value : 0) + step, min, max));
        updateGuidedPreview();
      });
    });

    [projectName, email, projectDetails].forEach((field) => {
      field?.addEventListener("input", updateGuidedPreview);
    });

    preview.send.addEventListener("click", async () => {
      const state = buildGuidedState();
      if (!state.isValid) {
        preview.platformWarning.hidden = false;
        preview.status.textContent = "Selecione pelo menos uma plataforma.";
        return;
      }

      if (email?.value && !email.checkValidity()) {
        email.reportValidity();
        preview.status.textContent = "Informe um e-mail válido.";
        return;
      }

      const text = buildGuidedSummaryText();
      try {
        await navigator.clipboard.writeText(text);
        preview.status.textContent = "Orçamento guiado pronto para envio.";
      } catch {
        window.prompt("Copie o orçamento:", text);
        preview.status.textContent = "Orçamento guiado pronto.";
      }

      window.setTimeout(() => {
        preview.status.textContent = "";
      }, 1800);
    });

    updateGuidedPreview();
  };

  const setupAdvancedGuidedBudget = () => {
    const builder = document.querySelector("#advanced-budget");
    if (!builder) {
      return;
    }

    const unitPrice = 200;
    const stepLabel = builder.querySelector("[data-advanced-step-label]");
    const stepName = builder.querySelector("[data-advanced-step-name]");
    const progressTrack = builder.querySelector("[data-advanced-progress-track]");
    const branchMap = builder.querySelector("[data-advanced-branch-map]");
    const questionKicker = builder.querySelector("[data-advanced-question-kicker]");
    const questionTitle = builder.querySelector("[data-advanced-question-title]");
    const questionDescription = builder.querySelector("[data-advanced-question-description]");
    const questionBody = builder.querySelector("[data-advanced-question-body]");
    const validation = builder.querySelector("[data-advanced-validation]");
    const backButton = builder.querySelector("[data-advanced-back]");
    const nextButton = builder.querySelector("[data-advanced-next]");
    const summary = {
      project: builder.querySelector("[data-advanced-summary-project]"),
      app: builder.querySelector("[data-advanced-summary-app]"),
      media: builder.querySelector("[data-advanced-summary-media]"),
      platforms: builder.querySelector("[data-advanced-summary-platforms]"),
      features: builder.querySelector("[data-advanced-summary-features]"),
      alerts: builder.querySelector("[data-advanced-summary-alerts]"),
      base: builder.querySelector("[data-advanced-summary-base]"),
      mediaCost: builder.querySelector("[data-advanced-summary-media-cost]"),
      total: builder.querySelector("[data-advanced-summary-total]"),
      note: builder.querySelector("[data-advanced-summary-note]"),
      copy: builder.querySelector("[data-advanced-copy]"),
      status: builder.querySelector("[data-advanced-status]")
    };

    const state = {
      step: 0,
      projectName: "",
      mediaCount: 0,
      soundCount: 0,
      mediaTouched: false,
      appType: "",
      platforms: [],
      features: [],
      details: "",
      email: "",
      corrections: [],
      expandedTimelineSteps: []
    };

    const assistiveAppTypes = {
      standalone: {
        label: "Standalone (APK ou EXE)",
        description: "Aplicação instalada no dispositivo, como APK para Android/Quest ou EXE para desktop Windows/Linux.",
        help: "Standalone significa que o app é instalado e roda diretamente no dispositivo, como APK no Android/Meta Quest ou EXE em computador compatível.",
        tags: ["standalone", "apk", "desktop", "vr", "mobile"],
        compatiblePlatforms: ["meta", "android", "desktopNoApple"],
        visibleBlockedPlatforms: ["ios"],
        blockedPlatforms: {
          metaAndroid: "Use Meta Quest para o modo standalone.",
          mobile: "Standalone separa Android de iOS; selecione Android.",
          desktopAll: "Standalone não contempla Apple nesta opção; selecione Desktop sem Apple."
        }
      },
      webPwa: {
        label: "Web (PWA)",
        description: "Aplicação web instalável, com comportamento próximo de app e acesso por dispositivos compatíveis.",
        help: "PWA significa Progressive Web App: uma aplicação web que pode ser acessada pelo navegador e, em muitos casos, instalada como se fosse um app.",
        tags: ["web", "pwa", "mobile", "desktop", "vr"],
        compatiblePlatforms: ["metaAndroid", "mobile", "desktopAll"]
      },
      webOnline: {
        label: "Web (totalmente online)",
        description: "Aplicação acessada online pelo navegador, sem necessidade de instalação como app.",
        help: "Web totalmente online é uma aplicação acessada por link no navegador, sem instalação local e com hospedagem/publicação definidas à parte.",
        tags: ["web", "mobile", "desktop", "vr"],
        compatiblePlatforms: ["metaAndroid", "mobile", "desktopAll"]
      }
    };

    const assistivePlatforms = {
      metaAndroid: {
        label: "Meta Quest (Android OS)",
        description: "Headset Meta Quest acessando uma solução web pelo sistema Android do dispositivo.",
        tags: ["vr", "mobile", "web"]
      },
      mobile: {
        label: "Mobile (Android e iOS)",
        description: "Celulares e tablets Android/iOS contemplados pela entrega web.",
        tags: ["mobile", "web"]
      },
      desktopAll: {
        label: "Desktop (Mac, Windows e Linux)",
        description: "Computadores desktop/notebook em sistemas Mac, Windows e Linux.",
        tags: ["desktop", "web"]
      },
      meta: {
        label: "Meta Quest",
        description: "Aplicação standalone para headset Meta Quest.",
        tags: ["vr", "apk", "standalone"]
      },
      android: {
        label: "Android",
        description: "APK standalone para celulares, tablets ou dispositivos Android.",
        tags: ["mobile", "apk", "standalone"]
      },
      desktopNoApple: {
        label: "Desktop (computador ou notebook, exceto Apple)",
        description: "Executável desktop para computador ou notebook fora do ecossistema Apple.",
        tags: ["desktop", "standalone"]
      },
      ios: {
        label: "iOS",
        description: "iOS indisponível no momento para Standalone (APK, EXE).",
        tags: ["mobile"]
      }
    };

    const assistiveFeatures = [
      {
        id: "nav-basic",
        label: "Navegação sem hotspot",
        description: "Fluxo mínimo de navegação entre telas, cenas ou mídias.",
        tags: ["all"],
        group: "navigation",
        priceMode: "core"
      },
      {
        id: "nav-hotspot",
        label: "Navegação com hotspot",
        description: "Pontos interativos para navegar ou abrir informações no conteúdo.",
        tags: ["all"],
        group: "navigation",
        priceMode: "core"
      },
      {
        id: "tour360",
        label: "Tour 360",
        description: "Experiência baseada em imagens 360° com pontos de navegação.",
        tags: ["web", "vr", "apk", "standalone"],
        priceMode: "core"
      },
      {
        id: "interactive3d",
        label: "Visualização 3D interativa",
        description: "Cena 3D navegável com interações e inspeção de elementos.",
        tags: ["3d", "web", "desktop", "vr"],
        priceMode: "scope"
      },
      {
        id: "api",
        label: "Integração com API",
        description: "Comunicação com serviços, bancos de dados ou sistemas externos.",
        tags: ["web", "mobile", "desktop"],
        priceMode: "scope"
      },
      {
        id: "login",
        label: "Login de usuário",
        description: "Área de acesso com autenticação.",
        tags: ["web", "mobile"],
        priceMode: "scope"
      },
      {
        id: "admin",
        label: "Painel administrativo",
        description: "Interface para gerenciar conteúdo, usuários ou registros.",
        tags: ["web"],
        priceMode: "scope"
      },
      {
        id: "responsive",
        label: "Responsividade",
        description: "Interface adaptada para diferentes tamanhos de tela.",
        tags: ["web", "mobile"],
        priceMode: "scope"
      },
      {
        id: "seo",
        label: "SEO",
        description: "Estrutura básica para indexação e compartilhamento.",
        tags: ["web"],
        requiresAny: { appTypes: ["webPwa", "webOnline"], platforms: ["metaAndroid", "mobile", "desktopAll"] },
        priceMode: "scope"
      },
      {
        id: "forms",
        label: "Formulários",
        description: "Coleta de informações do usuário ou pedidos de contato.",
        tags: ["web"],
        priceMode: "scope"
      },
      {
        id: "media-gallery",
        label: "Galeria de mídia",
        description: "Organização de imagens, vídeos ou materiais do projeto.",
        tags: ["web", "mobile", "desktop"],
        priceMode: "scope"
      },
      {
        id: "upload",
        label: "Upload de arquivos",
        description: "Envio de arquivos pelo usuário ou administrador.",
        tags: ["web"],
        priceMode: "scope"
      },
      {
        id: "object3d",
        label: "Interação com objetos 3D",
        description: "Seleção, destaque ou ação sobre objetos dentro da cena.",
        tags: ["3d", "vr", "desktop"],
        priceMode: "scope"
      },
      {
        id: "teleport",
        label: "Teleport em VR",
        description: "Locomoção por teleport dentro da experiência imersiva.",
        tags: ["vr"],
        priceMode: "scope"
      },
      {
        id: "raycast",
        label: "Controle por raycast",
        description: "Interação apontando o controle para menus ou objetos.",
        tags: ["vr"],
        priceMode: "scope"
      },
      {
        id: "vr-menus",
        label: "Menus em VR",
        description: "Menus e painéis posicionados dentro do ambiente virtual.",
        tags: ["vr"],
        priceMode: "scope"
      },
      {
        id: "headset-optimization",
        label: "Otimização para headset",
        description: "Ajustes de performance e ergonomia para VR standalone.",
        tags: ["vr"],
        priceMode: "scope"
      },
      {
        id: "mobile-compat",
        label: "Compatibilidade mobile",
        description: "Ajustes para uso em celular ou tablet.",
        tags: ["web", "mobile"],
        priceMode: "scope"
      },
      {
        id: "store-publishing",
        label: "Publicação em loja",
        description: "Preparação para distribuição em loja ou canal de instalação.",
        tags: ["mobile", "apk"],
        priceMode: "scope"
      },
      {
        id: "apk-build",
        label: "Build APK",
        description: "Geração de build Android/APK para instalação.",
        tags: ["apk"],
        requiresAny: { appTypes: ["standalone"], platforms: ["android", "meta"] },
        priceMode: "scope"
      },
      {
        id: "hosting",
        label: "Hospedagem",
        description: "Publicação, domínio e infraestrutura web definidos à parte.",
        tags: ["web"],
        requiresAny: { appTypes: ["webPwa", "webOnline"], platforms: ["metaAndroid", "mobile", "desktopAll"] },
        priceMode: "scope"
      },
      {
        id: "analytics",
        label: "Analytics",
        description: "Medição de uso, eventos e acessos.",
        tags: ["web", "mobile"],
        priceMode: "scope"
      },
      {
        id: "device-communication",
        label: "Comunicação entre dispositivos",
        description: "Controle ou sincronização entre dispositivos, como tablet e VR.",
        tags: ["vr", "tablet"],
        priceMode: "core"
      },
      {
        id: "hotspot-content",
        label: "Conteúdo em hotspots",
        description: "Textos, imagens ou ações abertas a partir de pontos interativos.",
        tags: ["all"],
        hiddenUntilFeature: "nav-hotspot",
        priceMode: "scope"
      }
    ];

    const assistiveQuestions = [
      {
        id: "project",
        kicker: "Projeto",
        title: "Qual é o nome do app/projeto?",
        description: "Use um nome simples para identificar este orçamento.",
        type: "project"
      },
      {
        id: "media",
        kicker: "Mídias",
        title: "Quantas mídias você deseja usar?",
        description: "Informe o volume aproximado de imagens, áudios ou mídias 360°.",
        type: "media"
      },
      {
        id: "appType",
        kicker: "Tipo de app",
        title: "Qual é o tipo de app que você planeja ter?",
        description: "Aqui Web é tipo de desenvolvimento/entrega, não plataforma.",
        type: "single",
        source: "appTypes"
      },
      {
        id: "platforms",
        kicker: "Plataformas",
        title: "Quais plataformas ou dispositivos deseja contemplar?",
        description: "As opções incompatíveis ficam bloqueadas com uma explicação curta.",
        type: "multi",
        source: "platforms"
      },
      {
        id: "features",
        kicker: "Features",
        title: "Quais recursos o projeto precisa incluir?",
        description: "A lista muda conforme o tipo de app e as plataformas escolhidas.",
        type: "features"
      },
      {
        id: "details",
        kicker: "Detalhes finais",
        title: "Quer adicionar observações ao orçamento?",
        description: "Inclua referências, objetivos, restrições ou contexto comercial.",
        type: "details"
      }
    ];

    const getSelectedAppType = () => assistiveAppTypes[state.appType] || null;

    const unique = (items) => Array.from(new Set(items.filter(Boolean)));

    const getActiveTags = () => {
      const tags = new Set();
      const appType = getSelectedAppType();
      appType?.tags.forEach((tag) => tags.add(tag));
      state.platforms.forEach((platformId) => {
        assistivePlatforms[platformId]?.tags.forEach((tag) => tags.add(tag));
      });
      if (state.appType) {
        tags.add(state.appType);
      }
      return tags;
    };

    const matchesRequiresAny = (feature) => {
      if (!feature.requiresAny) {
        return true;
      }

      const appMatch = feature.requiresAny.appTypes?.includes(state.appType);
      const platformMatch = feature.requiresAny.platforms?.some((platform) => state.platforms.includes(platform));
      return Boolean(appMatch || platformMatch);
    };

    const isPlatformAllowed = (platformId) => {
      const appType = getSelectedAppType();
      if (!appType) {
        return false;
      }
      return appType.compatiblePlatforms.includes(platformId);
    };

    const getPlatformBlockReason = (platformId) => {
      const appType = getSelectedAppType();
      if (!appType) {
        return "Escolha o tipo de app antes de definir a plataforma.";
      }
      return appType.blockedPlatforms?.[platformId] || `${assistivePlatforms[platformId].label} não combina com ${appType.label}.`;
    };

    const isFeatureVisible = (feature) => {
      if (!state.appType) {
        return false;
      }
      if (feature.hiddenUntilFeature && !state.features.includes(feature.hiddenUntilFeature)) {
        return false;
      }
      if (!matchesRequiresAny(feature)) {
        return false;
      }
      if (feature.tags.includes("all")) {
        return true;
      }

      const activeTags = getActiveTags();
      return feature.tags.some((tag) => activeTags.has(tag));
    };

    const getFeatureBlockReason = (feature) => {
      if (feature.requiresFeature && !state.features.includes(feature.requiresFeature)) {
        return "Este recurso depende de outra feature selecionada.";
      }
      return "";
    };

    const getVisibleFeatures = () => {
      return assistiveFeatures.filter(isFeatureVisible);
    };

    const pushCorrections = (messages) => {
      if (!messages.length) {
        return;
      }
      state.corrections = unique([...messages, ...state.corrections]).slice(0, 4);
    };

    const normalizeState = () => {
      const corrections = [];
      const visibleFeatureIdsBefore = getVisibleFeatures().map((feature) => feature.id);

      state.platforms = state.platforms.filter((platformId) => {
        if (isPlatformAllowed(platformId)) {
          return true;
        }
        corrections.push(`${assistivePlatforms[platformId].label} foi removido: ${getPlatformBlockReason(platformId)}`);
        return false;
      });

      const visibleFeatureIds = getVisibleFeatures().map((feature) => feature.id);
      state.features = state.features.filter((featureId) => {
        if (visibleFeatureIds.includes(featureId)) {
          return true;
        }
        const feature = assistiveFeatures.find((item) => item.id === featureId);
        corrections.push(`${feature?.label || featureId} foi removido por incompatibilidade com a nova escolha.`);
        return false;
      });

      if (!state.features.includes("nav-hotspot")) {
        state.features = state.features.filter((featureId) => featureId !== "hotspot-content");
      }

      if (state.features.includes("nav-basic") && state.features.includes("nav-hotspot")) {
        state.features = state.features.filter((featureId) => featureId !== "nav-basic");
      }

      if (visibleFeatureIdsBefore.length !== visibleFeatureIds.length) {
        state.corrections = state.corrections.slice(0, 4);
      }

      pushCorrections(corrections);
    };

    const assistivePricingRules = {
      estimate() {
        const isComplex = state.features.includes("nav-hotspot");
        const hasCommunication = state.features.includes("device-communication");
        const usesMeta = state.platforms.includes("meta") || state.platforms.includes("metaAndroid");
        const usesAndroidStandalone = state.platforms.includes("android");
        const usesDesktopStandalone = state.platforms.includes("desktopNoApple");
        const usesWebDelivery = state.appType === "webPwa"
          || state.appType === "webOnline"
          || state.platforms.includes("metaAndroid")
          || state.platforms.includes("mobile")
          || state.platforms.includes("desktopAll");
        let title = "Escolha uma combinação";
        let base = 0;
        let note = "A estimativa será ajustada conforme suas respostas.";
        let isCustom = false;

        if (!state.appType || !state.platforms.length) {
          return { title, base, note, isCustom, usesWebDelivery };
        }

        if (hasCommunication && usesMeta && state.appType === "standalone") {
          title = `Meta Quest + Tablet via TCP com ${isComplex ? "navegação complexa" : "navegação simples"}`;
          base = isComplex ? 12500 : 10000;
          note = "Base reaproveitada da solução integrada Quest + Tablet com comunicação.";
        } else if (usesWebDelivery) {
          title = `${state.appType === "webPwa" ? "Website / PWA" : "Website online"} com ${isComplex ? "navegação complexa" : "navegação simples"}`;
          base = isComplex ? 20000 : 15000;
          note = "Base reaproveitada da solução Web/PWA. Hosting e publicação seguem definidos à parte.";
        } else if (usesMeta) {
          title = `Meta Quest com ${isComplex ? "navegação complexa" : "navegação simples"}`;
          base = isComplex ? 5000 : 2500;
          note = "Base reaproveitada da solução dedicada ao Meta Quest.";
        } else if (usesAndroidStandalone || usesDesktopStandalone) {
          title = `Standalone ${usesAndroidStandalone ? "Android" : "desktop"} com ${isComplex ? "navegação complexa" : "navegação simples"}`;
          base = isComplex ? 7500 : 5000;
          note = "Estimativa inicial para aplicação standalone fora da base Meta Quest.";
          isCustom = true;
        } else {
          title = `Projeto personalizado com ${isComplex ? "navegação complexa" : "navegação simples"}`;
          base = isComplex ? 7500 : 5000;
          note = "Combinação fora das bases fixas atuais; valor exibido como estimativa inicial.";
          isCustom = true;
        }

        return { title, base, note, isCustom, usesWebDelivery };
      }
    };

    const getSelectedFeatureLabels = () => {
      return state.features
        .map((featureId) => assistiveFeatures.find((feature) => feature.id === featureId)?.label)
        .filter(Boolean);
    };

    const createChip = (text) => {
      const chip = document.createElement("span");
      chip.className = "select-chip is-selected";
      chip.textContent = text;
      return chip;
    };

    const renderChipList = (container, values, fallback) => {
      container.textContent = "";
      if (!values.length) {
        const chip = document.createElement("span");
        chip.className = "select-chip";
        chip.textContent = fallback;
        container.appendChild(chip);
        return;
      }
      values.forEach((value) => container.appendChild(createChip(value)));
    };

    const formatBranchValue = (values, fallback = "Não selecionado") => {
      if (!values.length) {
        return fallback;
      }
      if (values.length <= 2) {
        return values.join(", ");
      }
      return `${values.slice(0, 2).join(", ")} +${values.length - 2}`;
    };

    const getBranchSummary = (questionId) => {
      if (questionId === "project") {
        const value = state.projectName.trim();
        return {
          selected: Boolean(value),
          value: value || "Não selecionado"
        };
      }

      if (questionId === "media") {
        const hasMediaSelection = state.mediaCount > 0 || state.soundCount > 0;
        return {
          selected: hasMediaSelection,
          value: `${state.mediaCount} ${state.mediaCount === 1 ? "mídia" : "mídias"} · ${state.soundCount} ${state.soundCount === 1 ? "som" : "sons"}`
        };
      }

      if (questionId === "appType") {
        const appType = getSelectedAppType();
        return {
          selected: Boolean(appType),
          value: appType?.label || "Não selecionado"
        };
      }

      if (questionId === "platforms") {
        const platforms = state.platforms
          .map((platformId) => assistivePlatforms[platformId]?.label)
          .filter(Boolean);
        return {
          selected: platforms.length > 0,
          value: formatBranchValue(platforms)
        };
      }

      if (questionId === "features") {
        const features = getSelectedFeatureLabels();
        return {
          selected: features.length > 0,
          value: formatBranchValue(features)
        };
      }

      const detailValues = [];
      if (state.details.trim()) {
        detailValues.push("Com observações");
      }
      if (state.email.trim()) {
        detailValues.push("E-mail informado");
      }
      return {
        selected: detailValues.length > 0,
        value: formatBranchValue(detailValues)
      };
    };

    const isTimelineStepAnswered = (questionId) => {
      if (questionId === "project") {
        return Boolean(state.projectName.trim());
      }
      if (questionId === "media") {
        return state.mediaCount > 0 || state.soundCount > 0;
      }
      if (questionId === "appType") {
        return Boolean(state.appType);
      }
      if (questionId === "platforms") {
        return state.platforms.length > 0;
      }
      if (questionId === "features") {
        return state.features.length > 0;
      }
      return Boolean(state.details.trim() || state.email.trim());
    };

    const timelineChoice = (label, status, detail = "", action = null, control = null) => ({ label, status, detail, action, control });

    const getChoiceStatus = (isChosen, isAnswered) => {
      if (isChosen) {
        return "chosen";
      }
      return isAnswered ? "discarded" : "pending";
    };

    const goToStep = (questionId) => {
      const nextStep = assistiveQuestions.findIndex((question) => question.id === questionId);
      if (nextStep >= 0) {
        state.step = nextStep;
        setValidation("");
        renderCurrentQuestion();
      }
    };

    const setAppTypeChoice = (appTypeId) => {
      const wasSelected = state.appType === appTypeId;
      state.appType = wasSelected ? "" : appTypeId;
      if (wasSelected) {
        state.platforms = [];
        state.features = [];
      }
      normalizeState();
      setValidation("");
      renderCurrentQuestion();
    };

    const togglePlatformChoice = (platformId) => {
      if (!isPlatformAllowed(platformId)) {
        return;
      }

      state.platforms = state.platforms.includes(platformId)
        ? state.platforms.filter((item) => item !== platformId)
        : [...state.platforms, platformId];
      normalizeState();
      setValidation("");
      renderCurrentQuestion();
    };

    const toggleFeatureChoice = (featureId) => {
      const feature = assistiveFeatures.find((item) => item.id === featureId);
      if (!feature || getFeatureBlockReason(feature)) {
        return;
      }

      const wasSelected = state.features.includes(featureId);
      if (feature.group) {
        state.features = state.features.filter((itemId) => {
          const item = assistiveFeatures.find((candidate) => candidate.id === itemId);
          return item?.group !== feature.group;
        });
      }

      state.features = wasSelected
        ? state.features.filter((itemId) => itemId !== featureId)
        : [...state.features, featureId];

      normalizeState();
      setValidation("");
      renderCurrentQuestion();
    };

    const selectAppTypeFromTimeline = (appTypeId) => {
      if (state.appType === appTypeId) {
        return;
      }
      state.appType = appTypeId;
      normalizeState();
      setValidation("");
      renderCurrentQuestion();
    };

    const selectPlatformFromTimeline = (platformId) => {
      if (!isPlatformAllowed(platformId) || state.platforms.includes(platformId)) {
        return;
      }
      state.platforms = [...state.platforms, platformId];
      normalizeState();
      setValidation("");
      renderCurrentQuestion();
    };

    const selectFeatureFromTimeline = (featureId) => {
      const feature = assistiveFeatures.find((item) => item.id === featureId);
      if (!feature || getFeatureBlockReason(feature) || state.features.includes(featureId)) {
        return;
      }
      if (feature.group) {
        state.features = state.features.filter((itemId) => {
          const item = assistiveFeatures.find((candidate) => candidate.id === itemId);
          return item?.group !== feature.group;
        });
      }
      state.features = [...state.features, featureId];
      normalizeState();
      setValidation("");
      renderCurrentQuestion();
    };

    const updateMediaFromTimeline = (key, step) => {
      const prop = key === "sound" ? "soundCount" : "mediaCount";
      state[prop] = clamp(state[prop] + step, 0, 999);
      state.mediaTouched = true;
      setValidation("");
      renderCurrentQuestion();
    };

    const toggleTimelineExpansion = (questionId) => {
      state.expandedTimelineSteps = state.expandedTimelineSteps.includes(questionId)
        ? state.expandedTimelineSteps.filter((item) => item !== questionId)
        : [...state.expandedTimelineSteps, questionId];
      renderBranchMap();
    };

    const getTimelineChoices = (question, index) => {
      const isAnswered = isTimelineStepAnswered(question.id);
      const isCurrent = index === state.step;

      const warningWhenEmpty = ["project", "media", "appType", "platforms", "features"];

      if (!isAnswered && !isCurrent && !warningWhenEmpty.includes(question.id)) {
        return [timelineChoice("Aguardando resposta", "pending")];
      }

      if (question.id === "project") {
        const value = state.projectName.trim();
        if (!value) {
          return [timelineChoice("Nome vazio", "warning", "Preencha o nome do projeto", () => goToStep("project"))];
        }
        return [timelineChoice(value, "chosen", "Nome escolhido", () => goToStep("project"))];
      }

      if (question.id === "media") {
        return [
          timelineChoice(
            state.mediaCount > 0
              ? `${state.mediaCount} ${state.mediaCount === 1 ? "mídia selecionada" : "mídias selecionadas"}`
              : "0 mídias selecionadas",
            state.mediaCount > 0 ? "chosen" : "warning",
            "Imagens 360",
            () => goToStep("media"),
            { key: "media", value: state.mediaCount, decrementLabel: "Diminuir mídias", incrementLabel: "Aumentar mídias" }
          ),
          timelineChoice(
            state.soundCount > 0
              ? `${state.soundCount} ${state.soundCount === 1 ? "áudio selecionado" : "áudios selecionados"}`
              : "0 áudios selecionados",
            state.soundCount > 0 ? "chosen" : "warning",
            "Áudios",
            () => goToStep("media"),
            { key: "sound", value: state.soundCount, decrementLabel: "Diminuir áudios", incrementLabel: "Aumentar áudios" }
          )
        ];
      }

      if (question.id === "appType") {
        if (!state.appType) {
          return [timelineChoice("Nenhum tipo de app selecionado", "error", "Escolha uma opção para continuar", () => goToStep("appType"))];
        }

        return Object.entries(assistiveAppTypes).map(([id, appType]) => {
          return timelineChoice(appType.label, getChoiceStatus(state.appType === id, isAnswered), "", () => selectAppTypeFromTimeline(id));
        });
      }

      if (question.id === "platforms") {
        const appType = getSelectedAppType();
        const platformIds = unique([...(appType?.compatiblePlatforms || []), ...(appType?.visibleBlockedPlatforms || [])]);
        if (!platformIds.length) {
          return [timelineChoice("Nenhuma plataforma selecionada", "error", "Escolha o tipo de app primeiro", () => goToStep("appType"))];
        }
        if (!state.platforms.length) {
          return [timelineChoice("Nenhuma plataforma selecionada", "error", "Selecione pelo menos uma plataforma", () => goToStep("platforms"))];
        }
        return platformIds.map((id) => {
          const platform = assistivePlatforms[id];
          const allowed = isPlatformAllowed(id);
          if (!allowed) {
            return timelineChoice(platform.label, "unavailable", getPlatformBlockReason(id), () => goToStep("platforms"));
          }
          return timelineChoice(platform.label, getChoiceStatus(state.platforms.includes(id), isAnswered), "", () => selectPlatformFromTimeline(id));
        });
      }

      if (question.id === "features") {
        const features = getVisibleFeatures();
        if (!features.length) {
          return [timelineChoice("Nenhum recurso selecionado", "error", "Escolha tipo de app e plataformas primeiro", () => goToStep(state.appType ? "platforms" : "appType"))];
        }
        if (!state.features.length) {
          return [timelineChoice("Nenhum recurso selecionado", "error", "Selecione os recursos do projeto", () => goToStep("features"))];
        }
        return features.map((feature) => {
          const reason = getFeatureBlockReason(feature);
          if (reason) {
            return timelineChoice(feature.label, "unavailable", reason, () => goToStep("features"));
          }
          return timelineChoice(feature.label, getChoiceStatus(state.features.includes(feature.id), isAnswered), "", () => selectFeatureFromTimeline(feature.id));
        });
      }

      return [
        timelineChoice("Observações do projeto", getChoiceStatus(Boolean(state.details.trim()), isAnswered), "", () => goToStep("details")),
        timelineChoice("E-mail de identificação", getChoiceStatus(Boolean(state.email.trim()), isAnswered), "", () => goToStep("details"))
      ];
    };

    const getTimelineStatusText = (question, index) => {
      if (index === state.step) {
        return "Em edição";
      }
      if (isTimelineStepAnswered(question.id)) {
        return "Respondida";
      }
      return "Pendente";
    };

    const renderBranchMap = () => {
      if (!branchMap) {
        return;
      }

      branchMap.textContent = "";
      assistiveQuestions.forEach((question, index) => {
        const summary = getBranchSummary(question.id);
        const choices = getTimelineChoices(question, index);
        const isExpanded = state.expandedTimelineSteps.includes(question.id);
        const visibleChoices = isExpanded ? choices : choices.slice(0, 3);
        const hiddenChoiceCount = Math.max(0, choices.length - visibleChoices.length);
        const selectedChoices = choices.filter((choice) => choice.status === "chosen");
        const node = document.createElement("div");
        node.className = "advanced-branch-node";
        node.classList.toggle("is-active", index === state.step);
        node.classList.toggle("is-selected", summary.selected);
        node.classList.toggle("is-missing", !summary.selected);
        if (index === state.step) {
          node.setAttribute("aria-current", "step");
        }

        const stepButton = document.createElement("button");
        stepButton.type = "button";
        stepButton.className = "advanced-branch-step-button";
        stepButton.setAttribute("aria-label", `Ir para ${question.kicker}: ${selectedChoices.length ? selectedChoices.map((choice) => choice.label).join(", ") : summary.value}`);

        const marker = document.createElement("span");
        marker.className = "advanced-branch-pin";
        marker.textContent = String(index + 1);
        const heading = document.createElement("span");
        heading.className = "advanced-branch-heading";
        const label = document.createElement("strong");
        label.textContent = question.kicker;
        const status = document.createElement("span");
        status.className = "advanced-branch-status";
        status.textContent = getTimelineStatusText(question, index);
        heading.append(label, status);
        stepButton.append(marker, heading);

        const optionList = document.createElement("span");
        optionList.className = "advanced-branch-options";
        visibleChoices.forEach((choice) => {
          const item = document.createElement(choice.action && !choice.control ? "button" : "span");
          item.className = `advanced-branch-choice is-${choice.status}`;
          if (item instanceof HTMLButtonElement) {
            item.type = "button";
            item.setAttribute("aria-label", choice.detail ? `${choice.label}: ${choice.detail}` : choice.label);
          }

          const icon = document.createElement("span");
          icon.className = "advanced-branch-choice-icon";
          icon.setAttribute("aria-hidden", "true");

          const text = document.createElement("span");
          text.className = "advanced-branch-choice-text";
          text.textContent = choice.label;
          item.append(icon, text);

          if (choice.detail) {
            const detail = document.createElement("span");
            detail.className = "advanced-branch-choice-detail";
            detail.textContent = choice.detail;
            item.appendChild(detail);
          }

          if (choice.control) {
            const spinbox = document.createElement("span");
            spinbox.className = "site-spinbox advanced-branch-spinbox";

            const decrement = document.createElement("button");
            decrement.type = "button";
            decrement.textContent = "-";
            decrement.setAttribute("aria-label", choice.control.decrementLabel);

            const input = document.createElement("input");
            input.type = "text";
            input.inputMode = "numeric";
            input.min = "0";
            input.max = "999";
            input.maxLength = 3;
            input.value = String(choice.control.value);
            input.readOnly = true;
            input.setAttribute("aria-readonly", "true");

            const increment = document.createElement("button");
            increment.type = "button";
            increment.textContent = "+";
            increment.setAttribute("aria-label", choice.control.incrementLabel);

            [decrement, increment].forEach((button, buttonIndex) => {
              button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                updateMediaFromTimeline(choice.control.key, buttonIndex === 0 ? -1 : 1);
              });
            });

            spinbox.addEventListener("click", (event) => {
              event.stopPropagation();
            });

            spinbox.append(decrement, input, increment);
            item.appendChild(spinbox);
          }

          if (choice.action) {
            item.classList.add("is-clickable");
            item.addEventListener("click", (event) => {
              if (event.target instanceof Element && event.target.closest(".advanced-branch-spinbox")) {
                return;
              }
              event.stopPropagation();
              choice.action();
            });
          }

          optionList.appendChild(item);
        });

        if (choices.length > 3) {
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "advanced-branch-expand";
          toggle.textContent = isExpanded ? "Ocultar detalhes" : `Detalhes +${hiddenChoiceCount}`;
          toggle.setAttribute("aria-expanded", String(isExpanded));
          toggle.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleTimelineExpansion(question.id);
          });
          optionList.appendChild(toggle);
        }

        stepButton.addEventListener("click", () => {
          goToStep(question.id);
        });

        node.append(stepButton, optionList);
        branchMap.appendChild(node);
      });
    };

    const getCompletedStepCount = () => assistiveQuestions.filter((question) => isTimelineStepAnswered(question.id)).length;

    const renderProgressHeading = () => {
      const completedSteps = getCompletedStepCount();
      stepLabel.textContent = `Etapa ${state.step + 1} de ${assistiveQuestions.length} - ${completedSteps} ${completedSteps === 1 ? "concluída" : "concluídas"}`;
    };

    const getProgressStepStatus = (question, index) => {
      const isComplete = isTimelineStepAnswered(question.id);
      if (isComplete) {
        return { key: "complete", label: "concluída" };
      }

      const choices = getTimelineChoices(question, index);
      if (choices.some((choice) => choice.status === "error" || choice.status === "unavailable")) {
        return { key: "error", label: "pendente com erro" };
      }
      if (choices.some((choice) => choice.status === "warning")) {
        return { key: "warning", label: "pendente com aviso" };
      }
      return { key: "pending", label: "pendente" };
    };

    const renderSegmentedProgress = () => {
      if (!progressTrack) {
        return;
      }

      const timelineCardWidth = 230;
      const timelineGap = 10;
      const progressWidth = (assistiveQuestions.length * timelineCardWidth) + ((assistiveQuestions.length - 1) * timelineGap);

      progressTrack.textContent = "";
      progressTrack.style.setProperty("--advanced-step-count", String(assistiveQuestions.length));
      progressTrack.style.setProperty("--advanced-progress-width", `${progressWidth}px`);
      assistiveQuestions.forEach((question, index) => {
        const isCurrent = index === state.step;
        const status = getProgressStepStatus(question, index);
        const segment = document.createElement("button");
        segment.type = "button";
        segment.className = "advanced-progress-segment";
        segment.classList.toggle("is-current", isCurrent);
        segment.classList.add(`is-${status.key}`);
        segment.dataset.tooltip = `Etapa ${index + 1}: ${question.kicker} - ${status.label}`;
        segment.setAttribute("aria-label", segment.dataset.tooltip);
        segment.setAttribute("aria-current", isCurrent ? "step" : "false");
        segment.addEventListener("click", () => goToStep(question.id));

        const marker = document.createElement("span");
        marker.textContent = String(index + 1);
        marker.setAttribute("aria-hidden", "true");
        segment.appendChild(marker);
        progressTrack.appendChild(segment);
      });
    };

    const buildAlerts = (estimate) => {
      const alerts = [...state.corrections];
      const scopeFeatures = state.features
        .map((featureId) => assistiveFeatures.find((feature) => feature.id === featureId))
        .filter((feature) => feature?.priceMode === "scope");

      if (!state.appType) {
        alerts.push("Escolha um tipo de app para liberar plataformas e features compatíveis.");
      }
      if (state.appType && !state.platforms.length) {
        alerts.push("Selecione pelo menos uma plataforma compatível para avançar.");
      }
      if (scopeFeatures.length) {
        alerts.push("Algumas features selecionadas entram como escopo a definir e não alteram o total nesta versão.");
      }
      if (estimate.isCustom) {
        alerts.push("A combinação atual não corresponde exatamente a uma base fixa do orçamento tradicional.");
      }
      if (estimate.usesWebDelivery || state.features.includes("hosting")) {
        alerts.push("Hosting, domínio, custos recorrentes e publicação serão definidos à parte.");
      }

      return unique(alerts).slice(0, 5);
    };

    const updateSummary = () => {
      const estimate = assistivePricingRules.estimate();
      const mediaCost = (state.mediaCount + state.soundCount) * unitPrice;
      const total = estimate.base + mediaCost;
      const appType = getSelectedAppType();

      summary.project.textContent = state.projectName.trim() || "Projeto sem nome";
      summary.app.textContent = appType ? appType.label : "Tipo de app ainda não escolhido.";
      summary.media.textContent = `${state.mediaCount} ${state.mediaCount === 1 ? "mídia" : "mídias"} · ${state.soundCount} ${state.soundCount === 1 ? "som" : "sons"}`;
      summary.base.textContent = formatBRL(estimate.base);
      summary.mediaCost.textContent = formatBRL(mediaCost);
      summary.total.textContent = formatBRL(total);
      summary.note.textContent = estimate.note;

      renderChipList(
        summary.platforms,
        state.platforms.map((platformId) => assistivePlatforms[platformId]?.label).filter(Boolean),
        "Nenhuma plataforma"
      );
      renderChipList(summary.features, getSelectedFeatureLabels(), "Nenhuma feature");

      summary.alerts.textContent = "";
      const alerts = buildAlerts(estimate);
      if (!alerts.length) {
        const item = document.createElement("li");
        item.textContent = "Nenhum conflito encontrado até agora.";
        summary.alerts.appendChild(item);
      } else {
        alerts.forEach((alert) => {
          const item = document.createElement("li");
          item.textContent = alert;
          summary.alerts.appendChild(item);
        });
      }

      renderProgressHeading();
      renderSegmentedProgress();
      renderBranchMap();
      return { ...estimate, mediaCost, total, alerts };
    };

    const setValidation = (message) => {
      validation.textContent = message || "";
      validation.hidden = !message;
    };

    const validateCurrentStep = () => {
      const question = assistiveQuestions[state.step];

      if (question.id === "project" && !state.projectName.trim()) {
        return "Informe o nome do projeto para continuar.";
      }
      if (question.id === "media" && state.soundCount < 0) {
        return "A quantidade de sons não pode ser negativa.";
      }
      if (question.id === "appType" && !state.appType) {
        return "Escolha um tipo de app.";
      }
      if (question.id === "platforms" && !state.platforms.length) {
        return "Escolha pelo menos uma plataforma compatível.";
      }
      if (question.id === "features" && !state.features.some((featureId) => featureId === "nav-basic" || featureId === "nav-hotspot")) {
        return "Escolha se a navegação terá hotspots ou não.";
      }
      if (question.id === "details" && state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
        return "Informe um e-mail válido ou deixe o campo vazio.";
      }

      return "";
    };

    const validateRequiredState = () => {
      if (!state.projectName.trim()) {
        return "Informe o nome do projeto para preparar o resumo.";
      }
      if (state.soundCount < 0) {
        return "A quantidade de sons não pode ser negativa.";
      }
      if (!state.appType) {
        return "Escolha um tipo de app.";
      }
      if (!state.platforms.length) {
        return "Escolha pelo menos uma plataforma compatível.";
      }
      if (!state.features.some((featureId) => featureId === "nav-basic" || featureId === "nav-hotspot")) {
        return "Escolha se a navegação terá hotspots ou não.";
      }
      if (state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
        return "Informe um e-mail válido ou deixe o campo vazio.";
      }
      return "";
    };

    const closeAdvancedOptionHelps = (exceptButton = null) => {
      builder.querySelectorAll(".advanced-option-help.is-open").forEach((button) => {
        if (button !== exceptButton) {
          button.classList.remove("is-open");
          button.setAttribute("aria-expanded", "false");
        }
      });
    };

    const appendAdvancedOptionHelp = (card, label, text) => {
      if (!text) {
        return;
      }

      const help = document.createElement("button");
      help.type = "button";
      help.className = "advanced-option-help";
      help.textContent = "?";
      help.setAttribute("aria-label", `Explicar ${label}`);
      help.setAttribute("aria-expanded", "false");

      const tooltip = document.createElement("span");
      tooltip.className = "advanced-option-tooltip";
      tooltip.textContent = text;
      help.appendChild(tooltip);

      help.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isOpen = help.classList.toggle("is-open");
        help.setAttribute("aria-expanded", String(isOpen));
        closeAdvancedOptionHelps(isOpen ? help : null);
      });

      help.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });

      card.appendChild(help);
    };

    const createOptionCard = ({ id, label, description, selected, disabled, unavailable, reason, help, onClick }) => {
      const card = document.createElement("div");
      card.className = "advanced-option-card";
      card.classList.toggle("is-selected", Boolean(selected));
      card.classList.toggle("is-disabled", Boolean(disabled));
      card.classList.toggle("is-unavailable", Boolean(unavailable));
      card.setAttribute("role", "button");
      card.setAttribute("aria-pressed", String(Boolean(selected)));
      card.setAttribute("aria-disabled", String(Boolean(disabled)));
      card.tabIndex = disabled ? -1 : 0;
      card.dataset.optionId = id;

      const title = document.createElement("strong");
      title.textContent = label;
      card.appendChild(title);

      const copy = document.createElement("span");
      copy.textContent = description;
      card.appendChild(copy);

      if (reason) {
        const reasonNode = document.createElement("small");
        reasonNode.textContent = reason;
        card.appendChild(reasonNode);
      }

      appendAdvancedOptionHelp(card, label, help || reason || description);

      const activate = () => {
        if (disabled) {
          return;
        }
        closeAdvancedOptionHelps();
        onClick();
      };

      card.addEventListener("click", activate);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });

      return card;
    };

    const createIosUnavailableCard = (platform) => {
      const card = document.createElement("div");
      card.className = "advanced-option-card is-unavailable advanced-ios-helper-card";

      const title = document.createElement("strong");
      title.textContent = platform.description;

      const copy = document.createElement("span");
      copy.textContent = "Para suporte a iOS, selecione:";

      const actions = document.createElement("div");
      actions.className = "advanced-ios-helper-actions";

      [
        { id: "webPwa", label: "Web (PWA)" },
        { id: "webOnline", label: "Online" }
      ].forEach((option) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "advanced-ios-helper-chip";
        chip.textContent = option.label;
        chip.addEventListener("click", () => {
          state.appType = option.id;
          state.platforms = [];
          state.features = [];
          normalizeState();
          setValidation("");
          state.step = assistiveQuestions.findIndex((question) => question.id === "appType");
          renderCurrentQuestion();
        });
        actions.appendChild(chip);
      });

      card.append(title, copy, actions);
      appendAdvancedOptionHelp(
        card,
        "iOS",
        "No momento, iOS não está disponível no fluxo Standalone. Para atender iOS, escolha Web (PWA) ou Web totalmente online na etapa anterior."
      );
      return card;
    };

    const createAdvancedSpinbox = ({ labelText, value, min = 0, max = 999, onChange, decrementLabel, incrementLabel }) => {
      const field = document.createElement("label");
      field.className = "advanced-field";

      const label = document.createElement("span");
      label.textContent = labelText;

      const row = document.createElement("div");
      row.className = "quantity-input-row advanced-spinbox-row";

      const spinbox = document.createElement("div");
      spinbox.className = "site-spinbox advanced-site-spinbox";

      const decrement = document.createElement("button");
      decrement.type = "button";
      decrement.textContent = "-";
      decrement.setAttribute("aria-label", decrementLabel);

      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.min = String(min);
      input.max = String(max);
      input.maxLength = 3;
      input.value = String(value);
      input.readOnly = true;
      input.setAttribute("aria-readonly", "true");

      const increment = document.createElement("button");
      increment.type = "button";
      increment.textContent = "+";
      increment.setAttribute("aria-label", incrementLabel);

      const stepValue = (step) => {
        const current = Number.parseInt(input.value || "0", 10);
        const next = clamp((Number.isFinite(current) ? current : 0) + step, min, max);
        input.value = String(next);
        onChange(next);
      };

      decrement.addEventListener("click", () => stepValue(-1));
      increment.addEventListener("click", () => stepValue(1));

      spinbox.append(decrement, input, increment);
      row.appendChild(spinbox);
      field.append(label, row);
      return field;
    };

    const renderProjectQuestion = () => {
      const field = document.createElement("label");
      field.className = "advanced-field";
      const label = document.createElement("span");
      label.textContent = "Nome do projeto/app";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Ex.: Tour interativo do decorado";
      input.value = state.projectName;
      input.addEventListener("input", () => {
        state.projectName = input.value;
        setValidation("");
        updateSummary();
      });
      field.append(label, input);
      questionBody.appendChild(field);
      input.focus();
    };

    const renderMediaQuestion = () => {
      const panel = document.createElement("div");
      panel.className = "advanced-media-panel";

      const shortcuts = document.createElement("div");
      shortcuts.className = "advanced-media-shortcuts";
      [1, 2, 3, 5, 10].forEach((value) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = value === 10 ? "10+" : String(value);
        button.classList.toggle("is-selected", state.mediaCount === value);
        button.addEventListener("click", () => {
          state.mediaCount = value;
          state.mediaTouched = true;
          renderCurrentQuestion();
        });
        shortcuts.appendChild(button);
      });

      const field = createAdvancedSpinbox({
        labelText: "Quantidade exata de mídias",
        value: state.mediaCount,
        decrementLabel: "Diminuir mídias",
        incrementLabel: "Aumentar mídias",
        onChange: (next) => {
          state.mediaCount = next;
          state.mediaTouched = true;
          setValidation("");
          renderCurrentQuestion();
        }
      });

      const soundField = createAdvancedSpinbox({
        labelText: "Sons",
        value: state.soundCount,
        decrementLabel: "Diminuir sons",
        incrementLabel: "Aumentar sons",
        onChange: (next) => {
          state.soundCount = next;
          state.mediaTouched = true;
          setValidation("");
          updateSummary();
        }
      });

      field.querySelector(".site-spinbox")?.addEventListener("click", (event) => {
        if (event.target instanceof HTMLButtonElement) {
          return;
        }
        event.preventDefault();
      });

      soundField.querySelector(".site-spinbox")?.addEventListener("click", (event) => {
        if (event.target instanceof HTMLButtonElement) {
          return;
        }
        event.preventDefault();
      });

      const inputGrid = document.createElement("div");
      inputGrid.className = "advanced-media-input-grid";
      inputGrid.append(field, soundField);
      panel.append(shortcuts, inputGrid);
      questionBody.appendChild(panel);
    };

    const renderAppTypeQuestion = () => {
      const grid = document.createElement("div");
      grid.className = "advanced-option-grid";
      Object.entries(assistiveAppTypes).forEach(([id, appType]) => {
        grid.appendChild(createOptionCard({
          id,
          label: appType.label,
          description: appType.description,
          help: appType.help,
          selected: state.appType === id,
          onClick: () => setAppTypeChoice(id)
        }));
      });
      questionBody.appendChild(grid);
    };

    const renderPlatformQuestion = () => {
      const grid = document.createElement("div");
      grid.className = "advanced-option-grid";
      const appType = getSelectedAppType();
      const platformIds = unique([...(appType?.compatiblePlatforms || []), ...(appType?.visibleBlockedPlatforms || [])]);
      platformIds.forEach((id) => {
        const platform = assistivePlatforms[id];
        const allowed = isPlatformAllowed(id);
        if (!allowed && id === "ios") {
          grid.appendChild(createIosUnavailableCard(platform));
          return;
        }
        grid.appendChild(createOptionCard({
          id,
          label: platform.label,
          description: platform.description,
          selected: state.platforms.includes(id),
          disabled: !allowed,
          unavailable: !allowed,
          reason: allowed || id === "ios" ? "" : getPlatformBlockReason(id),
          onClick: () => {
            if (!allowed) {
              return;
            }
            togglePlatformChoice(id);
          }
        }));
      });
      questionBody.appendChild(grid);
    };

    const renderFeaturesQuestion = () => {
      const features = getVisibleFeatures();
      const grid = document.createElement("div");
      grid.className = "advanced-option-grid";

      features.forEach((feature) => {
        const reason = getFeatureBlockReason(feature);
        grid.appendChild(createOptionCard({
          id: feature.id,
          label: feature.label,
          description: feature.description,
          selected: state.features.includes(feature.id),
          disabled: Boolean(reason),
          reason,
          onClick: () => {
            if (reason) {
              return;
            }
            toggleFeatureChoice(feature.id);
          }
        }));
      });

      questionBody.appendChild(grid);
    };

    const renderDetailsQuestion = () => {
      const grid = document.createElement("div");
      grid.className = "advanced-details-grid";

      const detailsField = document.createElement("label");
      detailsField.className = "advanced-field";
      const detailsLabel = document.createElement("span");
      detailsLabel.textContent = "Detalhes do projeto";
      const textarea = document.createElement("textarea");
      textarea.rows = 5;
      textarea.placeholder = "Descreva objetivos, referências, integrações, público, ambientes ou observações importantes.";
      textarea.value = state.details;
      textarea.addEventListener("input", () => {
        state.details = textarea.value;
        updateSummary();
      });
      detailsField.append(detailsLabel, textarea);

      const emailField = document.createElement("label");
      emailField.className = "advanced-field";
      const emailLabel = document.createElement("span");
      emailLabel.textContent = "E-mail para identificação";
      const email = document.createElement("input");
      email.type = "email";
      email.inputMode = "email";
      email.placeholder = "cliente@email.com";
      email.value = state.email;
      email.addEventListener("input", () => {
        state.email = email.value;
        setValidation("");
        updateSummary();
      });
      emailField.append(emailLabel, email);
      grid.append(detailsField, emailField);
      questionBody.appendChild(grid);
    };

    const renderCurrentQuestion = () => {
      const question = assistiveQuestions[state.step];
      const isFinalStep = state.step === assistiveQuestions.length - 1;
      builder.classList.toggle("is-final-step", isFinalStep);
      builder.dataset.advancedStep = String(state.step + 1);
      builder.dataset.advancedStepId = question.id;
      questionKicker.textContent = question.kicker;
      questionTitle.textContent = question.title;
      questionDescription.textContent = question.description;
      renderProgressHeading();
      stepName.textContent = question.kicker;
      questionBody.textContent = "";
      setValidation("");

      if (question.type === "project") {
        renderProjectQuestion();
      } else if (question.type === "media") {
        renderMediaQuestion();
      } else if (question.type === "single") {
        renderAppTypeQuestion();
      } else if (question.type === "multi") {
        renderPlatformQuestion();
      } else if (question.type === "features") {
        renderFeaturesQuestion();
      } else if (question.type === "details") {
        renderDetailsQuestion();
      }

      backButton.disabled = state.step === 0;
      nextButton.textContent = isFinalStep ? "Preparar resumo" : "Avançar";
      updateSummary();
    };

    const buildAdvancedSummaryText = () => {
      const estimate = updateSummary();
      const appType = getSelectedAppType();
      const platformLabels = state.platforms.map((platformId) => assistivePlatforms[platformId]?.label).filter(Boolean);
      const featureLabels = getSelectedFeatureLabels();
      return [
        "Orçamento LuKassab — Assistido avançado",
        `Projeto: ${state.projectName || "não informado"}`,
        `E-mail do cliente: ${state.email || "não informado"}`,
        `Quantidade de mídias: ${state.mediaCount}`,
        `Quantidade de sons: ${state.soundCount}`,
        `Tipo de app: ${appType?.label || "não informado"}`,
        `Plataformas: ${platformLabels.length ? platformLabels.join(", ") : "nenhuma"}`,
        `Features: ${featureLabels.length ? featureLabels.join(", ") : "nenhuma"}`,
        `Detalhes: ${state.details || "não informado"}`,
        `Base estimada: ${formatBRL(estimate.base)}`,
        `${state.mediaCount} mídias x ${formatBRL(unitPrice)} = ${formatBRL(state.mediaCount * unitPrice)}`,
        `${state.soundCount} sons x ${formatBRL(unitPrice)} = ${formatBRL(state.soundCount * unitPrice)}`,
        `Valor estimado: ${formatBRL(estimate.total)}`,
        `Observações: ${estimate.alerts.length ? estimate.alerts.join(" | ") : "nenhuma"}`,
        "Reimportação de mídias: até 4 vezes por mídia dentro do escopo aprovado."
      ].join("\n");
    };

    const copyAdvancedSummary = async () => {
      const message = validateRequiredState();
      if (message) {
        setValidation(message);
        summary.status.textContent = message;
        return;
      }

      const text = buildAdvancedSummaryText();
      try {
        await navigator.clipboard.writeText(text);
        summary.status.textContent = "Resumo assistido pronto para envio.";
      } catch {
        window.prompt("Copie o orçamento:", text);
        summary.status.textContent = "Resumo assistido pronto.";
      }

      window.setTimeout(() => {
        summary.status.textContent = "";
      }, 1800);
    };

    backButton.addEventListener("click", () => {
      state.step = Math.max(0, state.step - 1);
      renderCurrentQuestion();
    });

    nextButton.addEventListener("click", () => {
      const message = validateCurrentStep();
      if (message) {
        setValidation(message);
        return;
      }

      if (state.step === assistiveQuestions.length - 1) {
        copyAdvancedSummary();
        return;
      }

      if (assistiveQuestions[state.step].id === "media") {
        state.mediaTouched = true;
      }

      state.step += 1;
      renderCurrentQuestion();
    });

    summary.copy.addEventListener("click", copyAdvancedSummary);

    renderCurrentQuestion();
  };

  setupHeroCanvas();
  setupHelpTooltips();
  setupPortfolioTabs();
  setupPortfolioLightbox();
  setupBudget();
  setupGuidedBudget();
  setupAdvancedGuidedBudget();
})();
