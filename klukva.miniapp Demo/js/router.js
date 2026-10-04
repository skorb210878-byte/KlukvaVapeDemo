// Простой роутер со стеком экранов. Экраны и их параметры хранятся в history.state,
// поэтому системная кнопка «назад» в браузере и BackButton в Telegram ведут себя одинаково.

import * as tg from './tg.js';

let renderFn = null;

function currentState() {
  return window.history.state || { screen: 'home', params: {} };
}

function applyBackButton() {
  const state = currentState();
  const hasHistory = window.history.length > 1 && state.depth > 0;
  if (hasHistory) {
    tg.showBackButton(back);
  } else {
    tg.hideBackButton();
  }
}

function render() {
  const state = currentState();
  applyBackButton();
  if (renderFn) renderFn(state.screen, state.params || {});
}

export function init(onRender) {
  renderFn = onRender;
  if (!window.history.state) {
    window.history.replaceState({ screen: 'age-gate', params: {}, depth: 0 }, '');
  }
  window.addEventListener('popstate', render);
  render();
}

export function navigate(screen, params = {}) {
  const depth = (currentState().depth || 0) + 1;
  window.history.pushState({ screen, params, depth }, '');
  render();
  window.scrollTo(0, 0);
}

export function replace(screen, params = {}) {
  const depth = currentState().depth || 0;
  window.history.replaceState({ screen, params, depth }, '');
  render();
  window.scrollTo(0, 0);
}

export function back() {
  if ((currentState().depth || 0) > 0) {
    window.history.back();
  }
}

export function getCurrentScreen() {
  return currentState().screen;
}

export function getCurrentParams() {
  return currentState().params || {};
}

// Пересчитать BackButton под текущий экран. Нужно после того, как что-то временно
// забирало BackButton себе (например, полноэкранный просмотр фото) и отдало обратно.
export function refreshBackButton() {
  applyBackButton();
}
