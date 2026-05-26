/** Tipos mínimos alineados con `supabase/01_schema_bootstrap.sql`. */
export type Database = {
  public: {
    Tables: {
      perfiles: {
        Row: {
          id: string;
          nombre_completo: string | null;
          telefono: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id: string;
          nombre_completo?: string | null;
          telefono?: string | null;
        };
        Update: {
          nombre_completo?: string | null;
          telefono?: string | null;
        };
      };
      personal: {
        Row: {
          id: string;
          id_usuario: string;
          nombre_visible: string;
          rol: 'anfitrion' | 'mesero' | 'gerente' | 'cocina';
          codigo_empleado: string | null;
          activo: boolean;
          creado_en: string;
          actualizado_en: string;
        };
      };
      zonas: {
        Row: {
          id: string;
          nombre: string;
          orden: number;
          creado_en: string;
        };
      };
      mesas: {
        Row: {
          id: string;
          codigo: string;
          id_zona: string | null;
          capacidad: number;
          estado: 'libre' | 'ocupada' | 'reservada';
          notas: string | null;
          descripcion_publica: string | null;
          imagen_url: string | null;
          id_personal_atendiendo: string | null;
          actualizado_en: string;
        };
        Insert: {
          codigo: string;
          capacidad: number;
          id_zona?: string | null;
          estado?: 'libre' | 'ocupada' | 'reservada';
          notas?: string | null;
          descripcion_publica?: string | null;
          imagen_url?: string | null;
        };
        Update: {
          codigo?: string;
          capacidad?: number;
          id_zona?: string | null;
          estado?: 'libre' | 'ocupada' | 'reservada';
          notas?: string | null;
          descripcion_publica?: string | null;
          imagen_url?: string | null;
        };
      };
      fila_espera: {
        Row: {
          id: string;
          id_usuario: string | null;
          nombre_cliente: string | null;
          personas_grupo: number;
          estado: 'esperando' | 'sentado' | 'cancelado';
          nota: string | null;
          minutos_espera_estimados: number | null;
          unido_en: string;
          sentado_en: string | null;
          cancelado_en: string | null;
          id_mesa_asignada: string | null;
        };
        Insert: {
          id_usuario?: string | null;
          nombre_cliente?: string | null;
          personas_grupo: number;
          estado?: 'esperando' | 'sentado' | 'cancelado';
          nota?: string | null;
          minutos_espera_estimados?: number | null;
          id_mesa_asignada?: string | null;
        };
      };
      categorias_menu: {
        Row: {
          id: string;
          nombre: string;
          orden: number;
          creado_en: string;
        };
      };
      items_menu: {
        Row: {
          id: string;
          id_categoria: string;
          nombre: string;
          descripcion: string | null;
          precio_centavos: number;
          disponible: boolean;
          sin_stock: boolean;
          imagen_url: string | null;
          alergenos_json: unknown;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id_categoria: string;
          nombre: string;
          precio_centavos: number;
          descripcion?: string | null;
          disponible?: boolean;
          imagen_url?: string | null;
        };
        Update: {
          id_categoria?: string;
          nombre?: string;
          precio_centavos?: number;
          descripcion?: string | null;
          disponible?: boolean;
          imagen_url?: string | null;
        };
      };
      ingredientes: {
        Row: {
          id: string;
          nombre: string;
          cantidad_disponible: number;
          unidad_medida: 'g' | 'ml' | 'piezas' | 'unidades';
          stock_minimo: number | null;
          categoria: 'Bebidas' | 'Alimentos' | 'Ingredientes' | 'Otros';
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          nombre: string;
          unidad_medida: 'g' | 'ml' | 'piezas' | 'unidades';
          cantidad_disponible?: number;
          stock_minimo?: number | null;
          categoria?: 'Bebidas' | 'Alimentos' | 'Ingredientes' | 'Otros';
        };
        Update: {
          nombre?: string;
          unidad_medida?: 'g' | 'ml' | 'piezas' | 'unidades';
          cantidad_disponible?: number;
          stock_minimo?: number | null;
          categoria?: 'Bebidas' | 'Alimentos' | 'Ingredientes' | 'Otros';
        };
      };
      recetas: {
        Row: {
          id: string;
          id_item_menu: string;
          notas: string | null;
          creado_en: string;
        };
        Insert: {
          id_item_menu: string;
          notas?: string | null;
        };
        Update: {
          notas?: string | null;
        };
      };
      receta_ingredientes: {
        Row: {
          id: string;
          id_receta: string;
          id_ingrediente: string;
          cantidad_por_plato: number;
          creado_en: string;
        };
        Insert: {
          id_receta: string;
          id_ingrediente: string;
          cantidad_por_plato: number;
        };
        Update: {
          cantidad_por_plato?: number;
        };
      };
      movimientos_almacen: {
        Row: {
          id: string;
          id_ingrediente: string;
          tipo: 'entrada' | 'salida_pedido' | 'ajuste';
          delta_cantidad: number;
          id_pedido_cocina: string | null;
          nota: string | null;
          creado_en: string;
        };
      };
      pedidos_cocina: {
        Row: {
          id: string;
          id_mesa: string;
          id_usuario: string;
          id_item_menu: string;
          id_reserva_mesa: string | null;
          id_fila_espera: string | null;
          id_servicio_mesa: string | null;
          id_personal_registro: string | null;
          cantidad: number;
          nota_cliente: string | null;
          estado: 'pendiente' | 'listo';
          creado_en: string;
          listo_en: string | null;
        };
      };
      servicios_mesa: {
        Row: {
          id: string;
          id_mesa: string;
          id_usuario: string | null;
          id_reserva_mesa: string | null;
          id_fila_espera: string | null;
          nombre_invitado: string | null;
          id_personal_apertura: string | null;
          id_personal_cierre: string | null;
          estado: 'activo' | 'cerrado';
          total_centavos: number;
          abierto_en: string;
          cerrado_en: string | null;
        };
      };
      reportes_problema: {
        Row: {
          id: string;
          id_usuario: string;
          nombre_usuario: string | null;
          titulo: string;
          descripcion: string;
          estado: 'abierto' | 'revisado' | 'cerrado';
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id_usuario: string;
          nombre_usuario?: string | null;
          titulo: string;
          descripcion: string;
          estado?: 'abierto' | 'revisado' | 'cerrado';
        };
        Update: {
          nombre_usuario?: string | null;
          titulo?: string;
          descripcion?: string;
          estado?: 'abierto' | 'revisado' | 'cerrado';
        };
      };
      solicitudes_servicio: {
        Row: {
          id: string;
          id_mesa: string | null;
          id_usuario: string | null;
          mensaje: string | null;
          estado: 'abierta' | 'reconocida' | 'cerrada';
          id_personal_asignado: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id_mesa?: string | null;
          id_usuario?: string | null;
          mensaje?: string | null;
          estado?: 'abierta' | 'reconocida' | 'cerrada';
        };
      };
      reservas_mesa: {
        Row: {
          id: string;
          id_usuario: string;
          id_mesa: string;
          fecha_hora_reserva: string;
          personas_grupo: number;
          nota: string | null;
          ciclo: 'activa' | 'cancelada' | 'completada';
          comensal_llego: boolean | null;
          mesero_atender_a_partir_de: string;
          creado_en: string;
        };
      };
    };
    Enums: {
      estado_mesa: 'libre' | 'ocupada' | 'reservada';
      estado_fila: 'esperando' | 'sentado' | 'cancelado';
      estado_solicitud: 'abierta' | 'reconocida' | 'cerrada';
      rol_personal: 'anfitrion' | 'mesero' | 'gerente' | 'cocina';
      ciclo_reserva: 'activa' | 'cancelada' | 'completada';
      estado_pedido_cocina: 'pendiente' | 'listo';
      tipo_movimiento_almacen: 'entrada' | 'salida_pedido' | 'ajuste';
    };
  };
};
