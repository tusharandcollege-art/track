/* ====================================================
   Hastkala – Rural Artisan Supply Chain, Dynamic Form Builder, Production & POS
   app.js — Complete Application Logic
   ==================================================== */

'use strict';

// ===================================================
// STATE & STORAGE CONSTANTS
// ===================================================
const DB_VILLAGES       = 'hastkala_villages';
const DB_ARTISANS       = 'hastkala_artisans';
const DB_RAW_MAT        = 'hastkala_raw_materials';
const DB_DISPATCHES     = 'hastkala_dispatches';
const DB_PRODUCTION     = 'hastkala_production';
const DB_PRODUCTS       = 'hastkala_products';
const DB_TXN            = 'hastkala_txn';
const DB_CUSTOM_FIELDS  = 'hastkala_custom_fields';

let state = {
  villages: [],
  artisans: [],
  rawMaterials: [],
  dispatches: [],
  productionLogs: [],
  products: [],
  transactions: [],
  customArtisanFields: [],
  cart: [],
  currentPage: 'home',
  artisanVillageFilter: 'all',
  analyticsPeriod: 'today',
  currentUser: null
};

// ===================================================
// FIREBASE AUTH & FIRESTORE INTEGRATION
// ===================================================
const firebaseConfig = {
  apiKey: "AIzaSyDExdK7v6mP-x9CdRUMceUNjkvupnJtVr8",
  authDomain: "seedance-app.firebaseapp.com",
  projectId: "seedance-app",
  storageBucket: "seedance-app.firebasestorage.app",
  messagingSenderId: "455714900154",
  appId: "1:455714900154:web:c3ecf76b3f2f7305be1a83"
};

let db = null;
let auth = null;

function getAuth() {
  if (auth) return auth;
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    return auth;
  }
  return null;
}

function initFirebase() {
  const firebaseAuth = getAuth();
  if (!firebaseAuth) return;
  try {
    firebaseAuth.onAuthStateChanged(user => {
      if (user) {
        state.currentUser = { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL };
        updateUserHeaderUI();
        loadUserDataFromFirebase(user.uid);
      } else {
        state.currentUser = null;
        updateUserHeaderUI();
        loadData();
      }
    });
  } catch (err) {
    console.warn('Firebase auth listener warning:', err);
  }
}

function updateUserHeaderUI() {
  const label = document.getElementById('userAuthLabel');
  const btn = document.getElementById('openAuthModal');
  if (!label || !btn) return;
  if (state.currentUser) {
    const nameStr = state.currentUser.displayName || (state.currentUser.email ? state.currentUser.email.split('@')[0] : 'User');
    label.textContent = `👤 ${nameStr}`;
    btn.classList.add('logged-in');
    btn.title = `Logged in as ${state.currentUser.email}`;
  } else {
    label.textContent = '👤 Log In';
    btn.classList.remove('logged-in');
    btn.title = 'Log In or Sign Up with Google';
  }
}

function openAuthModalClick() {
  if (state.currentUser) {
    navigateTo('profile');
  } else {
    openModal('authModal');
  }
}

async function handleGoogleSignIn() {
  const firebaseAuth = getAuth();
  if (!firebaseAuth) {
    showToast('Firebase library not loaded yet.', 'error');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await firebaseAuth.signInWithPopup(provider);
    const user = result.user;
    state.currentUser = { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL };
    updateUserHeaderUI();
    showToast(`Welcome to Hastkala, ${user.displayName || user.email}!`, 'success');
    closeModal('authModal');
    navigateTo('profile');
  } catch (err) {
    console.error('Google Sign-In Error:', err);
    if (err.code === 'auth/popup-closed-by-user') return;
    let msg = err.message || 'Google Sign-In failed.';
    const errEl = document.getElementById('authErrorMsg');
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    } else {
      showToast(msg, 'error');
    }
  }
}

function handleLogout() {
  if (auth) {
    auth.signOut().then(() => {
      showToast('Logged out successfully');
      state.currentUser = null;
      updateUserHeaderUI();
      loadData();
      refreshCurrentPage();
    });
  }
}

// ===================================================
// DATA PERSISTENCE (Local & Cloud)
// ===================================================
function saveAllData() {
  localStorage.setItem(DB_VILLAGES, JSON.stringify(state.villages));
  localStorage.setItem(DB_ARTISANS, JSON.stringify(state.artisans));
  localStorage.setItem(DB_RAW_MAT, JSON.stringify(state.rawMaterials));
  localStorage.setItem(DB_DISPATCHES, JSON.stringify(state.dispatches));
  localStorage.setItem(DB_PRODUCTION, JSON.stringify(state.productionLogs));
  localStorage.setItem(DB_PRODUCTS, JSON.stringify(state.products));
  localStorage.setItem(DB_TXN, JSON.stringify(state.transactions));
  localStorage.setItem(DB_CUSTOM_FIELDS, JSON.stringify(state.customArtisanFields));

  if (state.currentUser && db) {
    db.collection('users').doc(state.currentUser.uid).set({
      hastkala: {
        villages: state.villages,
        artisans: state.artisans,
        rawMaterials: state.rawMaterials,
        dispatches: state.dispatches,
        productionLogs: state.productionLogs,
        products: state.products,
        transactions: state.transactions,
        customArtisanFields: state.customArtisanFields
      }
    }, { merge: true }).catch(err => console.warn('Cloud save error:', err));
  }
}

function loadData() {
  try {
    const v = localStorage.getItem(DB_VILLAGES);
    const a = localStorage.getItem(DB_ARTISANS);
    const rm = localStorage.getItem(DB_RAW_MAT);
    const d = localStorage.getItem(DB_DISPATCHES);
    const pr = localStorage.getItem(DB_PRODUCTION);
    const p = localStorage.getItem(DB_PRODUCTS);
    const t = localStorage.getItem(DB_TXN);
    const cf = localStorage.getItem(DB_CUSTOM_FIELDS);

    if (v)  state.villages = JSON.parse(v);
    if (a)  state.artisans = JSON.parse(a);
    if (rm) state.rawMaterials = JSON.parse(rm);
    if (d)  state.dispatches = JSON.parse(d);
    if (pr) state.productionLogs = JSON.parse(pr);
    if (p)  state.products = JSON.parse(p);
    if (t)  state.transactions = JSON.parse(t);
    if (cf) state.customArtisanFields = JSON.parse(cf);
  } catch(e) { console.warn('Data load error', e); }
}

async function loadUserDataFromFirebase(uid) {
  if (!db) return;
  try {
    const docRef = db.collection('users').doc(uid);
    const doc = await docRef.get();
    if (doc.exists && doc.data().hastkala) {
      const h = doc.data().hastkala;
      state.villages = h.villages || [];
      state.artisans = h.artisans || [];
      state.rawMaterials = h.rawMaterials || [];
      state.dispatches = h.dispatches || [];
      state.productionLogs = h.productionLogs || [];
      state.products = h.products || [];
      state.transactions = h.transactions || [];
      state.customArtisanFields = h.customArtisanFields || [];
    } else {
      seedSampleData();
      await docRef.set({
        hastkala: {
          villages: state.villages,
          artisans: state.artisans,
          rawMaterials: state.rawMaterials,
          dispatches: state.dispatches,
          productionLogs: state.productionLogs,
          products: state.products,
          transactions: state.transactions,
          customArtisanFields: state.customArtisanFields
        }
      }, { merge: true });
    }
    saveAllData();
    refreshCurrentPage();
  } catch (err) {
    console.warn('Cloud load error:', err);
  }
}

// ===================================================
// SEED INITIAL DEMO DATA (First Run)
// ===================================================
function seedSampleData() {
  if (!state.customArtisanFields || state.customArtisanFields.length === 0) {
    state.customArtisanFields = [
      { id: 'f_aadhaar', label: 'Aadhaar Number', placeholder: '12-digit Aadhaar No.' },
      { id: 'f_craft', label: 'Craft Specialization', placeholder: 'e.g. Embroidery, Weaving, Pottery' },
      { id: 'f_bank', label: 'Bank A/c & IFSC', placeholder: 'e.g. 123456789 (SBIN000123)' },
      { id: 'f_photo', label: 'Photo URL', placeholder: 'https://...' }
    ];
  }

  if (state.villages.length === 0) {
    const v1 = uid(), v2 = uid(), v3 = uid(), v4 = uid();
    state.villages = [
      { id: v1, name: 'Rampur', district: 'Varanasi' },
      { id: v2, name: 'Chandpur', district: 'Lucknow' },
      { id: v3, name: 'Sundarpur', district: 'Mirzapur' },
      { id: v4, name: 'Shivpur', district: 'Jaunpur' }
    ];

    state.rawMaterials = [
      { id: uid(), name: 'Cotton Thread', unit: 'kg', plantStock: 120 },
      { id: uid(), name: 'Jute Fabric', unit: 'meters', plantStock: 300 },
      { id: uid(), name: 'Terracotta Clay', unit: 'kg', plantStock: 450 },
      { id: uid(), name: 'Silk Yarn', unit: 'kg', plantStock: 60 }
    ];

    const a1 = uid(), a2 = uid(), a3 = uid(), a4 = uid();
    state.artisans = [
      { id: a1, name: 'Sunita Devi', phone: '9876543210', villageId: v1, customData: { f_aadhaar: '4589-1234-5678', f_craft: 'Handloom Weaving', f_bank: '987654321 (SBIN000123)' } },
      { id: a2, name: 'Anita Sharma', phone: '9812345678', villageId: v2, customData: { f_aadhaar: '8912-3456-7890', f_craft: 'Chikankari Embroidery', f_bank: '456789123 (HDFC000456)' } },
      { id: a3, name: 'Meena Kumari', phone: '9765432109', villageId: v3, customData: { f_aadhaar: '1234-5678-9012', f_craft: 'Terracotta Pottery', f_bank: '123987456 (ICIC000789)' } },
      { id: a4, name: 'Radha Patel', phone: '9988776655', villageId: v4, customData: { f_aadhaar: '6789-0123-4567', f_craft: 'Jute Handicrafts', f_bank: '789123456 (PUNB000321)' } }
    ];

    state.dispatches = [
      { id: uid(), materialId: state.rawMaterials[1].id, villageId: v1, artisanId: a1, qty: 25, ts: Date.now() - 86400000 * 3 },
      { id: uid(), materialId: state.rawMaterials[0].id, villageId: v1, artisanId: a1, qty: 10, ts: Date.now() - 86400000 * 2 },
      { id: uid(), materialId: state.rawMaterials[0].id, villageId: v2, artisanId: a2, qty: 15, ts: Date.now() - 86400000 * 2 },
      { id: uid(), materialId: state.rawMaterials[2].id, villageId: v3, artisanId: a3, qty: 50, ts: Date.now() - 86400000 * 1 }
    ];

    state.productionLogs = [
      { id: uid(), artisanId: a1, villageId: v1, productName: 'Handwoven Jute Tote Bag', qtyProduced: 15, materialUsed: '10 m Jute Fabric', costPrice: 120, sellPrice: 280, emoji: '👜', ts: Date.now() - 86400000 },
      { id: uid(), artisanId: a2, villageId: v2, productName: 'Chikan Embroidered Dupatta', qtyProduced: 10, materialUsed: '5 kg Cotton Thread', costPrice: 200, sellPrice: 550, emoji: '🧣', ts: Date.now() - 43200000 },
      { id: uid(), artisanId: a3, villageId: v3, productName: 'Artisanal Terracotta Vase', qtyProduced: 18, materialUsed: '25 kg Terracotta Clay', costPrice: 70, sellPrice: 200, emoji: '🏺', ts: Date.now() - 21600000 }
    ];

    state.products = [
      { id: uid(), name: 'Handwoven Jute Tote Bag', category: 'Handicrafts', costPrice: 120, sellPrice: 280, stock: 15, lowAlert: 5, emoji: '👜', villageId: v1, artisanId: a1, sold: 0, revenue: 0 },
      { id: uid(), name: 'Chikan Embroidered Dupatta', category: 'Textiles', costPrice: 200, sellPrice: 550, stock: 10, lowAlert: 3, emoji: '🧣', villageId: v2, artisanId: a2, sold: 0, revenue: 0 },
      { id: uid(), name: 'Artisanal Terracotta Vase', category: 'Pottery', costPrice: 70, sellPrice: 200, stock: 18, lowAlert: 4, emoji: '🏺', villageId: v3, artisanId: a3, sold: 0, revenue: 0 },
      { id: uid(), name: 'Silk Table Runner', category: 'Textiles', costPrice: 180, sellPrice: 420, stock: 12, lowAlert: 3, emoji: '🧵', villageId: v4, artisanId: a4, sold: 0, revenue: 0 }
    ];

    saveAllData();
  }
}

// ===================================================
// UTILS & HELPERS
// ===================================================
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function r2(n) { return Number(Number(n).toFixed(2)); }
function formatCurrency(val) { return '₹' + Number(val).toFixed(2); }
function todayStr() { return new Date().toDateString(); }
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0,0,0,0);
  return d;
}
function formatTime(ts) {
  const d = new Date(ts);
  const dateStr = d.toDateString() === todayStr() ? 'Today' :
    d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
  const timeStr = d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12: true });
  return `${dateStr}, ${timeStr}`;
}
function getFilteredTxn(period) {
  if (period === 'all') return state.transactions;
  if (period === 'today') {
    return state.transactions.filter(t => new Date(t.ts).toDateString() === todayStr());
  }
  if (period === 'week') {
    const ws = weekStart();
    return state.transactions.filter(t => new Date(t.ts) >= ws);
  }
  return state.transactions;
}

function getVillageById(id) { return state.villages.find(v => v.id === id); }
function getArtisanById(id) { return state.artisans.find(a => a.id === id); }
function getRawMaterialById(id) { return state.rawMaterials.find(m => m.id === id); }
function getProductById(id) { return state.products.find(p => p.id === id); }

// Village Raw Material Breakdown
function getVillageMaterialBreakdown(villageId) {
  const vDispatches = state.dispatches.filter(d => d.villageId === villageId);
  if (vDispatches.length === 0) return 'No raw material received yet';
  const matTotals = {};
  vDispatches.forEach(d => {
    const mat = getRawMaterialById(d.materialId);
    const name = mat ? mat.name : 'Material';
    const unit = mat ? mat.unit : 'units';
    const key = `${name} (${unit})`;
    matTotals[key] = (matTotals[key] || 0) + Number(d.qty);
  });
  return Object.entries(matTotals).map(([mat, qty]) => `${r2(qty)} ${mat}`).join(', ');
}

// Village Itemized Production Breakdown
function getVillageProductionBreakdown(villageId) {
  const vLogs = state.productionLogs.filter(pr => pr.villageId === villageId);
  if (vLogs.length === 0) return 'No production logged yet';
  const prodTotals = {};
  vLogs.forEach(pr => {
    const key = `${pr.emoji || '📦'} ${pr.productName}`;
    prodTotals[key] = (prodTotals[key] || 0) + Number(pr.qtyProduced);
  });
  return Object.entries(prodTotals).map(([name, qty]) => `${qty}x ${name}`).join(', ');
}

// Village Store POS Inventory Stock Breakdown
function getVillagePOSStock(villageId) {
  const vProds = state.products.filter(p => p.villageId === villageId && p.stock > 0);
  if (vProds.length === 0) return '0 items in POS store';
  return vProds.map(p => `${p.stock}x ${p.emoji || '📦'} ${p.name}`).join(', ');
}

// Village Total POS Sales Earned
function getVillageTotalSales(villageId) {
  let rev = 0;
  (state.transactions || []).forEach(t => {
    if (t.items) {
      t.items.forEach(i => {
        if (i.villageId === villageId) {
          rev += ((i.price || 0) * (i.qty || 0));
        }
      });
    }
  });
  return rev;
}

// ===================================================
// TOAST NOTIFICATIONS
// ===================================================
let toastTimer = null;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2800);
}

// ===================================================
// DYNAMIC FORM BUILDER ENGINE (ADMIN CONTROL)
// ===================================================
function renderDynamicArtisanFormFields() {
  const container = document.getElementById('dynamicArtisanFormFields');
  if (!container) return;

  if (!state.customArtisanFields || state.customArtisanFields.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = state.customArtisanFields.map(f => `
    <div class="form-group" style="margin-top:10px;">
      <label>${f.label}</label>
      <input type="text" id="custField_${f.id}" placeholder="${f.placeholder || ''}" />
    </div>
  `).join('');
}

function renderCustomFieldsAdminList() {
  const list = document.getElementById('customFieldsList');
  if (!list) return;

  if (!state.customArtisanFields || state.customArtisanFields.length === 0) {
    list.innerHTML = '<div class="empty-state">No custom form fields added.<br>Add one above!</div>';
    return;
  }

  list.innerHTML = state.customArtisanFields.map(f => `
    <div class="material-card" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;">
      <div>
        <div style="font-size:14px;font-weight:700;">${f.label}</div>
        <div style="font-size:12px;color:var(--text2);">ID: ${f.id}</div>
      </div>
      <button class="inv-btn delete" onclick="deleteCustomArtisanField('${f.id}')">🗑️ Remove</button>
    </div>
  `).join('');
}

function addCustomArtisanField() {
  const labelInput = document.getElementById('newFieldName');
  const label = labelInput.value.trim();
  if (!label) {
    showToast('Enter a field name', 'error');
    return;
  }

  const fieldId = 'f_' + Date.now().toString(36);
  state.customArtisanFields.push({
    id: fieldId,
    label: label,
    placeholder: `Enter ${label}...`
  });

  saveAllData();
  labelInput.value = '';
  showToast(`⚙️ Custom field "${label}" added to Artisan Form!`, 'success');
  renderCustomFieldsAdminList();
  renderDynamicArtisanFormFields();
}

function deleteCustomArtisanField(id) {
  if (!confirm('Remove this custom form field?')) return;
  state.customArtisanFields = state.customArtisanFields.filter(f => f.id !== id);
  saveAllData();
  showToast('Custom field removed', 'error');
  renderCustomFieldsAdminList();
  renderDynamicArtisanFormFields();
}

// ===================================================
// MODAL HELPERS & SELECT POPULATION
// ===================================================
function openModal(id) {
  populateSelectDropdowns();
  if (id === 'addArtisanModal') {
    renderDynamicArtisanFormFields();
  }
  if (id === 'manageCustomFieldsModal') {
    renderCustomFieldsAdminList();
  }
  document.getElementById(id).classList.add('open');
}

function openVillageDispatchModal(villageId) {
  openModal('dispatchMaterialModal');
  const vSel = document.getElementById('dispatchVillageSelect');
  if (vSel && villageId) {
    vSel.value = villageId;
    onDispatchVillageChange();
  }
}

function openVillageProductionModal(villageId) {
  openModal('logProductionModal');
  const pArt = document.getElementById('prodArtisanSelect');
  if (pArt && villageId) {
    const vArtisans = state.artisans.filter(a => a.villageId === villageId);
    if (vArtisans.length === 0) {
      const v = getVillageById(villageId);
      showToast(`No women artisans registered in ${v ? v.name : 'this village'} yet. Register an artisan first!`, 'warning');
      pArt.innerHTML = '<option value="">No artisans registered in this village</option>';
      return;
    }
    const v = getVillageById(villageId);
    let html = `<optgroup label="🏡 ${v ? v.name : 'Village'} Artisans">` +
      vArtisans.map(a => `<option value="${a.id}">👩‍🎨 ${a.name}</option>`).join('') +
      `</optgroup>`;

    const otherArtisans = state.artisans.filter(a => a.villageId !== villageId);
    if (otherArtisans.length > 0) {
      html += `<optgroup label="Other Villages">` +
        otherArtisans.map(a => {
          const ov = getVillageById(a.villageId);
          return `<option value="${a.id}">👩‍🎨 ${a.name} (${ov ? ov.name : 'Village'})</option>`;
        }).join('') + `</optgroup>`;
    }
    pArt.innerHTML = html;
  }
}

function buildVillageCard(v, showDelete = false) {
  const vArtisans = state.artisans.filter(a => a.villageId === v.id);
  const matBreakdown = getVillageMaterialBreakdown(v.id);
  const prodBreakdown = getVillageProductionBreakdown(v.id);
  const posStockBreakdown = getVillagePOSStock(v.id);
  const vSalesRev = getVillageTotalSales(v.id);

  return `
    <div class="village-card">
      <div class="village-title-row">
        <div>
          <span class="village-name">🏡 ${v.name}</span>
          <span class="artisan-village-tag" style="margin-left:6px">${v.district || 'Region'}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-primary" style="padding:4px 8px;font-size:11px;border-radius:6px;" onclick="openVillageDispatchModal('${v.id}')">🚚 Dispatch Raw Material</button>
          <button class="btn-secondary" style="padding:4px 8px;font-size:11px;border-radius:6px;" onclick="openVillageProductionModal('${v.id}')">🔨 Log Finished Product</button>
          ${showDelete ? `<button class="inv-btn edit" onclick="deleteVillage('${v.id}')" title="Delete Village">🗑️</button>` : ''}
        </div>
      </div>
      <div class="village-stats-flex" style="margin-top:10px">
        <div class="village-stat-item" style="grid-column:1/-1">
          👩‍🎨 Artisans Registered: <strong>${vArtisans.length} women</strong>
        </div>
        <div class="village-stat-item" style="grid-column:1/-1">
          🧵 Raw Material Dispatched: <strong style="color:var(--accent2);">${matBreakdown}</strong>
        </div>
        <div class="village-stat-item" style="grid-column:1/-1">
          🔨 Craft Yield (Total Produced): <strong style="color:var(--text);">${prodBreakdown}</strong>
        </div>
        <div class="village-stat-item" style="grid-column:1/-1">
          🏬 POS Store Stock (Ready to Sell): <strong style="color:var(--blue);">${posStockBreakdown}</strong>
        </div>
        <div class="village-stat-item" style="grid-column:1/-1">
          💰 POS Sales Earned: <strong style="color:var(--green);">${formatCurrency(vSalesRev)}</strong>
        </div>
      </div>
    </div>
  `;
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function onDispatchVillageChange() {
  const vilSel = document.getElementById('dispatchVillageSelect');
  const dArt = document.getElementById('dispatchArtisanSelect');
  if (!vilSel || !dArt) return;

  const vilId = vilSel.value;
  const villageArtisans = state.artisans.filter(a => a.villageId === vilId);
  let options = '<option value="">-- General Village Stock (No specific artisan) --</option>';
  options += villageArtisans.map(a => `<option value="${a.id}">👩‍🎨 ${a.name}</option>`).join('');
  dArt.innerHTML = options;
}

function populateSelectDropdowns() {
  const artV = document.getElementById('artVillageSelect');
  if (artV) {
    artV.innerHTML = state.villages.map(v => `<option value="${v.id}">${v.name} (${v.district || 'Region'})</option>`).join('');
  }

  const dVil = document.getElementById('dispatchVillageSelect');
  if (dVil) {
    dVil.innerHTML = state.villages.map(v => `<option value="${v.id}">🏡 ${v.name} (${v.district || 'Region'})</option>`).join('');
  }

  const dMat = document.getElementById('dispatchMaterialSelect');
  if (dMat) {
    if (state.rawMaterials.length === 0) {
      dMat.innerHTML = '<option value="">⚠️ No raw materials in Plant stock! Add material under Material & Production tab first.</option>';
    } else {
      dMat.innerHTML = state.rawMaterials.map(m => `<option value="${m.id}">${m.name} (${m.plantStock} ${m.unit} in Plant)</option>`).join('');
    }
  }

  onDispatchVillageChange();

  const pArt = document.getElementById('prodArtisanSelect');
  if (pArt) {
    const artisanOptions = state.artisans.map(a => {
      const v = getVillageById(a.villageId);
      return `<option value="${a.id}">${a.name} - ${v ? v.name : 'Village'}</option>`;
    }).join('');
    pArt.innerHTML = artisanOptions || '<option value="">No artisans registered yet</option>';
  }
}

// ===================================================
// NAVIGATION
// ===================================================
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (pageEl) pageEl.classList.add('active');
  if (navBtn) navBtn.classList.add('active');

  state.currentPage = page;
  refreshCurrentPage();
}

function refreshCurrentPage() {
  if (state.currentPage === 'home')      renderHome();
  if (state.currentPage === 'villages')  renderVillagesAndArtisans();
  if (state.currentPage === 'material')  renderMaterialAndCrafting();
  if (state.currentPage === 'pos')       renderPOS();
  if (state.currentPage === 'analytics') renderAnalytics();
  if (state.currentPage === 'profile')   renderProfile();
}

// ===================================================
// CLOCK & GREETING
// ===================================================
function updateClock() {
  const now = new Date();
  const el = document.getElementById('headerTime');
  if (el) el.textContent = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12: true });
}

function updateGreeting() {
  const hour = new Date().getHours();
  const greetEl = document.getElementById('greetingText');
  const dateEl  = document.getElementById('greetingDate');
  if (greetEl) {
    let g = hour < 12 ? 'Welcome to Hastkala! 👋' : hour < 17 ? 'Welcome to Hastkala! 🪡' : 'Welcome to Hastkala! ✨';
    greetEl.textContent = g;
  }
  if (dateEl) {
    const d = new Date();
    dateEl.innerHTML = d.toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }).replace(',','<br>');
  }
}

// ===================================================
// PAGE 1: HOME DASHBOARD
// ===================================================
function renderHome() {
  updateGreeting();

  document.getElementById('statVillageCount').textContent = state.villages.length;
  document.getElementById('statArtisanCount').textContent = state.artisans.length;

  let totalMatUnits = 0;
  state.rawMaterials.forEach(m => totalMatUnits += Number(m.plantStock || 0));
  document.getElementById('statMaterialStock').textContent = `${r2(totalMatUnits)} units`;

  const todayTxn = getFilteredTxn('today');
  const allTxn = state.transactions;

  let todayRev = 0;
  todayTxn.forEach(t => todayRev += t.total);
  document.getElementById('todayRevenue').textContent = formatCurrency(todayRev);

  let allRev = 0, allProfit = 0, allCost = 0;
  let cashRev = 0, upiRev = 0;

  allTxn.forEach(t => {
    allRev += t.total;
    allProfit += t.profit;
    allCost += (t.total - t.profit);

    if (t.paymentMode === 'UPI') upiRev += t.total;
    else cashRev += t.total;
  });

  document.getElementById('allRevenue').textContent = formatCurrency(allRev);
  document.getElementById('allCost').textContent = formatCurrency(allCost);
  document.getElementById('allProfit').textContent = formatCurrency(allProfit);
  document.getElementById('allTxn').textContent = `${allTxn.length} (💵 Cash: ${formatCurrency(cashRev)} | 📱 UPI: ${formatCurrency(upiRev)})`;

  // Render Village Raw Material & Production Cards on Dashboard
  const homeVillageList = document.getElementById('homeVillageList');
  if (state.villages.length === 0) {
    homeVillageList.innerHTML = '<div class="empty-state">No villages added yet. Go to Villages tab to add!</div>';
  } else {
    homeVillageList.innerHTML = state.villages.map(v => buildVillageCard(v, false)).join('');
  }

  // Recent Store Sales
  const recentEl = document.getElementById('recentTxnList');
  const recent = [...allTxn].sort((a,b) => b.ts - a.ts).slice(0, 5);
  if (recent.length === 0) {
    recentEl.innerHTML = '<div class="empty-state">No store sales yet.<br>Go to POS to make a sale!</div>';
  } else {
    recentEl.innerHTML = recent.map(t => buildTxnCard(t)).join('');
  }

  const undoBtn = document.getElementById('undoLastBtn');
  if (undoBtn) {
    undoBtn.style.opacity = allTxn.length === 0 ? '0.5' : '1';
    undoBtn.style.pointerEvents = allTxn.length === 0 ? 'none' : 'auto';
  }
}

function buildTxnCard(t) {
  const itemList = t.items.map(i => `${i.qty}x ${i.name}`).join(', ');
  const custName = t.customerName || 'Walk-in Customer';
  const payMode = t.paymentMode || 'Cash';
  const payBadge = payMode === 'UPI' ? '📱 UPI' : '💵 Cash';
  const payColor = payMode === 'UPI' ? 'var(--blue)' : 'var(--green)';

  return `
    <div class="txn-card">
      <div class="txn-left">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <span style="font-size:11px;font-weight:700;color:${payColor};background:var(--card2);padding:2px 6px;border-radius:6px;border:1px solid var(--border)">${payBadge}</span>
          <span style="font-size:13px;font-weight:700;color:var(--text)">👤 ${custName}</span>
        </div>
        <div class="txn-time">${formatTime(t.ts)}</div>
        <div class="txn-items">${itemList}</div>
      </div>
      <div class="txn-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="txn-amount">${formatCurrency(t.total)}</div>
        <div class="txn-profit">Profit: ${formatCurrency(t.profit)}</div>
        <button class="txn-undo-btn" title="Cancel this sale" onclick="openUndoModal('${t.id}')">↩️ Undo</button>
      </div>
    </div>
  `;
}

// ===================================================
// PAGE 2: VILLAGES & ARTISANS DIRECTORY
// ===================================================
function switchVillageSubTab(sub) {
  document.getElementById('tabSubVillages').classList.toggle('active', sub === 'villages');
  document.getElementById('tabSubArtisans').classList.toggle('active', sub === 'artisans');
  document.getElementById('subViewVillages').style.display = sub === 'villages' ? 'block' : 'none';
  document.getElementById('subViewArtisans').style.display = sub === 'artisans' ? 'block' : 'none';
  renderVillagesAndArtisans();
}

function renderVillagesAndArtisans() {
  // Render Villages Admin Panel List
  const vList = document.getElementById('villageAdminList');
  if (state.villages.length === 0) {
    vList.innerHTML = '<div class="empty-state">No villages configured.<br>Click "+ Add Village" above!</div>';
  } else {
    vList.innerHTML = state.villages.map(v => buildVillageCard(v, true)).join('');
  }

  // Render Artisan Village Filter Chips
  const filterRow = document.getElementById('artisanVillageFilterRow');
  if (filterRow) {
    let chipsHtml = `<button class="filter-chip ${state.artisanVillageFilter === 'all' ? 'active' : ''}" onclick="filterArtisans('all')">All Villages</button>`;
    state.villages.forEach(v => {
      chipsHtml += `<button class="filter-chip ${state.artisanVillageFilter === v.id ? 'active' : ''}" onclick="filterArtisans('${v.id}')">${v.name}</button>`;
    });
    filterRow.innerHTML = chipsHtml;
  }

  // Render Artisans List with Dynamic Custom Fields
  const aList = document.getElementById('artisanList');
  let filteredArtisans = state.artisans;
  if (state.artisanVillageFilter !== 'all') {
    filteredArtisans = filteredArtisans.filter(a => a.villageId === state.artisanVillageFilter);
  }

  if (filteredArtisans.length === 0) {
    aList.innerHTML = '<div class="empty-state">No artisans found.<br>Click "+ Register Artisan" to add!</div>';
  } else {
    aList.innerHTML = filteredArtisans.map(a => {
      const v = getVillageById(a.villageId);
      const vName = v ? v.name : 'Unknown Village';

      const aDispatches = state.dispatches.filter(d => d.artisanId === a.id);
      let matRec = 0;
      aDispatches.forEach(d => matRec += Number(d.qty));

      const aProds = state.productionLogs.filter(pr => pr.artisanId === a.id);
      let unitsCrafted = 0;
      aProds.forEach(pr => unitsCrafted += Number(pr.qtyProduced));

      // Build custom field badges
      let customBadgesHtml = '';
      if (a.customData) {
        state.customArtisanFields.forEach(f => {
          const val = a.customData[f.id];
          if (val && f.id !== 'f_photo') {
            customBadgesHtml += `<span class="detail-pill">${f.label}: <strong>${val}</strong></span>`;
          }
        });
      }

      const photoUrl = a.customData ? a.customData['f_photo'] : '';

      return `
        <div class="artisan-card">
          <div class="artisan-header-row">
            ${photoUrl ? `<img src="${photoUrl}" class="artisan-avatar-img" alt="${a.name}" />` : `<div class="artisan-avatar-fallback">👩‍🎨</div>`}
            <div class="artisan-info-meta">
              <div class="artisan-name">${a.name}</div>
              <span class="artisan-village-tag">🏡 ${vName}</span>
              <div style="font-size:12px;color:var(--text2);margin-top:2px">Phone: <strong>${a.phone || 'N/A'}</strong></div>
            </div>
            <button class="inv-btn delete" onclick="deleteArtisan('${a.id}')">🗑️</button>
          </div>
          <div class="artisan-detail-pills">
            ${customBadgesHtml}
            <span class="detail-pill" style="color:var(--accent)">🧵 Mat Rec: ${r2(matRec)} units</span>
            <span class="detail-pill" style="color:var(--green)">🔨 Output: ${unitsCrafted} units</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

function filterArtisans(villageId) {
  state.artisanVillageFilter = villageId;
  renderVillagesAndArtisans();
}

function saveVillage() {
  const name = document.getElementById('vName').value.trim();
  const district = document.getElementById('vDistrict').value.trim();
  if (!name) {
    showToast('Enter village name', 'error');
    return;
  }
  state.villages.push({ id: uid(), name, district });
  saveAllData();
  closeModal('addVillageModal');
  document.getElementById('vName').value = '';
  document.getElementById('vDistrict').value = '';
  showToast(`🏡 Village "${name}" added!`, 'success');
  renderVillagesAndArtisans();
}

function deleteVillage(id) {
  if (!confirm('Delete this village?')) return;
  state.villages = state.villages.filter(v => v.id !== id);
  saveAllData();
  renderVillagesAndArtisans();
  showToast('Village deleted', 'error');
}

function saveArtisan() {
  const name = document.getElementById('artName').value.trim();
  const phone = document.getElementById('artPhone').value.trim();
  const villageId = document.getElementById('artVillageSelect').value;

  if (!name || !phone || !villageId) {
    showToast('Name, Phone & Village are required', 'error');
    return;
  }

  // Read all dynamic admin custom fields
  const customData = {};
  if (state.customArtisanFields) {
    state.customArtisanFields.forEach(f => {
      const inputEl = document.getElementById(`custField_${f.id}`);
      if (inputEl) {
        customData[f.id] = inputEl.value.trim();
      }
    });
  }

  state.artisans.push({ id: uid(), name, phone, villageId, customData });
  saveAllData();
  closeModal('addArtisanModal');
  document.getElementById('artName').value = '';
  document.getElementById('artPhone').value = '';
  showToast(`👩‍🎨 Artisan "${name}" registered!`, 'success');
  renderVillagesAndArtisans();
}

function deleteArtisan(id) {
  if (!confirm('Delete this artisan entry?')) return;
  state.artisans = state.artisans.filter(a => a.id !== id);
  saveAllData();
  renderVillagesAndArtisans();
  showToast('Artisan removed', 'error');
}

// ===================================================
// PAGE 3: MATERIAL & PRODUCTION YIELD
// ===================================================
function switchMaterialSubTab(sub) {
  document.getElementById('tabSubMaterial').classList.toggle('active', sub === 'material');
  document.getElementById('tabSubDispatch').classList.toggle('active', sub === 'dispatch');
  document.getElementById('tabSubProduction').classList.toggle('active', sub === 'production');

  document.getElementById('subViewMaterial').style.display = sub === 'material' ? 'block' : 'none';
  document.getElementById('subViewDispatch').style.display = sub === 'dispatch' ? 'block' : 'none';
  document.getElementById('subViewProduction').style.display = sub === 'production' ? 'block' : 'none';
  renderMaterialAndCrafting();
}

function renderMaterialAndCrafting() {
  // 1. Plant Raw Materials List
  const rmList = document.getElementById('rawMaterialList');
  if (state.rawMaterials.length === 0) {
    rmList.innerHTML = '<div class="empty-state">No raw materials gathered from plant.<br>Click "+ Add Raw Material" above!</div>';
  } else {
    rmList.innerHTML = state.rawMaterials.map(m => {
      return `
        <div class="material-card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:16px;font-weight:700">🧵 ${m.name}</span>
            <span class="artisan-village-tag">${m.unit}</span>
          </div>
          <div style="font-size:14px;color:var(--text2);margin-top:4px">
            Plant Stock Gathered: <strong style="color:var(--accent);font-size:16px">${m.plantStock} ${m.unit}</strong>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Dispatch Log List
  const dList = document.getElementById('dispatchLogList');
  if (state.dispatches.length === 0) {
    dList.innerHTML = '<div class="empty-state">No raw material dispatches logged.<br>Click "🚚 Dispatch Material" above!</div>';
  } else {
    dList.innerHTML = [...state.dispatches].sort((a,b) => b.ts - a.ts).map(d => {
      const mat = getRawMaterialById(d.materialId);
      const art = getArtisanById(d.artisanId);
      const vil = getVillageById(d.villageId);
      const recipientStr = art ? art.name : (vil ? `Village ${vil.name}` : 'Village');

      return `
        <div class="dispatch-card">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text3)">
            <span>🚚 RAW MATERIAL DISPATCH</span>
            <span>${formatTime(d.ts)}</span>
          </div>
          <div style="font-size:15px;font-weight:700;margin-top:2px;color:var(--accent2)">
            ${d.qty} ${mat ? mat.unit : 'units'} of ${mat ? mat.name : 'Material'}
          </div>
          <div style="font-size:13px;color:var(--text2)">
            Recipient: <strong>${recipientStr}</strong> (🏡 <strong>${vil ? vil.name : 'Village'}</strong>)
          </div>
        </div>
      `;
    }).join('');
  }

  // 3. Production Yield Log List
  const prList = document.getElementById('productionLogList');
  if (state.productionLogs.length === 0) {
    prList.innerHTML = '<div class="empty-state">No craft production logged yet.<br>Click "🔨 Log Finished Product" above!</div>';
  } else {
    prList.innerHTML = [...state.productionLogs].sort((a,b) => b.ts - a.ts).map(pr => {
      const art = getArtisanById(pr.artisanId);
      const vil = getVillageById(pr.villageId);
      return `
        <div class="production-card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:16px;font-weight:700">${pr.emoji || '📦'} ${pr.productName}</span>
            <span style="font-size:13px;font-weight:800;color:var(--green)">+${pr.qtyProduced} units</span>
          </div>
          <div style="font-size:13px;color:var(--text2);margin-top:2px">
            Crafted by: <strong>${art ? art.name : 'Artisan'}</strong> (🏡 ${vil ? vil.name : 'Village'})
          </div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">
            Material Used: ${pr.materialUsed || 'Standard'} | POS Sell Price: ${formatCurrency(pr.sellPrice)}
          </div>
        </div>
      `;
    }).join('');
  }
}

function saveRawMaterial() {
  const name = document.getElementById('rmName').value.trim();
  const unit = document.getElementById('rmUnit').value;
  const stock = parseFloat(document.getElementById('rmStock').value);

  if (!name || isNaN(stock) || stock < 0) {
    showToast('Enter valid material name & quantity', 'error');
    return;
  }

  state.rawMaterials.push({ id: uid(), name, unit, plantStock: stock });
  saveAllData();
  closeModal('addRawMaterialModal');
  document.getElementById('rmName').value = '';
  document.getElementById('rmStock').value = '';
  showToast(`🧵 Raw Material "${name}" added to plant stock!`, 'success');
  renderMaterialAndCrafting();
}

function confirmDispatchMaterial() {
  const materialId = document.getElementById('dispatchMaterialSelect').value;
  const villageId = document.getElementById('dispatchVillageSelect').value;
  const artisanId = document.getElementById('dispatchArtisanSelect').value;
  const qty = parseFloat(document.getElementById('dispatchQty').value);

  if (!materialId || !villageId || isNaN(qty) || qty <= 0) {
    showToast('Select material, target village, and valid quantity', 'error');
    return;
  }

  const mat = getRawMaterialById(materialId);
  const vil = getVillageById(villageId);
  const art = artisanId ? getArtisanById(artisanId) : null;
  if (!mat || !vil) return;

  if (mat.plantStock < qty) {
    showToast(`Only ${mat.plantStock} ${mat.unit} available in plant stock!`, 'warning');
    return;
  }

  mat.plantStock = r2(mat.plantStock - qty);
  state.dispatches.push({
    id: uid(),
    materialId,
    villageId: villageId,
    artisanId: artisanId || null,
    qty,
    ts: Date.now()
  });

  saveAllData();
  closeModal('dispatchMaterialModal');
  document.getElementById('dispatchQty').value = '';
  const recipientStr = art ? art.name : `Village ${vil.name}`;
  showToast(`🚚 ${qty} ${mat.unit} dispatched to ${recipientStr}!`, 'success');
  refreshCurrentPage();
}

function confirmLogProduction() {
  const artisanId = document.getElementById('prodArtisanSelect').value;
  const name = document.getElementById('prodName').value.trim();
  const qty = parseInt(document.getElementById('prodQty').value);
  const emoji = document.getElementById('prodEmoji').value.trim() || '📦';
  const costPrice = parseFloat(document.getElementById('prodCostPrice').value);
  const sellPrice = parseFloat(document.getElementById('prodSellPrice').value);
  const materialUsed = document.getElementById('prodMatUsed').value.trim();

  if (!artisanId || !name || isNaN(qty) || qty <= 0 || isNaN(costPrice) || isNaN(sellPrice)) {
    showToast('Fill in all product details accurately', 'error');
    return;
  }

  const art = getArtisanById(artisanId);
  if (!art) return;

  // Log Production Yield
  state.productionLogs.push({
    id: uid(),
    artisanId,
    villageId: art.villageId,
    productName: name,
    qtyProduced: qty,
    materialUsed,
    costPrice,
    sellPrice,
    emoji,
    ts: Date.now()
  });

  // Automatically update/add POS Store Product Inventory
  let prod = state.products.find(p => p.name.toLowerCase() === name.toLowerCase() && p.artisanId === artisanId);
  if (prod) {
    prod.stock += qty;
    prod.costPrice = costPrice;
    prod.sellPrice = sellPrice;
  } else {
    state.products.push({
      id: uid(),
      name,
      category: 'Handicrafts',
      costPrice,
      sellPrice,
      stock: qty,
      lowAlert: 3,
      emoji,
      villageId: art.villageId,
      artisanId,
      sold: 0,
      revenue: 0
    });
  }

  saveAllData();
  closeModal('logProductionModal');
  document.getElementById('prodName').value = '';
  document.getElementById('prodQty').value = '';
  document.getElementById('prodCostPrice').value = '';
  document.getElementById('prodSellPrice').value = '';
  document.getElementById('prodMatUsed').value = '';

  showToast(`🔨 ${qty} units of "${name}" crafted & added to POS!`, 'success');
  renderMaterialAndCrafting();
}

// ===================================================
// PAGE 4: STORE POS (POINT OF SALE)
// ===================================================
function renderPOS() {
  renderProductGrid();
  renderCart();
}

function renderProductGrid(filter = '') {
  const grid = document.getElementById('productGrid');
  let products = state.products;
  if (filter) {
    const f = filter.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(f) || p.category.toLowerCase().includes(f));
  }

  if (products.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No craft products in store inventory.<br>Log production output in Supply tab!</div>';
    return;
  }

  grid.innerHTML = products.map(p => {
    const stockClass = p.stock === 0 ? 'stock-out' : p.stock <= p.lowAlert ? 'stock-low' : 'stock-ok';
    const stockLabel = p.stock === 0 ? 'Out of Stock' : `Qty: ${p.stock}`;
    const vil = getVillageById(p.villageId);
    const art = getArtisanById(p.artisanId);

    return `
      <div class="product-card ${p.stock === 0 ? 'out-of-stock' : ''}"
           data-id="${p.id}" onclick="addToCart('${p.id}')">
        <span class="product-stock-badge ${stockClass}">${stockLabel}</span>
        <span class="product-emoji">${p.emoji || '📦'}</span>
        <div class="product-name">${p.name}</div>
        <div class="origin-tag">🏡 ${vil ? vil.name : 'Village'} • ${art ? art.name : 'Artisan'}</div>
        <div class="product-price" style="margin-top:4px">${formatCurrency(p.sellPrice)}</div>
      </div>
    `;
  }).join('');
}

function addToCart(productId) {
  const product = getProductById(productId);
  if (!product || product.stock === 0) return;

  const existing = state.cart.find(c => c.id === productId);
  if (existing) {
    if (existing.qty >= product.stock) {
      showToast(`Only ${product.stock} in store stock!`, 'warning');
      return;
    }
    existing.qty++;
  } else {
    state.cart.push({ id: productId, qty: 1 });
  }
  renderCart();
  renderProductGrid(document.getElementById('productSearch').value);
}

function updateCartQty(productId, delta) {
  const item = state.cart.find(c => c.id === productId);
  if (!item) return;
  const product = getProductById(productId);
  const newQty = item.qty + delta;
  if (newQty <= 0) {
    state.cart = state.cart.filter(c => c.id !== productId);
  } else if (newQty > product.stock) {
    showToast(`Max ${product.stock} in stock`, 'warning');
    return;
  } else {
    item.qty = newQty;
  }
  renderCart();
}

function renderCart() {
  const cartItems = document.getElementById('cartItems');
  const cartSubtotal = document.getElementById('cartSubtotal');
  const cartItemCount = document.getElementById('cartItemCount');
  const checkoutTotal = document.getElementById('checkoutTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');

  if (state.cart.length === 0) {
    cartItems.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">Cart is empty. Tap craft products above to add.</div>';
    cartSubtotal.textContent = '₹0.00';
    cartItemCount.textContent = '0';
    checkoutTotal.textContent = '₹0.00';
    checkoutBtn.disabled = true;
    return;
  }

  checkoutBtn.disabled = false;
  let total = 0, totalItems = 0;

  cartItems.innerHTML = state.cart.map(c => {
    const p = getProductById(c.id);
    if (!p) return '';
    const lineTotal = p.sellPrice * c.qty;
    total += lineTotal;
    totalItems += c.qty;
    return `
      <div class="cart-item">
        <span class="cart-item-emoji">${p.emoji || '📦'}</span>
        <div class="cart-item-info">
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-price">${formatCurrency(p.sellPrice)} × ${c.qty} = <strong>${formatCurrency(lineTotal)}</strong></div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateCartQty('${p.id}', -1)">−</button>
          <span class="qty-display">${c.qty}</span>
          <button class="qty-btn" onclick="updateCartQty('${p.id}', +1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  cartSubtotal.textContent = formatCurrency(total);
  cartItemCount.textContent = totalItems;
  checkoutTotal.textContent = formatCurrency(total);
}

function openCheckoutModal() {
  if (state.cart.length === 0) return;
  let total = 0, totalProfit = 0;
  const summaryEl = document.getElementById('checkoutSummary');
  const totalEl = document.getElementById('checkoutTotalDisplay');

  summaryEl.innerHTML = state.cart.map(c => {
    const p = getProductById(c.id);
    if (!p) return '';
    const lineTotal = p.sellPrice * c.qty;
    total += lineTotal;
    totalProfit += (p.sellPrice - p.costPrice) * c.qty;
    return `
      <div class="checkout-item-row">
        <span>${p.emoji} ${p.name} × ${c.qty}</span>
        <span>${formatCurrency(lineTotal)}</span>
      </div>
    `;
  }).join('') + `
    <div class="checkout-item-row" style="color:var(--green);font-weight:600">
      <span>Net Earnings / Profit</span>
      <span>${formatCurrency(totalProfit)}</span>
    </div>
  `;
  totalEl.textContent = formatCurrency(total);
  openModal('checkoutModal');
}

function confirmSale() {
  let total = 0, profit = 0;
  const items = [];

  const custNameInput = document.getElementById('custNameInput');
  const customerName = (custNameInput && custNameInput.value.trim()) ? custNameInput.value.trim() : 'Walk-in Customer';
  const payRadio = document.querySelector('input[name="paymentMode"]:checked');
  const paymentMode = payRadio ? payRadio.value : 'Cash';

  state.cart.forEach(c => {
    const p = getProductById(c.id);
    if (!p) return;
    const lineTotal = p.sellPrice * c.qty;
    const lineProfit = (p.sellPrice - p.costPrice) * c.qty;
    total += lineTotal;
    profit += lineProfit;

    p.stock = Math.max(0, p.stock - c.qty);
    p.sold = (p.sold || 0) + c.qty;
    p.revenue = (p.revenue || 0) + lineTotal;

    items.push({
      id: p.id,
      name: p.name,
      qty: c.qty,
      price: p.sellPrice,
      cost: p.costPrice,
      villageId: p.villageId,
      artisanId: p.artisanId
    });
  });

  const txn = { id: uid(), ts: Date.now(), items, total, profit, customerName, paymentMode };
  state.transactions.push(txn);
  state.cart = [];

  if (custNameInput) custNameInput.value = '';

  saveAllData();
  closeModal('checkoutModal');
  renderPOS();
  showToast(`✅ Store sale recorded! ₹${total.toFixed(2)} (${paymentMode})`, 'success');
}

// ===================================================
// UNDO SALE LOGIC
// ===================================================
function undoLastSale() {
  if (!state.transactions || state.transactions.length === 0) {
    showToast('No store sales to undo', 'error');
    return;
  }
  const lastTxn = [...state.transactions].sort((a, b) => b.ts - a.ts)[0];
  openUndoModal(lastTxn.id);
}

function openUndoModal(txnId) {
  const txn = state.transactions.find(t => t.id === txnId);
  if (!txn) {
    showToast('Transaction not found', 'error');
    return;
  }
  document.getElementById('undoTxnId').value = txnId;
  const itemsHtml = txn.items.map(i => `
    <div class="undo-detail-item">
      <span>${i.qty}x ${i.name}</span>
      <span>${formatCurrency(i.price * i.qty)}</span>
    </div>
  `).join('');

  document.getElementById('undoSaleDetails').innerHTML = `
    <div class="undo-detail-time">📅 ${new Date(txn.ts).toLocaleString()}</div>
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px;">👤 ${txn.customerName || 'Walk-in Customer'} (${txn.paymentMode || 'Cash'})</div>
    ${itemsHtml}
    <div class="undo-detail-total">
      <span>Total to Refund</span>
      <strong>${formatCurrency(txn.total)}</strong>
    </div>
    <div class="undo-restore-note">
      📦 Restores ${txn.items.reduce((acc, i) => acc + i.qty, 0)} item(s) back to store POS inventory
    </div>
  `;
  openModal('undoModal');
}

function confirmUndoSale() {
  const txnId = document.getElementById('undoTxnId').value;
  const txnIndex = state.transactions.findIndex(t => t.id === txnId);
  if (txnIndex === -1) {
    showToast('Transaction not found', 'error');
    closeModal('undoModal');
    return;
  }

  const txn = state.transactions[txnIndex];

  // Restore inventory stock and adjust sold count
  txn.items.forEach(item => {
    const prod = getProductById(item.id);
    if (prod) {
      prod.stock += item.qty;
      prod.sold = Math.max(0, (prod.sold || 0) - item.qty);
      prod.revenue = Math.max(0, (prod.revenue || 0) - (item.price * item.qty));
    }
  });

  // Remove transaction
  state.transactions.splice(txnIndex, 1);
  saveAllData();

  closeModal('undoModal');
  showToast('↩️ Store sale cancelled & stock restored!', 'success');
  refreshCurrentPage();
}

// ===================================================
// PAGE 5: ANALYTICS & EXCEL EXPORT
// ===================================================
function renderAnalytics() {
  const txns = getFilteredTxn(state.analyticsPeriod);
  const villageAnalyticsEl = document.getElementById('villageAnalyticsList');
  const analyticsEl = document.getElementById('productAnalytics');
  const historyEl   = document.getElementById('txnHistoryList');

  // Village Revenue & Production Attributions
  const villageStats = {};
  state.villages.forEach(v => {
    const matBreakdown = getVillageMaterialBreakdown(v.id);
    const prodBreakdown = getVillageProductionBreakdown(v.id);
    villageStats[v.id] = { name: v.name, revenue: 0, unitsSold: 0, matBreakdown, prodBreakdown };
  });

  txns.forEach(t => {
    t.items.forEach(item => {
      if (item.villageId && villageStats[item.villageId]) {
        villageStats[item.villageId].revenue += (item.price * item.qty);
        villageStats[item.villageId].unitsSold += item.qty;
      }
    });
  });

  villageAnalyticsEl.innerHTML = Object.values(villageStats).map(vs => {
    return `
      <div class="analytics-card">
        <div class="analytics-card-header">
          <span class="analytics-emoji">🏡</span>
          <div>
            <div class="analytics-name">${vs.name} Village</div>
            <div class="analytics-category">Village Production & POS Attributions</div>
          </div>
        </div>
        <div class="analytics-metrics">
          <div class="analytics-metric">
            <div class="analytics-metric-val color-orange">${vs.unitsSold}</div>
            <div class="analytics-metric-label">Items Sold</div>
          </div>
          <div class="analytics-metric" style="grid-column: span 2">
            <div class="analytics-metric-val color-green">${formatCurrency(vs.revenue)}</div>
            <div class="analytics-metric-label">Revenue Earned</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          🔨 <strong>Items Produced:</strong> <span style="color:var(--green);">${vs.prodBreakdown}</span>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px">
          🧵 <strong>Raw Material:</strong> <span style="color:var(--accent2);">${vs.matBreakdown}</span>
        </div>
      </div>
    `;
  }).join('');

  // Product Performance
  const productStats = {};
  txns.forEach(t => {
    t.items.forEach(item => {
      if (!productStats[item.id]) {
        productStats[item.id] = { qty: 0, revenue: 0, profit: 0 };
      }
      productStats[item.id].qty     += item.qty;
      productStats[item.id].revenue += item.price * item.qty;
      productStats[item.id].profit  += (item.price - item.cost) * item.qty;
    });
  });

  if (Object.keys(productStats).length === 0) {
    analyticsEl.innerHTML = '<div class="empty-state">No sales data for this period.<br>Record sales in POS!</div>';
  } else {
    const sorted = Object.entries(productStats).sort((a,b) => b[1].revenue - a[1].revenue);
    analyticsEl.innerHTML = sorted.map(([id, stats]) => {
      const p = getProductById(id);
      if (!p) return '';
      return `
        <div class="analytics-card">
          <div class="analytics-card-header">
            <span class="analytics-emoji">${p.emoji || '📦'}</span>
            <div>
              <div class="analytics-name">${p.name}</div>
              <div class="analytics-category">${p.category}</div>
            </div>
          </div>
          <div class="analytics-metrics">
            <div class="analytics-metric">
              <div class="analytics-metric-val color-orange">${stats.qty}</div>
              <div class="analytics-metric-label">Sold</div>
            </div>
            <div class="analytics-metric">
              <div class="analytics-metric-val color-blue">${formatCurrency(stats.revenue)}</div>
              <div class="analytics-metric-label">Revenue</div>
            </div>
            <div class="analytics-metric">
              <div class="analytics-metric-val color-green">${formatCurrency(stats.profit)}</div>
              <div class="analytics-metric-label">Profit</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Sales History
  const sorted = [...txns].sort((a,b) => b.ts - a.ts);
  if (sorted.length === 0) {
    historyEl.innerHTML = '<div class="empty-state">No store transactions in this period.</div>';
  } else {
    historyEl.innerHTML = sorted.map(t => buildTxnCard(t)).join('');
  }
}

// ===================================================
// PAGE 6: PROFILE PAGE
// ===================================================
function renderProfile() {
  const profileContent = document.getElementById('profileContent');
  const profileNotLoggedIn = document.getElementById('profileNotLoggedIn');
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const profileAvatarImg = document.getElementById('profileAvatarImg');
  const profileAvatarFallback = document.getElementById('profileAvatarFallback');

  if (state.currentUser) {
    profileContent.style.display = 'block';
    profileNotLoggedIn.style.display = 'none';

    const nameStr = state.currentUser.displayName || (state.currentUser.email ? state.currentUser.email.split('@')[0] : 'User');
    profileName.textContent = nameStr;
    profileEmail.textContent = state.currentUser.email || '';

    if (state.currentUser.photoURL) {
      profileAvatarImg.src = state.currentUser.photoURL;
      profileAvatarImg.style.display = 'block';
      profileAvatarFallback.style.display = 'none';
    } else {
      profileAvatarImg.style.display = 'none';
      profileAvatarFallback.style.display = 'block';
    }

    document.getElementById('profileStatVillages').textContent = state.villages.length;
    document.getElementById('profileStatArtisans').textContent = state.artisans.length;
  } else {
    profileContent.style.display = 'none';
    profileNotLoggedIn.style.display = 'block';
  }
}

// ===================================================
// HASTKALA MULTI-SHEET EXCEL REPORT (6 Worksheets)
// ===================================================
function generateHastkalaExcelReport() {
  const period = document.getElementById('excelPeriod').value;
  if (typeof XLSX === 'undefined') {
    showToast('Excel library not loaded.', 'error');
    return;
  }

  const wb = XLSX.utils.book_new();
  const txns = getFilteredTxn(period);

  // Sheet 1: Executive Summary
  if (document.getElementById('sheetSummary').checked) {
    let rev = 0, profit = 0, cashTot = 0, upiTot = 0;
    txns.forEach(t => {
      rev += t.total;
      profit += t.profit;
      if (t.paymentMode === 'UPI') upiTot += t.total;
      else cashTot += t.total;
    });
    const summaryData = [
      ['🪡 HASTKALA RURAL ARTISAN & POS REPORT'],
      [`Report Period: ${period.toUpperCase()}`, `Generated: ${new Date().toLocaleString('en-IN')}`],
      [],
      ['Metric', 'Value'],
      ['Total Active Villages', state.villages.length],
      ['Total Women Artisans Registered', state.artisans.length],
      ['Total Plant Raw Material Types', state.rawMaterials.length],
      ['Total Craft Production Logs', state.productionLogs.length],
      ['Total POS Sales Revenue', r2(rev)],
      ['💵 Total Cash Revenue', r2(cashTot)],
      ['📱 Total UPI Revenue', r2(upiTot)],
      ['Total Net Earnings / Profit', r2(profit)],
      ['Total POS Transactions', txns.length]
    ];
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws, '📋 Executive Summary');
  }

  // Sheet 2: Village Performance
  if (document.getElementById('sheetVillages').checked) {
    const vRows = [
      ['Village ID', 'Village Name', 'District / Region', 'Women Artisans Count', 'Raw Material Breakdown', 'Craft Yield Breakdown', 'Total Units Produced', 'POS Store Stock Breakdown', 'Attributed Sales Revenue']
    ];
    state.villages.forEach(v => {
      const vArts = state.artisans.filter(a => a.villageId === v.id);
      const matBreakdown = getVillageMaterialBreakdown(v.id);
      const prodBreakdown = getVillageProductionBreakdown(v.id);
      const posStockBreakdown = getVillagePOSStock(v.id);

      const vProd = state.productionLogs.filter(pr => pr.villageId === v.id);
      let itemsCrafted = 0;
      vProd.forEach(p => itemsCrafted += Number(p.qtyProduced));

      let vRev = 0;
      txns.forEach(t => {
        if (t.items) {
          t.items.forEach(i => {
            if (i.villageId === v.id) vRev += (i.price * i.qty);
          });
        }
      });

      vRows.push([v.id, v.name, v.district || 'Region', vArts.length, matBreakdown, prodBreakdown, itemsCrafted, posStockBreakdown, r2(vRev)]);
    });
    const ws = XLSX.utils.aoa_to_sheet(vRows);
    XLSX.utils.book_append_sheet(wb, ws, '🏡 Village Performance');
  }

  // Sheet 3: Women Artisans Roster with Dynamic Admin Custom Fields
  if (document.getElementById('sheetArtisans').checked) {
    const customHeaderLabels = (state.customArtisanFields || []).map(f => f.label);
    const aHeader = ['Artisan Name', 'Phone Number', 'Village', ...customHeaderLabels, 'Material Received (units)', 'Units Crafted'];
    const aRows = [aHeader];

    state.artisans.forEach(a => {
      const v = getVillageById(a.villageId);
      const aDisp = state.dispatches.filter(d => d.artisanId === a.id);
      let matRec = 0;
      aDisp.forEach(d => matRec += Number(d.qty));

      const aProd = state.productionLogs.filter(pr => pr.artisanId === a.id);
      let unitsCrafted = 0;
      aProd.forEach(p => unitsCrafted += Number(p.qtyProduced));

      const customVals = (state.customArtisanFields || []).map(f => (a.customData && a.customData[f.id]) ? a.customData[f.id] : '');

      aRows.push([a.name, a.phone || '', v ? v.name : '', ...customVals, r2(matRec), unitsCrafted]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aRows);
    XLSX.utils.book_append_sheet(wb, ws, '👩‍🎨 Women Artisans Roster');
  }

  // Sheet 4: Raw Material Dispatches
  if (document.getElementById('sheetMaterials').checked) {
    const mRows = [
      ['Date & Time', 'Raw Material', 'Quantity Dispatched', 'Recipient Artisan / Village', 'Village']
    ];
    state.dispatches.forEach(d => {
      const mat = getRawMaterialById(d.materialId);
      const art = getArtisanById(d.artisanId);
      const vil = getVillageById(d.villageId);
      const recipientStr = art ? art.name : (vil ? `Village ${vil.name}` : '');
      mRows.push([
        new Date(d.ts).toLocaleString('en-IN'),
        mat ? mat.name : '',
        `${d.qty} ${mat ? mat.unit : ''}`,
        recipientStr,
        vil ? vil.name : ''
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(mRows);
    XLSX.utils.book_append_sheet(wb, ws, '🧵 Material Dispatches');
  }

  // Sheet 5: Production Yield Log
  if (document.getElementById('sheetProduction').checked) {
    const pRows = [
      ['Date & Time', 'Artisan Producer', 'Village', 'Finished Product', 'Qty Produced', 'Material Consumed', 'Unit Cost Price', 'POS Sell Price']
    ];
    state.productionLogs.forEach(pr => {
      const art = getArtisanById(pr.artisanId);
      const vil = getVillageById(pr.villageId);
      pRows.push([
        new Date(pr.ts).toLocaleString('en-IN'),
        art ? art.name : '',
        vil ? vil.name : '',
        pr.productName,
        pr.qtyProduced,
        pr.materialUsed || '',
        r2(pr.costPrice),
        r2(pr.sellPrice)
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(pRows);
    XLSX.utils.book_append_sheet(wb, ws, '🔨 Production Yield');
  }

  // Sheet 6: Store POS Sales
  if (document.getElementById('sheetSales').checked) {
    const sRows = [
      ['Transaction Date', 'Customer Name', 'Payment Mode', 'Items Sold', 'Total Sale Amount', 'Net Profit']
    ];
    txns.forEach(t => {
      const itemsStr = t.items.map(i => `${i.qty}x ${i.name}`).join(', ');
      sRows.push([
        new Date(t.ts).toLocaleString('en-IN'),
        t.customerName || 'Walk-in Customer',
        t.paymentMode || 'Cash',
        itemsStr,
        r2(t.total),
        r2(t.profit)
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(sRows);
    XLSX.utils.book_append_sheet(wb, ws, '🛒 POS Store Sales');
  }

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Hastkala_Report_${stamp}.toISOString().slice(0, 10)}.xlsx`);
  closeModal('excelModal');
  showToast('📊 Hastkala .xlsx report downloaded!', 'success');
}

// ===================================================
// EVENT LISTENERS & INIT
// ===================================================
function initEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  const pSearch = document.getElementById('productSearch');
  if (pSearch) {
    pSearch.addEventListener('input', e => renderProductGrid(e.target.value));
  }

  document.getElementById('checkoutBtn').addEventListener('click', openCheckoutModal);
  document.getElementById('confirmSaleBtn').addEventListener('click', confirmSale);
  document.getElementById('closeCheckoutModal').addEventListener('click', () => closeModal('checkoutModal'));
  document.getElementById('cancelCheckout').addEventListener('click', () => closeModal('checkoutModal'));

  document.getElementById('clearCartBtn').addEventListener('click', () => {
    if (state.cart.length === 0) return;
    state.cart = [];
    renderCart();
    showToast('Cart cleared');
  });

  // Excel Export Events
  document.getElementById('openExcelModal').addEventListener('click', () => openModal('excelModal'));
  document.getElementById('closeExcelModal').addEventListener('click', () => closeModal('excelModal'));
  document.getElementById('cancelExcelModal').addEventListener('click', () => closeModal('excelModal'));
  document.getElementById('downloadExcelBtn').addEventListener('click', generateHastkalaExcelReport);

  // Undo Sale Events
  const undoLastBtn = document.getElementById('undoLastBtn');
  if (undoLastBtn) undoLastBtn.addEventListener('click', undoLastSale);
  document.getElementById('closeUndoModal').addEventListener('click', () => closeModal('undoModal'));
  document.getElementById('cancelUndoModal').addEventListener('click', () => closeModal('undoModal'));
  document.getElementById('confirmUndoBtn').addEventListener('click', confirmUndoSale);

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
}

function init() {
  loadData();
  seedSampleData();
  initEvents();
  updateClock();
  setInterval(updateClock, 30000);
  initFirebase();
  navigateTo('home');
}

document.addEventListener('DOMContentLoaded', init);
