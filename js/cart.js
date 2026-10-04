// Экраны корзины, оформления заказа, успеха и «Мои заказы».

import { config } from './config.js';
import * as store from './store.js';
import * as tg from './tg.js';
import * as router from './router.js';
import * as ui from './ui.js';

const ORDER_STATUS_LABELS = {
  new: 'Новый',
  processing: 'В обработке',
  done: 'Выполнен',
  cancelled: 'Отменён',
};

const TERMINAL_STATUSES = ['done', 'cancelled'];

export async function renderCart(container) {
  const content = ui.el('div', { class: 'screen-content' });
  container.appendChild(content);

  const items = await store.getCartDetailed();

  if (items.length === 0) {
    content.appendChild(ui.emptyState('Корзина пуста. Добавьте товары из каталога.'));
    const toHome = ui.el('button', { class: 'btn btn--secondary btn--block', text: 'В каталог' });
    toHome.addEventListener('click', () => router.navigate('home'));
    content.appendChild(toHome);
    return;
  }

  const list = ui.el('div', { class: 'cart-list' });
  content.appendChild(list);

  let total = 0;
  for (const { product, qty } of items) {
    total += product.price * qty;
    const photoImg = ui.el('img', { class: 'cart-row__photo' });
    ui.setProductImage(photoImg, product, ui.getPhotoSlots(product)[0], 'thumb');
    const row = ui.el('div', { class: 'cart-row' }, [
      photoImg,
      ui.el('div', { class: 'cart-row__info' }, [
        ui.el('p', { class: 'cart-row__name', text: product.name }),
        ui.el('p', { class: 'cart-row__price', text: ui.formatPrice(product.price) }),
      ]),
      ui.el('div', { class: 'qty-control' }, [
        makeQtyButton('−', () => changeQty(product.id, qty - 1)),
        ui.el('span', { class: 'qty-control__value', text: String(qty) }),
        makeQtyButton('+', () => changeQty(product.id, qty + 1)),
      ]),
      ui.el('button', { class: 'cart-row__remove', 'aria-label': 'Удалить', text: '✕', onclick: () => { store.removeFromCart(product.id); router.replace('cart'); } }),
    ]);
    list.appendChild(row);
  }

  content.appendChild(ui.el('div', { class: 'cart-total' }, [
    ui.el('span', { text: 'Итого' }),
    ui.el('span', { class: 'cart-total__value', text: ui.formatPrice(total) }),
  ]));

  function makeQtyButton(label, onClick) {
    const btn = ui.el('button', { class: 'qty-control__btn', text: label });
    btn.addEventListener('click', onClick);
    return btn;
  }

  function changeQty(productId, qty) {
    store.setCartQty(productId, qty);
    router.replace('cart');
  }

  const bar = ui.el('div', { class: 'fixed-bottom-bar' });
  const button = ui.el('button', { class: 'btn btn--primary btn--block', text: `Оформить заказ • ${ui.formatPrice(total)}` });
  button.addEventListener('click', () => router.navigate('checkout'));

  if (tg.isActuallyInTelegram()) {
    tg.showMainButton(`Оформить заказ • ${ui.formatPrice(total)}`, () => router.navigate('checkout'));
  } else {
    bar.appendChild(button);
    container.appendChild(bar);
  }
}

export async function renderCheckout(container) {
  const content = ui.el('div', { class: 'screen-content' });
  container.appendChild(content);

  const items = await store.getCartDetailed();
  if (items.length === 0) {
    content.appendChild(ui.emptyState('Корзина пуста.'));
    return;
  }
  const total = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);

  const form = ui.el('form', { class: 'form' });
  content.appendChild(ui.el('h2', { text: 'Оформление заказа' }));
  content.appendChild(form);

  const nameInput = ui.el('input', { type: 'text', name: 'name', placeholder: 'Имя', required: 'true', class: 'input' });
  const phoneInput = ui.el('input', { type: 'tel', name: 'phone', placeholder: '+7 (___) ___-__-__', required: 'true', class: 'input' });
  const methodSelect = ui.el('select', { name: 'method', class: 'input' }, [
    ui.el('option', { value: 'pickup', text: 'Самовывоз' }),
    ui.el('option', { value: 'delivery', text: 'Доставка' }),
  ]);
  const addressInput = ui.el('input', { type: 'text', name: 'address', placeholder: 'Адрес доставки', class: 'input' });
  const addressWrap = ui.el('div', { class: 'form__field form__field--address', hidden: 'true' }, [addressInput]);
  const commentInput = ui.el('textarea', { name: 'comment', placeholder: 'Комментарий к заказу', class: 'input input--textarea' });
  const ageCheckbox = ui.el('input', { type: 'checkbox', name: 'age', id: 'checkout-age', required: 'true' });

  phoneInput.addEventListener('input', () => {
    const pos = phoneInput.selectionStart;
    phoneInput.value = ui.formatPhone(phoneInput.value);
    phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
    validate();
  });
  methodSelect.addEventListener('change', () => {
    addressWrap.hidden = methodSelect.value !== 'delivery';
    validate();
  });
  nameInput.addEventListener('input', validate);
  addressInput.addEventListener('input', validate);
  ageCheckbox.addEventListener('change', validate);

  form.append(
    field('Имя', nameInput),
    field('Телефон', phoneInput),
    field('Способ получения', methodSelect),
    addressWrap,
    field('Комментарий', commentInput),
    ui.el('label', { class: 'checkbox-field' }, [ageCheckbox, ui.el('span', { text: 'Подтверждаю, что мне есть 18 лет' })]),
  );

  function field(labelText, inputEl) {
    return ui.el('div', { class: 'form__field' }, [ui.el('label', { class: 'form__label', text: labelText }), inputEl]);
  }

  function isValid() {
    const phoneDigits = phoneInput.value.replace(/\D/g, '');
    if (!nameInput.value.trim()) return false;
    if (phoneDigits.length !== 11) return false;
    if (methodSelect.value === 'delivery' && !addressInput.value.trim()) return false;
    if (!ageCheckbox.checked) return false;
    return true;
  }

  function submit() {
    if (!isValid()) return;
    const order = store.createOrder({
      customer: {
        name: nameInput.value.trim(),
        phone: phoneInput.value,
        method: methodSelect.value,
        address: methodSelect.value === 'delivery' ? addressInput.value.trim() : '',
        comment: commentInput.value.trim(),
      },
      items: items.map((i) => ({ productId: i.product.id, name: i.product.name, price: i.product.price, qty: i.qty })),
      total,
    });
    tg.hapticSuccess();
    router.navigate('success', { orderId: order.id });
  }

  function validate() {
    const valid = isValid();
    tg.setMainButtonEnabled(valid);
    submitBtn.disabled = !valid;
  }

  const bar = ui.el('div', { class: 'fixed-bottom-bar' });
  const submitBtn = ui.el('button', { type: 'button', class: 'btn btn--primary btn--block', text: 'Подтвердить заказ' });
  submitBtn.addEventListener('click', submit);

  if (tg.isActuallyInTelegram()) {
    tg.showMainButton('Подтвердить заказ', submit);
  } else {
    bar.appendChild(submitBtn);
    container.appendChild(bar);
  }
  validate();
}

export function renderSuccess(container) {
  const content = ui.el('div', { class: 'screen-content state' });
  content.appendChild(ui.el('p', { class: 'success-icon', text: '✅' }));
  content.appendChild(ui.el('h2', { text: 'Заказ принят' }));
  content.appendChild(ui.el('p', { text: 'Мы свяжемся с вами в ближайшее время.' }));

  const toOrders = ui.el('button', { class: 'btn btn--primary', text: 'Мои заказы' });
  toOrders.addEventListener('click', () => router.navigate('orders'));
  const toHome = ui.el('button', { class: 'btn btn--secondary', text: 'В каталог' });
  toHome.addEventListener('click', () => router.navigate('home'));

  content.appendChild(ui.el('div', { class: 'success-actions' }, [toOrders, toHome]));
  container.appendChild(content);
}

export function renderOrders(container) {
  const content = ui.el('div', { class: 'screen-content' });
  container.appendChild(content);
  content.appendChild(ui.el('h2', { text: 'Мои заказы' }));

  const list = ui.el('div', { class: 'orders-list' });
  content.appendChild(list);

  function draw() {
    ui.clear(list);
    const orders = store.getMyOrders();
    if (orders.length === 0) {
      list.appendChild(ui.emptyState('У вас пока нет заказов.'));
      return;
    }
    for (const order of orders) {
      list.appendChild(buildOrderCard(order));
    }
  }

  function buildOrderCard(order) {
    const date = new Date(order.createdAt).toLocaleDateString('ru-RU');
    const card = ui.el('div', { class: 'order-card' }, [
      ui.el('div', { class: 'order-card__head' }, [
        ui.el('span', { text: `Заказ № ${order.id.slice(-6)}` }),
        ui.el('span', { class: `order-status order-status--${order.status}`, text: ORDER_STATUS_LABELS[order.status] || order.status }),
      ]),
      ui.el('p', { class: 'order-card__date', text: date }),
      ui.el('p', { class: 'order-card__items', text: order.items.map((i) => `${i.name} × ${i.qty}`).join(', ') }),
      ui.el('p', { class: 'order-card__total', text: ui.formatPrice(order.total) }),
    ]);

    if (config.cancellableStatuses.includes(order.status)) {
      const cancelBtn = ui.el('button', { class: 'btn btn--secondary btn--block', text: 'Отменить заказ' });
      cancelBtn.addEventListener('click', () => handleCancel(order));
      card.appendChild(ui.el('div', { class: 'order-card__actions' }, [cancelBtn]));
    } else if (order.status === 'cancelled') {
      const repeatBtn = ui.el('button', { class: 'btn btn--secondary btn--block', text: 'Повторить заказ' });
      repeatBtn.addEventListener('click', () => {
        for (const item of order.items) store.addToCart(item.productId, item.qty);
        router.navigate('cart');
      });
      card.appendChild(ui.el('div', { class: 'order-card__actions' }, [repeatBtn]));
    } else if (!TERMINAL_STATUSES.includes(order.status)) {
      card.appendChild(ui.el('p', { class: 'order-card__hint', text: 'Чтобы отменить, свяжитесь с магазином.' }));
    }

    return card;
  }

  async function handleCancel(order) {
    const confirmed = await ui.confirmAction(`Отменить заказ № ${order.id.slice(-6)}?`, {
      confirmLabel: 'Да, отменить',
      cancelLabel: 'Нет',
    });
    if (!confirmed) return;
    const result = store.cancelOrder(order.id);
    if (!result.ok) {
      ui.showToast(result.error);
      draw();
      return;
    }
    tg.hapticWarning();
    ui.showToast('Заказ отменён');
    draw();
  }

  draw();
}
