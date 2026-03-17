/* ─── Kitchen Pro SPA – app.js ─────────────────────────────────────────────
   Single-page application logic for Kitchen Pro.
   Pages: Dashboard, Recipes, Inventory, Suggestions
───────────────────────────────────────────────────────────────────────────── */

const API = "";   // relative, same origin
let allIngredients = [];
let allCategories  = [];
let chartCategories = null;
let chartTopRecipes = null;

// --- Auth State ---
let currentRole = "admin";
let currentUser = null;

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════════════════ */

const PAGE_CONFIG = {
  dashboard:   { title: "Dashboard",  subtitle: "Today's kitchen overview",     search: false, action: null },
  recipes:     { title: "Recipes",    subtitle: "Manage your recipe library",   search: true,  action: "addRecipe",     actionLabel: "+ Add Recipe" },
  inventory:   { title: "Inventory",  subtitle: "Track ingredient stock levels",search: true,  action: "addIngredient", actionLabel: "+ Add Ingredient" },
  suggestions: { title: "Suggestions",subtitle: "AI-optimized recipe picks",    search: false, action: null },
  rating:      { title: "Recipe Ratings", subtitle: "Provide quality feedback", search: false, action: null },
  "check-quality": { title: "Quality Check", subtitle: "AI image analysis for food safety", search: false, action: null },
  "nearby-restaurants": { title: "Nearby Restaurants", subtitle: "Explore local culinary partners", search: false, action: null },
};

function navigateTo(page) {
  // Update nav
  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.page === page);
  });

  // Update pages
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const el = document.getElementById(`page-${page}`);
  if (el) { el.classList.add("active"); }

  // Update topbar
  const cfg = PAGE_CONFIG[page] || {};
  document.getElementById("page-title").textContent = cfg.title || page;
  document.getElementById("page-subtitle").textContent = cfg.subtitle || "";

  const searchWrap = document.getElementById("global-search-wrap");
  const actionBtn  = document.getElementById("topbar-action-btn");
  const searchEl   = document.getElementById("global-search");

  if (cfg.search) {
    searchWrap.style.display = "flex";
    searchEl.value = "";
    searchEl.placeholder = `Search ${cfg.title.toLowerCase()}...`;
    searchEl.oninput = () => handleSearch(page, searchEl.value);
  } else {
    searchWrap.style.display = "none";
  }

  if (cfg.action) {
    actionBtn.style.display = "flex";
    actionBtn.textContent = cfg.actionLabel;
    actionBtn.onclick = window[cfg.action];
  } else {
    actionBtn.style.display = "none";
  }

  // Load data
  if (page === "dashboard")   loadDashboard();
  if (page === "recipes")     loadRecipes();
  if (page === "inventory")   loadInventory();
  if (page === "suggestions") loadSuggestions();
  if (page === "rating")      loadRating();
  if (page === "check-quality") loadCheckQuality();
  if (page === "nearby-restaurants") loadNearbyRestaurants();
}

function handleSearch(page, q) {
  if (page === "recipes")   loadRecipes(q);
  if (page === "inventory") loadInventory(q);
}

// Nav click handlers
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", e => {
    e.preventDefault();
    navigateTo(item.dataset.page);
  });
});

// Dashboard alert links
function setupAlertLinks() {
  document.querySelectorAll("[data-page]").forEach(el => {
    if (!el.classList.contains("nav-item")) {
      el.addEventListener("click", e => {
        e.preventDefault();
        navigateTo(el.dataset.page || "inventory");
      });
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLOCK
═══════════════════════════════════════════════════════════════════════════ */
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  document.getElementById("topbar-time").textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

/* ═══════════════════════════════════════════════════════════════════════════
   API HELPERS
═══════════════════════════════════════════════════════════════════════════ */
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
    throw err;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════════════════ */
async function loadDashboard() {
  const data = await apiFetch("/api/analytics");

  // KPIs
  animateNumber("kpi-total-recipes", data.total_recipes);
  animateNumber("kpi-low-stock", data.low_stock_count);
  animateNumber("kpi-avg-quality", data.avg_quality, 1);
  animateNumber("kpi-avg-consistency", data.avg_consistency, 1);
  animateNumber("kpi-stock-value", data.total_stock_value, 0, "$");
  animateNumber("kpi-total-ingredients", data.total_ingredients);

  const critBadge = document.getElementById("kpi-critical-badge");
  if (data.critical_stock_count > 0) {
    critBadge.textContent = `${data.critical_stock_count} critical`;
    critBadge.className = "kpi-trend down";
  } else {
    critBadge.textContent = "All good";
    critBadge.className = "kpi-trend up";
  }

  // Charts
  renderCategoryChart(data.category_breakdown);
  renderTopRecipesChart(data.top_recipes);

  // Low stock alerts
  const list = document.getElementById("low-stock-list");
  if (data.low_stock_items.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><h3>All stocked up!</h3><p>No low-stock items right now.</p></div>`;
  } else {
    list.innerHTML = data.low_stock_items.map(i => `
      <div class="alert-row ${i.status === 'critical' ? 'critical' : ''}">
        <span style="font-size:16px">${i.status === 'critical' ? '🔴' : '🟡'}</span>
        <span class="alert-ing-name">${i.name}</span>
        <span class="alert-stock">${i.stock_qty} ${i.unit} / ${i.reorder_level} reorder</span>
        <span class="status-badge ${i.status}">${i.status}</span>
      </div>
    `).join("");
  }
}

function animateNumber(id, target, decimals = 0, prefix = "") {
  const el = document.getElementById(id);
  if (!el) return;
  const start = 0;
  const duration = 800;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;
    el.textContent = prefix + (decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString());
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderCategoryChart(breakdown) {
  const ctx = document.getElementById("chart-categories").getContext("2d");
  const filtered = breakdown.filter(c => c.count > 0);
  const palette = [
    "#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444","#06b6d4","#ec4899","#f97316"
  ];

  if (chartCategories) chartCategories.destroy();
  chartCategories = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: filtered.map(c => c.name),
      datasets: [{
        data: filtered.map(c => c.count),
        backgroundColor: palette.slice(0, filtered.length),
        borderColor: "#1e2340",
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#8892b0", font: { size: 11 }, padding: 12, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: "#1e2340",
          titleColor: "#f0f2ff",
          bodyColor: "#8892b0",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
        }
      },
      cutout: "65%",
    }
  });
}

function renderTopRecipesChart(recipes) {
  const ctx = document.getElementById("chart-top-recipes").getContext("2d");
  if (chartTopRecipes) chartTopRecipes.destroy();
  chartTopRecipes = new Chart(ctx, {
    type: "bar",
    data: {
      labels: recipes.map(r => r.name.length > 22 ? r.name.substring(0, 22) + "…" : r.name),
      datasets: [
        {
          label: "Quality",
          data: recipes.map(r => r.quality_score),
          backgroundColor: "rgba(245,158,11,0.8)",
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: "Consistency",
          data: recipes.map(r => r.consistency_rating),
          backgroundColor: "rgba(59,130,246,0.7)",
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#8892b0", font: { size: 11 } },
        },
        y: {
          min: 0, max: 10,
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#8892b0", font: { size: 11 } },
        }
      },
      plugins: {
        legend: {
          labels: { color: "#8892b0", font: { size: 11 }, padding: 12, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: "#1e2340",
          titleColor: "#f0f2ff",
          bodyColor: "#8892b0",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
        }
      },
      barThickness: 28,
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   RECIPES PAGE
═══════════════════════════════════════════════════════════════════════════ */
let allRecipes = [];
let activeCategoryFilter = "";
let activeSort = "name";

async function loadRecipes(search = "") {
  let url = "/api/recipes?q=" + encodeURIComponent(search);
  if (activeCategoryFilter) url += "&category_id=" + activeCategoryFilter;
  allRecipes = await apiFetch(url);
  renderRecipeGrid(sortRecipes(allRecipes));
  buildCategoryPills();
}

function sortRecipes(recipes) {
  const sorted = [...recipes];
  if (activeSort === "quality")      sorted.sort((a, b) => b.quality_score - a.quality_score);
  else if (activeSort === "consistency") sorted.sort((a, b) => b.consistency_rating - a.consistency_rating);
  else if (activeSort === "time")    sorted.sort((a, b) => (a.prep_time + a.cook_time) - (b.prep_time + b.cook_time));
  else sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}

document.getElementById("recipe-sort").addEventListener("change", e => {
  activeSort = e.target.value;
  renderRecipeGrid(sortRecipes(allRecipes));
});

function renderRecipeGrid(recipes) {
  const grid = document.getElementById("recipe-grid");
  if (recipes.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No recipes found</h3><p>Try adjusting filters or add a new recipe.</p></div>`;
    return;
  }
  grid.innerHTML = recipes.map(r => recipeCard(r)).join("");
}

function recipeCard(r) {
  const ings = (r.ingredients || []).slice(0, 4);
  const extra = (r.ingredients || []).length - 4;
  const qualColor = r.quality_score >= 9 ? "#10b981" : r.quality_score >= 7 ? "#f59e0b" : "#ef4444";
  return `
    <div class="recipe-card" id="recipe-card-${r.id}">
      <div class="recipe-card-header">
        <div class="recipe-card-name">${escHtml(r.name)}</div>
        <span class="recipe-card-cat">${escHtml(r.category)}</span>
      </div>
      <div class="recipe-scores">
        <div class="score-chip quality">⭐ ${r.quality_score.toFixed(1)}</div>
        <div class="score-chip consistency">🎯 ${r.consistency_rating.toFixed(1)}</div>
      </div>
      <div class="recipe-meta">
        <span class="meta-item">🕐 ${r.prep_time + r.cook_time} min</span>
        <span class="meta-item">👤 ${r.servings} serves</span>
      </div>
      <div class="recipe-ing-preview">
        ${ings.map(i => `<span class="ing-tag">${escHtml(i.ingredient_name)}</span>`).join("")}
        ${extra > 0 ? `<span class="ing-tag">+${extra} more</span>` : ""}
      </div>
      <div class="recipe-card-actions">
        <button class="btn btn-ghost small" onclick="editRecipe(${r.id})">✏️ Edit</button>
        <button class="btn btn-danger small" onclick="deleteRecipe(${r.id}, '${escJs(r.name)}')">🗑️ Delete</button>
      </div>
    </div>
  `;
}

function buildCategoryPills() {
  const wrap = document.getElementById("recipe-category-pills");
  const cats = [...new Set(allRecipes.map(r => r.category))].filter(Boolean);
  wrap.innerHTML = `<button class="pill ${!activeCategoryFilter ? 'active' : ''}" data-cat="" onclick="filterRecipesByCategory('')">All</button>`;
  cats.forEach(cat => {
    const id = allCategories.find(c => c.name === cat)?.id || "";
    wrap.innerHTML += `<button class="pill ${activeCategoryFilter == id ? 'active' : ''}" data-cat="${id}" onclick="filterRecipesByCategory('${id}')">${cat}</button>`;
  });
}

function filterRecipesByCategory(catId) {
  activeCategoryFilter = catId;
  loadRecipes(document.getElementById("global-search")?.value || "");
}

// Add Recipe
async function addRecipe() {
  await ensureCategoriesLoaded();
  await ensureIngredientsLoaded();
  populateRecipeModal(null);
  openModal("recipe-modal");
}

// Edit Recipe
async function editRecipe(id) {
  await ensureCategoriesLoaded();
  await ensureIngredientsLoaded();
  const r = await apiFetch(`/api/recipes/${id}`);
  populateRecipeModal(r);
  openModal("recipe-modal");
}

function populateRecipeModal(r) {
  const isEdit = r !== null;
  document.getElementById("recipe-modal-title").textContent = isEdit ? "Edit Recipe" : "Add Recipe";
  document.getElementById("rf-id").value = isEdit ? r.id : "";
  document.getElementById("rf-name").value = isEdit ? r.name : "";
  document.getElementById("rf-prep").value = isEdit ? r.prep_time : 15;
  document.getElementById("rf-cook").value = isEdit ? r.cook_time : 30;
  document.getElementById("rf-servings").value = isEdit ? r.servings : 4;
  document.getElementById("rf-quality").value = isEdit ? r.quality_score : 8.0;
  document.getElementById("rf-consistency").value = isEdit ? r.consistency_rating : 8.0;
  document.getElementById("rf-instructions").value = isEdit ? r.instructions : "";

  // Categories
  const catSel = document.getElementById("rf-category");
  catSel.innerHTML = `<option value="">-- Select Category --</option>` +
    allCategories.map(c => `<option value="${c.id}" ${isEdit && r.category_id == c.id ? 'selected' : ''}>${c.name}</option>`).join("");

  // Ingredient rows
  const list = document.getElementById("rf-ingredients-list");
  list.innerHTML = "";
  if (isEdit && r.ingredients) {
    r.ingredients.forEach(ri => addIngredientRow(ri.ingredient_id, ri.quantity_needed));
  } else {
    addIngredientRow();
  }
}

function addIngredientRow(selectedId = "", qty = "") {
  const list = document.getElementById("rf-ingredients-list");
  const row = document.createElement("div");
  row.className = "ing-row";
  row.innerHTML = `
    <select class="ing-select">
      <option value="">-- Select Ingredient --</option>
      ${allIngredients.map(i => `<option value="${i.id}" ${i.id == selectedId ? 'selected' : ''}>${i.name} (${i.unit})</option>`).join("")}
    </select>
    <input type="number" class="ing-qty" placeholder="Qty" min="0" step="0.01" value="${qty}" />
    <button class="ing-remove" onclick="this.parentElement.remove()">✕</button>
  `;
  list.appendChild(row);
}

async function submitRecipeForm() {
  const id = document.getElementById("rf-id").value;
  const rows = document.querySelectorAll("#rf-ingredients-list .ing-row");
  const ingredients = [];
  rows.forEach(row => {
    const ingId = row.querySelector(".ing-select").value;
    const qty   = row.querySelector(".ing-qty").value;
    if (ingId && qty) ingredients.push({ ingredient_id: ingId, quantity_needed: qty });
  });

  const payload = {
    name: document.getElementById("rf-name").value,
    category_id: document.getElementById("rf-category").value || null,
    prep_time: document.getElementById("rf-prep").value,
    cook_time: document.getElementById("rf-cook").value,
    servings: document.getElementById("rf-servings").value,
    quality_score: document.getElementById("rf-quality").value,
    consistency_rating: document.getElementById("rf-consistency").value,
    instructions: document.getElementById("rf-instructions").value,
    ingredients,
  };

  if (!payload.name) { showToast("Recipe name is required.", "error"); return; }

  try {
    if (id) {
      await apiFetch(`/api/recipes/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Recipe updated! ✓", "success");
    } else {
      await apiFetch("/api/recipes", { method: "POST", body: JSON.stringify(payload) });
      showToast("Recipe added! ✓", "success");
    }
    closeModal("recipe-modal");
    loadRecipes();
  } catch (e) {}
}

async function deleteRecipe(id, name) {
  if (!confirm(`Archive recipe "${name}"?`)) return;
  await apiFetch(`/api/recipes/${id}`, { method: "DELETE" });
  showToast(`"${name}" archived.`, "warning");
  loadRecipes();
}

/* ═══════════════════════════════════════════════════════════════════════════
   INVENTORY PAGE
═══════════════════════════════════════════════════════════════════════════ */
let allInventory = [];
let invCatFilter = "";
let invStatusFilter = "";

async function loadInventory(search = "") {
  allInventory = await apiFetch("/api/ingredients?q=" + encodeURIComponent(search));
  renderInventoryTable(filterInventory(allInventory));
  buildInvCategoryPills();
}

function filterInventory(items) {
  let filtered = items;
  if (invCatFilter) filtered = filtered.filter(i => i.category === invCatFilter);
  if (invStatusFilter) filtered = filtered.filter(i => i.status === invStatusFilter);
  return filtered;
}

document.getElementById("inv-status-filter").addEventListener("change", e => {
  invStatusFilter = e.target.value;
  renderInventoryTable(filterInventory(allInventory));
});

function renderInventoryTable(items) {
  const tbody = document.getElementById("inventory-tbody");
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted)">No ingredients found.</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(i => stockRow(i)).join("");
}

function stockRow(i) {
  const pct = Math.min((i.stock_qty / Math.max(i.reorder_level * 2, 1)) * 100, 100);
  return `
    <tr>
      <td><strong>${escHtml(i.name)}</strong></td>
      <td style="color:var(--text-secondary)">${escHtml(i.category)}</td>
      <td>
        <div class="stock-bar-wrap">
          <div class="stock-bar">
            <div class="stock-bar-fill ${i.status}" style="width:${pct.toFixed(1)}%"></div>
          </div>
          <span class="stock-val">${i.stock_qty}</span>
        </div>
      </td>
      <td style="color:var(--text-muted)">${escHtml(i.unit)}</td>
      <td style="color:var(--text-secondary)">${i.reorder_level}</td>
      <td style="font-family:var(--mono);font-size:12px;color:var(--text-secondary)">$${i.cost_per_unit.toFixed(3)}</td>
      <td><span class="status-badge ${i.status}">${statusIcon(i.status)} ${i.status}</span></td>
      <td>
        <button class="btn btn-ghost small" onclick="editInventory(${i.id})">✏️ Edit</button>
      </td>
    </tr>
  `;
}

function statusIcon(s) { return s === "ok" ? "✓" : s === "low" ? "⚠" : "🔴"; }

function buildInvCategoryPills() {
  const wrap = document.getElementById("inv-category-pills");
  const cats = [...new Set(allInventory.map(i => i.category))].filter(Boolean).sort();
  wrap.innerHTML = `<button class="pill ${!invCatFilter ? 'active' : ''}" onclick="filterInvByCategory('')">All</button>`;
  cats.forEach(c => {
    wrap.innerHTML += `<button class="pill ${invCatFilter === c ? 'active' : ''}" onclick="filterInvByCategory('${c}')">${c}</button>`;
  });
}

function filterInvByCategory(cat) {
  invCatFilter = cat;
  document.querySelectorAll("#inv-category-pills .pill").forEach(p => {
    p.classList.toggle("active", (p.textContent.trim() === (cat || "All")));
  });
  renderInventoryTable(filterInventory(allInventory));
}

async function editInventory(id) {
  const item = allInventory.find(i => i.id === id);
  if (!item) return;
  document.getElementById("if-id").value = id;
  document.getElementById("if-name").value = item.name;
  document.getElementById("if-stock").value = item.stock_qty;
  document.getElementById("if-reorder").value = item.reorder_level;
  document.getElementById("if-cost").value = item.cost_per_unit;
  openModal("inventory-modal");
}

async function submitInventoryForm() {
  const id = document.getElementById("if-id").value;
  const payload = {
    stock_qty:    document.getElementById("if-stock").value,
    reorder_level: document.getElementById("if-reorder").value,
    cost_per_unit: document.getElementById("if-cost").value,
  };
  try {
    await apiFetch(`/api/ingredients/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    showToast("Stock updated! ✓", "success");
    closeModal("inventory-modal");
    loadInventory(document.getElementById("global-search")?.value || "");
  } catch(e) {}
}

// Add Ingredient
async function addIngredient() {
  document.getElementById("add-ingredient-form").reset();
  openModal("add-ingredient-modal");
}

async function submitAddIngredient() {
  const payload = {
    name:          document.getElementById("ai-name").value,
    unit:          document.getElementById("ai-unit").value,
    category:      document.getElementById("ai-category").value,
    stock_qty:     document.getElementById("ai-stock").value,
    reorder_level: document.getElementById("ai-reorder").value,
    cost_per_unit: document.getElementById("ai-cost").value,
  };
  if (!payload.name) { showToast("Name is required.", "error"); return; }
  try {
    await apiFetch("/api/ingredients", { method: "POST", body: JSON.stringify(payload) });
    showToast("Ingredient added! ✓", "success");
    closeModal("add-ingredient-modal");
    allIngredients = await apiFetch("/api/ingredients");
    loadInventory();
  } catch(e) {}
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUGGESTIONS PAGE
═══════════════════════════════════════════════════════════════════════════ */
async function loadSuggestions() {
  const suggestions = await apiFetch("/api/suggest");
  const grid = document.getElementById("suggestion-grid");
  if (suggestions.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">✨</div><h3>No recipes yet</h3><p>Add recipes to see suggestions.</p></div>`;
    return;
  }
  grid.innerHTML = suggestions.map((r, idx) => suggestionCard(r, idx + 1)).join("");
  // Animate bars
  requestAnimationFrame(() => {
    suggestions.forEach((r, idx) => {
      const bar = document.getElementById(`comp-bar-${r.id}`);
      if (bar) bar.style.width = ((r.composite_score / 10) * 100).toFixed(1) + "%";
    });
  });
}

function suggestionCard(r, rank) {
  const canMake = r.can_make;
  const avail = (r.availability_ratio * 10).toFixed(1);
  return `
    <div class="suggestion-card ${canMake ? 'can-make' : ''}" id="sug-${r.id}">
      <div class="sug-rank">#${rank}</div>
      <div class="sug-name">${escHtml(r.name)}</div>

      <div class="composite-score">
        <div>
          <div class="composite-label">Composite</div>
          <div class="composite-value">${r.composite_score}</div>
        </div>
        <div class="composite-bar-wrap">
          <div class="composite-bar" id="comp-bar-${r.id}" style="width:0%"></div>
        </div>
      </div>

      <div class="sug-score-grid">
        <div class="sug-score-item">
          <div class="sug-score-label">Quality</div>
          <div class="sug-score-val sug-quality">${r.quality_score.toFixed(1)}</div>
        </div>
        <div class="sug-score-item">
          <div class="sug-score-label">Consistency</div>
          <div class="sug-score-val sug-consistency">${r.consistency_rating.toFixed(1)}</div>
        </div>
        <div class="sug-score-item">
          <div class="sug-score-label">Availability</div>
          <div class="sug-score-val sug-availability">${avail}</div>
        </div>
      </div>

      ${r.missing_ingredients.length > 0 ? `
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">Missing Ingredients</div>
          <div class="missing-list">
            ${r.missing_ingredients.map(m => `<span class="missing-tag">${escHtml(m)}</span>`).join("")}
          </div>
        </div>
      ` : ""}

      <div class="sug-status">
        ${canMake
          ? `<span style="color:var(--green)">✅ Ready to cook</span>`
          : `<span style="color:var(--accent)">⚠️ ${r.missing_ingredients.length} item(s) needed</span>`
        }
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL HELPERS
═══════════════════════════════════════════════════════════════════════════ */
function openModal(id) {
  document.getElementById(id).classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  document.body.style.overflow = "";
}

// Close on overlay click
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
═══════════════════════════════════════════════════════════════════════════ */
function showToast(msg, type = "info") {
  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const c = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${msg}</span>`;
  c.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(24px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════════════════════════ */
function escHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escJs(str) {
  return String(str || "").replace(/'/g, "\\'");
}

async function ensureCategoriesLoaded() {
  if (allCategories.length === 0) {
    allCategories = await apiFetch("/api/categories");
  }
}

async function ensureIngredientsLoaded() {
  if (allIngredients.length === 0) {
    allIngredients = await apiFetch("/api/ingredients");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUTHENTICATION LOGIC
═══════════════════════════════════════════════════════════════════════════ */

function initAuth() {
  const tabs = document.querySelectorAll(".auth-tab");
  const authForm = document.getElementById("auth-form");
  const authError = document.getElementById("auth-error");
  const logoutBtn = document.getElementById("logout-btn");
  
  const fieldName = document.getElementById("field-name");
  const fieldConfirm = document.getElementById("field-confirm");
  const labelPass = document.getElementById("label-pass");
  const btnAuth = authForm.querySelector(".auth-btn");

  let authMode = "login"; // login | signup

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      authMode = tab.dataset.type;
      currentRole = tab.dataset.role;
      
      const userField = document.getElementById("auth-user");
      const passField = document.getElementById("auth-pass");
      
      // Toggle fields visibility
      if (authMode === "signup") {
        fieldName.style.display = "block";
        fieldConfirm.style.display = "block";
        labelPass.textContent = "Create Password";
        passField.placeholder = "Min 6 chars";
        btnAuth.textContent = "Sign Up";
        userField.placeholder = "you@example.com";
      } else {
        fieldName.style.display = "none";
        fieldConfirm.style.display = "none";
        labelPass.textContent = "Password";
        passField.placeholder = "••••••••";
        btnAuth.textContent = "Login";
        userField.placeholder = currentRole === "admin" ? "admin@kitchen.com" : "customer@kitchen.com";
      }
      
      authError.style.display = "none";
    });
  });

  authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-user").value.trim();
    const pass = document.getElementById("auth-pass").value;
    const remember = document.getElementById("auth-remember").checked;

    if (authMode === "signup") {
      handleSignUp(email, pass);
    } else {
      handleLogin(email, pass, remember);
    }
  });

  logoutBtn.addEventListener("click", logout);
}

function handleSignUp(email, pass) {
  const name = document.getElementById("auth-name").value.trim();
  const confirm = document.getElementById("auth-confirm").value;
  const authError = document.getElementById("auth-error");

  if (!name || !email || !pass) {
    showAuthError("Please fill all fields.");
    return;
  }
  if (pass !== confirm) {
    showAuthError("Passwords do not match.");
    return;
  }

  const users = JSON.parse(localStorage.getItem("kitchen_users") || "[]");
  if (users.some(u => u.email === email)) {
    showAuthError("Email already registered.");
    return;
  }

  const newUser = { name, email, password: pass, role: "customer" };
  users.push(newUser);
  localStorage.setItem("kitchen_users", JSON.stringify(users));

  showToast("Registration successful! Please login.", "success");
  document.getElementById("tab-login-customer").click();
}

function handleLogin(email, pass, remember) {
  // 1. Check Admin Static
  if (currentRole === "admin") {
    if (email === "admin@kitchen.com" && pass === "admin123") {
      doLogin(email, "admin", "Admin User", remember);
      return;
    }
  } else {
    // 2. Check Customer Static Defaults
    const defaults = [
      { email: "customer@kitchen.com", pass: "customer123", name: "Default Customer" },
      { email: "user@kitchen.com", pass: "user123", name: "Kitchen User" }
    ];
    
    const foundDefault = defaults.find(d => d.email === email && d.pass === pass);
    if (foundDefault) {
      doLogin(email, "customer", foundDefault.name, remember);
      return;
    }

    // 3. Check Signed Up Users
    const users = JSON.parse(localStorage.getItem("kitchen_users") || "[]");
    const foundUser = users.find(u => u.email === email && u.password === pass);
    if (foundUser) {
      doLogin(email, "customer", foundUser.name, remember);
      return;
    }
  }

  showAuthError("Invalid credentials.");
}

function doLogin(email, role, name, remember) {
  currentUser = { email, role, name };
  if (remember) localStorage.setItem("kitchen_pro_session", JSON.stringify(currentUser));
  loginSuccess();
}

function showAuthError(msg) {
  const authError = document.getElementById("auth-error");
  authError.textContent = msg;
  authError.style.display = "block";
  setTimeout(() => { authError.style.display = "none"; }, 3000);
}

async function loginSuccess() {
  document.body.classList.remove("not-logged-in");
  document.body.classList.add("logged-in");
  
  // Fetch navigation items from backend API based on role
  try {
    const navPages = await apiFetch(`/api/nav/pages?role=${currentUser.role}`);
    const sidebarNav = document.querySelector(".sidebar-nav");
    sidebarNav.innerHTML = navPages.map(p => `
      <a href="#" class="nav-item" data-page="${p.key}" id="nav-${p.key}">
        <span class="nav-icon">${p.icon}</span>
        <span class="nav-label">${p.title}</span>
      </a>
    `).join("");
    
    // Re-attach click handlers to new nav items
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", e => {
        e.preventDefault();
        navigateTo(item.dataset.page);
      });
    });
    
    // Update PAGE_CONFIG dynamically from backend data
    navPages.forEach(p => {
      PAGE_CONFIG[p.key] = {
        title: p.title,
        subtitle: p.subtitle,
        search: p.search,
        action: p.action || null,
        actionLabel: p.actionLabel || null
      };
    });
  } catch(e) {
    // Fallback to static visibility if API fails
    const isCustomer = currentUser.role === "customer";
    document.getElementById("nav-inventory").style.display = isCustomer ? "none" : "flex";
    document.getElementById("nav-rating").style.display = isCustomer ? "flex" : "none";
    document.getElementById("nav-check-quality").style.display = "flex";
    document.getElementById("nav-nearby-restaurants").style.display = "flex";
  }

  showToast(`Welcome back, ${currentUser.name}! ✓`, "success");
  navigateTo("nearby-restaurants");
}

async function loadRating() {
  const recipes = await apiFetch("/api/recipes");
  const grid = document.getElementById("rating-recipe-grid");
  if (recipes.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⭐</div><h3>No recipes to rate</h3></div>`;
    return;
  }
  grid.innerHTML = recipes.map(r => `
    <div class="recipe-card">
      <div class="recipe-card-header">
        <div class="recipe-card-name">${escHtml(r.name)}</div>
        <span class="recipe-card-cat">${escHtml(r.category)}</span>
      </div>
      <div class="recipe-scores" style="margin: 12px 0;">
        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Rate this recipe (0-10)</div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="number" class="rating-input" id="rate-${r.id}" min="0" max="10" step="0.1" value="8.0" style="width: 70px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px 8px; border-radius: 4px;">
          <button class="btn btn-primary small" onclick="submitRating(${r.id})">Submit Rating</button>
        </div>
      </div>
    </div>
  `).join("");
}

async function submitRating(recipeId) {
  const score = document.getElementById(`rate-${recipeId}`).value;
  // In a real app, this would hit /api/feedback or similar
  showToast("Rating submitted! Thank you. ✓", "success");
}

function logout() {
  localStorage.removeItem("kitchen_pro_session");
  currentUser = null;
  document.body.classList.remove("logged-in");
  document.body.classList.add("not-logged-in");
  showToast("Logged out successfully.", "info");
}

function checkSession() {
  const session = localStorage.getItem("kitchen_pro_session");
  if (session) {
    currentUser = JSON.parse(session);
    currentRole = currentUser.role;
    loginSuccess();
  } else {
    document.body.classList.add("not-logged-in");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════════════════ */
async function loadCheckQuality() {
  const input = document.getElementById("food-image-input");
  const dropZone = document.getElementById("drop-zone");
  
  if (!input.dataset.initialized) {
    input.addEventListener("change", (e) => handleImageSelect(e.target.files[0]));
    
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "var(--primary)";
    });
    
    dropZone.addEventListener("dragleave", () => {
      dropZone.style.borderColor = "rgba(255,255,255,0.1)";
    });
    
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      handleImageSelect(e.dataTransfer.files[0]);
    });
    
    input.dataset.initialized = "true";
  }
}

function handleImageSelect(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("food-preview").src = e.target.result;
    document.getElementById("image-preview-wrap").style.display = "block";
    document.getElementById("drop-zone").style.display = "none";
    runMockAnalysis();
  };
  reader.readAsDataURL(file);
}

function resetUpload() {
  document.getElementById("food-image-input").value = "";
  document.getElementById("image-preview-wrap").style.display = "none";
  document.getElementById("drop-zone").style.display = "block";
  document.getElementById("analysis-results").style.display = "none";
}

function runMockAnalysis() {
  const results = document.getElementById("analysis-results");
  results.style.display = "block";
  results.style.opacity = "0.5";
  document.getElementById("analysis-details").textContent = "Analyzing texture patterns and color distributions...";

  setTimeout(() => {
    results.style.opacity = "1";
    document.getElementById("val-freshness").textContent = (Math.random() * 2 + 8).toFixed(1) + "/10";
    document.getElementById("val-safety").textContent = "Passed 🛡️";
    document.getElementById("val-risk").textContent = "Minimal";
    document.getElementById("analysis-details").textContent = "Visual indicators suggest optimal freshness and no signs of bacterial oxidation. Recommended for immediate use or storage at < 4°C.";
    showToast("Analysis Complete! ✓", "success");
  }, 1500);
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════════════════ */
(async function init() {
  initAuth();
  checkSession();
  
  // Pre-load supporting data
  [allCategories, allIngredients] = await Promise.all([
    apiFetch("/api/categories").catch(() => []),
    apiFetch("/api/ingredients").catch(() => []),
  ]);
  
  if (currentUser) navigateTo("nearby-restaurants");
})();

let activeCountryFilter = "All";

async function loadNearbyRestaurants(filteredList) {
  const grid = document.getElementById("restaurant-grid");
  if (!grid) return;

  let restaurants;
  if (filteredList) {
    restaurants = filteredList;
  } else {
    try {
      let url = API + "/api/restaurants";
      const params = [];
      if (activeCountryFilter && activeCountryFilter !== "All") params.push("country=" + encodeURIComponent(activeCountryFilter));
      if (params.length) url += "?" + params.join("&");
      const res = await fetch(url);
      restaurants = await res.json();
    } catch (e) {
      console.error("Failed to fetch restaurants:", e);
      grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">Could not load restaurants.</p>';
      return;
    }
  }

  window.lastRestaurants = restaurants;

  // Load countries dropdown
  loadCountryFilter();

  grid.innerHTML = restaurants.length === 0
    ? '<p style="color:var(--text-muted);text-align:center;padding:40px;">No restaurants match your filter.</p>'
    : restaurants.map(r => `
    <div class="restaurant-card">
      <img src="${r.img || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80'}" alt="${escHtml(r.name)}" class="restaurant-img" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80'">
      <div class="restaurant-content">
        <div class="restaurant-header">
          <div class="restaurant-name">${escHtml(r.name)}</div>
          <span class="restaurant-cuisine">${escHtml(r.cuisine)}</span>
        </div>
        <div class="restaurant-details">
          <div class="detail-item">🏷️ ${escHtml(r.type)}</div>
          <div class="detail-item">⭐ <span class="restaurant-rating">${r.rating}</span></div>
          <div class="detail-item">🌍 ${escHtml(r.country || '')}</div>
        </div>
        <div class="restaurant-footer">
          <div class="distance-badge">📍 ${r.distance || r.address}</div>
          <button class="btn btn-primary small" onclick="showRestaurantDetails(${r.id})">Open Profile</button>
        </div>
      </div>
    </div>
  `).join("");
}

async function loadCountryFilter() {
  const select = document.getElementById("country-filter");
  if (!select || select.options.length > 1) return;
  try {
    const countries = await apiFetch("/api/restaurants/countries");
    countries.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = `${c.name} (${c.count})`;
      select.appendChild(opt);
    });
  } catch(e) {}
}

function filterByCountry(country) {
  activeCountryFilter = country;
  // Reset map so it re-initializes with filtered data
  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
    mapMarkers = [];
  }
  loadNearbyRestaurants();
}

async function filterByCuisine(cuisine) {
  document.querySelectorAll(".res-nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.textContent === cuisine || (cuisine === "All" && btn.textContent === "All"));
  });

  try {
    let url = API + "/api/restaurants?";
    const params = [];
    if (cuisine !== "All") params.push("cuisine=" + encodeURIComponent(cuisine));
    if (activeCountryFilter && activeCountryFilter !== "All") params.push("country=" + encodeURIComponent(activeCountryFilter));
    url += params.join("&");
    const res = await fetch(url);
    const data = await res.json();
    // Reset map for new data
    if (leafletMap) { leafletMap.remove(); leafletMap = null; mapMarkers = []; }
    loadNearbyRestaurants(data);
  } catch (e) {
    console.error("Filter error:", e);
  }
}

async function searchRestaurants(query) {
  try {
    let url = API + "/api/restaurants?q=" + encodeURIComponent(query);
    if (activeCountryFilter && activeCountryFilter !== "All") url += "&country=" + encodeURIComponent(activeCountryFilter);
    const res = await fetch(url);
    const data = await res.json();
    if (leafletMap) { leafletMap.remove(); leafletMap = null; mapMarkers = []; }
    loadNearbyRestaurants(data);
  } catch (e) {
    console.error("Search error:", e);
  }
}

function showRestaurantDetails(id) {
  const r = window.lastRestaurants.find(item => item.id === id);
  if (!r) return;

  const title = document.getElementById("modal-res-title");
  const body = document.getElementById("restaurant-detail-body");
  
  title.textContent = r.name;
  body.innerHTML = `
    <div class="res-detail-header">
      <img src="${r.img}" alt="${escHtml(r.name)}" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80'">
      <div class="res-detail-overlay">
        <span class="res-detail-tag">Culinary Partner</span>
        <h1 style="color:#fff; font-size:32px; font-weight:800; text-shadow: 0 4px 12px rgba(0,0,0,0.5);">${escHtml(r.name)}</h1>
      </div>
    </div>
    
    <div class="res-detail-meta">
      <div class="meta-box">
        <div class="meta-label">Operating Hours</div>
        <div class="meta-value">${escHtml(r.hours)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Distance from Kitchen</div>
        <div class="meta-value">${escHtml(r.distance)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Safety Compliance</div>
        <div class="meta-value" style="color:var(--primary);">${escHtml(r.safety)}</div>
      </div>
    </div>
    
    <div class="section-card" style="background:rgba(255,255,255,0.02);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="margin:0;">Chef's Signature Selection</h3>
        <span style="font-family:var(--mono); color:var(--text-muted);">${r.price}</span>
      </div>
      <p style="color:var(--text-secondary); line-height:1.6; font-size:15px;">
        ${escHtml(r.specialty)}. All ingredients are verified through our AI Quality System to ensure maximum freshness and logistical optimization.
      </p>
      <div style="margin-top:24px; display:flex; gap:12px;">
        <button class="btn btn-primary" style="flex:1;" onclick="showToast('Initiating partner order...', 'success')">Order Ingredients</button>
        <button class="btn btn-ghost" style="flex:1;" onclick="showToast('Routing request sent to logistics.', 'info')">Request Logistics</button>
      </div>
    </div>
  `;
  
  openModal("modal-restaurant");
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEAFLET MAP – INTERACTIVE RESTAURANT EXPLORER
═══════════════════════════════════════════════════════════════════════════ */
let leafletMap = null;
let mapMarkers = [];

function getMarkerColor(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("fine")) return "#f59e0b";
  if (t.includes("casual") || t.includes("eco"))  return "#10b981";
  if (t.includes("fast"))  return "#ef4444";
  return "#3b82f6";
}

function createPulseIcon(color) {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        width: 18px; height: 18px;
        background: ${color};
        border-radius: 50%;
        border: 3px solid rgba(255,255,255,0.9);
        box-shadow: 0 0 12px ${color}88, 0 2px 8px rgba(0,0,0,0.4);
        position: relative;
      ">
        <div style="
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px solid ${color}44;
          animation: marker-pulse 2s ease-in-out infinite;
        "></div>
      </div>
      <style>
        @keyframes marker-pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.4); opacity: 0; }
        }
      </style>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -14]
  });
}

async function initRestaurantMap() {
  const container = document.getElementById('leaflet-map');
  if (!container) return;

  // If map already exists, just invalidate size (handles tab switching)
  if (leafletMap) {
    setTimeout(() => leafletMap.invalidateSize(), 200);
    return;
  }

  // Initialize map — world-view for global restaurants
  leafletMap = L.map('leaflet-map', {
    center: [20, 30],
    zoom: 2,
    zoomControl: true,
    attributionControl: true,
    minZoom: 2,
    worldCopyJump: true
  });

  // Dark-themed tile layer (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(leafletMap);

  // Fetch restaurants from backend API (with active filters)
  let restaurants;
  try {
    let url = API + "/api/restaurants";
    const params = [];
    if (activeCountryFilter && activeCountryFilter !== "All") params.push("country=" + encodeURIComponent(activeCountryFilter));
    if (params.length) url += "?" + params.join("&");
    const res = await fetch(url);
    restaurants = await res.json();
  } catch(e) {
    console.error('Failed to load restaurants for map:', e);
    return;
  }

  // Add markers
  const bounds = [];
  restaurants.forEach(r => {
    if (!r.lat || !r.lng) return;

    const color = getMarkerColor(r.type);
    const icon = createPulseIcon(color);
    const marker = L.marker([r.lat, r.lng], { icon })
      .addTo(leafletMap)
      .bindPopup(`
        <div class="map-popup-name">${escHtml(r.name)}</div>
        <div class="map-popup-cuisine">${escHtml(r.cuisine)} · ${escHtml(r.country || '')}</div>
        <div class="map-popup-row">
          <span>Rating</span>
          <span class="map-popup-val">⭐ ${r.rating}</span>
        </div>
        <div class="map-popup-row">
          <span>Country</span>
          <span class="map-popup-val">🌍 ${escHtml(r.country || '')}</span>
        </div>
        <div class="map-popup-row">
          <span>Type</span>
          <span class="map-popup-val">${escHtml(r.type)}</span>
        </div>
        <div class="map-popup-row">
          <span>Hours</span>
          <span class="map-popup-val">${escHtml(r.hours)}</span>
        </div>
        <div class="map-popup-row">
          <span>Safety</span>
          <span class="map-popup-val" style="color:#10b981;">${escHtml(r.safety)}</span>
        </div>
        <button class="map-popup-btn" onclick="showRestaurantDetails(${r.id})">View Full Profile →</button>
      `, { maxWidth: 280 });

    mapMarkers.push(marker);
    bounds.push([r.lat, r.lng]);
  });

  // Fit map to show all markers with padding
  if (bounds.length > 0) {
    leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }

  // Ensure tiles render correctly after tab animation
  setTimeout(() => leafletMap.invalidateSize(), 300);
}

function switchResTab(tab) {
  // Update Buttons
  document.querySelectorAll(".res-tab").forEach(btn => btn.classList.remove("active"));
  const activeBtn = Array.from(document.querySelectorAll(".res-tab")).find(b => b.textContent.toLowerCase().includes(tab));
  if (activeBtn) activeBtn.classList.add("active");

  // Update Views
  document.querySelectorAll(".res-view").forEach(v => v.classList.remove("active"));
  document.getElementById(`res-view-${tab}`).classList.add("active");

  // Initialize map when the Map tab is opened
  if (tab === "map") {
    setTimeout(() => initRestaurantMap(), 100);
  }
  if (tab === "deals") loadRestaurantDeals();
}

function loadRestaurantDeals() {
  const deals = [
    { title: "Bulk Spice Discount", vendor: "Spice Route", off: "15% OFF", desc: "Special rate on ethical Saffron & Cardamom for partner kitchens." },
    { title: "Priority Sushi Grade", vendor: "Sushi Zen", off: "24h Priority", desc: "Access to fresh Bluefin Tuna shipments before general market." },
    { title: "Bistro Wine Pairing", vendor: "Gourmet Bistro", off: "Exclusive", desc: "Weekly sommelier consultation for optimizing menu pairings." }
  ];

  const grid = document.getElementById("deals-grid");
  if (!grid) return;

  grid.innerHTML = deals.map(d => `
    <div class="deal-card">
      <span class="deal-badge">${d.off}</span>
      <h3 style="margin:0; font-size:16px;">${escHtml(d.title)}</h3>
      <div style="font-size:12px; color:var(--primary); font-weight:600;">${escHtml(d.vendor)}</div>
      <p style="font-size:13px; color:var(--text-secondary); line-height:1.5;">${escHtml(d.desc)}</p>
      <button class="btn btn-ghost small" style="margin-top:8px;" onclick="showToast('Applying deal to next procurement...', 'success')">Apply Deal</button>
    </div>
  `).join("");
}
