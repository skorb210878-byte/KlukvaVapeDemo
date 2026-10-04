// Единственная точка доступа к данным. В Фазе 2 эти функции заменятся на вызовы API,
// остальной код приложения менять не придётся.

import { config } from './config.js';

const LS_KEYS = {
  age: 'klukva.ageConfirmed',
  cart: 'klukva.cart',
  orders: 'klukva.orders',
  overrides: 'klukva.overrides',
  customProducts: 'klukva.customProducts',
  catalogView: 'klukva.catalogView',
};

let dataPromise = null;

function loadRaw() {
  if (!dataPromise) {
    dataPromise = fetch('data/products.json').then((r) => r.json());
  }
  return dataPromise;
}

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function seedOrdersIfEmpty() {
  const existing = readLS(LS_KEYS.orders, null);
  if (existing) return existing;
  const now = Date.now();
  const seeded = [
    {
      id: 'demo-1000',
      items: [{ productId: 4, name: 'Холодная дыня 30мл', price: 650, qty: 1 }],
      total: 650,
      customer: { name: 'Светлана', phone: '+7 900 111-22-33', method: 'pickup', address: '', comment: '' },
      status: 'new',
      createdAt: now - 1000 * 60 * 10,
    },
    {
      id: 'demo-1001',
      items: [
        { productId: 1, name: 'Лесная клюква 30мл', price: 590, qty: 2 },
        { productId: 12, name: 'Картридж сменный x2', price: 390, qty: 1 },
      ],
      total: 590 * 2 + 390,
      customer: { name: 'Алексей', phone: '+7 900 123-45-67', method: 'pickup', address: '', comment: '' },
      status: 'done',
      createdAt: now - 1000 * 60 * 60 * 24 * 3,
    },
    {
      id: 'demo-1002',
      items: [{ productId: 7, name: 'Устройство «Компакт»', price: 1990, qty: 1 }],
      total: 1990,
      customer: { name: 'Мария', phone: '+7 900 765-43-21', method: 'delivery', address: 'г. Москва, ул. Примерная, 5', comment: 'Позвонить перед доставкой' },
      status: 'processing',
      createdAt: now - 1000 * 60 * 60 * 5,
    },
  ];
  writeLS(LS_KEYS.orders, seeded);
  return seeded;
}

async function getMergedProducts() {
  const raw = await loadRaw();
  const overrides = readLS(LS_KEYS.overrides, {});
  const custom = readLS(LS_KEYS.customProducts, []);
  const base = raw.products.map((p) => ({ ...p, ...(overrides[p.id] || {}) }));
  return [...base, ...custom];
}

// --- Возрастной гейт ---

export function isAgeConfirmed() {
  return readLS(LS_KEYS.age, false) === true;
}

export function confirmAge() {
  writeLS(LS_KEYS.age, true);
}

// --- Вид каталога (плитки/список) ---

export function getCatalogView() {
  const view = readLS(LS_KEYS.catalogView, 'grid');
  return view === 'list' ? 'list' : 'grid';
}

export function setCatalogView(view) {
  writeLS(LS_KEYS.catalogView, view === 'list' ? 'list' : 'grid');
}

// --- Каталог ---

export async function getCategories() {
  const raw = await loadRaw();
  return raw.categories;
}

export async function getProducts({ q = '', categoryId = 'all', inStock = false, sort = 'default', offset = 0, limit = 20 } = {}) {
  let items = await getMergedProducts();

  if (categoryId && categoryId !== 'all') {
    items = items.filter((p) => p.category === categoryId);
  }
  if (inStock) {
    items = items.filter((p) => p.in_stock);
  }
  if (q && q.trim()) {
    const needle = q.trim().toLocaleLowerCase('ru');
    items = items.filter((p) => p.name.toLocaleLowerCase('ru').includes(needle));
  }

  if (sort === 'price-asc') {
    items = [...items].sort((a, b) => a.price - b.price);
  } else if (sort === 'price-desc') {
    items = [...items].sort((a, b) => b.price - a.price);
  } else if (sort === 'name') {
    items = [...items].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  const total = items.length;
  const page = items.slice(offset, offset + limit);
  return { items: page, total, hasMore: offset + limit < total };
}

export async function getProduct(id) {
  const items = await getMergedProducts();
  return items.find((p) => String(p.id) === String(id)) || null;
}

// --- Корзина ---

export function getCart() {
  return readLS(LS_KEYS.cart, []);
}

export function addToCart(productId, qty = 1) {
  const cart = getCart();
  const existing = cart.find((i) => String(i.productId) === String(productId));
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ productId, qty });
  }
  writeLS(LS_KEYS.cart, cart);
  return cart;
}

export function setCartQty(productId, qty) {
  let cart = getCart();
  if (qty <= 0) {
    cart = cart.filter((i) => String(i.productId) !== String(productId));
  } else {
    const existing = cart.find((i) => String(i.productId) === String(productId));
    if (existing) existing.qty = qty;
  }
  writeLS(LS_KEYS.cart, cart);
  return cart;
}

export function removeFromCart(productId) {
  const cart = getCart().filter((i) => String(i.productId) !== String(productId));
  writeLS(LS_KEYS.cart, cart);
  return cart;
}

export function clearCart() {
  writeLS(LS_KEYS.cart, []);
}

export async function getCartDetailed() {
  const cart = getCart();
  const detailed = [];
  for (const item of cart) {
    const product = await getProduct(item.productId);
    if (product) detailed.push({ product, qty: item.qty });
  }
  return detailed;
}

// --- Заказы (демо: только localStorage, никуда не отправляются) ---

export function createOrder({ customer, items, total }) {
  const orders = seedOrdersIfEmpty();
  const order = {
    id: 'order-' + Date.now(),
    items,
    total,
    customer,
    status: 'new',
    createdAt: Date.now(),
  };
  orders.unshift(order);
  writeLS(LS_KEYS.orders, orders);
  clearCart();
  return order;
}

export function getMyOrders() {
  return seedOrdersIfEmpty().slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function adminSetOrderStatus(orderId, status) {
  const orders = seedOrdersIfEmpty();
  const order = orders.find((o) => o.id === orderId);
  if (order) order.status = status;
  writeLS(LS_KEYS.orders, orders);
  return order;
}

// Отмена заказа клиентом. Разрешено только из статусов в config.cancellableStatuses —
// этой же функцией пользуется и админка (см. store.getMyOrders в admin.js).
export function cancelOrder(orderId) {
  const orders = seedOrdersIfEmpty();
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    return { ok: false, error: 'Заказ не найден.' };
  }
  if (!config.cancellableStatuses.includes(order.status)) {
    return { ok: false, error: 'Этот заказ уже нельзя отменить.' };
  }
  order.status = 'cancelled';
  writeLS(LS_KEYS.orders, orders);
  return { ok: true, order };
}

// --- Админка: товары ---

export async function adminGetAllProducts() {
  return getMergedProducts();
}

export function adminUpdateProduct(id, patch) {
  const overrides = readLS(LS_KEYS.overrides, {});
  const custom = readLS(LS_KEYS.customProducts, []);
  const isCustom = custom.some((p) => String(p.id) === String(id));
  if (isCustom) {
    const updated = custom.map((p) => (String(p.id) === String(id) ? { ...p, ...patch } : p));
    writeLS(LS_KEYS.customProducts, updated);
  } else {
    overrides[id] = { ...(overrides[id] || {}), ...patch };
    writeLS(LS_KEYS.overrides, overrides);
  }
}

export function adminAddProduct(data) {
  const custom = readLS(LS_KEYS.customProducts, []);
  const newProduct = {
    id: 'custom-' + Date.now(),
    sku: data.sku || '—',
    name: data.name,
    description: data.description || '',
    price: Number(data.price) || 0,
    category: data.category,
    in_stock: Boolean(data.in_stock),
    photos: data.photos && data.photos.length ? data.photos : [],
  };
  custom.push(newProduct);
  writeLS(LS_KEYS.customProducts, custom);
  return newProduct;
}

export function resetDemoData() {
  localStorage.removeItem(LS_KEYS.cart);
  localStorage.removeItem(LS_KEYS.orders);
  localStorage.removeItem(LS_KEYS.overrides);
  localStorage.removeItem(LS_KEYS.customProducts);
  seedOrdersIfEmpty();
}
