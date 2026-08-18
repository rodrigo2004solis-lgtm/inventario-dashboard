// supabase/functions/subir-foto/index.ts
//
// Recibe una foto desde el dashboard (ProductoForm.tsx), la sube a
// Cloudflare R2 usando las credenciales guardadas como "secrets" de
// Supabase (nunca expuestas al navegador), y regresa la URL pública.

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.17'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Preflight de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const archivo = formData.get('archivo') as File | null
    const sku = formData.get('sku') as string | null

    if (!archivo || !sku) {
      return new Response(JSON.stringify({ error: 'Falta el archivo o el SKU.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accountId = Deno.env.get('R2_ACCOUNT_ID')!
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')!
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')!
    const bucket = Deno.env.get('R2_BUCKET')!
    const publicUrl = Deno.env.get('R2_PUBLIC_URL')!

    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    })

    const extension = archivo.name.split('.').pop() || 'jpg'
    const nombreArchivo = `${sku}-${Date.now()}.${extension}`
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${nombreArchivo}`

    const bytes = new Uint8Array(await archivo.arrayBuffer())

    const respuestaR2 = await r2.fetch(endpoint, {
      method: 'PUT',
      body: bytes,
      headers: { 'Content-Type': archivo.type || 'application/octet-stream' },
    })

    if (!respuestaR2.ok) {
      const detalle = await respuestaR2.text()
      throw new Error(`R2 respondió ${respuestaR2.status}: ${detalle}`)
    }

    const urlFinal = `${publicUrl}/${nombreArchivo}`

    return new Response(JSON.stringify({ url: urlFinal }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})