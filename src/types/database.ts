export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type EstadoReporte = 'no_confirmada' | 'corroborada' | 'verificada' | 'descartada' | 'cerrada';
export type Severidad = 'baja' | 'media' | 'alta';
// 'moderador' solo existe por compatibilidad (las filas se migraron a 'gubernamental').
export type RolUsuario = 'ciudadano' | 'moderador' | 'gubernamental' | 'administrador';
export type EstadoEnvio = 'enviado' | 'validado_verdad' | 'validado_mentira' | 'cerrado';
export type TipoCampo = 'texto' | 'texto_largo' | 'numero' | 'opciones';

/** Campo extra del formulario de reporte, definido por categoría (`categorias.campos_formulario`). */
export type CampoFormulario = {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  requerido?: boolean;
  /** Obligatorio solo cuando el campo con esta clave está vacío (ej. descripción si no hay placas). */
  requerido_si_vacio?: string;
  opciones?: string[];
  ayuda?: string;
  mayusculas?: boolean;
};

/** Resultado del análisis de la foto hecho en el teléfono. */
export type AnalisisFoto = {
  disponible: boolean;
  nsfw: boolean;
  probabilidadNsfw: number;
  rostros: number;
  calidad: { ancho: number; alto: number; nitidez: number; brillo: number; aceptable: boolean };
  rostrosCubiertos: number;
};
export type TipoReaccion = 'confirma' | 'desmiente';

// Tipos "Row" nombrados de forma independiente (no indexados dentro del tipo
// Database todavía en construcción) para que Insert/Update no generen una
// referencia circular que TypeScript colapsa a `never`.

type CategoriaRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  color: string | null;
  icono: string | null;
  severidad_default: Severidad;
  radio_inicial_metros: number;
  radio_maximo_metros: number;
  vigencia_default_minutos: number;
  requiere_moderacion_obligatoria: boolean;
  requiere_foto: boolean;
  foto_requiere_rostro: boolean;
  campos_formulario: Json;
  created_at: string;
  updated_at: string;
};

type CategoriaReglaRow = {
  categoria_id: string;
  umbral_confirmaciones: number;
  ventana_minutos: number;
  expiracion_minutos: number;
  created_at: string;
  updated_at: string;
};

type InstitucionRow = {
  id: string;
  nombre: string;
  tipo: string;
  telefono: string | null;
  correo: string | null;
  webhook_url: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
};

type CategoriaInstitucionRow = {
  categoria_id: string;
  institucion_id: string;
};

type ReporteEnvioRow = {
  id: string;
  reporte_id: string;
  institucion_id: string;
  estado: EstadoEnvio;
  enviado_en: string;
  actualizado_en: string;
};

type ReputacionMovimientoRow = {
  id: string;
  usuario_id: string;
  reporte_id: string | null;
  puntos: number;
  motivo: string;
  created_at: string;
};

type PerfilRow = {
  id: string;
  nombre_visible: string | null;
  ultima_celda_h3: string | null;
  ultima_celda_actualizada_en: string | null;
  rol: RolUsuario;
  telefono: string | null;
  suspendido_hasta: string | null;
  reportes_confirmados_contador: number;
  reportes_descartados_contador: number;
  onboarding_completado: boolean;
  reputacion: number;
  institucion_id: string | null;
  created_at: string;
  updated_at: string;
};

type ReporteRow = {
  id: string;
  categoria_id: string;
  creador_id: string | null;
  estado: EstadoReporte;
  severidad: Severidad;
  descripcion: string | null;
  latitud_aproximada: number;
  longitud_aproximada: number;
  latitud_exacta: number;
  longitud_exacta: number;
  creado_en_celda_h3: string | null;
  radio_inicial_metros: number;
  radio_maximo_metros: number;
  vigencia_minutos: number;
  verificado_por: string | null;
  verificado_en: string | null;
  cerrado_en: string | null;
  descartado_motivo: string | null;
  foto_url: string | null;
  datos: Json;
  analisis_foto: Json | null;
  puntaje_apoyo: number;
  puntaje_contra: number;
  veracidad: number;
  prevalidado_en: string | null;
  created_at: string;
  updated_at: string;
};

type ReporteReaccionRow = {
  id: string;
  reporte_id: string;
  usuario_id: string;
  tipo: TipoReaccion;
  created_at: string;
};

type UsuarioPreferenciasRow = {
  usuario_id: string;
  radio_personal_metros: number;
  ver_no_confirmados: boolean;
  horario_silencio_inicio: string | null;
  horario_silencio_fin: string | null;
  autoriza_alertas_criticas_en_silencio: boolean;
  push_token: string | null;
  push_token_actualizado_en: string | null;
  created_at: string;
  updated_at: string;
};

type UsuarioCategoriaPreferenciaRow = {
  usuario_id: string;
  categoria_id: string;
  activa: boolean;
};

type ZonaGuardadaRow = {
  id: string;
  usuario_id: string;
  nombre: string;
  celda_h3: string;
  radio_metros: number;
  created_at: string;
  updated_at: string;
};

type AuditoriaAdministrativaRow = {
  id: string;
  reporte_id: string | null;
  admin_id: string | null;
  accion: string;
  detalle: Json;
  created_at: string;
};

type ReportePublicoRow = {
  id: string;
  categoria_id: string;
  categoria_nombre: string;
  estado: EstadoReporte;
  severidad: Severidad;
  latitud_aproximada: number;
  longitud_aproximada: number;
  radio_actual_metros: number;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
  expira_en: string;
  veracidad: number;
  datos: Json;
  foto_url: string | null;
  enviado_a: string[];
  categoria_icono: string | null;
};

export type UsuarioAdmin = {
  id: string;
  email: string | null;
  telefono: string | null;
  rol: RolUsuario;
  institucion_id: string | null;
  reputacion: number;
  suspendido_hasta: string | null;
  reportes_confirmados_contador: number;
  reportes_descartados_contador: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      categorias: {
        Row: CategoriaRow;
        Insert: Partial<CategoriaRow>;
        Update: Partial<CategoriaRow>;
        Relationships: never[];
      };
      categoria_reglas: {
        Row: CategoriaReglaRow;
        Insert: Partial<CategoriaReglaRow>;
        Update: Partial<CategoriaReglaRow>;
        Relationships: never[];
      };
      instituciones: {
        Row: InstitucionRow;
        Insert: Partial<InstitucionRow> & { nombre: string };
        Update: Partial<InstitucionRow>;
        Relationships: never[];
      };
      categoria_instituciones: {
        Row: CategoriaInstitucionRow;
        Insert: CategoriaInstitucionRow;
        Update: Partial<CategoriaInstitucionRow>;
        Relationships: never[];
      };
      reporte_envios: {
        Row: ReporteEnvioRow;
        Insert: Partial<ReporteEnvioRow>;
        Update: Partial<ReporteEnvioRow>;
        Relationships: never[];
      };
      reputacion_movimientos: {
        Row: ReputacionMovimientoRow;
        Insert: Partial<ReputacionMovimientoRow>;
        Update: Partial<ReputacionMovimientoRow>;
        Relationships: never[];
      };
      perfiles: {
        Row: PerfilRow;
        Insert: Partial<PerfilRow> & { id: string };
        Update: Partial<PerfilRow>;
        Relationships: never[];
      };
      reportes: {
        Row: ReporteRow;
        Insert: Partial<ReporteRow>;
        Update: Partial<ReporteRow>;
        Relationships: never[];
      };
      reporte_reacciones: {
        Row: ReporteReaccionRow;
        Insert: Partial<ReporteReaccionRow>;
        Update: Partial<ReporteReaccionRow>;
        Relationships: never[];
      };
      usuario_preferencias: {
        Row: UsuarioPreferenciasRow;
        Insert: Partial<UsuarioPreferenciasRow> & { usuario_id: string };
        Update: Partial<UsuarioPreferenciasRow>;
        Relationships: never[];
      };
      usuario_categoria_preferencias: {
        Row: UsuarioCategoriaPreferenciaRow;
        Insert: UsuarioCategoriaPreferenciaRow;
        Update: Partial<UsuarioCategoriaPreferenciaRow>;
        Relationships: never[];
      };
      zonas_guardadas: {
        Row: ZonaGuardadaRow;
        Insert: Partial<ZonaGuardadaRow> & {
          usuario_id: string;
          nombre: string;
          celda_h3: string;
          radio_metros: number;
        };
        Update: Partial<ZonaGuardadaRow>;
        Relationships: never[];
      };
      auditoria_administrativa: {
        Row: AuditoriaAdministrativaRow;
        Insert: Partial<AuditoriaAdministrativaRow>;
        Update: Partial<AuditoriaAdministrativaRow>;
        Relationships: never[];
      };
    };
    Views: {
      reportes_publicos: {
        Row: ReportePublicoRow;
        Relationships: never[];
      };
    };
    Functions: {
      crear_reporte: {
        Args: {
          p_categoria_id: string;
          p_latitud: number;
          p_longitud: number;
          p_celda_h3: string;
          p_descripcion?: string | null;
          p_foto_url?: string | null;
          p_datos?: Json;
          p_analisis_foto?: Json | null;
        };
        Returns: string;
      };
      admin_guardar_categoria: {
        Args: { p_id: string | null; p_datos: Json };
        Returns: string;
      };
      admin_listar_usuarios: {
        Args: { p_busqueda?: string | null };
        Returns: UsuarioAdmin[];
      };
      admin_cambiar_rol: {
        Args: { p_usuario_id: string; p_rol: RolUsuario; p_institucion_id?: string | null };
        Returns: undefined;
      };
      admin_suspender_usuario: {
        Args: { p_usuario_id: string; p_dias: number };
        Returns: undefined;
      };
      reaccionar_reporte: {
        Args: {
          p_reporte_id: string;
          p_tipo: TipoReaccion;
        };
        Returns: string;
      };
      actualizar_celda_perfil: {
        Args: { p_celda_h3: string };
        Returns: undefined;
      };
      actualizar_push_token: {
        Args: { p_token: string };
        Returns: undefined;
      };
      eliminar_cuenta_propia: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      moderar_verificar_reporte: {
        Args: {
          p_reporte_id: string;
          p_severidad_override?: Severidad | null;
          p_nota?: string | null;
        };
        Returns: string;
      };
      moderar_descartar_reporte: {
        Args: { p_reporte_id: string; p_motivo: string };
        Returns: string;
      };
      moderar_cerrar_reporte: {
        Args: { p_reporte_id: string };
        Returns: string;
      };
      radio_actual_reporte: {
        Args: { p_reporte_id: string };
        Returns: number;
      };
    };
    Enums: {
      estado_reporte: EstadoReporte;
      severidad: Severidad;
      rol_usuario: RolUsuario;
      tipo_reaccion: TipoReaccion;
    };
    CompositeTypes: {
      [_: string]: never;
    };
  };
};
