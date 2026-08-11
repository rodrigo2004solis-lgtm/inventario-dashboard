export type EstadoConteo = 'pendiente_conteo' | 'activo'

export interface Producto {
  sku: string
  descripcion: string
  categoria: string
  unidad_medida: string
  stock: number
  familia_id: number | null
  proveedor: string | null
  foto_url: string | null
  updated_at: string
  estado_conteo: EstadoConteo
}

export interface Familia {
  id: number
  nombre: string
  categoria: string
}

export const CATEGORIAS = ['aluminio', 'vidrio', 'accesorio', 'herramienta','herrajes', 'otro'] as const
export const UNIDADES = ['pieza', 'metro', 'metro2', 'kilogramo', 'litro'] as const