export type ValidacionReaccion = {
  creadorId: string | null;
  usuarioActualId: string;
};

export function validarReglasReaccion(validacion: ValidacionReaccion) {
  if (validacion.creadorId && validacion.creadorId === validacion.usuarioActualId) {
    throw new Error('No puedes reaccionar a tu propio reporte.');
  }

  return true;
}
