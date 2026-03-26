/* =====================================================
   CONFIGURATION - API INTEGRATION
===================================================== */

let PRODUCT_CONFIG = null; // Will be loaded from API
let PRODUCT_ID = null; // Shopify Product ID

/* =====================================================
   STATE - GLOBAL SCOPE
===================================================== */
let state = {
    selections: {},
    measurements: {},
    menge: 1
};

/* =====================================================
   URL STATE MANAGEMENT
===================================================== */

// Function to update URL with current state
function updateURL() {
    const currentParams = new URLSearchParams(window.location.search);
    const params = new URLSearchParams();

    // Whitelist: keep ONLY these existing params
    ['product_id', 'img', 'color'].forEach(key => {
        if (currentParams.has(key)) {
            params.set(key, currentParams.get(key));
        }
    });

    // Add / update selections
    Object.entries(state.selections).forEach(([key, value]) => {
        if (value != null && value !== '') {
            params.set(`sel_${key}`, value);
        }
    });

    // Add / update measurements
    Object.entries(state.measurements).forEach(([key, value]) => {
        if (value != null && value !== '') {
            params.set(`m_${key}`, value);
        }
    });

    // Quantity (only if not 1)
    if (state.menge && state.menge !== 1) {
        params.set('qty', state.menge);
    }

    // Update URL without reload
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState(
        { state: JSON.parse(JSON.stringify(state)) },
        '',
        newURL
    );
}


// Function to load state from URL
function loadStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const urlState = {
        selections: {},
        measurements: {},
        menge: 1
    };

    // Load selections (sel_*)
    for (const [key, value] of params.entries()) {
        if (key.startsWith('sel_')) {
            const actualKey = key.replace('sel_', '');
            urlState.selections[actualKey] = value;
        }
    }

    // Load measurements (m_*)
    for (const [key, value] of params.entries()) {
        if (key.startsWith('m_')) {
            const actualKey = key.replace('m_', '');
            urlState.measurements[actualKey] = Number(value);
        }
    }

    // Load quantity
    const qty = params.get('qty');
    if (qty) {
        urlState.menge = Number(qty);
    }

    return urlState;
}

// Function to apply loaded state to UI
function applyStateToUI(loadedState) {
    // Apply selections
    Object.entries(loadedState.selections).forEach(([key, value]) => {
        const radio = document.querySelector(`input[name="${key}"][value="${value}"]`);
        if (radio) {
            radio.checked = true;
        }
    });

    // Apply measurements
    Object.entries(loadedState.measurements).forEach(([key, value]) => {
        const input = document.querySelector(`input[name="${key}"]`);
        if (input) {
            input.value = value;
        }
    });

    // Apply quantity
    if (loadedState.menge) {
        const qtyDisplay = document.querySelector(".qty-value");
        if (qtyDisplay) {
            qtyDisplay.textContent = loadedState.menge;
        }
    }
}

// Handle browser back/forward buttons
function setupPopStateHandler() {
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.state) {
            // Restore state from history
            Object.assign(state, event.state.state);

            // Reapply to UI
            applyStateToUI(state);

            // Update summaries and prices
            updateSummaryAlt();
            renderFinalStep();
            updatePrices();

            // Handle conditional flow if needed
            const firstSelection = Object.keys(state.selections)[0];
            if (firstSelection) {
                handleDependencies(firstSelection, state.selections[firstSelection]);
            }
        }
    });
}

/* =====================================================
   API FUNCTIONS
===================================================== */

async function loadConfiguration(productId) {
    try {
        const response = await fetch(`https://plixxo-app-tvhmp.ondigitalocean.app/api/public/configurator/${productId}?v=${Date.now()}`,
            {
                cache: 'no-store', // 🚫 disable cache
            });
        const data = await response.json();

        if (!data.success) {
            console.error('Configuration load failed:', data.error);
            showError('Failed to load product configuration');
            return null;
        }

        return data.config;
    } catch (error) {
        console.error('API Error:', error);
        showError('Failed to connect to configuration service');
        return null;
    }
}

async function calculatePrice(productId, selections, measurements, quantity) {
    try {
        const response = await fetch(`https://plixxo-app-tvhmp.ondigitalocean.app/api/public/calculate-price?v=${Date.now()}`, {
            method: 'POST',
            cache: 'no-store', // 🚫 disable cache
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId,
                selections,
                measurements,
                quantity
            })
        });

        const data = await response.json();

        if (!data.success) {
            console.error('Price calculation failed:', data.error);
            return 0;
        }

        return data.price;
    } catch (error) {
        console.error('Price calculation error:', error);
        return 0;
    }
}

function showError(message) {
    alert(message); // Replace with better UI notification
}

/* =====================================================
   STEP GENERATION (Modified to use API data)
===================================================== */
function createStepShell(step, index) {
    return `
      <div class="config-step ${index !== 0 ? "is-disabled" : ""}"
           data-step="${index + 1}"
           data-step-key="${step.key}">
    <div class="heading_content_div">
        <h2>${step.title}</h2>
        <p>${step.subtitle || ''}</p>
  </div>
        ${step.description ? `<div class="heading_content_div_1">${step.description}</div>` : ""}
        ${step.image ? `<div class="option-zoom"> <img src="${step.image}"> </div>` : ""}
  
        <div class="step-content"></div>
  
        <button class="step-next">WEITER</button>
      </div>
    `;
}

function renderDynamicSteps(config) {
    const wrapper = document.getElementById("dynamicSteps");
    wrapper.innerHTML = "";

    config.steps.forEach((step, index) => {
        wrapper.insertAdjacentHTML("beforeend", createStepShell(step, index));
    });

    renderStepContents(config);
}

function renderOptions(step, container) {
    step.options.forEach(opt => {
        container.insertAdjacentHTML("beforeend", `
        <label class="option-card">
          <div class="option-title">
            <input
              type="radio"
              name="${step.key}"
              value="${opt.value}"
            >
            <div class="option-title1">
            ${opt.label}
            <span class="option-price">
              (${opt.price > 0 ? "+" : ""}${opt.price} €)
            </span>
            </div>
            ${opt.description ? `<img src="https://cdn.shopify.com/extensions/019bead9-e253-7ace-b99a-87365ef1f7bc/dev-f3cac707-85cf-466f-8b61-c189952e5121/assets/info.jpg" alt="Info" class="info_icon">` : ''}
          </div>
  
          <div class="option-inner">
            <div class="option-text">
              <div class="option-description">${opt.description || ''}
              </div>
            </div>
            ${opt.image ? `
              <div class="option-image main-img">
                <div class="option-zoom">
                  <img src="${opt.image}" alt="${opt.label}">
                </div>
              </div>
            ` : ''}
          </div>
        </label>
      `);
    });
}


function renderStepContents(config) {
    config.steps.forEach((step, index) => {
        const stepEl = document.querySelector(
            `.config-step[data-step="${index + 1}"]`
        );
        const content = stepEl.querySelector(".step-content");

        if (step.type === "options") {
            renderOptions(step, content);
        }

        if (step.type === "measurement") {
            content.innerHTML = `
              <div class="measure-field">
                <label>Breite (${step.width.min} – ${step.width.max} mm)</label>
                <input
                  type="number"
                  name="breite"
                  placeholder="Breite in mm"
                  data-min="${step.width.min}"
                  data-max="${step.width.max}"
                >
                <div class="measure-error" data-error-for="breite"></div>
              </div>
          
              <div class="measure-field">
                <label>Höhe (${step.height.min} – ${step.height.max} mm)</label>
                <input
                  type="number"
                  name="hoehe"
                  placeholder="Höhe in mm"
                  data-min="${step.height.min}"
                  data-max="${step.height.max}"
                >
                <div class="measure-error" data-error-for="hoehe"></div>
              </div>
            `;
        }
    });
}

/* =====================================================
   MAIN INIT (ONLY ONE DOMContentLoaded)
===================================================== */
document.addEventListener("DOMContentLoaded", async function () {

    // ============================================
    // GET PRODUCT ID FROM PAGE
    // ============================================
    // Method 1: From meta tag
    const productMeta = document.querySelector('meta[name="shopify-product-id"]');
    // if (productMeta) {
    //     PRODUCT_ID = productMeta.content;
    // }

    // Method 2: From global Shopify object
    // if (!PRODUCT_ID && typeof ShopifyAnalytics !== 'undefined') {
    //     PRODUCT_ID = ShopifyAnalytics?.meta?.product?.id;
    // }

    // Method 3: From URL or data attribute
    if (!PRODUCT_ID) {
        const params = new URLSearchParams(window.location.search);
        const productId = params.get("product_id");
        const img = params.get("img");
        const color = params.get("color");

        if (color) {
            document.querySelector('.custom-alert .color').textContent = color;
        }

        if (img) {
            const img_param_url = decodeURIComponent(img);

            const zoomThumb = document.querySelector('.zoom-thumb');
            const zoomPreview = document.querySelector('.zoom-preview');

            if (zoomThumb && zoomPreview) {
                zoomThumb.setAttribute('data-url', img_param_url);
                zoomThumb.style.backgroundImage = `url("${img_param_url}")`;
                zoomPreview.style.backgroundImage = `url("${img_param_url}")`;
            }
        }
        const configuratorEl = document.getElementById('configuratorSteps');
        PRODUCT_ID = productId || configuratorEl?.dataset?.productId;
    }

    if (!PRODUCT_ID) {
        console.error('Product ID not found');
        showError('Product configuration not available');
        return;
    }

    console.log('Loading configuration for product:', PRODUCT_ID);

    // ============================================
    // LOAD CONFIGURATION FROM API
    // ============================================
    PRODUCT_CONFIG = await loadConfiguration(PRODUCT_ID);

    if (!PRODUCT_CONFIG) {
        return; // Error already shown
    }

    console.log('Configuration loaded:', PRODUCT_CONFIG);

    if (PRODUCT_CONFIG) {
        document.querySelector('.pro_name').textContent =
            PRODUCT_CONFIG.product.name;

        document.querySelector('.steps_name').textContent =
            PRODUCT_CONFIG.steps.slice(0, 2).map(s => s.title).join(', ');
    }


    let activeFlow = []; // Current visible steps sequence
    let currentStepIndex = 0;

    /* 1️⃣ Render steps */
    renderDynamicSteps(PRODUCT_CONFIG);
    //buildSummaries(PRODUCT_CONFIG);

    /* 2️⃣ Cache steps AFTER render */
    const steps = document.querySelectorAll(".config-step");

    /* 3️⃣ Load state from URL and merge */
    const urlState = loadStateFromURL();

    // Merge URL state into global state
    state.selections = { ...state.selections, ...urlState.selections };
    state.measurements = { ...state.measurements, ...urlState.measurements };
    state.menge = urlState.menge || state.menge;

    // Setup browser back/forward handling
    setupPopStateHandler();

    // Set initial history state
    window.history.replaceState({ state: JSON.parse(JSON.stringify(state)) }, '', window.location.href);

    /* =====================================================
       CONDITIONAL FLOW HANDLER
    ===================================================== */
    function handleDependencies(stepKey, selectedValue) {
        const step = PRODUCT_CONFIG.steps.find(s => s.key === stepKey);
        if (!step || !step.options) return;

        const option = step.options.find(o => o.value === selectedValue);
        if (!option || !option.showSteps) return;

        // Reset previous selections
        Object.keys(state.selections).forEach(key => {
            if (key !== stepKey) {
                delete state.selections[key];
                const radios = document.querySelectorAll(`input[name="${key}"]`);
                radios.forEach(r => r.checked = false);
            }
        });
        state.measurements = {};

        // Clear measurement inputs
        document.querySelectorAll('input[name="breite"], input[name="hoehe"]').forEach(input => {
            input.value = '';
            input.classList.remove("error");
        });
        document.querySelectorAll('.measure-error').forEach(el => {
            el.style.display = 'none';
            el.textContent = '';
        });

        // Set new flow
        activeFlow = [stepKey, ...option.showSteps];
        currentStepIndex = 0;

        // Hide all steps
        document.querySelectorAll(".config-step").forEach(el => {
            el.classList.add("is-disabled");
        });
        const finalStep = document.getElementById("finalStep");
        if (finalStep) {
            finalStep.classList.add("is-disabled");
        }

        // Show current step
        showStepByKey(stepKey);

        // Rebuild summaries
        buildSummaries(PRODUCT_CONFIG);
        updateSummaryAlt();
        renderFinalStep();
        updatePrices();
    }

    function showStepByKey(key) {
        const el = document.querySelector(`.config-step[data-step-key="${key}"]`);
        if (el) {
            el.classList.remove("is-disabled");
        }
    }

    /* =====================================================
       STEP NAVIGATION
    ===================================================== */
    document.querySelectorAll(".step-next").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const currentStepEl = e.target.closest(".config-step");
            const currentKey = currentStepEl.dataset.stepKey;

            if (!isStepValid(currentStepEl)) {
                alert("Bitte Auswahl treffen");
                return;
            }

            const currentFlowIndex = activeFlow.indexOf(currentKey);

            if (currentFlowIndex === -1 || currentFlowIndex === activeFlow.length - 1) {
                const finalStep = document.getElementById("finalStep");
                if (finalStep) {
                    renderFinalStep();
                    finalStep.classList.remove("is-disabled");
                    finalStep.scrollIntoView({
                        behavior: "smooth"
                    });
                }
                return;
            }

            const nextKey = activeFlow[currentFlowIndex + 1];
            showStepByKey(nextKey);

            const nextStepEl = document.querySelector(`.config-step[data-step-key="${nextKey}"]`);
            if (nextStepEl) {
                nextStepEl.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    });

    /* =====================================================
       INPUT HANDLING - WITH URL UPDATE
    ===================================================== */
    document.querySelectorAll("#configuratorSteps input").forEach(input => {
        input.addEventListener("input", () => {

            if (input.name === "breite" || input.name === "hoehe") {
                if (!validateMeasurementInput(input)) return;
            }

            saveState(input);

            if (input.type === "radio") {
                handleDependencies(input.name, input.value);
            }

            updateSummaryAlt();
            renderFinalStep();
            updatePrices();

            // 🔥 UPDATE URL WITH NEW STATE
            updateURL();
        });
    });

    /* =====================================================
       HELPERS
    ===================================================== */
    function saveState(input) {
        if (input.type === "radio") {
            state.selections[input.name] = input.value;
        }

        if (input.type === "number") {
            state.measurements[input.name] = Number(input.value);
        }
    }

    // ============================================
    // PRICE CALCULATION (API-based)
    // ============================================
    async function updatePrices() {
        const subtotalEl = document.querySelector(".summary-price b");
        const totalEl = document.querySelector(".total b");

        // Show loading state
        if (subtotalEl) subtotalEl.textContent = "Calculating...";
        if (totalEl) totalEl.textContent = "Calculating...";

        try {
            const price = await calculatePrice(
                PRODUCT_ID,
                state.selections,
                state.measurements,
                state.menge
            );

            if (subtotalEl) subtotalEl.textContent = `${price.toFixed(2)} €`;
            if (totalEl) totalEl.textContent = `${price.toFixed(2)} €`;
        } catch (error) {
            console.error('Price update failed:', error);
            if (subtotalEl) subtotalEl.textContent = "Error";
            if (totalEl) totalEl.textContent = "Error";
        }
    }

    function isStepValid(step) {
        const radios = step.querySelectorAll('input[type="radio"]');
        const numbers = step.querySelectorAll('input[type="number"]');

        if (radios.length) {
            return [...radios].some(radio => radio.checked);
        }

        if (numbers.length) {
            return [...numbers].every(input => {
                if (!input.value) return false;
                return validateMeasurementInput(input);
            });
        }

        return true;
    }

    function renderFinalStep() {
        document.querySelectorAll("[data-final]").forEach(el => {
            const key = el.dataset.final;
            let value = "—";

            if (key === "masse") {
                const {
                    breite,
                    hoehe
                } = state.measurements || {};
                if (breite && hoehe) {
                    value = `${breite} mm × ${hoehe} mm`;
                }
            } else {
                const selected = state.selections?.[key];
                if (selected) {
                    const step = PRODUCT_CONFIG.steps.find(s => s.key === key);
                    if (step && step.options) {
                        const opt = step.options.find(o => o.value === selected);
                        value = opt ? opt.label : selected;
                    } else {
                        value = selected;
                    }
                }
            }

            el.textContent = value;
        });
    }

    function updateSummaryAlt() {
        document.querySelectorAll("[data-summary-alt]").forEach(el => {
            const key = el.dataset.summaryAlt;
            let value = "—";

            if (key === "masse") {
                const {
                    breite,
                    hoehe
                } = state.measurements || {};
                if (breite && hoehe) {
                    value = `${breite} mm × ${hoehe} mm`;
                }
            } else {
                const selected = state.selections?.[key];
                if (selected) {
                    const step = PRODUCT_CONFIG.steps.find(s => s.key === key);
                    if (step && step.options) {
                        const opt = step.options.find(o => o.value === selected);
                        value = opt ? opt.label : selected;
                    } else {
                        value = selected;
                    }
                }
            }

            el.textContent = value;
        });
    }

    document.querySelector(".qty-plus")?.addEventListener("click", () => {
        state.menge++;
        document.querySelector(".qty-value").textContent = state.menge;
        updateSummaryAlt();
        renderFinalStep();
        updatePrices();
        updateURL(); // 🔥 Update URL when quantity changes
    });

    document.querySelector(".qty-minus")?.addEventListener("click", () => {
        if (state.menge > 1) {
            state.menge--;
            document.querySelector(".qty-value").textContent = state.menge;
            updateSummaryAlt();
            updatePrices();
            renderFinalStep();
            updateURL(); // 🔥 Update URL when quantity changes
        }
    });

    function mmToCm(mm) {
        return mm / 10;
    }

    function validateMeasurementInput(input) {
        const min = Number(input.dataset.min);
        const max = Number(input.dataset.max);
        const value = Number(input.value);

        const errorEl = document.querySelector(
            `.measure-error[data-error-for="${input.name}"]`
        );

        input.classList.remove("error");
        errorEl.style.display = "none";
        errorEl.textContent = "";

        if (!value) return true;

        if (value < min || value > max) {
            input.classList.add("error");

            errorEl.textContent =
                `Du hast ${value} mm (= ${mmToCm(value)} cm) eingegeben. ` +
                `Die ${input.name === "breite" ? "Breite" : "Höhe"} muss zwischen ` +
                `${min} und ${max} mm liegen (= ${mmToCm(min)}–${mmToCm(max)} cm).`;

            errorEl.style.display = "block";
            return false;
        }

        return true;
    }

    // Zoom effect on options image  
    document.addEventListener("mousemove", function (e) {
        const zoomBox = e.target.closest(".option-zoom");
        if (!zoomBox) return;

        const img = zoomBox.querySelector("img");
        const rect = zoomBox.getBoundingClientRect();

        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        img.style.transformOrigin = `${x}% ${y}%`;
        img.style.transform = "scale(2)";
    });

    document.addEventListener("mouseleave", function (e) {
        const zoomBox = e.target.closest(".option-zoom");
        if (!zoomBox) return;

        const img = zoomBox.querySelector("img");
        img.style.transform = "scale(1)";
        img.style.transformOrigin = "center center";
    }, true);

    function buildSummaries(config) {
        const finalTable = document.getElementById("finalSummary");
        const sideList = document.getElementById("summaryBoxAltList");

        if (!finalTable || !sideList) return;

        finalTable.innerHTML = "";
        sideList.innerHTML = "";

        config.steps.forEach(step => {
            if (
                activeFlow.length &&
                !activeFlow.includes(step.key)
            ) {
                return;
            }

            if (step.type === "measurement") {
                finalTable.insertAdjacentHTML("beforeend", `
              <tr>
                <td>${step.title}</td>
                <td data-final="masse">—</td>
              </tr>
            `);

                sideList.insertAdjacentHTML("beforeend", `
              <li>
                <strong>${step.title}:</strong>
                <span data-summary-alt="masse">—</span>
              </li>
            `);

                return;
            }

            finalTable.insertAdjacentHTML("beforeend", `
            <tr>
              <td>${step.title}</td>
              <td data-final="${step.key}">—</td>
            </tr>
          `);

            sideList.insertAdjacentHTML("beforeend", `
            <li>
              <strong>${step.title}:</strong>
              <span data-summary-alt="${step.key}">—</span>
            </li>
          `);
        });
    }

    // ============================================
    // APPLY LOADED STATE TO UI (After rendering)
    // ============================================
    if (Object.keys(state.selections).length > 0 || Object.keys(state.measurements).length > 0) {
        // Wait for DOM to be fully ready
        setTimeout(() => {
            // First, restore the conditional flow based on first selection
            const firstSelectionKey = Object.keys(state.selections)[0];
            if (firstSelectionKey) {
                const step = PRODUCT_CONFIG.steps.find(s => s.key === firstSelectionKey);
                const selectedValue = state.selections[firstSelectionKey];

                if (step && step.options) {
                    const option = step.options.find(o => o.value === selectedValue);
                    if (option && option.showSteps) {
                        // Set active flow WITHOUT resetting state
                        activeFlow = [firstSelectionKey, ...option.showSteps];

                        // Hide all steps first
                        document.querySelectorAll(".config-step").forEach(el => {
                            el.classList.add("is-disabled");
                        });

                        // Show only relevant steps
                        activeFlow.forEach(key => {
                            showStepByKey(key);
                        });

                        // Show final step if config is complete
                        const finalStep = document.getElementById("finalStep");
                        if (finalStep && isConfigurationComplete()) {
                            renderFinalStep();
                            finalStep.classList.remove("is-disabled");
                        }
                    }
                }
            }

            // NOW apply state to UI (after flow is set)
            applyStateToUI(state);

            // Rebuild summaries with correct flow
            buildSummaries(PRODUCT_CONFIG);
            updateSummaryAlt();

            // Render final step to populate finalSummary table
            renderFinalStep();

            updatePrices();
        }, 100);
    }

    // for add to cart
    /* =====================================================
       ADD TO CART - WITH PRODUCT CREATION
    ===================================================== */

    async function addToCart() {
        if (!isConfigurationComplete()) {
            alert('Bitte vervollständigen Sie alle Schritte vor dem Hinzufügen zum Warenkorb');
            return;
        }

        const addToCartBtn = document.querySelector('.add-to-cart-btn');
        if (addToCartBtn) {
            addToCartBtn.disabled = true;
            addToCartBtn.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">⌛</span> Produkt wird erstellt...';
        }

        try {
            // Step 1: Calculate final price
            const finalPrice = await calculatePrice(
                PRODUCT_ID,
                state.selections,
                state.measurements,
                1
            );

            console.log('Final Price:', finalPrice);

            const baseProductTitle = PRODUCT_CONFIG.product.name || 'Configured Product';

            // Step 2: Get product image (optional - use first selected option's image)
            let productImage = null;
            const el = document.querySelector('.zoom-thumb');
            const imgUrl = el.dataset.url;
            if (state.selections) {
                for (const [stepKey, selectedValue] of Object.entries(state.selections)) {
                    const step = PRODUCT_CONFIG.steps.find(s => s.key === stepKey);
                    if (step && step.options) {
                        const option = step.options.find(o => o.value === selectedValue);
                        if (option && option.image) {
                            productImage = option.image;
                            break; // Use first available image
                        }
                    }
                }
            }

            // Step 3: Create product via App Proxy
            const createResponse = await fetch('/apps/cartApi', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    productId: PRODUCT_ID,
                    selections: state.selections,
                    measurements: state.measurements,
                    quantity: state.menge,
                    calculatedPrice: finalPrice,
                    baseProductTitle: baseProductTitle,
                    productImage: imgUrl,
                })
            });

            const createData = await createResponse.json();

            console.log('Create Product Response:', createData);

            if (!createData.success) {
                throw new Error(createData.error || 'Failed to create product');
            }

            // Step 4: Extract variant ID
            let variantId = createData.shopifyProduct.variantId;

            // Shopify Cart API needs numeric ID
            if (variantId.includes('gid://')) {
                variantId = variantId.split('/').pop();
            }

            console.log('Adding variant to cart:', variantId);

            // Step 5: Add to cart
            const fullURL = window.location.href;
            const params = new URLSearchParams(window.location.search);
            const colorFromURL = params.get('color');
            // Add a 2-second delay before adding to cart (adjust as needed)
            await new Promise(resolve => setTimeout(resolve, 5000));
            const cartResponse = await fetch('/cart/add.js', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    items: [{
                        id: variantId,
                        quantity: state.menge,
                        properties: {
                            // selections
                            ...Object.fromEntries(
                                Object.entries(state.selections).map(
                                    ([key, value]) => [`${key}`, String(value)]
                                )
                            ),

                            // measurements
                            ...Object.fromEntries(
                                Object.entries(state.measurements).map(
                                    ([key, value]) => [`${key}`, String(value)]
                                )
                            ),
                            // color from URL (only if exists)
                            ...(colorFromURL ? { color: colorFromURL } : {}),

                            // hidden properties
                            _url: fullURL
                        }
                    }]
                })
            });

            if (!cartResponse.ok) {
                const errorText = await cartResponse.text();
                console.error('Cart API Error:', errorText);
                throw new Error(`Failed to add to cart: ${errorText}`);
            }

            const cartResult = await cartResponse.json();
            console.log('Cart Result:', cartResult);

            // Step 6: Success!
            showSuccessMessage(createData.shopifyProduct.title);

            setTimeout(() => {
                window.location.href = '/cart';
            }, 1500);

        } catch (error) {
            console.error('Add to Cart Error:', error);
            alert(`Fehler: ${error.message}`);

            if (addToCartBtn) {
                addToCartBtn.disabled = false;
                addToCartBtn.innerHTML = 'IN DEN WARENKORB';
            }
        }
    }

    function isConfigurationComplete() {
        const requiredSteps = activeFlow.length > 0 ? activeFlow : PRODUCT_CONFIG.steps.map(s => s.key);

        for (const stepKey of requiredSteps) {
            const step = PRODUCT_CONFIG.steps.find(s => s.key === stepKey);

            if (!step) continue;

            if (step.type === 'options') {
                if (!state.selections[stepKey]) {
                    console.log('Missing selection for:', stepKey);
                    return false;
                }
            }

            if (step.type === 'measurement') {
                if (!state.measurements.breite || !state.measurements.hoehe) {
                    console.log('Missing measurements');
                    return false;
                }
            }
        }

        return true;
    }

    function showSuccessMessage(productTitle) {
        const notification = document.createElement('div');
        notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 20px 30px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
    `;

        notification.innerHTML = `
        <h3 style="margin: 0 0 10px 0; font-size: 18px;">✓ Produkt erstellt!</h3>
        <p style="margin: 0; font-size: 14px;">${productTitle}</p>
        <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Wird zum Warenkorb hinzugefügt...</p>
    `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Add to cart button event listener
    document.querySelector('.add-to-cart-btn')?.addEventListener('click', addToCart);
});

document.querySelector(".zoom-thumb")?.addEventListener("mousemove", (e) => {
    const preview = document.querySelector(".zoom-preview");

    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    preview.style.backgroundPosition = `${x}% ${y}%`;
});