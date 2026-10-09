export class ErrorConfiguracionSupabase extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorConfiguracionSupabase';
  }
}
