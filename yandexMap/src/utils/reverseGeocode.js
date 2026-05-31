/** Адрес по координатам через API Яндекс.Карт (ymaps уже на странице). */
export function reverseGeocode(coords) {
  return new Promise((resolve) => {
    if (!coords?.length || !window.ymaps) {
      resolve("");
      return;
    }
    window.ymaps.ready(() => {
      window.ymaps
        .geocode(coords, { results: 1 })
        .then((res) => {
          const obj = res.geoObjects.get(0);
          resolve(obj?.getAddressLine?.() || "");
        })
        .catch(() => resolve(""));
    });
  });
}
