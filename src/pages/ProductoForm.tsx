import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CATEGORIAS, UNIDADES, type Familia } from '../lib/types'
import { ThemeToggle } from '../components/ThemeToggle'
import { Lightbox } from '../components/Lightbox'

export default function ProductoForm() {
  const { sku: skuParam } = useParams()
  const esEdicion = Boolean(skuParam)
  const navigate = useNavigate()

  const [sku, setSku] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState<string>('otro')
  const [unidadMedida, setUnidadMedida] = useState<string>('pieza')
  const [proveedor, setProveedor] = useState('')
  const [familiaId, setFamiliaId] = useState<string>('')
  const [stock, setStock] = useState<number>(0)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [fotoArchivo, setFotoArchivo] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [dragActivo, setDragActivo] = useState(false)
  const [familias, setFamilias] = useState<Familia[]>([])
  const [cargando, setCargando] = useState(esEdicion)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxAbierto, setLightboxAbierto] = useState(false)

  useEffect(() => {
    supabase.from('familias').select('*').then(({ data }) => setFamilias(data ?? []))

    if (esEdicion && skuParam) {
      supabase
        .from('inventario')
        .select('*')
        .eq('sku', skuParam)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            setError('No se encontró el producto.')
          } else {
            setSku(data.sku)
            setDescripcion(data.descripcion)
            setCategoria(data.categoria)
            setUnidadMedida(data.unidad_medida)
            setProveedor(data.proveedor ?? '')
            setFamiliaId(data.familia_id ? String(data.familia_id) : '')
            setStock(data.stock)
            setFotoUrl(data.foto_url)
          }
          setCargando(false)
        })
    }
  }, [esEdicion, skuParam])

  useEffect(() => {
    if (!fotoArchivo) {
      setFotoPreview(null)
      return
    }
    const url = URL.createObjectURL(fotoArchivo)
    setFotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [fotoArchivo])

  const familiasFiltradas = familias.filter((f) => f.categoria === categoria)
  const imagenAMostrar = fotoPreview ?? fotoUrl

  function handleFileChange(file: File | null) {
    setFotoArchivo(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActivo(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleFileChange(file)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)

    let urlFinal = fotoUrl

    if (fotoArchivo) {
      // Sube la foto a través de la Edge Function "subir-foto", que la
      // manda a Cloudflare R2 con las credenciales seguras del servidor
      // (nunca expuestas aquí en el navegador).
      const formData = new FormData()
      formData.append('archivo', fotoArchivo)
      formData.append('sku', sku)

      const { data: funcionData, error: uploadError } = await supabase.functions.invoke('subir-foto', {
        body: formData,
      })

      if (uploadError || !funcionData?.url) {
        setError('Error al subir la foto: ' + (uploadError?.message || 'respuesta inválida del servidor'))
        setGuardando(false)
        return
      }

      urlFinal = funcionData.url
    }

    const payload = {
      sku,
      descripcion,
      categoria,
      unidad_medida: unidadMedida,
      proveedor: proveedor || null,
      familia_id: familiaId ? Number(familiaId) : null,
      foto_url: urlFinal,
    }

    const { error: saveError } = esEdicion
      ? await supabase.from('inventario').update(payload).eq('sku', skuParam)
      : await supabase.from('inventario').insert({ ...payload, stock: 0 })

    setGuardando(false)

    if (saveError) {
      setError('Error al guardar: ' + saveError.message)
      return
    }

    navigate('/')
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center text-gray-500 dark:text-gray-400 text-lg">
        Cargando…
      </div>
    )
  }

  const inputClass =
    'w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100'
  const labelClass = 'block text-base font-medium text-gray-700 dark:text-gray-300 mb-2'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto p-6 md:p-10">
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

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-8 md:px-10 pt-8 md:pt-10">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {esEdicion ? 'Editar producto' : 'Nuevo producto'}
            </h1>
            {esEdicion && (
              <p className="text-base text-gray-500 dark:text-gray-400 mt-2">
                Stock actual: <span className={stock < 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'font-medium'}>{stock}</span> {unidadMedida}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-8 md:p-10 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-10">
            {/* Columna de la foto */}
            <div>
              <label className={labelClass}>Foto del producto</label>
              <label
                htmlFor="foto-input"
                onDragOver={(e) => { e.preventDefault(); setDragActivo(true) }}
                onDragLeave={() => setDragActivo(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden ${
                  dragActivo
                    ? 'border-gray-900 dark:border-gray-100 bg-gray-50 dark:bg-gray-800'
                    : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
                }`}
              >
                {imagenAMostrar ? (
                  <>
                    <img
                      src={imagenAMostrar}
                      alt="Vista previa"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setLightboxAbierto(true)
                      }}
                      className="w-full h-full object-contain p-4 cursor-zoom-in"
                    />
                    <label
                      htmlFor="foto-input"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-2 right-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur text-xs font-medium text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full cursor-pointer hover:bg-white dark:hover:bg-gray-900 shadow-sm"
                    >
                      Cambiar foto
                    </label>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500 px-6 text-center">
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm">Arrastra una imagen o haz clic</span>
                  </div>
                )}
                <input
                  id="foto-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
              {fotoArchivo && (
                <button
                  type="button"
                  onClick={() => handleFileChange(null)}
                  className="mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  Quitar foto seleccionada
                </button>
              )}
            </div>

            {/* Columna de campos */}
            <div className="space-y-5">
              <div>
                <label className={labelClass}>SKU</label>
                <input
                  type="text"
                  required
                  disabled={esEdicion}
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className={`${inputClass} disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:text-gray-500`}
                />
              </div>

              <div>
                <label className={labelClass}>Descripción</label>
                <input
                  type="text"
                  required
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Categoría</label>
                  <select
                    value={categoria}
                    onChange={(e) => { setCategoria(e.target.value); setFamiliaId('') }}
                    className={`${inputClass} capitalize`}
                  >
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Familia</label>
                  <select
                    value={familiaId}
                    onChange={(e) => setFamiliaId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Sin asignar</option>
                    {familiasFiltradas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Unidad de medida</label>
                  <select
                    value={unidadMedida}
                    onChange={(e) => setUnidadMedida(e.target.value)}
                    className={`${inputClass} capitalize`}
                  >
                    {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Proveedor</label>
                  <input
                    type="text"
                    value={proveedor}
                    onChange={(e) => setProveedor(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {error && (
                <p className="text-base text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3">
                  {error}
                </p>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  type="submit"
                  disabled={guardando}
                  className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg px-6 py-3 text-base font-medium hover:bg-gray-800 dark:hover:bg-gray-300 disabled:opacity-50"
                >
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-base text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {lightboxAbierto && imagenAMostrar && (
        <Lightbox
          src={imagenAMostrar}
          alt={descripcion || 'Foto del producto'}
          onClose={() => setLightboxAbierto(false)}
        />
      )}
    </div>
  )
}