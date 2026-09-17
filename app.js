/* ====================================================
   ShopTrack – Mobile POS & Inventory App
   app.js — Complete Application Logic
   ==================================================== */

'use strict';

// ===================================================
// STATE & STORAGE
// ===================================================
const DB_PRODUCTS  = 'shoptrack_products';
const DB_TXN       = 'shoptrack_txn';

let state = {
  products: [],
  transactions: [],
  cart: [],
  currentPage: 'pos',
  analyticsPeriod: 'today',
  inventoryFilter: 'all',
  editingProductId: null,
  restockProductId: null,
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
let authMode = 'login';

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
        state.currentUser = { uid: user.uid, email: user.email };
        updateUserHeaderUI();
        loadUserDataFromFirebase(user.uid);
      } else {
        state.currentUser = null;
        updateUserHeaderUI();
        loadData();
      }
    });
  } catch (err) {
    console.warn('Firebase auth state listener warning:', err);
  }
}

function updateUserHeaderUI() {
  const label = document.getElementById('userAuthLabel');
  const btn = document.getElementById('openAuthModal');
  if (!label || !btn) return;
  if (state.currentUser) {
    const nameStr = state.currentUser.email ? state.currentUser.email.split('@')[0] : 'User';
    label.textContent = `👤 ${nameStr}`;
    btn.classList.add('logged-in');
    btn.title = `Logged in as ${state.currentUser.email}. Click to Log Out.`;
  } else {
    label.textContent = '👤 Log In';
    btn.classList.remove('logged-in');
    btn.title = 'Log In or Sign Up for an account';
  }
}

function openAuthModalClick() {
  if (state.currentUser) {
    if (confirm(`Logged in as ${state.currentUser.email}.\nDo you want to log out?`)) {
      handleLogout();
    }
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
    showToast(`Welcome back, ${user.displayName || user.email}!`, 'success');
    closeModal('authModal');
  } catch (err) {
    console.error('Google Sign-In Error:', err);
    if (err.code === 'auth/popup-closed-by-user') return;
    let msg = err.message || 'Google Sign-In failed.';
    if (err.code === 'auth/unauthorized-domain') {
      msg = 'Domain not authorized in Firebase. Add your Vercel/domain URL in Firebase Console -> Auth -> Settings -> Authorized domains.';
    }
    const errEl = document.getElementById('authErrorMsg');
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    } else {
      showToast(msg, 'error');
    }
  }
}

function switchAuthTab(mode) {
  authMode = mode;
  const loginBtn = document.getElementById('tabLoginBtn');
  const signupBtn = document.getElementById('tabSignupBtn');
  const submitBtn = document.getElementById('authSubmitBtn');
  const errEl = document.getElementById('authErrorMsg');

  if (errEl) errEl.style.display = 'none';

  if (mode === 'login') {
    loginBtn.classList.add('active');
    signupBtn.classList.remove('active');
    submitBtn.textContent = '🔓 Log In';
  } else {
    signupBtn.classList.add('active');
    loginBtn.classList.remove('active');
    submitBtn.textContent = '✨ Create Account';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authErrorMsg');
  const submitBtn = document.getElementById('authSubmitBtn');

  if (errEl) errEl.style.display = 'none';

  const firebaseAuth = getAuth();
  if (!firebaseAuth) {
    if (errEl) {
      errEl.textContent = 'Firebase library not loaded yet. Please check your internet connection.';
      errEl.style.display = 'block';
    } else {
      showToast('Firebase library not loaded yet.', 'error');
    }
    return;
  }

  const origBtnText = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Processing...';
  }

  try {
    if (authMode === 'login') {
      await firebaseAuth.signInWithEmailAndPassword(email, password);
      showToast(`Welcome back, ${email}!`, 'success');
    } else {
      await firebaseAuth.createUserWithEmailAndPassword(email, password);
      showToast(`Account created successfully!`, 'success');
    }
    closeModal('authModal');
  } catch (err) {
    console.error('Firebase Auth Error:', err);
    let msg = err.message || 'Authentication failed.';
    if (err.code === 'auth/user-not-found') msg = 'No account found with this email. Click "Create Account" tab to sign up!';
    if (err.code === 'auth/wrong-password') msg = 'Incorrect password. Please try again.';
    if (err.code === 'auth/invalid-email') msg = 'Please enter a valid email address.';
    if (err.code === 'auth/weak-password') msg = 'Password should be at least 6 characters long.';
    if (err.code === 'auth/email-already-in-use') msg = 'An account already exists with this email. Try logging in instead!';
    if (err.code === 'auth/operation-not-allowed') msg = 'Email/Password login is disabled in Firebase Console. Enable it in Firebase -> Authentication -> Sign-in method.';

    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    } else {
      showToast(msg, 'error');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = origBtnText;
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
      if (state.currentPage === 'home') renderHome();
      else if (state.currentPage === 'pos') renderPOS();
      else if (state.currentPage === 'inventory') renderInventory();
      else if (state.currentPage === 'analytics') renderAnalytics();
    });
  }
}

async function loadUserDataFromFirebase(uid) {
  if (!db) return;
  try {
    const docRef = db.collection('users').doc(uid);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      state.products = data.products || [];
      state.transactions = data.transactions || [];
    } else {
      seedSampleData();
      await docRef.set({
        products: state.products,
        transactions: state.transactions
      });
    }
    saveProducts();
    saveTxn();

    if (state.currentPage === 'home') renderHome();
    else if (state.currentPage === 'pos') renderPOS();
    else if (state.currentPage === 'inventory') renderInventory();
    else if (state.currentPage === 'analytics') renderAnalytics();
  } catch (err) {
    console.warn('Cloud data load error:', err);
  }
}

function saveProducts() {
  localStorage.setItem(DB_PRODUCTS, JSON.stringify(state.products));
  if (state.currentUser && db) {
    db.collection('users').doc(state.currentUser.uid).set({
      products: state.products
    }, { merge: true }).catch(err => console.warn('Cloud save error:', err));
  }
}

function saveTxn() {
  localStorage.setItem(DB_TXN, JSON.stringify(state.transactions));
  if (state.currentUser && db) {
    db.collection('users').doc(state.currentUser.uid).set({
      transactions: state.transactions
    }, { merge: true }).catch(err => console.warn('Cloud save error:', err));
  }
}

function loadData() {
  try {
    const p = localStorage.getItem(DB_PRODUCTS);
    const t = localStorage.getItem(DB_TXN);
    if (p) state.products = JSON.parse(p);
    if (t) state.transactions = JSON.parse(t);
  } catch(e) { console.warn('Load error', e); }
}

// ===================================================
// SAMPLE DATA (first run)
// ===================================================
function seedSampleData() {
  if (state.products.length > 0) return;
  state.products = [
    { id: uid(), name: 'Dairy Milk Chocolate', category: 'Chocolates', costPrice: 15, sellPrice: 20, stock: 50, lowAlert: 10, emoji: '🍫', sold: 0, revenue: 0 },
    { id: uid(), name: 'Lays Classic Chips',   category: 'Snacks',     costPrice: 18, sellPrice: 25, stock: 35, lowAlert: 8,  emoji: '🥔', sold: 0, revenue: 0 },
    { id: uid(), name: 'Coca Cola 250ml',       category: 'Beverages',  costPrice: 22, sellPrice: 30, stock: 20, lowAlert: 5,  emoji: '🥤', sold: 0, revenue: 0 },
    { id: uid(), name: 'KitKat Bar',            category: 'Chocolates', costPrice: 30, sellPrice: 40, stock: 30, lowAlert: 8,  emoji: '🍬', sold: 0, revenue: 0 },
    { id: uid(), name: 'Maggi Noodles',         category: 'Food',       costPrice: 12, sellPrice: 16, stock: 48, lowAlert: 10, emoji: '🍜', sold: 0, revenue: 0 },
    { id: uid(), name: 'Frooti Mango 200ml',    category: 'Beverages',  costPrice: 14, sellPrice: 20, stock: 4,  lowAlert: 8,  emoji: '🥭', sold: 0, revenue: 0 },
  ];
  saveProducts();
}

// ===================================================
// HELPERS
// ===================================================
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function r2(n) { return Number(Number(n).toFixed(2)); }
function pad(n) { return String(n).padStart(2, '0'); }

function formatCurrency(val) {
  return '₹' + Number(val).toFixed(2);
}

function todayStr() {
  return new Date().toDateString();
}

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

function getProductById(id) {
  return state.products.find(p => p.id === id);
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

  if (page === 'home')      renderHome();
  if (page === 'pos')       renderPOS();
  if (page === 'inventory') renderInventory();
  if (page === 'analytics') renderAnalytics();
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
    let g = hour < 12 ? 'Good Morning! 👋' : hour < 17 ? 'Good Afternoon! 👋' : 'Good Evening! 👋';
    greetEl.textContent = g;
  }
  if (dateEl) {
    const d = new Date();
    dateEl.innerHTML = d.toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }).replace(',','<br>');
  }
}

// ===================================================
// HOME PAGE
// ===================================================
function renderHome() {
  updateGreeting();
  const todayTxn = getFilteredTxn('today');
  const allTxn = state.transactions;

  let todayRev = 0, todayProfit = 0, todayItems = 0;
  todayTxn.forEach(t => {
    todayRev += t.total;
    todayProfit += t.profit;
    todayItems += t.items.reduce((s, i) => s + i.qty, 0);
  });
  document.getElementById('todayRevenue').textContent = formatCurrency(todayRev);
  document.getElementById('todayProfit').textContent = formatCurrency(todayProfit);
  document.getElementById('todaySales').textContent = todayTxn.length;
  document.getElementById('todayItems').textContent = todayItems;

  let allRev = 0, allProfit = 0, allCost = 0;
  allTxn.forEach(t => {
    allRev += t.total;
    allProfit += t.profit;
    allCost += (t.total - t.profit);
  });
  document.getElementById('allRevenue').textContent = formatCurrency(allRev);
  document.getElementById('allCost').textContent = formatCurrency(allCost);
  document.getElementById('allProfit').textContent = formatCurrency(allProfit);
  document.getElementById('allTxn').textContent = allTxn.length;

  const lowItems = state.products.filter(p => p.stock <= p.lowAlert);
  const lowSection = document.getElementById('lowStockSection');
  const lowList = document.getElementById('lowStockList');
  if (lowItems.length > 0) {
    lowSection.style.display = 'block';
    lowList.innerHTML = lowItems.map(p => `
      <div class="low-stock-item">
        <span class="low-stock-name">${p.emoji} ${p.name}</span>
        ${p.stock === 0
          ? `<span class="out-of-stock-badge">Out of Stock</span>`
          : `<span class="low-stock-badge">Only ${p.stock} left</span>`}
      </div>
    `).join('');
  } else {
    lowSection.style.display = 'none';
  }

  const recentEl = document.getElementById('recentTxnList');
  const recent = [...allTxn].sort((a,b) => b.ts - a.ts).slice(0, 8);
  if (recent.length === 0) {
    recentEl.innerHTML = '<div class="empty-state">No transactions yet.<br>Go to POS to make a sale!</div>';
  } else {
    recentEl.innerHTML = recent.map(t => buildTxnCard(t)).join('');
  }

  const undoBtn = document.getElementById('undoLastBtn');
  if (undoBtn) {
    if (allTxn.length === 0) {
      undoBtn.style.opacity = '0.5';
      undoBtn.style.pointerEvents = 'none';
    } else {
      undoBtn.style.opacity = '1';
      undoBtn.style.pointerEvents = 'auto';
    }
  }
}

function buildTxnCard(t) {
  const itemList = t.items.map(i => `${i.qty}x ${i.name}`).join(', ');
  return `
    <div class="txn-card">
      <div class="txn-left">
        <div class="txn-time">${formatTime(t.ts)}</div>
        <div class="txn-items">${itemList}</div>
      </div>
      <div class="txn-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="txn-amount">${formatCurrency(t.total)}</div>
        <div class="txn-profit">Profit: ${formatCurrency(t.profit)}</div>
        <button class="txn-undo-btn" title="Undo / Cancel this sale" onclick="openUndoModal('${t.id}')">↩️ Undo</button>
      </div>
    </div>
  `;
}

// ===================================================
// POS PAGE
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
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No products found.<br>Add products in Inventory!</div>';
    return;
  }

  grid.innerHTML = products.map(p => {
    const stockClass = p.stock === 0 ? 'stock-out' : p.stock <= p.lowAlert ? 'stock-low' : 'stock-ok';
    const stockLabel = p.stock === 0 ? 'Out of Stock' : `Qty: ${p.stock}`;
    return `
      <div class="product-card ${p.stock === 0 ? 'out-of-stock' : ''}"
           data-id="${p.id}" onclick="addToCart('${p.id}')">
        <span class="product-stock-badge ${stockClass}">${stockLabel}</span>
        <span class="product-emoji">${p.emoji || '📦'}</span>
        <div class="product-name">${p.name}</div>
        <div class="product-category">${p.category}</div>
        <div class="product-price">${formatCurrency(p.sellPrice)}</div>
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
      showToast(`Only ${product.stock} in stock!`, 'warning');
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
    cartItems.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">Cart is empty. Tap products above to add.</div>';
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
      <span>Your Profit</span>
      <span>${formatCurrency(totalProfit)}</span>
    </div>
  `;
  totalEl.textContent = formatCurrency(total);
  openModal('checkoutModal');
}

function confirmSale() {
  let total = 0, profit = 0;
  const items = [];

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

    items.push({ id: p.id, name: p.name, qty: c.qty, price: p.sellPrice, cost: p.costPrice });
  });

  const txn = { id: uid(), ts: Date.now(), items, total, profit };
  state.transactions.push(txn);
  state.cart = [];

  saveProducts();
  saveTxn();
  closeModal('checkoutModal');
  renderPOS();
  showToast(`✅ Sale recorded! ₹${total.toFixed(2)} earned`, 'success');
}

// ===================================================
// INVENTORY PAGE
// ===================================================
function renderInventory() {
  const list = document.getElementById('inventoryList');
  let products = [...state.products];

  if (state.inventoryFilter === 'low')  products = products.filter(p => p.stock > 0 && p.stock <= p.lowAlert);
  if (state.inventoryFilter === 'out')  products = products.filter(p => p.stock === 0);

  if (products.length === 0) {
    list.innerHTML = '<div class="empty-state">No products to show.<br>Tap "+ Add Product" to get started!</div>';
    return;
  }

  list.innerHTML = products.map(p => {
    const stockClass = p.stock === 0 ? 'out-of-stock' : p.stock <= p.lowAlert ? 'low-stock' : '';
    const numClass = p.stock === 0 ? 'stock-num-out' : p.stock <= p.lowAlert ? 'stock-num-low' : 'stock-num-ok';
    return `
      <div class="inv-card ${stockClass}">
        <div class="inv-emoji">${p.emoji || '📦'}</div>
        <div class="inv-info">
          <div class="inv-name">${p.name}</div>
          <div class="inv-category">${p.category}</div>
          <div class="inv-prices">
            <span>Cost: <strong>${formatCurrency(p.costPrice)}</strong></span>
            <span>Sell: <strong>${formatCurrency(p.sellPrice)}</strong></span>
          </div>
        </div>
        <div class="inv-stock-section">
          <div class="inv-stock-num ${numClass}">${p.stock}</div>
          <div class="inv-stock-label">IN STOCK</div>
        </div>
        <div class="inv-actions">
          <button class="inv-btn restock" onclick="openRestockModal('${p.id}')">📦 Restock</button>
          <button class="inv-btn edit" onclick="openEditProduct('${p.id}')">✏️ Edit</button>
          <button class="inv-btn delete" onclick="deleteProduct('${p.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

// ===================================================
// ANALYTICS PAGE
// ===================================================
function renderAnalytics() {
  const txns = getFilteredTxn(state.analyticsPeriod);
  const analyticsEl = document.getElementById('productAnalytics');
  const historyEl   = document.getElementById('txnHistoryList');

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
    analyticsEl.innerHTML = '<div class="empty-state">No data for this period.<br>Make some sales first!</div>';
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

  const sorted = [...txns].sort((a,b) => b.ts - a.ts);
  if (sorted.length === 0) {
    historyEl.innerHTML = '<div class="empty-state">No transactions in this period.</div>';
  } else {
    historyEl.innerHTML = sorted.map(t => buildTxnCard(t)).join('');
  }
}

// ===================================================
// PRODUCT MODAL (Add / Edit)
// ===================================================
function openAddProduct() {
  state.editingProductId = null;
  document.getElementById('productModalTitle').textContent = 'Add New Product';
  document.getElementById('editProductId').value = '';
  document.getElementById('pName').value = '';
  document.getElementById('pCategory').value = '';
  document.getElementById('pCostPrice').value = '';
  document.getElementById('pSellPrice').value = '';
  document.getElementById('pStock').value = '';
  document.getElementById('pLowAlert').value = '5';
  document.getElementById('pEmoji').value = '📦';
  openModal('productModal');
}

function openEditProduct(id) {
  const p = getProductById(id);
  if (!p) return;
  state.editingProductId = id;
  document.getElementById('productModalTitle').textContent = 'Edit Product';
  document.getElementById('editProductId').value = id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pCategory').value = p.category;
  document.getElementById('pCostPrice').value = p.costPrice;
  document.getElementById('pSellPrice').value = p.sellPrice;
  document.getElementById('pStock').value = p.stock;
  document.getElementById('pLowAlert').value = p.lowAlert;
  document.getElementById('pEmoji').value = p.emoji || '📦';
  openModal('productModal');
}

function saveProduct() {
  const name = document.getElementById('pName').value.trim();
  const category = document.getElementById('pCategory').value.trim() || 'General';
  const costPrice = parseFloat(document.getElementById('pCostPrice').value);
  const sellPrice = parseFloat(document.getElementById('pSellPrice').value);
  const stock = parseInt(document.getElementById('pStock').value);
  const lowAlert = parseInt(document.getElementById('pLowAlert').value) || 5;
  const emoji = document.getElementById('pEmoji').value.trim() || '📦';

  if (!name || isNaN(costPrice) || isNaN(sellPrice) || isNaN(stock)) {
    showToast('Please fill all required fields!', 'error');
    return;
  }
  if (sellPrice < costPrice) {
    showToast('⚠️ Sell price is less than cost price!', 'warning');
  }

  if (state.editingProductId) {
    const p = getProductById(state.editingProductId);
    if (p) {
      p.name = name; p.category = category; p.costPrice = costPrice;
      p.sellPrice = sellPrice; p.stock = stock; p.lowAlert = lowAlert; p.emoji = emoji;
    }
    showToast('Product updated!', 'success');
  } else {
    state.products.push({
      id: uid(), name, category, costPrice, sellPrice,
      stock, lowAlert, emoji, sold: 0, revenue: 0
    });
    showToast('Product added!', 'success');
  }

  saveProducts();
  closeModal('productModal');
  if (state.currentPage === 'inventory') renderInventory();
  if (state.currentPage === 'pos') renderPOS();
}

function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  state.products = state.products.filter(p => p.id !== id);
  state.cart = state.cart.filter(c => c.id !== id);
  saveProducts();
  renderInventory();
  showToast('Product deleted', 'error');
}

// ===================================================
// RESTOCK MODAL
// ===================================================
function openRestockModal(id) {
  const p = getProductById(id);
  if (!p) return;
  state.restockProductId = id;
  document.getElementById('restockProductId').value = id;
  document.getElementById('restockQty').value = 10;
  document.getElementById('restockProductInfo').innerHTML = `
    <div style="font-size:32px;margin-bottom:6px">${p.emoji || '📦'}</div>
    <div style="font-size:15px;font-weight:700">${p.name}</div>
    <div style="font-size:13px;color:var(--text2);margin-top:4px">Current stock: <strong style="color:var(--orange)">${p.stock}</strong></div>
  `;
  openModal('restockModal');
}

function confirmRestock() {
  const id = document.getElementById('restockProductId').value;
  const qty = parseInt(document.getElementById('restockQty').value);
  if (!id || isNaN(qty) || qty <= 0) {
    showToast('Enter a valid quantity', 'error');
    return;
  }
  const p = getProductById(id);
  if (!p) return;
  p.stock += qty;
  saveProducts();
  closeModal('restockModal');
  showToast(`✅ +${qty} added to ${p.name}!`, 'success');
  if (state.currentPage === 'inventory') renderInventory();
  if (state.currentPage === 'pos') renderProductGrid();
  if (state.currentPage === 'home') renderHome();
}

// ===================================================
// UNDO / CANCEL SALE LOGIC
// ===================================================
function undoLastSale() {
  if (!state.transactions || state.transactions.length === 0) {
    showToast('No transactions to undo', 'error');
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
    ${itemsHtml}
    <div class="undo-detail-total">
      <span>Total to Refund</span>
      <strong>${formatCurrency(txn.total)}</strong>
    </div>
    <div class="undo-restore-note">
      📦 Restores ${txn.items.reduce((acc, i) => acc + i.qty, 0)} item(s) back to inventory stock
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
    }
  });

  // Remove transaction
  state.transactions.splice(txnIndex, 1);
  saveTxn();
  saveProducts();

  closeModal('undoModal');
  showToast('↩️ Sale cancelled & stock restored!', 'success');

  // Refresh current view
  if (state.currentPage === 'home') renderHome();
  else if (state.currentPage === 'pos') renderPOS();
  else if (state.currentPage === 'inventory') renderInventory();
  else if (state.currentPage === 'analytics') renderAnalytics();
}

// ===================================================
// MODAL HELPERS
// ===================================================
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ===================================================
// EVENT LISTENERS
// ===================================================
function initEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  document.getElementById('productSearch').addEventListener('input', e => {
    renderProductGrid(e.target.value);
  });

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

  document.getElementById('openAddProductModal').addEventListener('click', openAddProduct);
  document.getElementById('closeProductModal').addEventListener('click', () => closeModal('productModal'));
  document.getElementById('cancelProductModal').addEventListener('click', () => closeModal('productModal'));
  document.getElementById('saveProductBtn').addEventListener('click', saveProduct);

  document.getElementById('closeRestockModal').addEventListener('click', () => closeModal('restockModal'));
  document.getElementById('cancelRestockModal').addEventListener('click', () => closeModal('restockModal'));
  document.getElementById('confirmRestockBtn').addEventListener('click', confirmRestock);
  document.getElementById('restockMinus').addEventListener('click', () => {
    const inp = document.getElementById('restockQty');
    inp.value = Math.max(1, parseInt(inp.value || 1) - 1);
  });
  document.getElementById('restockPlus').addEventListener('click', () => {
    const inp = document.getElementById('restockQty');
    inp.value = parseInt(inp.value || 0) + 1;
  });
  document.querySelectorAll('.quick-qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById('restockQty');
      inp.value = parseInt(btn.dataset.qty);
    });
  });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.inventoryFilter = chip.dataset.filter;
      renderInventory();
    });
  });

  document.querySelectorAll('.period-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.analyticsPeriod = tab.dataset.period;
      renderAnalytics();
    });
  });

  // Excel Export
  document.getElementById('openExcelModal').addEventListener('click', () => openModal('excelModal'));
  document.getElementById('closeExcelModal').addEventListener('click', () => closeModal('excelModal'));
  document.getElementById('cancelExcelModal').addEventListener('click', () => closeModal('excelModal'));
  document.getElementById('downloadExcelBtn').addEventListener('click', generateExcelReport);

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

// ===================================================
// EXCEL EXPORT  –  Detailed 6-Sheet Report
// ===================================================
function generateExcelReport() {
  const period       = document.getElementById('excelPeriod').value;
  const wantSummary  = document.getElementById('sheetSummary').checked;
  const wantProducts = document.getElementById('sheetProducts').checked;
  const wantTxn      = document.getElementById('sheetTransactions').checked;
  const wantInv      = document.getElementById('sheetInventory').checked;

  if (!wantSummary && !wantProducts && !wantTxn && !wantInv) {
    showToast('Select at least one sheet!', 'error');
    return;
  }
  if (typeof XLSX === 'undefined') {
    showToast('Excel library not loaded. Check internet connection.', 'error');
    return;
  }

  const allTxns      = state.transactions;
  const filteredTxns = getFilteredTxn(period);
  const wb           = XLSX.utils.book_new();
  const periodLabel  = period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'All Time';
  const generatedAt  = new Date().toLocaleString('en-IN');
  const storeName    = 'ShopTrack Store';

  // ── helper: build totals from a txn list ──────────────
  function buildTotals(txList) {
    let rev = 0, profit = 0, items = 0;
    txList.forEach(t => {
      rev    += t.total;
      profit += t.profit;
      items  += t.items.reduce((s, i) => s + i.qty, 0);
    });
    return { rev, profit, cost: rev - profit, items, txCount: txList.length,
             margin: rev > 0 ? r2(profit / rev * 100) : 0 };
  }

  // ══════════════════════════════════════════════════════
  // SHEET 1: SUMMARY DASHBOARD
  // ══════════════════════════════════════════════════════
  if (wantSummary) {
    const todayT  = buildTotals(getFilteredTxn('today'));
    const weekT   = buildTotals(getFilteredTxn('week'));
    const selT    = buildTotals(filteredTxns);
    const allT    = buildTotals(allTxns);

    const lowCount = state.products.filter(p => p.stock > 0 && p.stock <= p.lowAlert).length;
    const outCount = state.products.filter(p => p.stock === 0).length;

    // best seller by qty
    let bestSeller = '(no sales yet)';
    const bsMap = {};
    allTxns.forEach(t => t.items.forEach(i => { bsMap[i.name] = (bsMap[i.name]||0) + i.qty; }));
    const bsArr = Object.entries(bsMap).sort((a,b) => b[1]-a[1]);
    if (bsArr.length) bestSeller = `${bsArr[0][0]}  (${bsArr[0][1]} units)`;

    // most profitable product
    let topProfit = '(no sales yet)';
    const pfMap = {};
    allTxns.forEach(t => t.items.forEach(i => {
      pfMap[i.name] = (pfMap[i.name]||0) + (i.price - i.cost) * i.qty;
    }));
    const pfArr = Object.entries(pfMap).sort((a,b) => b[1]-a[1]);
    if (pfArr.length) topProfit = `${pfArr[0][0]}  (₹${r2(pfArr[0][1])})`;

    const data = [
      [`${storeName}  —  Sales & Inventory Report`],
      [`Report Period Selected: ${periodLabel}`],
      [`Generated At: ${generatedAt}`],
      [`Total Products in Catalogue: ${state.products.length}`],
      [],
      ['━━━━━━━━━━━━  TODAY\'S SNAPSHOT  ━━━━━━━━━━━━'],
      ['Metric', 'Value'],
      ['Transactions Today',           todayT.txCount],
      ['Items Sold Today',             todayT.items],
      ['Revenue Today (₹)',            r2(todayT.rev)],
      ['Cost Today (₹)',               r2(todayT.cost)],
      ['Net Profit Today (₹)',         r2(todayT.profit)],
      ['Profit Margin Today (%)',       r2(todayT.margin)],
      [],
      ['━━━━━━━━━━━━  THIS WEEK  ━━━━━━━━━━━━'],
      ['Metric', 'Value'],
      ['Transactions This Week',       weekT.txCount],
      ['Items Sold This Week',         weekT.items],
      ['Revenue This Week (₹)',        r2(weekT.rev)],
      ['Net Profit This Week (₹)',     r2(weekT.profit)],
      ['Profit Margin This Week (%)',   r2(weekT.margin)],
      [],
      [`━━━━━━━━━━━━  ${periodLabel.toUpperCase()} (SELECTED)  ━━━━━━━━━━━━`],
      ['Metric', 'Value'],
      [`Total Transactions`,           selT.txCount],
      [`Items Sold`,                   selT.items],
      [`Gross Revenue (₹)`,            r2(selT.rev)],
      [`Total Cost of Goods Sold (₹)`, r2(selT.cost)],
      [`Net Profit (₹)`,               r2(selT.profit)],
      [`Profit Margin (%)`,            r2(selT.margin)],
      [],
      ['━━━━━━━━━━━━  ALL-TIME TOTALS  ━━━━━━━━━━━━'],
      ['Metric', 'Value'],
      ['All-Time Transactions',        allT.txCount],
      ['All-Time Items Sold',          allT.items],
      ['All-Time Gross Revenue (₹)',   r2(allT.rev)],
      ['All-Time Total Cost (₹)',      r2(allT.cost)],
      ['All-Time Net Profit (₹)',      r2(allT.profit)],
      ['Average Profit Margin (%)',    r2(allT.margin)],
      [],
      ['━━━━━━━━━━━━  INVENTORY HEALTH  ━━━━━━━━━━━━'],
      ['Metric', 'Value'],
      ['Total Products Catalogued',    state.products.length],
      ['Products with Low Stock',      lowCount],
      ['Products Out of Stock',        outCount],
      ['Best-Selling Product',         bestSeller],
      ['Most Profitable Product',      topProfit],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    autoColWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, '📋 Summary');
  }

  // ══════════════════════════════════════════════════════
  // SHEET 2: STOCK & SALES MASTER  (the key sheet)
  // ══════════════════════════════════════════════════════
  if (wantInv) {
    // Build sold/revenue for the selected period
    const periodSoldMap = {};
    filteredTxns.forEach(t => {
      t.items.forEach(item => {
        if (!periodSoldMap[item.id]) periodSoldMap[item.id] = { qty: 0, revenue: 0, profit: 0 };
        periodSoldMap[item.id].qty     += item.qty;
        periodSoldMap[item.id].revenue += item.price * item.qty;
        periodSoldMap[item.id].profit  += (item.price - item.cost) * item.qty;
      });
    });

    const header = [
      [`${storeName}  —  Stock & Sales Master Sheet`],
      [`Period: ${periodLabel}   |   Generated: ${generatedAt}`],
      [],
      [
        '#',
        'Product Name',
        'Category',
        // STOCK columns
        'Stock Remaining (NOW)',
        'Low-Stock Alert At',
        'Stock Status',
        'Units Short of Alert',
        // SALES — Period
        `Units Sold (${periodLabel})`,
        `Revenue (${periodLabel}) ₹`,
        `Cost of Goods (${periodLabel}) ₹`,
        `Net Profit (${periodLabel}) ₹`,
        `Profit Margin (${periodLabel}) %`,
        // SALES — All Time
        'Units Sold (All Time)',
        'Revenue All Time ₹',
        'Profit All Time ₹',
        // PRICING
        'Cost Price per Unit ₹',
        'Sell Price per Unit ₹',
        'Profit per Unit ₹',
        'Margin per Unit %',
        // ESTIMATED
        'Est. Revenue if All Stock Sold ₹',
        'Est. Profit if All Stock Sold ₹',
      ]
    ];

    const rows = state.products.map((p, idx) => {
      const profitPerUnit  = r2(p.sellPrice - p.costPrice);
      const marginPct      = p.sellPrice > 0 ? r2(profitPerUnit / p.sellPrice * 100) : 0;
      const status         = p.stock === 0 ? 'OUT OF STOCK' : p.stock <= p.lowAlert ? 'LOW STOCK' : 'OK';
      const unitsShort     = p.stock < p.lowAlert ? p.lowAlert - p.stock : 0;
      const ps             = periodSoldMap[p.id] || { qty: 0, revenue: 0, profit: 0 };
      const periodCOGS     = r2(ps.qty * p.costPrice);
      const periodMargin   = ps.revenue > 0 ? r2(ps.profit / ps.revenue * 100) : 0;
      const allTimeSold    = p.sold || 0;
      const allTimeRevenue = r2(p.revenue || 0);
      const allTimeProfit  = r2(allTimeSold * profitPerUnit);
      const estRev         = r2(p.stock * p.sellPrice);
      const estProfit      = r2(p.stock * profitPerUnit);

      return [
        idx + 1,
        p.name,
        p.category,
        p.stock,
        p.lowAlert,
        status,
        unitsShort,
        ps.qty,
        r2(ps.revenue),
        periodCOGS,
        r2(ps.profit),
        periodMargin,
        allTimeSold,
        allTimeRevenue,
        allTimeProfit,
        r2(p.costPrice),
        r2(p.sellPrice),
        profitPerUnit,
        marginPct,
        estRev,
        estProfit,
      ];
    });

    // Grand totals row
    const sumCol = (col) => rows.reduce((s, r) => s + (typeof r[col] === 'number' ? r[col] : 0), 0);
    rows.push([]);
    rows.push([
      '', 'GRAND TOTAL', '',
      sumCol(3),   // stock remaining
      '', '', '',
      sumCol(7),   // period units sold
      r2(sumCol(8)),  // period revenue
      r2(sumCol(9)),  // period COGS
      r2(sumCol(10)), // period profit
      '',
      sumCol(12),  // all-time sold
      r2(sumCol(13)), // all-time revenue
      r2(sumCol(14)), // all-time profit
      '', '', '', '',
      r2(sumCol(19)), // est rev
      r2(sumCol(20)), // est profit
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
    autoColWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, '📦 Stock & Sales');
  }

  // ══════════════════════════════════════════════════════
  // SHEET 3: PRODUCT PERFORMANCE DEEP DIVE
  // ══════════════════════════════════════════════════════
  if (wantProducts) {
    const statsMap = {};
    allTxns.forEach(t => {
      t.items.forEach(item => {
        if (!statsMap[item.id]) {
          const p = getProductById(item.id);
          statsMap[item.id] = {
            name: item.name,
            category: p ? p.category : '—',
            cost: item.cost,
            sell: item.price,
            qty: 0, revenue: 0, totalCost: 0, profit: 0, txnCount: 0
          };
        }
        const s = statsMap[item.id];
        s.qty       += item.qty;
        s.revenue   += item.price * item.qty;
        s.totalCost += item.cost  * item.qty;
        s.profit    += (item.price - item.cost) * item.qty;
        s.txnCount  += 1;
      });
    });

    const allStats = Object.values(statsMap).sort((a,b) => b.revenue - a.revenue);
    const totalRevAll = allStats.reduce((s,x) => s + x.revenue, 0);

    const header = [
      [`${storeName}  —  Product Performance Deep Dive (All Time)`],
      [`Generated: ${generatedAt}`],
      [],
      [
        'Rank',
        'Product Name',
        'Category',
        'Cost Price (₹)',
        'Sell Price (₹)',
        'Profit Per Unit (₹)',
        'Margin Per Unit (%)',
        'Total Units Sold',
        'Appeared in # Transactions',
        'Avg Units Per Transaction',
        'Gross Revenue (₹)',
        'Total COGS (₹)',
        'Net Profit (₹)',
        'Profit Margin (%)',
        'Revenue Share of Store (%)',
        'Stock Remaining Now',
        'Est. Revenue from Remaining Stock (₹)',
        'Est. Profit from Remaining Stock (₹)',
      ]
    ];

    const dataRows = allStats.map((s, idx) => {
      const p          = state.products.find(x => x.id === Object.keys({...statsMap}).find(k => statsMap[k] === s));
      const pObj       = getProductById(Object.keys(statsMap).find(k => statsMap[k] === s));
      const marginPct  = s.revenue > 0 ? r2(s.profit / s.revenue * 100) : 0;
      const revShare   = totalRevAll > 0 ? r2(s.revenue / totalRevAll * 100) : 0;
      const avgPerTxn  = s.txnCount > 0 ? r2(s.qty / s.txnCount) : 0;
      const stockLeft  = pObj ? pObj.stock : '—';
      const estRev     = typeof stockLeft === 'number' ? r2(stockLeft * s.sell) : '—';
      const estProfit  = typeof stockLeft === 'number' ? r2(stockLeft * (s.sell - s.cost)) : '—';

      return [
        idx + 1,
        s.name,
        s.category,
        r2(s.cost),
        r2(s.sell),
        r2(s.sell - s.cost),
        r2((s.sell - s.cost) / s.sell * 100),
        s.qty,
        s.txnCount,
        avgPerTxn,
        r2(s.revenue),
        r2(s.totalCost),
        r2(s.profit),
        marginPct,
        revShare,
        stockLeft,
        estRev,
        estProfit,
      ];
    });

    const sumR = (col) => dataRows.reduce((s,r) => s + (typeof r[col]==='number' ? r[col] : 0), 0);
    dataRows.push([]);
    dataRows.push([
      '', 'TOTAL', '',
      '', '', '', '',
      sumR(7),        // units sold
      sumR(8),        // txn count
      '',
      r2(sumR(10)),   // revenue
      r2(sumR(11)),   // COGS
      r2(sumR(12)),   // profit
      '', '100%', '', '', ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...header, ...dataRows]);
    autoColWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, '📈 Product Deep Dive');
  }

  // ══════════════════════════════════════════════════════
  // SHEET 4: TRANSACTION LINE ITEMS (one row per item per sale)
  // ══════════════════════════════════════════════════════
  if (wantTxn) {
    const header = [
      [`${storeName}  —  Transaction Line Items  (${periodLabel})`],
      [`Generated: ${generatedAt}   |   Total Transactions: ${filteredTxns.length}`],
      [],
      [
        'Txn #',
        'Transaction ID',
        'Date',
        'Time',
        'Day',
        'Product Name',
        'Category',
        'Qty Sold',
        'Cost Price/Unit (₹)',
        'Sell Price/Unit (₹)',
        'Profit/Unit (₹)',
        'Line Revenue (₹)',
        'Line Cost (₹)',
        'Line Profit (₹)',
        'Txn Total (₹)',
        'Txn Total Profit (₹)',
      ]
    ];

    const rows = [];
    [...filteredTxns].sort((a,b) => b.ts - a.ts).forEach((t, txIdx) => {
      const d       = new Date(t.ts);
      const date    = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
      const time    = d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: true });
      const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });

      t.items.forEach((item, iIdx) => {
        const pObj       = getProductById(item.id);
        const unitProfit = r2(item.price - item.cost);
        rows.push([
          iIdx === 0 ? txIdx + 1 : '',
          iIdx === 0 ? t.id.toUpperCase() : '',
          iIdx === 0 ? date : '',
          iIdx === 0 ? time : '',
          iIdx === 0 ? dayName : '',
          item.name,
          pObj ? pObj.category : '—',
          item.qty,
          r2(item.cost),
          r2(item.price),
          unitProfit,
          r2(item.price * item.qty),
          r2(item.cost  * item.qty),
          r2(unitProfit * item.qty),
          iIdx === 0 ? r2(t.total)  : '',
          iIdx === 0 ? r2(t.profit) : '',
        ]);
      });

      rows.push(Array(16).fill(''));  // blank row between transactions
    });

    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
    autoColWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, '🧾 Txn Line Items');
  }

  // ══════════════════════════════════════════════════════
  // SHEET 5: DAILY SALES BREAKDOWN (always included)
  // ══════════════════════════════════════════════════════
  {
    const dayMap = {};
    allTxns.forEach(t => {
      const d   = new Date(t.ts);
      const key = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
      if (!dayMap[key]) dayMap[key] = { ts: t.ts, txCount: 0, items: 0, revenue: 0, profit: 0 };
      dayMap[key].txCount += 1;
      dayMap[key].items   += t.items.reduce((s,i) => s + i.qty, 0);
      dayMap[key].revenue += t.total;
      dayMap[key].profit  += t.profit;
    });

    const header = [
      [`${storeName}  —  Daily Sales Breakdown (All Time)`],
      [`Generated: ${generatedAt}`],
      [],
      ['Date', 'Day of Week', 'Transactions', 'Items Sold', 'Revenue (₹)', 'Cost (₹)', 'Net Profit (₹)', 'Profit Margin (%)']
    ];

    const dayRows = Object.entries(dayMap)
      .sort((a,b) => b[1].ts - a[1].ts)
      .map(([date, d]) => {
        const dayName = new Date(d.ts).toLocaleDateString('en-IN', { weekday: 'long' });
        const cost    = r2(d.revenue - d.profit);
        const margin  = d.revenue > 0 ? r2(d.profit / d.revenue * 100) : 0;
        return [date, dayName, d.txCount, d.items, r2(d.revenue), cost, r2(d.profit), margin];
      });

    if (dayRows.length === 0) dayRows.push(['No transactions recorded yet.']);
    else {
      const sumD = (col) => dayRows.reduce((s,r) => s+(typeof r[col]==='number'?r[col]:0), 0);
      dayRows.push([]);
      dayRows.push(['TOTAL', '', sumD(2), sumD(3), r2(sumD(4)), r2(sumD(5)), r2(sumD(6)), '']);
    }

    const ws = XLSX.utils.aoa_to_sheet([...header, ...dayRows]);
    autoColWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, '📅 Daily Breakdown');
  }

  // ══════════════════════════════════════════════════════
  // SHEET 6: STOCK ALERT SHEET (always included)
  // ══════════════════════════════════════════════════════
  {
    const alertHeader = [
      [`${storeName}  —  Stock Alert & Restock Guide`],
      [`Generated: ${generatedAt}`],
      [],
      [
        'Product Name',
        'Category',
        'Current Stock',
        'Low-Stock Alert At',
        'Units Below Alert',
        'Sell Price (₹)',
        'Cost Price (₹)',
        'Profit/Unit (₹)',
        'Stock Status',
        'All-Time Units Sold',
        'Avg Daily Sales (est.)',
        'Est. Days Until Out of Stock',
        'Est. Revenue Lost if Not Restocked (₹)',
        'Recommended Restock Qty',
      ]
    ];

    // Calculate avg daily sales for each product
    const firstTxnDate = allTxns.length > 0 ? new Date(Math.min(...allTxns.map(t => t.ts))) : new Date();
    const daysSinceFirst = Math.max(1, Math.ceil((Date.now() - firstTxnDate) / 86400000));

    const alertProducts = state.products
      .filter(p => p.stock <= p.lowAlert)
      .sort((a,b) => a.stock - b.stock);

    const alertRows = alertProducts.map(p => {
      const shortage      = Math.max(0, p.lowAlert - p.stock);
      const profitPerUnit = r2(p.sellPrice - p.costPrice);
      const status        = p.stock === 0 ? 'OUT OF STOCK' : 'LOW STOCK';
      const avgDaily      = r2((p.sold || 0) / daysSinceFirst);
      const daysLeft      = avgDaily > 0 ? r2(p.stock / avgDaily) : '∞';
      const estLoss       = r2(p.sellPrice * shortage);
      const recommended   = Math.max(p.lowAlert * 3, 20);

      return [
        p.name,
        p.category,
        p.stock,
        p.lowAlert,
        shortage,
        r2(p.sellPrice),
        r2(p.costPrice),
        profitPerUnit,
        status,
        p.sold || 0,
        avgDaily,
        daysLeft,
        estLoss,
        recommended,
      ];
    });

    if (alertRows.length === 0) {
      alertRows.push(['✅ All products are well-stocked! No alerts at this time.']);
    }

    const ws = XLSX.utils.aoa_to_sheet([...alertHeader, ...alertRows]);
    autoColWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, '⚠️ Stock Alerts');
  }

  // ── Download ──────────────────────────────────────────
  const now   = new Date();
  const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const fname = `ShopTrack_Report_${stamp}.xlsx`;

  XLSX.writeFile(wb, fname);
  closeModal('excelModal');
  showToast(`📊 ${fname} downloaded!`, 'success');
}

/** Auto-size column widths based on content */
function autoColWidth(ws) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const colWidths = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let maxLen = 10;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v != null) maxLen = Math.max(maxLen, String(cell.v).length + 2);
    }
    colWidths.push({ wch: Math.min(maxLen, 45) });
  }
  ws['!cols'] = colWidths;
}

// ===================================================
// INIT
// ===================================================
function init() {
  loadData();
  seedSampleData();
  initEvents();
  updateClock();
  setInterval(updateClock, 30000);
  navigateTo('pos');
}

document.addEventListener('DOMContentLoaded', init);
