/**
 * Reputación (espejo de la lógica en SQL: `peso_reputacion`, `recalcular_validacion`
 * y `repartir_reputacion`). Se usa para explicarle al usuario cuánto vale su voto.
 */

export const PUNTOS = {
  reporteVerdadero: 10,
  reporteFalso: -15,
  validacionAcertada: 5,
  validacionFallida: -5,
} as const;

/** Peso del voto: 0 pts = 1 voto, +100 = 2 votos (tope), −75 o menos = 0.25 (piso). */
export function pesoReputacion(reputacion: number): number {
  return Math.max(0.25, Math.min(2, 1 + reputacion / 100));
}

export function nivelReputacion(reputacion: number): string {
  if (reputacion <= -25) return 'Baja';
  if (reputacion < 25) return 'Nueva';
  if (reputacion < 75) return 'Confiable';
  return 'Muy confiable';
}

/** Igual que en SQL: 100 × apoyo/(apoyo+contra) × min(1, apoyo/umbral). */
export function calcularVeracidad(apoyo: number, contra: number, umbral: number): number {
  const proporcion = apoyo / Math.max(apoyo + contra, 0.0001);
  const progreso = Math.min(1, apoyo / Math.max(umbral, 1));
  return Math.max(0, Math.min(100, Math.round(100 * proporcion * progreso)));
}

export function colorVeracidad(veracidad: number): string {
  if (veracidad >= 75) return '#047857';
  if (veracidad >= 40) return '#D97706';
  return '#B91C1C';
}
