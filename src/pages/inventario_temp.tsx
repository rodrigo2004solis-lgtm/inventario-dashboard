import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { CATEGORIAS, type Producto, type Familia } from '../lib/types'

type EstadoStock = 'todos' | 'negativo' | 'cero' | 'positivo'

export default function Inventario() {
  const { signOut } = useAuth()
  const [productos, setProductos] = useState<Producto[]>([])
  const [familias, setFamilias] = useState<Familia[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroFamilia, setFiltroFamilia] = useState('')
  const [filtroStock, setFiltroStock] = useState<EstadoStock>('todos')

  useEffect(() => {
    cargarProductos()
    supabase.from('familias').select('*').then(({ data }) => setFamilias(data ?? []))
  }, [])

  async function cargarProductos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventario')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(0,4999)
    if (error) {
      console.error('Error al cargar inventario:', error.message)
    } else {
      setProductos(data ?? [])
    }
    setLoading(false)
  }

  const familiasFiltro = familias.filter((f) => !filtroCategoria || f.categoria === filtroCategoria)
  const filtrosActivos = Boolean(busqueda || filtroCategoria || filtroFamilia || filtroStock !== 'todos')

  const filtrados = productos.filter((p) => {
    const texto = busqueda.toLowerCase()
    const coincideTexto =
      !texto ||
      p.sku.toLowerCase().includes(texto) ||
      p.descripcion.toLowerCase().includes(texto) ||
      (p.proveedor ?? '').toLowerCase().includes(texto)

    const coincideCategoria = !filtroCategoria || p.categoria === filtroCategoria
    const coincideFamilia = !filtroFamilia || String(p.familia_id) === filtroFamilia

    const coincideStock =
      filtroStock === 'todos' ||
      (filtroStock === 'negativo' && p.stock < 0) ||
      (filtroStock === 'cero' && p.stock === 0) ||
      (filtroStock === 'positivo' && p.stock > 0)

    return coincideTexto && coincideCategoria && coincideFamilia && coincideStock
  })

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroCategoria('')
    setFiltroFamilia('')
    setFiltroStock('todos')
  }

  const selectClass =
    'border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Inventario</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {filtrados.length} de {productos.length} producto(s)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={signOut} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4 gap-4">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por SKU, descripción o proveedor…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
            />
          </div>
          <div className="flex items-center gap-3">
            <Link to="/familias" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Administrar familias
            </Link>
            <Link
              to="/productos/nuevo"
              className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-300 whitespace-nowrap"
            >
              + Nuevo producto
            </Link>
           <Link to="/Conteo-Inicial" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
             Conteo inicial
             </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={filtroCategoria}
            onChange={(e) => { setFiltroCategoria(e.target.value); setFiltroFamilia('') }}
            className={`${selectClass} capitalize`}
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filtroFamilia}
            onChange={(e) => setFiltroFamilia(e.target.value)}
            className={selectClass}
          >
            <option value="">Todas las familias</option>
            {familiasFiltro.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>

          <select
            value={filtroStock}
            onChange={(e) => setFiltroStock(e.target.value as EstadoStock)}
            className={selectClass}
          >
            <option value="todos">Todo el stock</option>
            <option value="negativo">Stock negativo</option>
            <option value="cero">Stock en cero</option>
            <option value="positivo">Stock positivo</option>
          </select>

          {filtrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-16">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-16">No se encontraron productos.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtrados.map((p) => (
              <Link
                key={p.sku}
                to={`/productos/${encodeURIComponent(p.sku)}`}
                className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700 transition-all"
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                  {p.foto_url ? (
                    <img
                      src={p.foto_url}
                      alt={p.descripcion}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}

                  <span className="absolute top-2 left-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur text-[11px] font-medium text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full capitalize">
                    {p.categoria}
                  </span>
                </div>

                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug min-h-[2.5rem]">
                    {p.descripcion}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{p.sku}</span>
                    {p.proveedor && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[100px]">{p.proveedor}</span>
                    )}
                  </div>
                </div>

                <div
                  className={`px-3 py-2 text-center text-sm font-semibold border-t ${
                    p.stock < 0
                      ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900'
                      : p.stock === 0
                      ? 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-800'
                      : 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900'
                  }`}
                >
                  Stock: {p.stock} {p.unidad_medida === 'pieza' ? 'pz' : p.unidad_medida}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}