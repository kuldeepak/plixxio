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
  menge: 1,
};

function stripHTML(html) {
  if (!html) return "";

  const temp = document.createElement("div");
  temp.innerHTML = html;

  return (temp.textContent || temp.innerText || "")
    .replace(/\uFFFD/g, "") // cleaner replacement
    .replace(/\s+/g, " ")   // extra spaces remove
    .trim();
}

function decodeImageParam(encoded) {
  if (!encoded) return null;

  let decoded = encoded;

  try {
    decoded = decodeURIComponent(decoded);

    // double encoded case handle
    if (decoded.includes("%")) {
      decoded = decodeURIComponent(decoded);
    }
  } catch (e) {}

  // ensure https
  if (decoded.startsWith("//")) {
    decoded = "https:" + decoded;
  }

  return decoded;
}

/* =====================================================
   URL STATE MANAGEMENT
===================================================== */

function updateURL() {
  const currentParams = new URLSearchParams(window.location.search);
  const params = new URLSearchParams();

  ["product_id", "img", "color"].forEach((key) => {
    if (currentParams.has(key)) {
      params.set(key, currentParams.get(key));
    }
  });

  Object.entries(state.selections).forEach(([key, value]) => {
    if (value != null && value !== "") {
      params.set(`sel_${key}`, value);
    }
  });

  Object.entries(state.measurements).forEach(([key, value]) => {
    if (value != null && value !== "") {
      params.set(`m_${key}`, value);
    }
  });

  if (state.menge && state.menge !== 1) {
    params.set("qty", state.menge);
  }

  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState(
    { state: JSON.parse(JSON.stringify(state)) },
    "",
    newURL,
  );
}

function decodeHTML(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

function loadStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  const urlState = {
    selections: {},
    measurements: {},
    menge: 1,
  };

  for (const [key, value] of params.entries()) {
    if (key.startsWith("sel_")) {
      const actualKey = key.replace("sel_", "");
      urlState.selections[actualKey] = value.toLowerCase();
    }
  }

  for (const [key, value] of params.entries()) {
    if (key.startsWith("m_")) {
      const actualKey = key.replace("m_", "");
      urlState.measurements[actualKey] = Number(value);
    }
  }

  const qty = params.get("qty");
  if (qty) {
    urlState.menge = Number(qty);
  }

  return urlState;
}

function applyStateToUI(loadedState) {
  Object.entries(loadedState.selections).forEach(([key, value]) => {
    const radio = document.querySelector(
      `input[name="${key}"][value="${value}"]`,
    );
    if (radio) {
      radio.checked = true;
    }

    setTimeout(() => {
      applySelectionsWithDependencies();
    }, 50);
  });

  Object.entries(loadedState.measurements).forEach(([key, value]) => {
    const input = document.querySelector(`input[name="${key}"]`);
    if (input) {
      input.value = value;
    }
  });

  if (loadedState.menge) {
    const qtyDisplay = document.querySelector(".qty-value");
    if (qtyDisplay) {
      qtyDisplay.textContent = loadedState.menge;
    }
  }
}

function setupPopStateHandler() {
  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.state) {
      Object.assign(state, event.state.state);
      applyStateToUI(state);
      updateSummaryAlt();
      renderFinalStep();
      updatePrices();

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
    const response = await fetch(
      `https://plixxo-app-tvhmp.ondigitalocean.app/api/public/configurator/${productId}?v=${Date.now()}`,
      { cache: "no-store" },
    );
    const data = await response.json();

    if (!data.success) {
      console.error("Configuration load failed:", data.error);
      showError("Failed to load product configuration");
      return null;
    }

    return data.config;
  } catch (error) {
    console.error("API Error:", error);
    showError("Failed to connect to configuration service");
    return null;
  }
}

async function calculatePrice(productId, selections, measurements, quantity) {
  try {
    const response = await fetch(
      `https://plixxo-app-tvhmp.ondigitalocean.app/api/public/calculate-price?v=${Date.now()}`,
      {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, selections, measurements, quantity }),
      },
    );

    const data = await response.json();

    if (!data.success) {
      console.error("Price calculation failed:", data.error);
      return 0;
    }

    return data.price;
  } catch (error) {
    console.error("Price calculation error:", error);
    return 0;
  }
}

function showError(message) {
  alert(message);
}

// Global dispatcher called by cascading dropdowns (which live outside DOMContentLoaded scope)
function onDropdownGroupChange() {
  if (typeof window._updateSummaryAlt === "function")
    window._updateSummaryAlt();
  if (typeof window._renderFinalStep === "function") window._renderFinalStep();
  if (typeof window._updatePrices === "function") window._updatePrices();
  if (typeof window._updateURL === "function") window._updateURL();
}

/* =====================================================
   STEP GROUPING HELPER
   Groups consecutive dropdown steps into one virtual group.
   Returns an array of "virtual steps":
     - type "dropdown_group": { type, steps[] }
     - all others: the original step object
===================================================== */
function groupSteps(steps) {
  steps.forEach((step) => {
    step.type = step.type?.toLowerCase();
  });
  const groups = [];
  let i = 0;

  while (i < steps.length) {
    if (steps[i].type === "dropdown") {
      // Collect all consecutive dropdowns
      const group = [];
      while (i < steps.length && steps[i].type === "dropdown") {
        group.push(steps[i]);
        i++;
      }
      groups.push({ type: "dropdown_group", steps: group });
    } else {
      groups.push(steps[i]);
      i++;
    }
  }

  return groups;
}

/* =====================================================
   STEP GENERATION
===================================================== */
// function createStepShell(step, index, isDropdownGroup = false) {
//   const stepKey = isDropdownGroup ? `dropdown_group_${index}` : step.key;
//   const title = isDropdownGroup ? step.steps[0].title : step.title;
//   const subtitle = isDropdownGroup
//     ? step.steps[0].subtitle || ""
//     : step.subtitle || "";
//   const description = isDropdownGroup
//     ? step.steps[0].description || ""
//     : step.description || "";
//   const image = isDropdownGroup ? null : step.image;

//   return `
//       <div class="config-step ${index !== 0 ? "is-disabled" : ""}"
//            data-step="${index + 1}"
//            data-step-key="${stepKey}"
//            ${isDropdownGroup ? 'data-dropdown-group="true"' : ""}>
//         <div class="heading_content_div">
//           <h2>${title || ""}</h2>
//           <p>${subtitle || ""}</p>
//         </div>
        
//         ${description ? `<div class="heading_content_div_1">${description}</div>` : ""}
//         ${image ? `<div class="option-zoom"><img src="${image}"></div>` : ""}

//         <div class="step-content"></div>

//         <button class="step-next">WEITER</button>
//       </div>
//     `;
// }
function createStepShell(step, index, isDropdownGroup = false) {
  const stepKey = isDropdownGroup ? `dropdown_group_${index}` : step.key;

  // Raw values from API
  const titleRaw = isDropdownGroup ? step.steps[0].title : step.title;
  const subtitleRaw = isDropdownGroup
    ? step.steps[0].subtitle || ""
    : step.subtitle || "";
  const descriptionRaw = isDropdownGroup
    ? step.steps[0].description || ""
    : step.description || "";

  // 🔒 Sanitize HTML
  const title = stripHTML(titleRaw);
  const subtitle = stripHTML(subtitleRaw);
  const description = stripHTML(descriptionRaw);

  const image = isDropdownGroup ? null : step.image;

  return `
      <div class="config-step ${index !== 0 ? "is-disabled" : ""}"
           data-step="${index + 1}"
           data-step-key="${stepKey}"
           ${isDropdownGroup ? 'data-dropdown-group="true"' : ""}>
        <div class="heading_content_div">
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        
        ${description ? `<div class="heading_content_div_1">${description}</div>` : ""}
        ${image ? `<div class="option-zoom"><img src="${image}"></div>` : ""}

        <div class="step-content"></div>

        <button class="step-next">WEITER</button>
      </div>
    `;
}
function renderDynamicSteps(config) {
  const wrapper = document.getElementById("dynamicSteps");
  wrapper.innerHTML = "";

  const virtualSteps = groupSteps(config.steps);

  virtualSteps.forEach((vStep, index) => {
    const isGroup = vStep.type === "dropdown_group";
    wrapper.insertAdjacentHTML(
      "beforeend",
      createStepShell(vStep, index, isGroup),
    );
  });

  renderStepContents(config, virtualSteps);

  // Store virtualSteps on config for later reference
  config._virtualSteps = virtualSteps;
}

/* =====================================================
   CASCADING DROPDOWNS RENDERER
   Renders first dropdown immediately.
   Subsequent dropdowns appear only after the previous one is selected.
===================================================== */
function renderCascadingDropdowns(groupStepsList, container) {
  container.innerHTML = "";

  // Build a set of keys that were explicitly set from the URL querystring.
  // Only these should be pre-selected and auto-cascaded on initial render.
  const params = new URLSearchParams(window.location.search);
  const urlKeys = new Set();
  for (const [key] of params.entries()) {
    if (key.startsWith("sel_")) {
      urlKeys.add(key.replace("sel_", ""));
    }
  }

  // Render only the first dropdown initially, passing urlKeys for pre-selection control
  renderSingleDropdownInGroup(groupStepsList, container, 0, urlKeys);
}

// urlKeys: Set of step keys that were loaded from the URL querystring.
// Only pre-select and auto-cascade for those keys — not for stale state.
function renderSingleDropdownInGroup(
  groupStepsList,
  container,
  index,
  urlKeys = new Set(),
) {
  if (index >= groupStepsList.length) return;

  const step = groupStepsList[index];
  const selectedValues = Object.values(state.selections);

  // Filter options based on parent selection
  const filteredOptions = step.options.filter((opt) => {
    if (!opt.parentOptionIds) return true;

    let parents = [];
    if (Array.isArray(opt.parentOptionIds)) {
      parents = opt.parentOptionIds;
    } else {
      try {
        parents = JSON.parse(opt.parentOptionIds);
      } catch {
        parents = [];
      }
    }

    return (
      parents.length === 0 || parents.some((p) => selectedValues.includes(p))
    );
  });

  // Build the dropdown wrapper with a label
  const wrapper = document.createElement("div");
  wrapper.classList.add("dropdown-step-row");
  wrapper.dataset.dropdownIndex = index;
  wrapper.dataset.dropdownKey = step.key;

  // Only pre-select if this key was explicitly set from the URL querystring
  const savedValue = urlKeys.has(step.key) ? state.selections[step.key] : null;

  let html = `
        <div class="dropdown-field">
            <label class="dropdown-label">${step.title}</label>
            <select name="${step.key}" data-dropdown-index="${index}">
                <option value="">Bitte wählen</option>
    `;

  filteredOptions.forEach((opt) => {
    const isSelected = savedValue === opt.value;
    html += `<option value="${opt.value}" ${isSelected ? "selected" : ""}>${opt.label}</option>`;
  });

  html += `</select></div>`;

  wrapper.innerHTML = html;
  container.appendChild(wrapper);

  // Only cascade to next dropdown if this value came from the URL querystring
  if (savedValue) {
    renderSingleDropdownInGroup(groupStepsList, container, index + 1, urlKeys);
  }

  // Listen for change on this dropdown → show next
  const select = wrapper.querySelector("select");
  select.addEventListener("change", (e) => {
    const value = e.target.value;

    // Save to state AND mark this key as explicitly set (treat like URL key)
    state.selections[step.key] = value;
    urlKeys.add(step.key);

    // Remove all dropdowns AFTER this one
    const toRemove = container.querySelectorAll(
      `.dropdown-step-row[data-dropdown-index]`,
    );
    toRemove.forEach((el) => {
      if (Number(el.dataset.dropdownIndex) > index) {
        el.remove();
        // Clear state and urlKeys for removed dropdowns
        const removedKey = el.dataset.dropdownKey;
        delete state.selections[removedKey];
        urlKeys.delete(removedKey);
      }
    });

    // Render next dropdown if a value was selected
    if (value) {
      renderSingleDropdownInGroup(
        groupStepsList,
        container,
        index + 1,
        urlKeys,
      );
    }

    // IMPORTANT: buildSummaries must run first so [data-summary-alt]/[data-final]
    // elements exist before we try to populate them.
    if (window._buildSummaries) window._buildSummaries();
    if (window._updateSummaryAlt) window._updateSummaryAlt();
    if (window._renderFinalStep) window._renderFinalStep();
    if (window._updatePrices) window._updatePrices();
    if (window._updateURL) window._updateURL();
  });
}

function renderOptions(step, container) {
  const sortedOptions = [...step.options]
    .map((opt) => ({
      ...opt,
      order: parseInt(opt.order) || 0,
    }))
    .sort((a, b) => a.order - b.order);

  console.log("Sorted:", sortedOptions);

  sortedOptions.forEach((opt) => {
    container.insertAdjacentHTML(
      "beforeend",
      `
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

            ${
              opt.description
                ? `<img src="https://cdn.shopify.com/extensions/019bead9-e253-7ace-b99a-87365ef1f7bc/dev-f3cac707-85cf-466f-8b61-c189952e5121/assets/info.jpg" alt="Info" class="info_icon">`
                : ""
            }
          </div>

          <div class="option-inner">
            <div class="option-text">
             <div class="option-description">
  ${stripHTML(opt.description || "")}
</div>
            </div>

            ${
              opt.image
                ? `
                <div class="option-image main-img">
                  <div class="option-zoom">
                    <img src="${opt.image}" alt="${opt.label}">
                  </div>
                </div>
              `
                : ""
            }
          </div>
        </label>
      `,
    );
  });
}

function renderStepContents(config, virtualSteps) {
  virtualSteps.forEach((vStep, index) => {
    const stepEl = document.querySelector(
      `.config-step[data-step="${index + 1}"]`,
    );
    if (!stepEl) return;

    const content = stepEl.querySelector(".step-content");

    if (vStep.type === "dropdown_group") {
      // Render cascading dropdowns inside this single step
      renderCascadingDropdowns(vStep.steps, content);
      return;
    }

    if (vStep.type === "options") {
      renderOptions(vStep, content);
    }

    // UPDATED: Measurement with conditional Flügel field
    if (vStep.type === "measurement") {
      const hasFlugel =
        vStep.measurementMode &&
        vStep.measurementMode.toUpperCase() === "FLUGEL";

      let html = `
              <div class="measure-field">
                <label>Breite (${vStep.width.min} – ${vStep.width.max} mm)</label>
                <input
                  type="number"
                  name="breite"
                  placeholder="Breite in mm"
                  data-min="${vStep.width.min}"
                  data-max="${vStep.width.max}"
                >
                <div class="measure-error" data-error-for="breite"></div>
              </div>
          
              <div class="measure-field">
                <label>Höhe (${vStep.height.min} – ${vStep.height.max} mm)</label>
                <input
                  type="number"
                  name="hoehe"
                  placeholder="Höhe in mm"
                  data-min="${vStep.height.min}"
                  data-max="${vStep.height.max}"
                >
                <div class="measure-error" data-error-for="hoehe"></div>
              </div>
            `;

      // Conditionally add Flügel field
      if (hasFlugel) {
        html += `
              <div class="measure-field">
                <label>Flügel (${vStep.flugelMin} – ${vStep.flugelMax} mm)</label>
                <input
                  type="number"
                  name="flugel"
                  placeholder="Flügel in mm"
                  data-min="${vStep.flugelMin}"
                  data-max="${vStep.flugelMax}"
                >
                <div class="measure-error" data-error-for="flugel"></div>
              </div>
                `;
      }

      content.innerHTML = html;
    }
  });
}

/* =====================================================
   RE-RENDER DEPENDENT STEPS (for non-grouped dropdowns, kept for compatibility)
===================================================== */
function reRenderDependentSteps(changedStepKey) {
  // For dropdown_group, cascading is handled internally.
  // This function now only handles legacy non-grouped usage if any.
  const steps = PRODUCT_CONFIG.steps;
  const currentIndex = steps.findIndex((s) => s.key === changedStepKey);

  for (let i = currentIndex + 1; i < steps.length; i++) {
    const step = steps[i];
    if (step.type !== "dropdown") continue;

    // Skip if this dropdown is inside a dropdown_group (handled by cascading)
    const groupEl = document.querySelector(
      `.config-step[data-dropdown-group="true"] select[name="${step.key}"]`,
    );
    if (groupEl) continue;

    const stepEl = document.querySelector(
      `.config-step[data-step-key="${step.key}"]`,
    );
    if (!stepEl) continue;

    const content = stepEl.querySelector(".step-content");
    content.innerHTML = "";

    // Legacy single dropdown render
    const selectedValues = Object.values(state.selections);
    const filteredOptions = step.options.filter((opt) => {
      if (!opt.parentOptionIds) return true;
      let parents = [];
      if (Array.isArray(opt.parentOptionIds)) {
        parents = opt.parentOptionIds;
      } else {
        try {
          parents = JSON.parse(opt.parentOptionIds);
        } catch {
          parents = [];
        }
      }
      return parents.some((p) => selectedValues.includes(p));
    });

    let html = `<select name="${step.key}"><option value="">Bitte wählen</option>`;
    filteredOptions.forEach((opt) => {
      html += `<option value="${opt.value}">${opt.label}</option>`;
    });
    html += `</select>`;
    content.innerHTML = html;
  }
}

function applySelectionsWithDependencies() {
  const steps = PRODUCT_CONFIG.steps;

  steps.forEach((step) => {
    const value = state.selections[step.key];
    if (!value) return;

    if (step.type === "dropdown") {
      // Handled by cascading logic in renderCascadingDropdowns
      return;
    }

    const radio = document.querySelector(
      `input[name="${step.key}"][value="${value}"]`,
    );
    if (radio) {
      radio.checked = true;
    }
  });
}

/* =====================================================
   MAIN INIT
===================================================== */
document.addEventListener("DOMContentLoaded", async function () {
  // ============================================
  // GET PRODUCT ID FROM PAGE
  // ============================================
  const productMeta = document.querySelector('meta[name="shopify-product-id"]');

  if (!PRODUCT_ID) {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("product_id");
    const img = params.get("img");
    if (img) {
      const finalImg = decodeImageParam(img);

      const zoomThumb = document.querySelector(".zoom-thumb");
      const zoomPreview = document.querySelector(".zoom-preview");
      const mainImg = document.querySelector(".config-image-main");

      if (zoomThumb && finalImg) {
        zoomThumb.setAttribute("data-url", finalImg);
        zoomThumb.style.backgroundImage = `url("${finalImg}")`;
      }

      if (zoomPreview && finalImg) {
        zoomPreview.style.backgroundImage = `url("${finalImg}")`;
      }

      if (mainImg && finalImg) {
        mainImg.src = finalImg;
      }
    }
    const color = params.get("color");

    if (color) {
      document.querySelector(".custom-alert .color").textContent = color;
    }

    const configuratorEl = document.getElementById("configuratorSteps");
    PRODUCT_ID = productId || configuratorEl?.dataset?.productId;
  }

  if (!PRODUCT_ID) {
    console.error("Product ID not found");
    showError("Product configuration not available");
    return;
  }

  console.log("Loading configuration for product:", PRODUCT_ID);

  // ============================================
  // LOAD CONFIGURATION FROM API
  // ============================================
  PRODUCT_CONFIG = await loadConfiguration(PRODUCT_ID);

  if (!PRODUCT_CONFIG) return;

  // function stripHTML(html) {
  //   if (!html) return "";

  //   const temp = document.createElement("div");
  //   temp.innerHTML = html;

  //   return (temp.textContent || temp.innerText || "").replace(/�/g, "").trim();
  // }

  if (PRODUCT_CONFIG) {
    document.querySelector(".pro_name").textContent = stripHTML(
      PRODUCT_CONFIG.product.name,
    );

    const stepsEl = document.querySelector(".steps_name");

if (stepsEl && PRODUCT_CONFIG?.steps) {
  stepsEl.textContent = PRODUCT_CONFIG.steps
    .slice(0, 2)
    .map((s) => stripHTML(s.title || ""))
    .filter(Boolean)
    .join(", ");
}
  }

  let activeFlow = [];
  let currentStepIndex = 0;
  window._getActiveFlow = () => activeFlow;

  /* 1️⃣ Render steps (with dropdown grouping) */
  renderDynamicSteps(PRODUCT_CONFIG);

  /* 2️⃣ Cache steps AFTER render */
  const steps = document.querySelectorAll(".config-step");

  /* 3️⃣ Load state from URL and merge */
  const urlState = loadStateFromURL();
  state.selections = { ...state.selections, ...urlState.selections };
  state.measurements = { ...state.measurements, ...urlState.measurements };
  state.menge = urlState.menge || state.menge;

  setupPopStateHandler();
  window.history.replaceState(
    { state: JSON.parse(JSON.stringify(state)) },
    "",
    window.location.href,
  );

  // Build summary DOM immediately so [data-summary-alt] / [data-final] elements
  // exist before any dropdown change fires (buildSummaries is defined below,
  // so we defer with a microtask after all function declarations are hoisted)
  // We call it again after the function is defined — see window._buildSummaries alias below.

  /* =====================================================
       CONDITIONAL FLOW HANDLER
    ===================================================== */
  function handleDependencies(stepKey, selectedValue) {
    const step = PRODUCT_CONFIG.steps.find((s) => s.key === stepKey);
    if (!step || !step.options) return;

    const option = step.options.find((o) => o.value === selectedValue);
    if (!option || !option.showSteps) return;

    // Reset previous selections (except current)
    Object.keys(state.selections).forEach((key) => {
      if (key !== stepKey) {
        delete state.selections[key];
        document
          .querySelectorAll(`input[name="${key}"]`)
          .forEach((r) => (r.checked = false));
      }
    });
    state.measurements = {};

    // UPDATED: Clear all measurement fields including flügel
    document
      .querySelectorAll(
        'input[name="breite"], input[name="hoehe"], input[name="flugel"]',
      )
      .forEach((input) => {
        input.value = "";
        input.classList.remove("error");
      });
    document.querySelectorAll(".measure-error").forEach((el) => {
      el.style.display = "none";
      el.textContent = "";
    });

    activeFlow = [stepKey, ...option.showSteps];
    currentStepIndex = 0;

    document.querySelectorAll(".config-step").forEach((el) => {
      el.classList.add("is-disabled");
    });

    const finalStep = document.getElementById("finalStep");
    if (finalStep) finalStep.classList.add("is-disabled");

    showStepByKey(stepKey);
    buildSummaries(PRODUCT_CONFIG);
    updateSummaryAlt();
    renderFinalStep();
    updatePrices();
  }

  function showStepByKey(key) {
    // Key might be a real step key OR a dropdown_group virtual key
    let el = document.querySelector(`.config-step[data-step-key="${key}"]`);

    // If not found directly, check if this key belongs to a dropdown_group
    if (!el) {
      el = document.querySelector(`.config-step[data-dropdown-group="true"]`);
    }

    if (el) el.classList.remove("is-disabled");
  }

  /* =====================================================
       STEP NAVIGATION
    ===================================================== */
  document.querySelectorAll(".step-next").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const currentStepEl = e.target.closest(".config-step");
      const currentKey = currentStepEl.dataset.stepKey;
      const isDropdownGroup = currentStepEl.dataset.dropdownGroup === "true";

      // Validate the current step
      if (isDropdownGroup) {
        // For dropdown group: validate all currently visible dropdowns
        const visibleSelects = currentStepEl.querySelectorAll("select");
        let allValid = true;

        visibleSelects.forEach((select) => {
          if (!select.value) allValid = false;
        });

        if (!allValid) {
          alert("Bitte alle Auswahlen treffen");
          return;
        }
      } else {
        if (!isStepValid(currentStepEl)) {
          alert("Bitte Auswahl treffen");
          return;
        }
      }

      // Determine active flow position for this step.
      // For dropdown groups, all dropdown keys live in activeFlow.
      // We want the LAST dropdown key in the group to find what comes after.
      let lastFlowIndex = -1;

      if (isDropdownGroup) {
        const vStep = PRODUCT_CONFIG._virtualSteps?.find(
          (vs) =>
            vs.type === "dropdown_group" &&
            vs.steps.some((s) => activeFlow.includes(s.key)),
        );
        if (vStep) {
          // Find the highest index among all dropdown keys in this group
          vStep.steps.forEach((s) => {
            const idx = activeFlow.indexOf(s.key);
            if (idx > lastFlowIndex) lastFlowIndex = idx;
          });
        }
      } else {
        lastFlowIndex = activeFlow.indexOf(currentKey);
      }

      if (lastFlowIndex === -1 || lastFlowIndex === activeFlow.length - 1) {
        // No more steps → show final step
        const finalStep = document.getElementById("finalStep");
        if (finalStep) {
          renderFinalStep();
          finalStep.classList.remove("is-disabled");
          scrollToElementWithOffset(finalStep, 100);
        }
        return;
      }

      // Find the next key AFTER the group's last dropdown
      const nextKey = activeFlow[lastFlowIndex + 1];
      showStepByKey(nextKey);

      // The next step element — look up by real key first, then fallback to group
      const nextStepEl =
        document.querySelector(`.config-step[data-step-key="${nextKey}"]`) ||
        document.querySelector(
          `.config-step[data-dropdown-group="true"]:not(.is-disabled)`,
        );

      if (nextStepEl) scrollToElementWithOffset(nextStepEl, 100);
    });
  });

  /* =====================================================
       INPUT HANDLING - FOR RADIO & NUMBER INPUTS
       (Dropdowns inside groups are handled by cascading logic above)
    ===================================================== */
  document.addEventListener("change", (e) => {
    const input = e.target;
    if (!input.name) return;

    // Skip selects inside dropdown groups — they handle themselves
    if (
      input.tagName === "SELECT" &&
      input.closest('[data-dropdown-group="true"]')
    ) {
      return;
    }

    // UPDATED: Include flügel in validation check
    if (
      input.name === "breite" ||
      input.name === "hoehe" ||
      input.name === "flugel"
    ) {
      if (!validateMeasurementInput(input)) return;
    }

    saveState(input);

    if (input.type === "radio" || input.tagName === "SELECT") {
      reRenderDependentSteps(input.name);
    }

    if (input.type === "radio") {
      handleDependencies(input.name, input.value);
    }

    updateSummaryAlt();
    renderFinalStep();
    updatePrices();
    updateURL();
  });

  /* =====================================================
       HELPERS
    ===================================================== */
  function saveState(input) {
    if (input.type === "radio" || input.tagName === "SELECT") {
      state.selections[input.name] = input.value;
    }
    if (input.type === "number") {
      state.measurements[input.name] = Number(input.value);
    }
  }

  async function updatePrices() {
    const subtotalEl = document.querySelector(".summary-price b");
    const totalEl = document.querySelector(".total b");

    if (subtotalEl) subtotalEl.textContent = "Calculating...";
    if (totalEl) totalEl.textContent = "Calculating...";

    try {
      const price = await calculatePrice(
        PRODUCT_ID,
        state.selections,
        state.measurements,
        state.menge,
      );
      if (subtotalEl) subtotalEl.textContent = `${price.toFixed(2)} €`;
      if (totalEl) totalEl.textContent = `${price.toFixed(2)} €`;
    } catch (error) {
      console.error("Price update failed:", error);
      if (subtotalEl) subtotalEl.textContent = "Error";
      if (totalEl) totalEl.textContent = "Error";
    }
  }
  window._updatePrices = updatePrices;

  function isStepValid(step) {
    const radios = step.querySelectorAll('input[type="radio"]');
    const numbers = step.querySelectorAll('input[type="number"]');

    if (radios.length) {
      return [...radios].some((radio) => radio.checked);
    }

    if (numbers.length) {
      return [...numbers].every((input) => {
        if (!input.value) return false;
        return validateMeasurementInput(input);
      });
    }

    return true;
  }

  // UPDATED: Measurement display with flügel
  function renderFinalStep() {
    document.querySelectorAll("[data-final]").forEach((el) => {
      const key = el.dataset.final;
      let value = "—";

      if (key === "masse") {
        const { breite, hoehe, flugel } = state.measurements || {};

        // Show measurements based on whether flügel exists
        if (breite && hoehe) {
          value = flugel
            ? `${breite} mm × ${hoehe} mm × ${flugel} mm`
            : `${breite} mm × ${hoehe} mm`;
        }
      } else {
        const selected = state.selections?.[key];
        if (selected) {
          const step = PRODUCT_CONFIG.steps.find((s) => s.key === key);
          if (step && step.options) {
            const opt = step.options.find((o) => o.value === selected);
            value = opt ? opt.label : selected;
          } else {
            value = selected;
          }
        }
      }

      el.textContent = value;
    });
  }
  window._renderFinalStep = renderFinalStep;

  // UPDATED: Summary display with flügel
  function updateSummaryAlt() {
    document.querySelectorAll("[data-summary-alt]").forEach((el) => {
      const key = el.dataset.summaryAlt;
      let value = "—";

      if (key === "masse") {
        const { breite, hoehe, flugel } = state.measurements || {};

        // Show measurements based on whether flügel exists
        if (breite && hoehe) {
          value = flugel
            ? `${breite} mm × ${hoehe} mm × ${flugel} mm`
            : `${breite} mm × ${hoehe} mm`;
        }
      } else {
        const selected = state.selections?.[key];
        if (selected) {
          const step = PRODUCT_CONFIG.steps.find((s) => s.key === key);
          if (step && step.options) {
            const opt = step.options.find((o) => o.value === selected);
            value = opt ? opt.label : selected;
          } else {
            value = selected;
          }
        }
      }

      el.textContent = value;
    });
  }
  window._updateSummaryAlt = updateSummaryAlt;
  window._updateURL = updateURL;

  document.querySelector(".qty-plus")?.addEventListener("click", () => {
    state.menge++;
    document.querySelector(".qty-value").textContent = state.menge;
    updateSummaryAlt();
    renderFinalStep();
    updatePrices();
    updateURL();
  });

  document.querySelector(".qty-minus")?.addEventListener("click", () => {
    if (state.menge > 1) {
      state.menge--;
      document.querySelector(".qty-value").textContent = state.menge;
      updateSummaryAlt();
      updatePrices();
      renderFinalStep();
      updateURL();
    }
  });

  function mmToCm(mm) {
    return mm / 10;
  }

  // UPDATED: Measurement validation with flügel support
  function validateMeasurementInput(input) {
    const min = Number(input.dataset.min);
    const max = Number(input.dataset.max);
    const value = Number(input.value);

    const errorEl = document.querySelector(
      `.measure-error[data-error-for="${input.name}"]`,
    );

    input.classList.remove("error");
    errorEl.style.display = "none";
    errorEl.textContent = "";

    if (!value) return true; // Allow empty, validation happens on step completion

    if (value < min || value > max) {
      input.classList.add("error");
      const fieldLabel =
        input.name === "breite"
          ? "Breite"
          : input.name === "hoehe"
            ? "Höhe"
            : "Flügel";
      errorEl.textContent =
        `Du hast ${value} mm (= ${mmToCm(value)} cm) eingegeben. ` +
        `Die ${fieldLabel} muss zwischen ` +
        `${min} und ${max} mm liegen (= ${mmToCm(min)}–${mmToCm(max)} cm).`;
      errorEl.style.display = "block";
      return false;
    }

    return true;
  }

  document.addEventListener("mousemove", function (e) {
    const targetEl =
      e.target instanceof Element ? e.target : e.target?.parentElement;
    const zoomBox = targetEl?.closest?.(".option-zoom");
    if (!zoomBox) return;

    const img = zoomBox.querySelector("img");
    const rect = zoomBox.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    img.style.transformOrigin = `${x}% ${y}%`;
    img.style.transform = "scale(2)";
  });

  document.addEventListener(
    "mouseleave",
    function (e) {
      const targetEl =
        e.target instanceof Element ? e.target : e.target?.parentElement;
      const zoomBox = targetEl?.closest?.(".option-zoom");
      if (!zoomBox) return;

      const img = zoomBox.querySelector("img");
      img.style.transform = "scale(1)";
      img.style.transformOrigin = "center center";
    },
    true,
  );

  function scrollToElementWithOffset(element, offset = null) {
    if (!element) return;

    if (offset === null) {
      const header = document.querySelector("header, .header, .fixed-header");
      offset = header ? header.offsetHeight + 20 : 100;
    }

    const elementPosition =
      element.getBoundingClientRect().top + window.pageYOffset;
    const targetPosition = elementPosition - offset;

    window.scrollTo({ top: targetPosition, behavior: "smooth" });
  }

  // function buildSummaries(config) {
  //   const finalTable = document.getElementById("finalSummary");
  //   const sideList = document.getElementById("summaryBoxAltList");

  //   if (!finalTable || !sideList) return;

  //   finalTable.innerHTML = "";
  //   sideList.innerHTML = "";

  //   config.steps.forEach((step) => {
  //     if (activeFlow.length && !activeFlow.includes(step.key)) return;

  //     const cleanTitle = stripHTML(step.title);

  //     if (step.type === "measurement") {
  //       finalTable.insertAdjacentHTML(
  //         "beforeend",
  //         `
  //                   <tr><td>${cleanTitle}</td><td data-final="masse">—</td></tr>
  //               `,
  //       );
  //       sideList.insertAdjacentHTML(
  //         "beforeend",
  //         `
  //                   <li><strong>${cleanTitle}:</strong> <span data-summary-alt="masse">—</span></li>
  //               `,
  //       );
  //       return;
  //     }

  //     finalTable.insertAdjacentHTML(
  //       "beforeend",
  //       `
  //               <tr><td>${cleanTitle}</td><td data-final="${step.key}">—</td></tr>
  //           `,
  //     );
  //     sideList.insertAdjacentHTML(
  //       "beforeend",
  //       `
  //               <li><strong>${cleanTitle}:</strong> <span data-summary-alt="${step.key}">—</span></li>
  //           `,
  //     );
  //   });
  // }

 function buildSummaries(config) {
  const finalTable = document.getElementById("finalSummary");
  const sideList = document.getElementById("summaryBoxAltList");

  if (!finalTable || !sideList) return;

  finalTable.innerHTML = "";
  sideList.innerHTML = "";

  config.steps.forEach((step) => {
    if (activeFlow.length && !activeFlow.includes(step.key)) return;

    // ✅ PURE TEXT ONLY
    const cleanTitle = stripHTML(step.title || "");

    // ===== FINAL TABLE =====
    const tr = document.createElement("tr");

    const td1 = document.createElement("td");
    td1.textContent = cleanTitle; // 🔒 SAFE (no HTML)

    const td2 = document.createElement("td");
    td2.setAttribute(
      "data-final",
      step.type === "measurement" ? "masse" : step.key
    );
    td2.textContent = "—";

    tr.appendChild(td1);
    tr.appendChild(td2);
    finalTable.appendChild(tr);

    // ===== SIDE LIST =====
    const li = document.createElement("li");

    const strong = document.createElement("strong");
    strong.textContent = cleanTitle + ":";

    const span = document.createElement("span");
    span.setAttribute(
      "data-summary-alt",
      step.type === "measurement" ? "masse" : step.key
    );
    span.textContent = "—";

    li.appendChild(strong);
    li.appendChild(document.createTextNode(" "));
    li.appendChild(span);

    sideList.appendChild(li);
  });
}
  window._buildSummaries = () => buildSummaries(PRODUCT_CONFIG);

  // Build the summary DOM once now so elements exist for dropdown onChange handlers
  buildSummaries(PRODUCT_CONFIG);

  // ============================================
  // APPLY LOADED STATE TO UI (After rendering)
  // ============================================
  if (
    Object.keys(state.selections).length > 0 ||
    Object.keys(state.measurements).length > 0
  ) {
    setTimeout(() => {
      const firstSelectionKey = Object.keys(state.selections)[0];
      if (firstSelectionKey) {
        const step = PRODUCT_CONFIG.steps.find(
          (s) => s.key === firstSelectionKey,
        );
        const selectedValue = state.selections[firstSelectionKey];

        if (step && step.options) {
          const option = step.options.find((o) => o.value === selectedValue);
          if (option && option.showSteps) {
            activeFlow = [firstSelectionKey, ...option.showSteps];

            document.querySelectorAll(".config-step").forEach((el) => {
              el.classList.add("is-disabled");
            });

            activeFlow.forEach((key) => showStepByKey(key));

            const finalStep = document.getElementById("finalStep");
            if (finalStep && isConfigurationComplete()) {
              renderFinalStep();
              finalStep.classList.remove("is-disabled");
            }
          }
        }
      }

      applyStateToUI(state);

      // Re-trigger cascading dropdowns with saved state
      const groupContainers = document.querySelectorAll(
        '[data-dropdown-group="true"] .step-content',
      );
      groupContainers.forEach((container) => {
        const vStep = PRODUCT_CONFIG._virtualSteps?.find(
          (vs) => vs.type === "dropdown_group",
        );
        if (vStep) {
          renderCascadingDropdowns(vStep.steps, container);
        }
      });

      buildSummaries(PRODUCT_CONFIG);
      updateSummaryAlt();
      renderFinalStep();
      updatePrices();
    }, 100);
  }

  // ============================================
  // ADD TO CART
  // ============================================
  // UPDATED: Include flügel in Shopify properties
  function buildShopifyLineItemProperties() {
    const properties = {};

    (PRODUCT_CONFIG?.steps || []).forEach((step) => {
      if (activeFlow.length && !activeFlow.includes(step.key)) return;

      const cleanTitle = stripHTML(step.title);
      if (!cleanTitle) return;
      const propertyKey = `${cleanTitle}:`;

      if (step.type === "measurement") {
        const { breite, hoehe, flugel } = state.measurements || {};

        if (breite && hoehe) {
          // Include flügel in the property if it exists
          properties[propertyKey] = flugel
            ? `${breite} mm × ${hoehe} mm × ${flugel} mm`
            : `${breite} mm × ${hoehe} mm`;
        }
        return;
      }

      const selected = state.selections?.[step.key];
      if (!selected) return;

      let value = selected;
      if (step.options) {
        const opt = step.options.find((o) => o.value === selected);
        if (opt) value = opt.label ?? selected;
      }

      properties[propertyKey] = String(value);
    });

    return properties;
  }

  async function addToCart() {
    if (!isConfigurationComplete()) {
      alert(
        "Bitte vervollständigen Sie alle Schritte vor dem Hinzufügen zum Warenkorb",
      );
      return;
    }

    const addToCartBtn = document.querySelector(".add-to-cart-btn");
    if (addToCartBtn) {
      addToCartBtn.disabled = true;
      addToCartBtn.innerHTML =
        '<span style="display: inline-block; animation: spin 1s linear infinite;">⌛</span> Produkt wird erstellt...';
    }

    try {
      const finalPrice = await calculatePrice(
        PRODUCT_ID,
        state.selections,
        state.measurements,
        1,
      );

      const baseProductTitle =
        PRODUCT_CONFIG.product.name || "Configured Product";

      let productImage = null;
      const el = document.querySelector(".zoom-thumb");
      const imgUrl = el.dataset.url;

      if (state.selections) {
        for (const [stepKey, selectedValue] of Object.entries(
          state.selections,
        )) {
          const step = PRODUCT_CONFIG.steps.find((s) => s.key === stepKey);
          if (step && step.options) {
            const option = step.options.find((o) => o.value === selectedValue);
            if (option && option.image) {
              productImage = option.image;
              break;
            }
          }
        }
      }

      const createResponse = await fetch("/apps/cartApi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: PRODUCT_ID,
          selections: state.selections,
          measurements: state.measurements,
          quantity: state.menge,
          calculatedPrice: finalPrice,
          baseProductTitle: baseProductTitle,
          productImage: imgUrl,
        }),
      });

      const createData = await createResponse.json();

      if (!createData.success) {
        throw new Error(createData.error || "Failed to create product");
      }

      let variantId = createData.shopifyProduct.variantId;
      if (variantId.includes("gid://")) {
        variantId = variantId.split("/").pop();
      }

      const fullURL = window.location.href;
      const params = new URLSearchParams(window.location.search);
      const colorFromURL = params.get("color");

      await new Promise((resolve) => setTimeout(resolve, 5000));

      const cartResponse = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: variantId,
              quantity: state.menge,
              properties: {
                ...buildShopifyLineItemProperties(),
                ...(colorFromURL ? { color: colorFromURL } : {}),
                _url: fullURL,
              },
            },
          ],
        }),
      });

      if (!cartResponse.ok) {
        const errorText = await cartResponse.text();
        throw new Error(`Failed to add to cart: ${errorText}`);
      }

      const cartResult = await cartResponse.json();
      showSuccessMessage(createData.shopifyProduct.title);

      setTimeout(() => {
        window.location.href = "/cart";
      }, 1500);
    } catch (error) {
      console.error("Add to Cart Error:", error);
      alert(`Fehler: ${error.message}`);

      if (addToCartBtn) {
        addToCartBtn.disabled = false;
        addToCartBtn.innerHTML = "IN DEN WARENKORB";
      }
    }
  }

  // UPDATED: Check for flügel field if present
  function isConfigurationComplete() {
    const requiredSteps =
      activeFlow.length > 0
        ? activeFlow
        : PRODUCT_CONFIG.steps.map((s) => s.key);

    for (const stepKey of requiredSteps) {
      const step = PRODUCT_CONFIG.steps.find((s) => s.key === stepKey);
      if (!step) continue;

      if (step.type === "options" || step.type === "dropdown") {
        if (!state.selections[stepKey]) return false;
      }

      if (step.type === "measurement") {
        if (!state.measurements.breite || !state.measurements.hoehe)
          return false;

        // Check if flügel is required (when measurement step has flügel)
        const hasFlugelField =
          step.measurementMode &&
          step.measurementMode.toUpperCase() === "FLUGEL";
        if (hasFlugelField && !state.measurements.flugel) return false;
      }
    }

    return true;
  }

  function showSuccessMessage(productTitle) {
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #4CAF50;
            color: white; padding: 20px 30px; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000;
            animation: slideIn 0.3s ease-out; max-width: 400px;
        `;
    notification.innerHTML = `
            <h3 style="margin: 0 0 10px 0; font-size: 18px;">✓ Produkt erstellt!</h3>
            <p style="margin: 0; font-size: 14px;">${productTitle}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Wird zum Warenkorb hinzugefügt...</p>
        `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  document
    .querySelector(".add-to-cart-btn")
    ?.addEventListener("click", addToCart);
});

document.querySelector(".zoom-thumb")?.addEventListener("mousemove", (e) => {
  const preview = document.querySelector(".zoom-preview");
  const rect = e.target.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  preview.style.backgroundPosition = `${x}% ${y}%`;
});
