/** Ключ API Яндекс.Карт (тот же, что у компонента Map). */
const YMAPS_API_KEY =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_YANDEX_MAPS_API_KEY ||
      import.meta.env.VITE_YMAP_API_KEY)) ||
  "e99fcd77-5ec6-4928-85ff-47ddb2f50012";

/** Убираем «Россия, » и лишние пробелы. */
export function formatGeocodedAddress(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  if (/^россия,\s*/i.test(s)) {
    s = s.replace(/^россия,\s*/i, "");
  }
  return s.trim();
}

function addressFromYmapsObject(obj) {
  if (!obj) return "";
  try {
    const meta = obj.properties?.get?.("metaDataProperty");
    const text = meta?.GeocoderMetaData?.text;
    if (text) return formatGeocodedAddress(text);
  } catch {
    /* */
  }
  const line = obj.getAddressLine?.() || obj.properties?.get?.("text") || "";
  return formatGeocodedAddress(line);
}

function geocodeYmaps(api, lat, lon, kind) {
  const opts = { results: 1 };
  if (kind) opts.kind = kind;
  return api.geocode([lat, lon], opts).then((res) => {
    const obj = res?.geoObjects?.get?.(0);
    return addressFromYmapsObject(obj);
  });
}

/**
 * Адрес по координатам [широта, долгота].
 * Сначала ymaps.geocode (дом), при пустом ответе — без kind, затем HTTP.
 */
export function reverseGeocode(coords, ymapsInstance = null) {
  const lat = Number(coords?.[0]);
  const lon = Number(coords?.[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Promise.resolve("");
  }

  const viaYmaps = () =>
    new Promise((resolve) => {
      const api =
        ymapsInstance ||
        (typeof window !== "undefined" ? window.ymaps : null);
      if (!api?.geocode) {
        resolve("");
        return;
      }
      api.ready(() => {
        geocodeYmaps(api, lat, lon, "house")
          .then((addr) => {
            if (addr) return addr;
            return geocodeYmaps(api, lat, lon, null);
          })
          .then((addr) => resolve(addr || ""))
          .catch(() => resolve(""));
      });
    });

  const viaHttp = async () => {
    try {
      const url =
        `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(YMAPS_API_KEY)}` +
        `&format=json&geocode=${lon},${lat}&results=1&lang=ru_RU&kind=house`;
      const res = await fetch(url);
      if (!res.ok) return "";
      const data = await res.json();
      const members =
        data?.response?.GeoObjectCollection?.featureMember || [];
      const text =
        members[0]?.GeoObject?.metaDataProperty?.GeocoderMetaData?.text;
      if (text) return formatGeocodedAddress(text);

      const url2 =
        `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(YMAPS_API_KEY)}` +
        `&format=json&geocode=${lon},${lat}&results=1&lang=ru_RU`;
      const res2 = await fetch(url2);
      if (!res2.ok) return "";
      const data2 = await res2.json();
      const members2 =
        data2?.response?.GeoObjectCollection?.featureMember || [];
      const text2 =
        members2[0]?.GeoObject?.metaDataProperty?.GeocoderMetaData?.text;
      return formatGeocodedAddress(text2);
    } catch {
      return "";
    }
  };

  return viaYmaps().then((addr) => {
    if (addr?.trim()) return addr.trim();
    return viaHttp();
  });
}
