// Reduce el tamaño de una foto en el navegador antes de subirla.
//
// - Limita el lado más largo a `ladoMaximo` píxeles (por defecto 1600).
// - La convierte a WebP (o a JPEG si el navegador no soporta WebP).
// - Respeta la orientación de las fotos tomadas con el celular.
// - Si algo falla, o el resultado pesa más que el original, regresa el
//   archivo original: comprimir nunca debe impedir que se guarde la foto.

const TIPOS_NO_COMPRIMIBLES = ['image/gif', 'image/svg+xml']

export async function comprimirImagen(
  archivo: File,
  ladoMaximo = 1600,
  calidad = 0.82,
): Promise<File> {
  if (!archivo.type.startsWith('image/') || TIPOS_NO_COMPRIMIBLES.includes(archivo.type)) {
    return archivo
  }

  try {
    const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
    const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height))
    const ancho = Math.round(imagen.width * escala)
    const alto = Math.round(imagen.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    if (!ctx) return archivo

    // Primer intento: WebP (conserva transparencia y pesa poco)
    ctx.drawImage(imagen, 0, 0, ancho, alto)
    let blob = await canvasABlob(canvas, 'image/webp', calidad)

    // Si el navegador no soporta WebP, usar JPEG con fondo blanco
    if (!blob || blob.type !== 'image/webp') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, ancho, alto)
      ctx.drawImage(imagen, 0, 0, ancho, alto)
      blob = await canvasABlob(canvas, 'image/jpeg', calidad)
    }
    imagen.close()

    if (!blob || blob.size >= archivo.size) return archivo

    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const nombreBase = archivo.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${nombreBase}.${extension}`, { type: blob.type })
  } catch {
    return archivo
  }
}

function canvasABlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad))
}