// Макет админки. Все данные — в localStorage через store.js, сервера нет.

import { config } from './config.js';
import * as store from './store.js';
import * as ui from './ui.js';

const root = document.getElementById('admin-app');

const ORDER_STATUSES = [
  { id: 'new', label: 'Новый' },
  { id: 'processing', label: 'В обработке' },
  { id: 'done', label: 'Выполнен' },
];

const ORDER_STATUS_LABELS = {
  new: 'Новый',
  processing: 'В обработке',
  done: 'Выполнен',
  cancelled: 'Отменён',
};

const STATUS_LEGEND = [
  ['Новый', 'клиент оформил заказ, магазин ещё не взял его в работу.'],
  ['В обработке', 'магазин принял заказ и связывается с клиентом или собирает его.'],
  ['Выполнен', 'заказ выдан или доставлен.'],
  ['Отменён', 'клиент отменил заказ.'],
];

const STATS_BY_PERIOD = {
  day: { orders: 14, revenue: 38600, avgCheck: 2757, top: [['Лесная клюква 30мл', 9], ['Устройство «Компакт»', 5], ['Картридж сменный x2', 4]], chart: [3, 5, 2, 6, 4, 7, 14] },
  week: { orders: 86, revenue: 241300, avgCheck: 2806, top: [['Устройство «Компакт»', 22], ['Лесная клюква 30мл', 31], ['Картридж сменный x2', 18]], chart: [10, 14, 9, 16, 12, 11, 14] },
  month: { orders: 341, revenue: 968400, avgCheck: 2839, top: [['Лесная клюква 30мл', 120], ['Устройство «Компакт»', 88], ['Картридж сменный x2', 64]], chart: [45, 52, 38, 61, 55, 48, 42] },
};

let activeTab = 'products';
let productsFilter = '';
let ordersStatusFilter = 'all';
let legendOpen = false;

function render() {
  ui.clear(root);

  root.appendChild(ui.el('div', { class: 'admin-banner', text: 'Макет. В полной версии вход только по Telegram ID владельца.' }));
  root.appendChild(ui.el('header', { class: 'admin-header' }, [
    ui.el('div', { class: 'store-header__logo', text: config.logoText }),
    ui.el('h1', { class: 'store-header__name', text: `${config.storeName} — админка` }),
  ]));

  const tabs = ui.el('nav', { class: 'admin-tabs' });
  for (const tab of [['products', 'Товары'], ['orders', 'Заказы'], ['import', 'Импорт'], ['stats', 'Статистика']]) {
    const btn = ui.el('button', { class: 'admin-tabs__item' + (activeTab === tab[0] ? ' admin-tabs__item--active' : ''), text: tab[1] });
    btn.addEventListener('click', () => { activeTab = tab[0]; render(); });
    tabs.appendChild(btn);
  }
  root.appendChild(tabs);

  const content = ui.el('div', { class: 'admin-content' });
  root.appendChild(content);

  if (activeTab === 'products') renderProductsTab(content);
  else if (activeTab === 'orders') renderOrdersTab(content);
  else if (activeTab === 'import') renderImportTab(content);
  else if (activeTab === 'stats') renderStatsTab(content);

  const resetBtn = ui.el('button', { class: 'btn btn--secondary btn--block admin-reset', text: 'Сбросить демо-данные' });
  resetBtn.addEventListener('click', () => {
    store.resetDemoData();
    render();
  });
  root.appendChild(resetBtn);

  root.appendChild(ui.el('p', { class: 'demo-note admin-hint', text: 'Изменения видны на витрине сразу — откройте index.html в соседней вкладке.' }));
}

async function renderProductsTab(content) {
  const searchInput = ui.el('input', { type: 'search', class: 'input', placeholder: 'Поиск товаров', value: productsFilter });
  searchInput.addEventListener('input', ui.debounce(() => { productsFilter = searchInput.value; renderList(); }, 250));
  content.appendChild(searchInput);

  const addToggleBtn = ui.el('button', { class: 'btn btn--primary btn--block admin-add-btn', text: '+ Добавить товар' });
  const addForm = buildAddProductForm(() => renderList());
  addForm.hidden = true;
  addToggleBtn.addEventListener('click', () => { addForm.hidden = !addForm.hidden; });
  content.appendChild(addToggleBtn);
  content.appendChild(addForm);

  const categories = await store.getCategories();
  const list = ui.el('div', { class: 'admin-product-list' });
  content.appendChild(list);

  async function renderList() {
    ui.clear(list);
    const all = await store.adminGetAllProducts();
    const needle = productsFilter.trim().toLocaleLowerCase('ru');
    const filtered = needle ? all.filter((p) => p.name.toLocaleLowerCase('ru').includes(needle)) : all;
    if (filtered.length === 0) {
      list.appendChild(ui.emptyState('Товары не найдены.'));
      return;
    }
    for (const product of filtered) {
      list.appendChild(buildProductRow(product, categories, renderList));
    }
  }

  renderList();
}

function buildProductRow(product, categories, onChange) {
  const photo = ui.el('img', { class: 'admin-product-row__photo' });
  ui.setProductImage(photo, product, ui.getPhotoSlots(product)[0], 'thumb');
  const priceInput = ui.el('input', { type: 'number', class: 'input admin-product-row__price', value: product.price, min: '0', step: '1' });
  priceInput.addEventListener('change', () => {
    store.adminUpdateProduct(product.id, { price: Number(priceInput.value) || 0 });
    onChange();
  });

  const stockToggle = ui.el('input', { type: 'checkbox', checked: product.in_stock ? 'true' : null });
  stockToggle.addEventListener('change', () => {
    store.adminUpdateProduct(product.id, { in_stock: stockToggle.checked });
    onChange();
  });

  return ui.el('div', { class: 'admin-product-row' }, [
    photo,
    ui.el('div', { class: 'admin-product-row__info' }, [
      ui.el('p', { class: 'admin-product-row__name', text: product.name }),
      ui.el('p', { class: 'admin-product-row__category', text: ui.categoryLabel(product.category, categories) }),
    ]),
    priceInput,
    ui.el('label', { class: 'toggle-field admin-product-row__stock' }, [stockToggle, ui.el('span', { text: 'В наличии' })]),
  ]);
}

function buildAddProductForm(onAdded) {
  const nameInput = ui.el('input', { class: 'input', placeholder: 'Название', type: 'text' });
  const descInput = ui.el('textarea', { class: 'input input--textarea', placeholder: 'Описание' });
  const priceInput = ui.el('input', { class: 'input', placeholder: 'Цена', type: 'number', min: '0' });
  const categorySelect = ui.el('select', { class: 'input' });
  store.getCategories().then((cats) => {
    for (const c of cats) categorySelect.appendChild(ui.el('option', { value: c.id, text: c.name }));
  });
  const stockCheckbox = ui.el('input', { type: 'checkbox', checked: 'true' });
  const photoInput = ui.el('input', { type: 'file', accept: 'image/*', class: 'admin-photo-input' });
  const preview = ui.el('img', { class: 'admin-photo-preview', hidden: 'true' });
  let photoDataUrl = null;

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!file) return;
    photoDataUrl = await resizeImageToDataUrl(file, 400);
    preview.src = photoDataUrl;
    preview.hidden = false;
  });

  const submitBtn = ui.el('button', { type: 'button', class: 'btn btn--primary btn--block', text: 'Сохранить товар' });
  submitBtn.addEventListener('click', () => {
    if (!nameInput.value.trim() || !priceInput.value) return;
    store.adminAddProduct({
      name: nameInput.value.trim(),
      description: descInput.value.trim(),
      price: priceInput.value,
      category: categorySelect.value,
      in_stock: stockCheckbox.checked,
      photos: photoDataUrl ? [photoDataUrl] : undefined,
    });
    nameInput.value = '';
    descInput.value = '';
    priceInput.value = '';
    photoDataUrl = null;
    preview.hidden = true;
    onAdded();
  });

  return ui.el('div', { class: 'admin-add-form' }, [
    field('Название', nameInput),
    field('Описание', descInput),
    field('Цена', priceInput),
    field('Категория', categorySelect),
    ui.el('label', { class: 'toggle-field' }, [stockCheckbox, ui.el('span', { text: 'В наличии' })]),
    field('Фото (превью до 400 px)', photoInput),
    preview,
    submitBtn,
  ]);

  function field(labelText, inputEl) {
    return ui.el('div', { class: 'form__field' }, [ui.el('label', { class: 'form__label', text: labelText }), inputEl]);
  }
}

function resizeImageToDataUrl(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderOrdersTab(content) {
  ui.clear(content);

  const toolbar = ui.el('div', { class: 'admin-orders-toolbar' });
  const filterChips = ui.el('div', { class: 'chips' });
  const legendToggle = ui.el('button', { class: 'status-legend__toggle', 'aria-label': 'Что означают статусы', text: '?' });
  toolbar.append(filterChips, legendToggle);
  content.appendChild(toolbar);

  const legendPanel = ui.el('div', { class: 'status-legend__panel' });
  for (const [label, desc] of STATUS_LEGEND) {
    legendPanel.appendChild(ui.el('p', { class: 'status-legend__row' }, [ui.el('strong', { text: label + ': ' }), document.createTextNode(desc)]));
  }
  legendPanel.hidden = !legendOpen;
  legendToggle.addEventListener('click', () => {
    legendOpen = !legendOpen;
    legendPanel.hidden = !legendOpen;
  });
  content.appendChild(legendPanel);

  const filters = [['all', 'Все'], ['new', 'Новый'], ['processing', 'В обработке'], ['done', 'Выполнен'], ['cancelled', 'Отменён']];
  for (const [id, label] of filters) {
    const chip = ui.el('button', { class: 'chip' + (ordersStatusFilter === id ? ' chip--active' : ''), text: label });
    chip.addEventListener('click', () => { ordersStatusFilter = id; renderOrdersTab(content); });
    filterChips.appendChild(chip);
  }

  const list = ui.el('div', { class: 'orders-list' });
  content.appendChild(list);

  const orders = store.getMyOrders().filter((o) => ordersStatusFilter === 'all' || o.status === ordersStatusFilter);
  if (orders.length === 0) {
    list.appendChild(ui.emptyState('Заказов с таким статусом нет.'));
    return;
  }

  for (const order of orders) {
    const date = new Date(order.createdAt).toLocaleString('ru-RU');
    const card = ui.el('div', { class: 'order-card' }, [
      ui.el('div', { class: 'order-card__head' }, [
        ui.el('span', { text: `Заказ № ${order.id.slice(-6)}` }),
        ui.el('span', { class: `order-status order-status--${order.status}`, text: ORDER_STATUS_LABELS[order.status] || order.status }),
      ]),
      ui.el('p', { class: 'order-card__date', text: `${date} · ${order.customer.name}, ${order.customer.phone}` }),
      ui.el('p', { class: 'order-card__items', text: order.items.map((i) => `${i.name} × ${i.qty}`).join(', ') }),
      ui.el('p', { class: 'order-card__total', text: ui.formatPrice(order.total) }),
    ]);

    if (order.status !== 'cancelled') {
      const statusButtons = ui.el('div', { class: 'admin-order-statuses' });
      for (const s of ORDER_STATUSES) {
        const btn = ui.el('button', { class: 'chip' + (order.status === s.id ? ' chip--active' : ''), text: s.label });
        btn.addEventListener('click', () => {
          store.adminSetOrderStatus(order.id, s.id);
          renderOrdersTab(content);
        });
        statusButtons.appendChild(btn);
      }
      card.appendChild(statusButtons);
    }

    list.appendChild(card);
  }
}

function renderImportTab(content) {
  content.appendChild(ui.el('h2', { text: 'Импорт товаров из Excel' }));
  content.appendChild(ui.el('p', { class: 'admin-hint', text: 'Столбцы: Артикул, Название, Цена, Категория, Наличие, Описание, Фото.' }));

  const templateBtn = ui.el('button', { class: 'btn btn--secondary btn--block', text: 'Скачать шаблон' });
  templateBtn.addEventListener('click', downloadTemplate);
  content.appendChild(templateBtn);

  const dropZone = ui.el('label', { class: 'import-dropzone' }, [
    ui.el('span', { text: 'Загрузите Excel со списком товаров' }),
    ui.el('input', { type: 'file', accept: '.xlsx,.xls,.csv', class: 'import-dropzone__input' }),
  ]);
  const preview = ui.el('div', { class: 'import-preview', hidden: 'true' });
  dropZone.querySelector('input').addEventListener('change', (e) => {
    if (!e.target.files[0]) return;
    preview.hidden = false;
    ui.clear(preview);
    preview.appendChild(ui.el('p', { text: '700 строк: 640 новых, 55 обновится, 5 с ошибками.' }));
    preview.appendChild(ui.el('p', { class: 'demo-note', text: 'Пример — в демо-версии файл не разбирается.' }));
  });
  content.appendChild(dropZone);
  content.appendChild(preview);
}

function downloadTemplate() {
  const header = 'Артикул,Название,Цена,Категория,Наличие,Описание,Фото\n';
  const blob = new Blob([header], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'шаблон-импорта.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderStatsTab(content) {
  let period = 'day';

  const periodRow = ui.el('div', { class: 'chips' });
  const cardsRow = ui.el('div', { class: 'stats-cards' });
  const topList = ui.el('div', { class: 'stats-top' });
  const chartCanvas = ui.el('canvas', { class: 'stats-chart', width: '320', height: '140' });
  const note = ui.el('p', { class: 'demo-note', text: 'Демонстрационные данные — пример данных.' });

  content.append(ui.el('h2', { text: 'Статистика' }), periodRow, cardsRow, chartCanvas, topList, note);

  for (const p of [['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']]) {
    const btn = ui.el('button', { class: 'chip' + (period === p[0] ? ' chip--active' : ''), text: p[1] });
    btn.addEventListener('click', () => { period = p[0]; draw(); });
    periodRow.appendChild(btn);
  }

  function draw() {
    periodRow.querySelectorAll('.chip').forEach((chip, idx) => {
      chip.classList.toggle('chip--active', ['day', 'week', 'month'][idx] === period);
    });
    const stats = STATS_BY_PERIOD[period];
    ui.clear(cardsRow);
    cardsRow.append(
      statCard('Заказы', String(stats.orders)),
      statCard('Выручка', ui.formatPrice(stats.revenue)),
      statCard('Средний чек', ui.formatPrice(stats.avgCheck)),
    );
    ui.clear(topList);
    topList.appendChild(ui.el('h3', { text: 'Топ товаров' }));
    for (const [name, count] of stats.top) {
      topList.appendChild(ui.el('p', { class: 'stats-top__row', text: `${name} — ${count} шт.` }));
    }
    drawChart(chartCanvas, stats.chart);
  }

  function statCard(label, value) {
    return ui.el('div', { class: 'stats-card' }, [ui.el('p', { class: 'stats-card__value', text: value }), ui.el('p', { class: 'stats-card__label', text: label })]);
  }

  draw();
}

function drawChart(canvas, values) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...values, 1);
  const barWidth = w / values.length - 8;
  values.forEach((v, i) => {
    const barHeight = (v / max) * (h - 10);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-accent') || '#7c3aed';
    ctx.fillRect(i * (barWidth + 8) + 4, h - barHeight, barWidth, barHeight);
  });
}

render();
