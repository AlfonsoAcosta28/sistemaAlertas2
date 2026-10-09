export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type EstadoReporte = 'no_confirmada' | 'corroborada' | 'verificada' | 'descartada' | 'cerrada';
export type Severidad = 'baja' | 'media' | 'alta';
export type RolUsuario = 'ciudadano' | 'moderador' | 'autoridad';
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
  created_at: string;
  updated_at: string;
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
        };
        Returns: string;
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
