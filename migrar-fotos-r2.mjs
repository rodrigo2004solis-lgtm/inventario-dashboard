// migrar-fotos-r2.mjs
//
// Migra las fotos de productos de Supabase Storage a Cloudflare R2,
// y actualiza el campo foto_url en la tabla `inventario` para que
// apunte a la nueva ubicación.
//
// CÓMO CORRERLO:
//   1. npm install @supabase/supabase-js @aws-sdk/client-s3
//   2. Crea un archivo .env.migracion (NO lo subas a git) con:
//        SUPABASE_URL=https://xxxxx.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=eyJ...   <- la "service_role" key, no la anon
//        R2_ACCOUNT_ID=e67c4165da322ecfd145e897414c9deb
//        R2_ACCESS_KEY_ID=...
//        R2_SECRET_ACCESS_KEY=...
//        R2_BUCKET=inventario-chew-fotos
//        R2_PUBLIC_URL=https://pub-ed3945d3d2164b7c8660ed3f06b0c5cf.r2.dev
//   3. node --env-file=.env.migracion migrar-fotos-r2.mjs
//
// La "service_role" key la encuentras en Supabase → Project Settings
// → API → service_role (secret). Es necesaria para poder actualizar
// la tabla inventario sin depender de las políticas RLS normales.
// NO la compartas ni la subas a ningún repositorio.

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

const BUCKET = process.env.R2_BUCKET
const PUBLIC_URL = process.env.R2_PUBLIC_URL

async function main() {
  console.log('Leyendo productos con foto desde Supabase...')

  const { data: productos, error } = await supabase
    .from('inventario')
    .select('sku, foto_url')
    .not('foto_url', 'is', null)

  if (error) {
    console.error('Error al leer inventario:', error.message)
    process.exit(1)
  }

  console.log(`Encontrados ${productos.length} productos con foto.`)

  let migrados = 0
  let fallidos = 0

  for (const producto of productos) {
    try {
      // 1. Descarga la foto actual desde Supabase Storage
      const respuesta = await fetch(producto.foto_url)
      if (!respuesta.ok) {
        throw new Error(`No se pudo descargar (status ${respuesta.status})`)
      }
      const buffer = Buffer.from(await respuesta.arrayBuffer())
      const contentType = respuesta.headers.get('content-type') || 'image/jpeg'

      // 2. Nombre del archivo en R2: usa el SKU para que sea legible
      const extension = contentType.split('/')[1]?.split(';')[0] || 'jpg'
      const nombreArchivo = `${producto.sku}.${extension}`

      // 3. Sube a R2
      await r2.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: nombreArchivo,
          Body: buffer,
          ContentType: contentType,
        })
      )

      const nuevaUrl = `${PUBLIC_URL}/${nombreArchivo}`

      // 4. Actualiza el registro en inventario
      const { error: errorUpdate } = await supabase
        .from('inventario')
        .update({ foto_url: nuevaUrl })
        .eq('sku', producto.sku)

      if (errorUpdate) throw new Error(errorUpdate.message)

      migrados++
      console.log(`✅ ${producto.sku} (${migrados}/${productos.length})`)
    } catch (err) {
      fallidos++
      console.error(`❌ ${producto.sku}: ${err.message}`)
    }
  }

  console.log('\n--- Resumen ---')
  console.log(`Migrados con éxito: ${migrados}`)
  console.log(`Fallidos: ${fallidos}`)
  if (fallidos > 0) {
    console.log('Revisa los SKUs marcados con ❌ arriba — probablemente su foto_url original ya no existía o falló la descarga.')
  }
}

main()
