const RADIO_TIERRA_METROS = 6371000;

export function distanciaMetros(
  latitud1: number,
  longitud1: number,
  latitud2: number,
  longitud2: number,
): number {
  const aRadianes = (grados: number) => (grados * Math.PI) / 180;

  const dLat = aRadianes(latitud2 - latitud1);
  const dLon = aRadianes(longitud2 - longitud1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(latitud1)) * Math.cos(aRadianes(latitud2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return RADIO_TIERRA_METROS * c;
}
