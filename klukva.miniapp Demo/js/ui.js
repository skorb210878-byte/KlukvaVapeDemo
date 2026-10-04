// Общие UI-утилиты: DOM-хелперы без innerHTML, форматирование, SVG-заглушки фото.

import { config } from './config.js';
import * as tg from './tg.js';

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function formatPrice(amount) {
  return `${Math.round(amount).toLocaleString('ru-RU')} ${config.currency}`;
}

const CATEGORY_ICONS = {
  liquids: 'M12 2c-3 4.5-5 7.6-5 10.5A5 5 0 0 0 12 17.5a5 5 0 0 0 5-5C17 9.6 15 6.5 12 2Z',
  devices: 'M9 2h6v3H9V2Zm-1 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z',
  parts: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 2.5-2-.4a7 7 0 0 0-.7-1.7l1.2-1.7-1.6-1.6-1.7 1.2a7 7 0 0 0-1.7-.7L14.1 3h-2.2l-.4 2a7 7 0 0 0-1.7.7L8.1 4.5 6.5 6.1l1.2 1.7a7 7 0 0 0-.7 1.7l-2 .4v2.2l2 .4c.1.6.4 1.2.7 1.7l-1.2 1.7 1.6 1.6 1.7-1.2c.5.3 1.1.6 1.7.7l.4 2h2.2l.4-2c.6-.1 1.2-.4 1.7-.7l1.7 1.2 1.6-1.6-1.2-1.7c.3-.5.6-1.1.7-1.7l2-.4v-2.2Z',
  custom: 'M4 7h16v3H4V7Zm1 4h14v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8Z',
};

// Заглушки только в клюквенных оттенках — единая фирменная палитра.
const GRADIENTS = [
  ['#7a1030', '#ff6b81'],
  ['#4a0a1e', '#e8365a'],
  ['#8c123f', '#f7a6b7'],
  ['#35050f', '#b3123f'],
];

const PRODUCT_PHOTOS_DIR = 'assets/photos/products';

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function placeholderSrc(categoryId, seedKey) {
  const gradient = GRADIENTS[hashString(seedKey) % GRADIENTS.length];
  const iconPath = CATEGORY_ICONS[categoryId] || CATEGORY_ICONS.custom;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${gradient[0]}"/>
        <stop offset="1" stop-color="${gradient[1]}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#g)"/>
    <path d="${iconPath}" fill="rgba(255,255,255,0.85)" transform="translate(130,130) scale(6)"/>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Слоты фото товара: явные пути из data/products.json (или data: URL из админки),
// либо один слот-заглушка, если массив пуст (тогда ищем assets/photos/products/<id>.jpg).
export function getPhotoSlots(product) {
  return product.photos && product.photos.length ? product.photos : [null];
}

// Подставляет в <img> фото товара с запасными вариантами: явный путь → оптимизированная
// версия → исходный файл по id → фиолетовая заглушка. Так товары без фото не ломаются.
export function setProductImage(imgEl, product, slotValue, variant) {
  const candidates = [];
  if (slotValue) {
    candidates.push(slotValue);
  } else {
    // Один запасной путь на вариант (не три) — иначе на каждое отсутствующее фото
    // уходит несколько неудачных запросов. Файл появляется здесь после
    // scripts/optimize_images.py (см. README, раздел «Фото»).
    const suffix = variant === 'thumb' ? '-thumb' : '';
    candidates.push(`${PRODUCT_PHOTOS_DIR}/optimized/${product.id}${suffix}.jpg`);
  }
  let i = 0;
  function tryNext() {
    if (i >= candidates.length) {
      imgEl.onerror = null;
      imgEl.src = placeholderSrc(product.category, `${product.id}-${variant}`);
      return;
    }
    imgEl.src = candidates[i++];
  }
  imgEl.onerror = tryNext;
  tryNext();
  imgEl.loading = 'lazy';
  imgEl.decoding = 'async';
  if (!imgEl.alt) imgEl.alt = product.name || product.category;
}

export function categoryLabel(categoryId, categories) {
  const found = categories.find((c) => c.id === categoryId);
  return found ? found.name : categoryId;
}

// Маска телефона: +7 (XXX) XXX-XX-XX
export function formatPhone(rawValue) {
  let digits = rawValue.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (!digits.startsWith('7')) digits = '7' + digits;
  digits = digits.slice(0, 11);
  const rest = digits.slice(1);
  let result = '+7';
  if (rest.length > 0) result += ' (' + rest.slice(0, 3);
  if (rest.length >= 3) result += ')';
  if (rest.length > 3) result += ' ' + rest.slice(3, 6);
  if (rest.length > 6) result += '-' + rest.slice(6, 8);
  if (rest.length > 8) result += '-' + rest.slice(8, 10);
  return result;
}

export function skeletonCard() {
  return el('div', { class: 'card card--skeleton' }, [
    el('div', { class: 'skeleton skeleton--photo' }),
    el('div', { class: 'skeleton skeleton--line' }),
    el('div', { class: 'skeleton skeleton--line short' }),
  ]);
}

export function emptyState(message) {
  return el('div', { class: 'state state--empty' }, [el('p', { text: message })]);
}

export function errorState(message, onRetry) {
  const retryBtn = el('button', { class: 'btn btn--secondary', text: 'Повторить' });
  retryBtn.addEventListener('click', onRetry);
  return el('div', { class: 'state state--error' }, [el('p', { text: message }), retryBtn]);
}

export function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// --- Всплывающее уведомление (тост) ---

let toastHost = null;

function getToastHost() {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host' });
    document.body.appendChild(toastHost);
  }
  return toastHost;
}

export function showToast(message) {
  const host = getToastHost();
  const toast = el('div', { class: 'toast', text: message });
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 250);
  }, 2500);
}

// --- Подтверждение действия ---
// Внутри настоящего Telegram используем нативный showConfirm (Bot API 6.2+), иначе —
// своё модальное окно, по центру колонки.

export function confirmAction(message, { confirmLabel = 'Да', cancelLabel = 'Отмена' } = {}) {
  return new Promise((resolve) => {
    if (tg.isActuallyInTelegram() && tg.showConfirm(message, (ok) => resolve(Boolean(ok)))) {
      return;
    }

    const backdrop = el('div', { class: 'modal-backdrop' });
    const yesBtn = el('button', { class: 'btn btn--primary btn--block', text: confirmLabel });
    const noBtn = el('button', { class: 'btn btn--secondary btn--block', text: cancelLabel });
    const dialog = el('div', { class: 'modal' }, [
      el('p', { class: 'modal__message', text: message }),
      el('div', { class: 'modal__actions' }, [yesBtn, noBtn]),
    ]);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    function close(result) {
      backdrop.remove();
      resolve(result);
    }
    yesBtn.addEventListener('click', () => close(true));
    noBtn.addEventListener('click', () => close(false));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
    });
  });
}
