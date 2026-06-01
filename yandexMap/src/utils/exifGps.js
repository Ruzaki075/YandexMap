import exifr from "exifr";

/** GPS из EXIF файла или null, если координат нет. */
export async function readImageGps(file) {
  if (!file) return null;
  try {
    const gps = await exifr.gps(file);
    if (
      gps &&
      typeof gps.latitude === "number" &&
      typeof gps.longitude === "number"
    ) {
      return { latitude: gps.latitude, longitude: gps.longitude };
    }
  } catch {
    /* нет EXIF — не ошибка */
  }
  return null;
}
