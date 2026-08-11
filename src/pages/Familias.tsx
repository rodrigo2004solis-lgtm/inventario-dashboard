import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CATEGORIAS, type Familia } from '../lib/types'
import { ThemeToggle } from '../components/ThemeToggle'

interface FamiliaConConteo extends Familia {
  productosCount: number
}

export default function Familias() {
  const [familias, setFamilias] = useState<FamiliaConConteo[]>([])
  const [loading, setLoading] = useState(true)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [categoriaNueva, setCategoriaNueva] = useState<string>(CATEGORIAS[0])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombreEditado, setNombreEditado] = useState('')

  useEffect(() => {
    cargarFamilias()
  }, [])

  async function cargarFamilias() {
    setLoading(true)

    const [{ data: familiasData }, { data: inventarioData }] = await Promise.all([
      supabase.from('familias').select('*').order('categoria').order('nombre'),
      supabase.from('inventario').select('familia_id'),
    ])

    // Contamos productos por familia en el navegador, en vez de una consulta
    // agregada en el servidor — con el volumen de datos que manejamos (miles,
    // no millones), es igual de rápido y más simple de leer y mantener.
    const conteos = new Map<number, number>()
    for (const row of inventarioData ?? []) {
      if (row.familia_id) {
        conteos.set(row.familia_id, (conteos.get(row.familia_id) ?? 0) + 1)
      }
    }

    setFamilias(
      (familiasData ?? []).map((f) => ({ ...f, productosCount: conteos.get(f.id) ?? 0 }))
    )
    setLoading(false)
  }

  async function handleCrear(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nombreNuevo.trim()) return

    setGuardando(true)
    const { error } = await supabase
      .from('familias')
      .insert({ nombre: nombreNuevo.trim(), categoria: categoriaNueva })

    setGuardando(false)

    if (error) {
      setError(
        error.code === '23505'
          ? 'Ya existe una familia con ese nombre en esa categoría.'
          : 'Error al crear: ' + error.message
      )
      return
    }

    setNombreNuevo('')
    cargarFamilias()
  }

  function iniciarEdicion(f: FamiliaConConteo) {
    setEditandoId(f.id)
    setNombreEditado(f.nombre)
  }

  async function guardarEdicion(id: number) {
    if (!nombreEditado.trim()) return

    const { error } = await supabase
      .from('familias')
      .update({ nombre: nombreEditado.trim() })
      .eq('id', id)

    if (error) {
      setError('Error al actualizar: ' + error.message)
      return
    }

    setEditandoId(null)
    cargarFamilias()
  }

  async function handleBorrar(f: FamiliaConConteo) {
    if (f.productosCount > 0) return // protección extra, aunque el botón ya está deshabilitado

    const confirmar = window.confirm(`¿Borrar la familia "${f.nombre}"? Esta acción no se puede deshacer.`)
    if (!confirmar) return

    const { error } = await supabase.from('familias').delete().eq('id', f.id)

    if (error) {
      setError('Error al borrar: ' + error.message)
      return
    }

    cargarFamilias()
  }

  const familiasPorCategoria = CATEGORIAS.map((cat) => ({
    categoria: cat,
    items: familias.filter((f) => f.categoria === cat),
  }))

  const inputClass =
    'border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <div className="flex justify-between items-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-base text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al inventario
          </Link>
          <ThemeToggle />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Familias</h1>

        <form
          onSubmit={handleCrear}
          className="flex gap-3 mb-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
        >
          <select
            value={categoriaNueva}
            onChange={(e) => setCategoriaNueva(e.target.value)}
            className={`${inputClass} capitalize`}
          >
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="text"
            placeholder="Nombre de la nueva familia…"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button
            type="submit"
            disabled={guardando || !nombreNuevo.trim()}
            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-300 disabled:opacity-50 whitespace-nowrap"
          >
            + Agregar
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 mb-6">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-16">Cargando…</p>
        ) : (
          <div className="space-y-8">
            {familiasPorCategoria.map(({ categoria, items }) => (
              <div key={categoria}>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 capitalize">
                  {categoria} <span className="font-normal">({items.length})</span>
                </h2>

                {items.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-600 italic">Sin familias todavía.</p>
                ) : (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
                    {items.map((f) => (
                      <div key={f.id} className="flex items-center justify-between px-4 py-3">
                        {editandoId === f.id ? (
                          <input
                            type="text"
                            autoFocus
                            value={nombreEditado}
                            onChange={(e) => setNombreEditado(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && guardarEdicion(f.id)}
                            className={`${inputClass} flex-1 mr-3`}
                          />
                        ) : (
                          <span className="text-sm text-gray-900 dark:text-gray-100">{f.nombre}</span>
                        )}

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {f.productosCount} producto(s)
                          </span>

                          {editandoId === f.id ? (
                            <button
                              onClick={() => guardarEdicion(f.id)}
                              className="text-xs font-medium text-gray-900 dark:text-gray-100 hover:underline"
                            >
                              Guardar
                            </button>
                          ) : (
                            <button
                              onClick={() => iniciarEdicion(f)}
                              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                            >
                              Editar
                            </button>
                          )}

                          <button
                            onClick={() => handleBorrar(f)}
                            disabled={f.productosCount > 0}
                            title={f.productosCount > 0 ? 'No se puede borrar: hay productos usando esta familia' : 'Borrar'}
                            className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:text-gray-300 dark:disabled:text-gray-700 disabled:cursor-not-allowed"
                          >
                            Borrar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}