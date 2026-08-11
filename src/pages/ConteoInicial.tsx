import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ThemeToggle } from '../components/ThemeToggle'
import { CATEGORIAS, type Producto, type Familia } from '../lib/types'

// ------------------------------------------------------------
// Similitud de imagen SIN IA: "average hash" (aHash) clásico.
// Reduce cada imagen a una huella de 64 bits (8x8 en escala de
// grises) y compara huellas por distancia de Hamming. No entiende
// "qué es" el objeto, solo compara patrones de píxeles — es más
// rápido para acercarte a la familia correcta, pero la confirmación
// final visual sigue siendo del usuario.
// ------------------------------------------------------------

function computeHashFromUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const size = 8
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        const grays: number[] = []
        for (let i = 0; i < data.length; i += 4) {
          grays.push((data[i] + data[i + 1] + data[i + 2]) / 3)
        }
        const avg = grays.reduce((a, b) => a + b, 0) / grays.length
        resolve(grays.map((g) => (g >= avg ? '1' : '0')).join(''))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity
  let dist = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) dist++
  return dist
}

export default function ConteoInicial() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [familias, setFamilias] = useState<Familia[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroFamilia, setFiltroFamilia] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [mostrarContados, setMostrarContados] = useState(false)

  const [totalProductos, setTotalProductos] = useState(0)
  const [totalContados, setTotalContados] = useState(0)

  const [seleccionado, setSeleccionado] = useState<Producto | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

  const [fotoReferencia, setFotoReferencia] = useState<string | null>(null)
  const [hashReferencia, setHashReferencia] = useState<string | null>(null)
  const [hashesProductos, setHashesProductos] = useState<Record<string, string | null>>({})
  const [calculandoSimilitud, setCalculandoSimilitud] = useState(false)

  useEffect(() => {
    cargarProductos()
    supabase.from('familias').select('*').then(({ data }) => setFamilias(data ?? []))
  }, [])

  useEffect(() => {
    if (!fotoReferencia) {
      setHashReferencia(null)
      return
    }
    computeHashFromUrl(fotoReferencia).then(setHashReferencia)
  }, [fotoReferencia])

  async function cargarProductos() {
    setLoading(true)
    // Trae TODO el catálogo (pendientes y activos): el toggle
    // "Mostrar también contados" filtra en el cliente, así no hay
    // que volver a pedir datos al servidor al prender/apagar.
    const { data, error } = await supabase
      .from('inventario')
      .select('*')
      .order('descripcion', { ascending: true })
      .range(0, 4999)
    if (error) {
      console.error('Error al cargar productos:', error.message)
    } else {
      setProductos(data ?? [])
    }
    setLoading(false)
    calcularProgreso(data ?? [])
  }

  function calcularProgreso(lista: Producto[]) {
    setTotalProductos(lista.length)
    setTotalContados(lista.filter((p) => p.estado_conteo === 'activo').length)
  }

  const familiasFiltro = familias.filter((f) => !filtroCategoria || f.categoria === filtroCategoria)

  const filtrados = productos.filter((p) => {
    if (!mostrarContados && p.estado_conteo !== 'pendiente_conteo') return false

    const texto = busqueda.toLowerCase()
    const coincideTexto =
      !texto ||
      p.sku.toLowerCase().includes(texto) ||
      p.descripcion.toLowerCase().includes(texto)

    const coincideCategoria = !filtroCategoria || p.categoria === filtroCategoria
    const coincideFamilia = !filtroFamilia || String(p.familia_id) === filtroFamilia

    return coincideTexto && coincideCategoria && coincideFamilia
  })

  // Calcula huellas de similitud solo para lo que está filtrado y visible ahora
  useEffect(() => {
    if (!hashReferencia) return
    const faltantes = filtrados.filter((p) => p.foto_url && !(p.sku in hashesProductos))
    if (faltantes.length === 0) return

    let cancelado = false
    setCalculandoSimilitud(true)
    ;(async () => {
      const resultados = await Promise.all(
        faltantes.map(async (p) => [p.sku, await computeHashFromUrl(p.foto_url!)] as const)
      )
      if (!cancelado) {
        setHashesProductos((prev) => {
          const nuevos = { ...prev }
          for (const [sku, hash] of resultados) nuevos[sku] = hash
          return nuevos
        })
        setCalculandoSimilitud(false)
      }
    })()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hashReferencia, filtroCategoria, filtroFamilia, busqueda, mostrarContados])

  const ordenados = hashReferencia
    ? [...filtrados].sort((a, b) => {
        const ha = hashesProductos[a.sku]
        const hb = hashesProductos[b.sku]
        const da = ha ? hammingDistance(hashReferencia, ha) : Infinity
        const db = hb ? hammingDistance(hashReferencia, hb) : Infinity
        return da - db
      })
    : filtrados

  function similitudPorcentaje(sku: string): number | null {
    if (!hashReferencia) return null
    const h = hashesProductos[sku]
    if (!h) return null
    const dist = hammingDistance(hashReferencia, h)
    return Math.round((1 - dist / 64) * 100)
  }

  function capturarFotoReferencia(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    const url = URL.createObjectURL(archivo)
    setFotoReferencia(url)
    setHashesProductos({})
    e.target.value = ''
  }

  function quitarFotoReferencia() {
    if (fotoReferencia) URL.revokeObjectURL(fotoReferencia)
    setFotoReferencia(null)
    setHashesProductos({})
  }

  function abrirModal(p: Producto) {
    setSeleccionado(p)
    setCantidad('')
    setErrorGuardado(null)
  }

  function cerrarModal() {
    setSeleccionado(null)
    setCantidad('')
    setErrorGuardado(null)
  }

  async function confirmarConteo() {
    if (!seleccionado) return
    const valor = Number(cantidad)
    if (cantidad === '' || Number.isNaN(valor) || valor < 0) {
      setErrorGuardado('Ingresa una cantidad válida.')
      return
    }

    setGuardando(true)
    setErrorGuardado(null)

    const esPrimerConteo = seleccionado.estado_conteo === 'pendiente_conteo'

    if (esPrimerConteo) {
      const { error } = await supabase.rpc('registrar_conteo_inicial', {
        p_sku: seleccionado.sku,
        p_cantidad_fisica: valor,
      })
      setGuardando(false)
      if (error) {
        setErrorGuardado(error.message)
        return
      }
      setProductos((prev) => {
        const actualizado = prev.map((p) =>
          p.sku === seleccionado.sku ? { ...p, estado_conteo: 'activo' as const, stock: valor } : p
        )
        calcularProgreso(actualizado)
        return actualizado
      })
    } else {
      // Producto ya contado antes: esta captura SUMA (lote adicional
      // encontrado en otra ubicación), no reemplaza el stock existente.
      const { error } = await supabase.rpc('sumar_stock', {
        p_sku: seleccionado.sku,
        p_cantidad: valor,
      })
      setGuardando(false)
      if (error) {
        setErrorGuardado(error.message)
        return
      }
      setProductos((prev) =>
        prev.map((p) => (p.sku === seleccionado.sku ? { ...p, stock: p.stock + valor } : p))
      )
    }

    cerrarModal()
  }

  const porcentaje = totalProductos > 0 ? Math.round((totalContados / totalProductos) * 100) : 0
  const filtrosActivos = Boolean(busqueda || filtroCategoria || filtroFamilia || mostrarContados)
  const esPrimerConteoSeleccionado = seleccionado?.estado_conteo === 'pendiente_conteo'

  const selectClass =
    'border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 w-full'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Conteo Inicial</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {ordenados.length} producto(s) en esta vista
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Inventario
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mb-4 sm:mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 sm:p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
              {totalContados} / {totalProductos} contados
            </span>
            <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">{porcentaje}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 dark:bg-green-500 transition-all duration-300"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        </div>

        {/* Barra de búsqueda + botón filtros */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar SKU o descripción…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
            />
          </div>
          <button
            onClick={() => setMostrarFiltros((v) => !v)}
            className={`sm:hidden px-3 rounded-lg border text-sm font-medium ${
              filtrosActivos
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Filtros
          </button>
        </div>

        {/* Filtros: colapsables en móvil, siempre visibles en escritorio */}
        <div className={`${mostrarFiltros ? 'flex flex-col' : 'hidden'} sm:flex sm:flex-row sm:flex-wrap gap-2 sm:gap-3 mb-3`}>
          <select
            value={filtroCategoria}
            onChange={(e) => { setFiltroCategoria(e.target.value); setFiltroFamilia('') }}
            className={`${selectClass} sm:w-auto capitalize`}
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filtroFamilia}
            onChange={(e) => setFiltroFamilia(e.target.value)}
            className={`${selectClass} sm:w-auto`}
          >
            <option value="">Todas las familias</option>
            {familiasFiltro.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 px-1 py-2 sm:py-0 select-none">
            <input
              type="checkbox"
              checked={mostrarContados}
              onChange={(e) => setMostrarContados(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
            />
            Mostrar también contados
          </label>

          {filtrosActivos && (
            <button
              onClick={() => { setBusqueda(''); setFiltroCategoria(''); setFiltroFamilia(''); setMostrarContados(false) }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-left sm:text-center"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Botón de cámara: ancho completo en móvil para fácil alcance */}
        <label className="flex items-center justify-center gap-2 cursor-pointer bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-lg px-4 py-3 sm:py-2.5 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 mb-4 sm:w-fit">
          📷 {fotoReferencia ? 'Tomar otra foto' : 'Comparar con foto'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={capturarFotoReferencia}
            className="hidden"
          />
        </label>

        {/* Foto de referencia fija para comparar contra el grid */}
        {fotoReferencia && (
          <div className="sticky top-2 z-20 mb-4 bg-white dark:bg-gray-900 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-3 flex items-center gap-3 sm:gap-4 shadow-lg">
            <img
              src={fotoReferencia}
              alt="Perfil a identificar"
              className="w-28 h-28 sm:w-40 sm:h-40 object-contain rounded-lg bg-gray-50 dark:bg-gray-800 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {calculandoSimilitud ? 'Ordenando por parecido…' : 'Ordenado por parecido ↓'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Las más parecidas aparecen primero. Confirma visualmente antes de contar.
              </p>
            </div>
            <button
              onClick={quitarFotoReferencia}
              className="text-sm text-gray-400 hover:text-red-600 dark:hover:text-red-400 flex-shrink-0 px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-16">Cargando…</p>
        ) : ordenados.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-16">
            No hay productos que coincidan con el filtro. 🎉
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {ordenados.map((p) => {
              const similitud = similitudPorcentaje(p.sku)
              const contado = p.estado_conteo === 'activo'
              return (
                <button
                  key={p.sku}
                  onClick={() => abrirModal(p)}
                  className="group text-left bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden active:scale-[0.98] hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700 transition-all"
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
                    <span className={`absolute top-2 left-2 text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      contado
                        ? 'bg-green-100 dark:bg-green-900/70 text-green-800 dark:text-green-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/70 text-yellow-800 dark:text-yellow-300'
                    }`}>
                      {contado ? `🟢 ${p.stock} pz` : '🟡 Pendiente'}
                    </span>
                    {similitud !== null && (
                      <span className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        {similitud}%
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 sm:p-3">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug min-h-[2.2rem] sm:min-h-[2.5rem]">
                      {p.descripcion}
                    </p>
                    <span className="text-[10px] sm:text-xs font-mono text-gray-400 dark:text-gray-500">{p.sku}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: cambia según si es primer conteo o lote adicional */}
      {seleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 max-w-sm w-full overflow-hidden rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="aspect-square bg-gray-100 dark:bg-gray-800 sticky top-0">
              {seleccionado.foto_url ? (
                <img
                  src={seleccionado.foto_url}
                  alt={seleccionado.descripcion}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5">
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{seleccionado.descripcion}</p>
              <p className="text-sm font-mono text-gray-400 dark:text-gray-500 mb-1">{seleccionado.sku}</p>

              {!esPrimerConteoSeleccionado && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                  Ya contado — stock actual: {seleccionado.stock} {seleccionado.unidad_medida === 'pieza' ? 'pz' : seleccionado.unidad_medida}. Lo que captures aquí se SUMA.
                </p>
              )}

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 mt-2">
                {esPrimerConteoSeleccionado
                  ? `Cantidad física contada (${seleccionado.unidad_medida === 'pieza' ? 'pz' : seleccionado.unidad_medida})`
                  : `Cantidad adicional encontrada (${seleccionado.unidad_medida === 'pieza' ? 'pz' : seleccionado.unidad_medida})`}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                autoFocus
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmarConteo() }}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-3 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 mb-2"
              />

              {errorGuardado && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-2">{errorGuardado}</p>
              )}

              <div className="flex gap-3 mt-3">
                <button
                  onClick={cerrarModal}
                  disabled={guardando}
                  className="flex-1 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarConteo}
                  disabled={guardando}
                  className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-300 disabled:opacity-50"
                >
                  {guardando ? 'Guardando…' : esPrimerConteoSeleccionado ? 'Confirmar conteo' : 'Sumar cantidad'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}