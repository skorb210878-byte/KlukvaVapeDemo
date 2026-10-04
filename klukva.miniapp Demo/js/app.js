import { config } from './config.js';
import * as tg from './tg.js';
import * as router from './router.js';
import * as ui from './ui.js';
import * as store from './store.js';
import * as cart from './cart.js';

const root = document.getElementById('app');

// Фирменная палитра не зависит от темы Telegram — наоборот, мы её туда передаём,
// чтобы системная шапка/фон не оставались белыми. Значения берём прямо из CSS-
// переменных (:root в css/style.css), чтобы правка цвета в одном месте тянула и сюда.
function applyBrandColors() {
  const styles = getComputedStyle(document.documentElement);
  const bg = styles.getPropertyValue('--color-bg').trim();
  if (!bg) return;
  tg.setHeaderColor(bg);
  tg.setBackgroundColor(bg);
  tg.setBottomBarColor(bg);
}

// --- Возрастной гейт ---

function renderAgeGate(container) {
  function draw(view) {
    ui.clear(container);
    const content = ui.el('div', { class: 'screen-content state age-gate' });
    if (view === 'denied') {
      content.appendChild(ui.el('h2', { text: 'Доступ закрыт' }));
      content.appendChild(ui.el('p', { text: 'Этот магазин продаёт товары, доступные только с 18 лет.' }));
    } else {
      content.appendChild(ui.el('h2', { text: config.storeName }));
      content.appendChild(ui.el('p', { text: 'Этот магазин продаёт товары, доступные только с 18 лет. Подтвердите свой возраст.' }));
      const yesBtn = ui.el('button', { class: 'btn btn--primary btn--block', text: 'Мне есть 18 лет' });
      const noBtn = ui.el('button', { class: 'btn btn--secondary btn--block', text: 'Мне нет 18' });
      yesBtn.addEventListener('click', () => {
        store.confirmAge();
        router.replace('home');
      });
      noBtn.addEventListener('click', () => draw('denied'));
      content.appendChild(ui.el('div', { class: 'age-gate__actions' }, [yesBtn, noBtn]));
    }
    container.appendChild(content);
  }
  draw('ask');
}

// --- Главная ---

const homeState = { q: '', categoryId: 'all', inStock: false, sort: 'default', offset: 0, items: [], total: 0 };

async function renderHome(container) {
  const content = ui.el('div', { class: 'screen-content' });
  container.appendChild(content);

  if (config.banner.enabled) {
    const banner = ui.el('div', { class: 'store-banner' });
    banner.style.height = `${config.banner.height}px`;
    const bannerImg = ui.el('img', { class: 'store-banner__img', src: config.banner.image, alt: config.storeName, loading: 'lazy', decoding: 'async' });
    banner.append(bannerImg, ui.el('div', { class: 'store-banner__gradient' }), ui.el('p', { class: 'store-banner__title', text: config.storeName }));
    content.appendChild(banner);
  }

  content.appendChild(ui.el('header', { class: 'store-header' }, [
    ui.el('div', { class: 'store-header__logo', text: config.logoText }),
    ui.el('h1', { class: 'store-header__name', text: config.storeName }),
  ]));

  const searchInput = ui.el('input', { type: 'search', class: 'input search-input', placeholder: 'Поиск товаров', value: homeState.q });
  content.appendChild(searchInput);

  const categoriesRow = ui.el('div', { class: 'chips' });
  content.appendChild(categoriesRow);

  let viewMode = store.getCatalogView();

  const controlsRow = ui.el('div', { class: 'controls-row' });
  const inStockToggle = ui.el('label', { class: 'toggle-field' }, [
    ui.el('input', { type: 'checkbox', checked: homeState.inStock ? 'true' : null }),
    ui.el('span', { text: 'Только в наличии' }),
  ]);
  const sortSelect = ui.el('select', { class: 'input sort-select' }, [
    ui.el('option', { value: 'default', text: 'По умолчанию' }),
    ui.el('option', { value: 'price-asc', text: 'Сначала дешевле' }),
    ui.el('option', { value: 'price-desc', text: 'Сначала дороже' }),
    ui.el('option', { value: 'name', text: 'По названию' }),
  ]);
  sortSelect.value = homeState.sort;
  const viewToggle = ui.el('div', { class: 'view-toggle' });
  controlsRow.append(inStockToggle, sortSelect, viewToggle);
  content.appendChild(controlsRow);

  const itemsContainer = ui.el('div', { class: 'product-grid' });
  content.appendChild(itemsContainer);

  const loadMoreWrap = ui.el('div', { class: 'load-more-wrap' });
  content.appendChild(loadMoreWrap);

  function renderViewToggle() {
    ui.clear(viewToggle);
    const gridBtn = ui.el('button', { class: 'view-toggle__btn' + (viewMode === 'grid' ? ' view-toggle__btn--active' : ''), 'aria-label': 'Плитки', text: '▦' });
    const listBtn = ui.el('button', { class: 'view-toggle__btn' + (viewMode === 'list' ? ' view-toggle__btn--active' : ''), 'aria-label': 'Список', text: '☰' });
    gridBtn.addEventListener('click', () => {
      viewMode = 'grid';
      store.setCatalogView(viewMode);
      renderViewToggle();
      renderItems();
    });
    listBtn.addEventListener('click', () => {
      viewMode = 'list';
      store.setCatalogView(viewMode);
      renderViewToggle();
      renderItems();
    });
    viewToggle.append(gridBtn, listBtn);
  }
  renderViewToggle();

  const categories = await store.getCategories();
  ui.clear(categoriesRow);
  categoriesRow.appendChild(makeChip('Все', 'all'));
  for (const cat of categories) categoriesRow.appendChild(makeChip(cat.name, cat.id));

  function makeChip(label, id) {
    const chip = ui.el('button', { class: 'chip' + (homeState.categoryId === id ? ' chip--active' : ''), text: label });
    chip.addEventListener('click', () => {
      homeState.categoryId = id;
      homeState.offset = 0;
      loadProducts(true);
    });
    return chip;
  }

  const debouncedSearch = ui.debounce(() => {
    homeState.q = searchInput.value;
    homeState.offset = 0;
    loadProducts(true);
  }, 300);
  searchInput.addEventListener('input', debouncedSearch);

  inStockToggle.querySelector('input').addEventListener('change', (e) => {
    homeState.inStock = e.target.checked;
    homeState.offset = 0;
    loadProducts(true);
  });

  sortSelect.addEventListener('change', () => {
    homeState.sort = sortSelect.value;
    homeState.offset = 0;
    loadProducts(true);
  });

  async function loadProducts(reset) {
    if (reset) {
      ui.clear(itemsContainer);
      for (let i = 0; i < 6; i++) itemsContainer.appendChild(ui.skeletonCard());
    }
    ui.clear(categoriesRow);
    categoriesRow.appendChild(makeChip('Все', 'all'));
    for (const cat of categories) categoriesRow.appendChild(makeChip(cat.name, cat.id));

    try {
      const { items, hasMore } = await store.getProducts({
        q: homeState.q,
        categoryId: homeState.categoryId,
        inStock: homeState.inStock,
        sort: homeState.sort,
        offset: homeState.offset,
        limit: 20,
      });
      if (reset) {
        ui.clear(itemsContainer);
        homeState.items = items;
      } else {
        homeState.items = homeState.items.concat(items);
      }
      renderItems();
      ui.clear(loadMoreWrap);
      if (hasMore) {
        const moreBtn = ui.el('button', { class: 'btn btn--secondary btn--block', text: 'Показать ещё' });
        moreBtn.addEventListener('click', () => {
          homeState.offset += 20;
          loadProducts(false);
        });
        loadMoreWrap.appendChild(moreBtn);
      }
    } catch (err) {
      ui.clear(itemsContainer);
      itemsContainer.appendChild(ui.errorState('Не удалось загрузить товары.', () => loadProducts(true)));
    }
  }

  function renderItems() {
    itemsContainer.className = viewMode === 'list' ? 'product-list' : 'product-grid';
    ui.clear(itemsContainer);
    if (homeState.items.length === 0) {
      itemsContainer.appendChild(ui.emptyState('Ничего не найдено.'));
      return;
    }
    for (const product of homeState.items) {
      itemsContainer.appendChild(viewMode === 'list' ? makeProductListItem(product) : makeProductCard(product));
    }
  }

  function makeProductCard(product) {
    const card = ui.el('button', { class: 'card product-card' });
    const photoImg = ui.el('img', { class: 'product-card__photo' });
    ui.setProductImage(photoImg, product, ui.getPhotoSlots(product)[0], 'thumb');
    const photoWrap = ui.el('div', { class: 'product-card__photo-wrap' }, [photoImg]);
    if (!product.in_stock) {
      photoWrap.appendChild(ui.el('span', { class: 'badge', text: 'Нет в наличии' }));
    }
    card.append(
      photoWrap,
      ui.el('p', { class: 'product-card__name', text: product.name }),
      ui.el('p', { class: 'product-card__price', text: ui.formatPrice(product.price) }),
    );
    card.addEventListener('click', () => router.navigate('product', { id: product.id }));
    return card;
  }

  function makeProductListItem(product) {
    const photoImg = ui.el('img', { class: 'product-list-item__photo' });
    ui.setProductImage(photoImg, product, ui.getPhotoSlots(product)[0], 'thumb');
    const item = ui.el('button', { class: 'product-list-item' }, [
      photoImg,
      ui.el('div', { class: 'product-list-item__info' }, [
        ui.el('p', { class: 'product-list-item__name', text: product.name }),
        ui.el('p', { class: 'product-list-item__price', text: ui.formatPrice(product.price) }),
        product.in_stock ? null : ui.el('span', { class: 'product-list-item__badge', text: 'Нет в наличии' }),
      ]),
    ]);
    item.addEventListener('click', () => router.navigate('product', { id: product.id }));
    return item;
  }

  loadProducts(true);
}

// --- Полноэкранный просмотр фото товара ---

function openPhotoViewer(srcs, startIndex, altBase) {
  const overlay = ui.el('div', { class: 'photo-viewer' });
  const panel = ui.el('div', { class: 'photo-viewer__panel' });
  const viewerSlider = ui.el('div', { class: 'photo-viewer__slider' });
  const viewerDots = ui.el('div', { class: 'photo-viewer__dots' });
  const closeBtn = ui.el('button', { class: 'photo-viewer__close', 'aria-label': 'Закрыть', text: '✕' });

  srcs.forEach((src, idx) => {
    viewerSlider.appendChild(ui.el('img', {
      class: 'photo-viewer__img',
      src,
      alt: `${altBase} — фото ${idx + 1}`,
      loading: idx === startIndex ? 'eager' : 'lazy',
      decoding: 'async',
    }));
    viewerDots.appendChild(ui.el('span', { class: 'photo-slider__dot' + (idx === startIndex ? ' photo-slider__dot--active' : '') }));
  });

  panel.append(closeBtn, viewerSlider);
  if (srcs.length > 1) panel.appendChild(viewerDots);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  let closed = false;
  function cleanup() {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
    router.refreshBackButton();
  }
  function onKeydown(e) {
    if (e.key === 'Escape') cleanup();
  }

  document.addEventListener('keydown', onKeydown);
  closeBtn.addEventListener('click', cleanup);
  tg.showBackButton(cleanup);

  viewerSlider.addEventListener('scroll', () => {
    const idx = Math.round(viewerSlider.scrollLeft / viewerSlider.clientWidth);
    viewerDots.querySelectorAll('.photo-slider__dot').forEach((d, i) => d.classList.toggle('photo-slider__dot--active', i === idx));
  });

  requestAnimationFrame(() => {
    viewerSlider.scrollTo({ left: startIndex * viewerSlider.clientWidth });
  });
}

// --- Карточка товара ---

async function renderProduct(container, screen, params) {
  const content = ui.el('div', { class: 'screen-content' });
  container.appendChild(content);
  for (let i = 0; i < 2; i++) content.appendChild(ui.skeletonCard());

  const product = await store.getProduct(params.id);
  ui.clear(content);

  if (!product) {
    content.appendChild(ui.errorState('Товар не найден.', () => router.navigate('home')));
    return;
  }

  const slider = ui.el('div', { class: 'photo-slider' });
  const dots = ui.el('div', { class: 'photo-slider__dots' });
  const slots = ui.getPhotoSlots(product);
  slots.forEach((slot, idx) => {
    const img = ui.el('img', { class: 'photo-slider__img', alt: `${product.name} — фото ${idx + 1}` });
    ui.setProductImage(img, product, slot, 'full');
    img.addEventListener('click', () => {
      const srcs = Array.from(slider.querySelectorAll('.photo-slider__img')).map((im) => im.currentSrc || im.src);
      openPhotoViewer(srcs, idx, product.name);
    });
    slider.appendChild(img);
    dots.appendChild(ui.el('span', { class: 'photo-slider__dot' + (idx === 0 ? ' photo-slider__dot--active' : '') }));
  });
  slider.addEventListener('scroll', () => {
    const idx = Math.round(slider.scrollLeft / slider.clientWidth);
    dots.querySelectorAll('.photo-slider__dot').forEach((d, i) => d.classList.toggle('photo-slider__dot--active', i === idx));
  });

  content.append(
    slider,
    ...(slots.length > 1 ? [dots] : []),
    ui.el('h2', { class: 'product-detail__name', text: product.name }),
    ui.el('p', { class: 'product-detail__price', text: ui.formatPrice(product.price) }),
    ui.el('p', { class: 'product-detail__availability', text: product.in_stock ? 'В наличии' : 'Нет в наличии' }),
    ui.el('p', { class: 'product-detail__description', text: product.description }),
  );

  let qty = 1;
  const qtyValue = ui.el('span', { class: 'qty-control__value', text: String(qty) });
  const decBtn = ui.el('button', { class: 'qty-control__btn', text: '−' });
  const incBtn = ui.el('button', { class: 'qty-control__btn', text: '+' });
  decBtn.addEventListener('click', () => {
    if (qty > 1) {
      qty -= 1;
      qtyValue.textContent = String(qty);
      updateMainButton();
    }
  });
  incBtn.addEventListener('click', () => {
    qty += 1;
    qtyValue.textContent = String(qty);
    updateMainButton();
  });
  content.appendChild(ui.el('div', { class: 'qty-control qty-control--large' }, [decBtn, qtyValue, incBtn]));

  function addToCart() {
    store.addToCart(product.id, qty);
    tg.hapticLight();
    router.navigate('cart');
  }

  const bar = ui.el('div', { class: 'fixed-bottom-bar' });
  const addBtn = ui.el('button', { class: 'btn btn--primary btn--block', text: `Добавить в корзину • ${ui.formatPrice(product.price * qty)}` });
  addBtn.addEventListener('click', addToCart);

  function updateMainButton() {
    const label = `Добавить в корзину • ${ui.formatPrice(product.price * qty)}`;
    if (tg.isActuallyInTelegram()) {
      tg.showMainButton(label, addToCart);
    } else {
      addBtn.textContent = label;
    }
  }

  if (!product.in_stock) {
    tg.hideMainButton();
  } else if (tg.isActuallyInTelegram()) {
    updateMainButton();
  } else {
    bar.appendChild(addBtn);
    container.appendChild(bar);
  }
}

// --- О магазине ---

function renderAbout(container) {
  const content = ui.el('div', { class: 'screen-content' });
  content.appendChild(ui.el('h2', { text: 'О магазине' }));
  content.appendChild(ui.el('p', { text: config.about.legalName }));
  content.appendChild(ui.el('p', { text: config.about.address }));
  content.appendChild(ui.el('p', { text: config.about.phone }));
  content.appendChild(ui.el('p', { text: config.about.workHours }));
  content.appendChild(ui.el('p', { class: 'demo-note', text: 'Демо-версия' }));
  container.appendChild(content);
}

// --- Навигационная панель (нижняя, для обычного браузера и для Telegram) ---

function renderTabBar(container, active) {
  const tabs = [
    { id: 'home', label: 'Каталог' },
    { id: 'cart', label: 'Корзина' },
    { id: 'orders', label: 'Заказы' },
    { id: 'about', label: 'О магазине' },
  ];
  const bar = ui.el('nav', { class: 'tab-bar' });
  for (const tabItem of tabs) {
    const btn = ui.el('button', { class: 'tab-bar__item' + (active === tabItem.id ? ' tab-bar__item--active' : ''), text: tabItem.label });
    btn.addEventListener('click', () => router.navigate(tabItem.id));
    bar.appendChild(btn);
  }
  container.appendChild(bar);
}

const SCREENS = {
  'age-gate': renderAgeGate,
  home: renderHome,
  product: renderProduct,
  cart: cart.renderCart,
  checkout: cart.renderCheckout,
  success: cart.renderSuccess,
  orders: cart.renderOrders,
  about: renderAbout,
};

const TAB_SCREENS = new Set(['home', 'cart', 'orders', 'about']);

function render(screen, params) {
  tg.hideMainButton();
  ui.clear(root);
  const container = ui.el('div', { class: 'screen' });
  root.appendChild(container);
  const handler = SCREENS[screen] || renderHome;
  Promise.resolve(handler(container, screen, params)).then(() => {
    if (TAB_SCREENS.has(screen)) renderTabBar(container, screen);
  });
}

function boot() {
  applyBrandColors();
  tg.init();
  tg.onThemeChanged(applyBrandColors);
  router.init((screen, params) => {
    if (screen === 'age-gate' && store.isAgeConfirmed()) {
      router.replace('home');
      return;
    }
    if (screen !== 'age-gate' && !store.isAgeConfirmed()) {
      router.replace('age-gate');
      return;
    }
    render(screen, params);
  });
}

boot();
