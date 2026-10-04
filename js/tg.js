// Безопасная обёртка над Telegram.WebApp: страница не должна падать без Telegram.

function webApp() {
  return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
}

export function isTelegram() {
  return Boolean(webApp());
}

// telegram-web-app.js исполняется и определяет window.Telegram.WebApp даже когда
// страница открыта в обычном браузере (вне Telegram) — тогда это просто заглушка,
// и вызовы вроде MainButton.show()/showConfirm() ничего не покажут (некому их принять).
// platform остаётся строкой 'unknown', только если страницу открыли НЕ из Telegram —
// это проверено прямо по исходнику telegram-web-app.js (webAppPlatform = 'unknown' по
// умолчанию, меняется только при получении параметров от настоящего клиента).
export function isActuallyInTelegram() {
  const wa = webApp();
  return Boolean(wa && wa.platform && wa.platform !== 'unknown');
}

export function isVersionAtLeast(version) {
  const wa = webApp();
  return Boolean(wa && typeof wa.isVersionAtLeast === 'function' && wa.isVersionAtLeast(version));
}

// BackButton, HapticFeedback появились в Bot API 6.1 — на более старых клиентах (и в
// заглушке telegram-web-app.js вне Telegram, которая представляется версией 6.0) их
// вызывать нельзя.
function supports(version) {
  return isVersionAtLeast(version);
}

export function init() {
  const wa = webApp();
  if (!wa) return;
  wa.ready();
  wa.expand();
}

export function onThemeChanged(callback) {
  const wa = webApp();
  if (!wa) return;
  wa.onEvent('themeChanged', callback);
}

export function getThemeParams() {
  const wa = webApp();
  return wa ? wa.themeParams : null;
}

export function getColorScheme() {
  const wa = webApp();
  return wa ? wa.colorScheme : null;
}

// --- Цвета интерфейса Telegram (чтобы системная шапка/фон совпадали с фирменной
// палитрой приложения, а не оставались белыми). Проверено по официальной документации
// https://core.telegram.org/bots/webapps: setHeaderColor и setBackgroundColor — Bot API
// 6.1+ (произвольный #RRGGBB — с 6.9), setBottomBarColor — Bot API 7.10+.

export function setHeaderColor(hex) {
  const wa = webApp();
  if (!wa || !supports('6.9')) return;
  wa.setHeaderColor(hex);
}

export function setBackgroundColor(hex) {
  const wa = webApp();
  if (!wa || !supports('6.1')) return;
  wa.setBackgroundColor(hex);
}

export function setBottomBarColor(hex) {
  const wa = webApp();
  if (!wa || !supports('7.10')) return;
  wa.setBottomBarColor(hex);
}

// --- MainButton ---

export function showMainButton(text, onClick) {
  const wa = webApp();
  if (!wa) return false;
  wa.MainButton.setText(text);
  wa.MainButton.offClick(onClick);
  wa.MainButton.onClick(onClick);
  wa.MainButton.show();
  return true;
}

export function hideMainButton() {
  const wa = webApp();
  if (!wa) return;
  wa.MainButton.hide();
}

export function setMainButtonEnabled(enabled) {
  const wa = webApp();
  if (!wa) return;
  if (enabled) wa.MainButton.enable();
  else wa.MainButton.disable();
}

// --- BackButton ---

export function showBackButton(onClick) {
  const wa = webApp();
  if (!wa || !supports('6.1')) return false;
  wa.BackButton.offClick(onClick);
  wa.BackButton.onClick(onClick);
  wa.BackButton.show();
  return true;
}

export function hideBackButton() {
  const wa = webApp();
  if (!wa || !supports('6.1')) return;
  wa.BackButton.hide();
}

// --- Haptics ---

export function hapticSuccess() {
  const wa = webApp();
  if (!wa || !supports('6.1')) return;
  wa.HapticFeedback.notificationOccurred('success');
}

export function hapticLight() {
  const wa = webApp();
  if (!wa || !supports('6.1')) return;
  wa.HapticFeedback.impactOccurred('light');
}

export function hapticWarning() {
  const wa = webApp();
  if (!wa || !supports('6.1')) return;
  wa.HapticFeedback.notificationOccurred('warning');
}

// --- Диалоги ---
// showConfirm — Bot API 6.2+ (проверено по официальной документации). Имеет смысл
// вызывать только если мы ДЕЙСТВИТЕЛЬНО внутри Telegram (см. isActuallyInTelegram) —
// иначе callback никогда не придёт, потому что звать его некому.

export function showConfirm(message, callback) {
  const wa = webApp();
  if (!wa || !supports('6.2')) return false;
  wa.showConfirm(message, callback);
  return true;
}

export function close() {
  const wa = webApp();
  if (wa) wa.close();
}
