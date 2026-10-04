// Настройки магазина — меняются здесь, чтобы быстро подогнать под клиента.
// Цветовая палитра — в css/style.css (:root), это внешний вид, а не контент.
export const config = {
  storeName: 'Klukva',
  logoText: 'KL',
  currency: '₽',
  locale: 'ru',
  about: {
    legalName: 'ИП «Клюква» (демо-реквизиты)',
    address: 'г. Москва, ул. Демонстрационная, 1',
    phone: '+7 (900) 000-00-00',
    workHours: 'Ежедневно 10:00–22:00',
  },
  // Баннер на главной. Пока нет фото — выключен. Чтобы включить: положить файл
  // по пути banner.image и поставить enabled: true.
  banner: {
    enabled: false,
    image: 'assets/photos/banner.jpg',
    height: 150,
  },
  // Из каких статусов клиент может сам отменить заказ.
  cancellableStatuses: ['new'],
  isDemo: true,
};
