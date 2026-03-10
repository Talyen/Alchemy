import 'dotenv/config'
import Replicate from 'replicate'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_MODEL = 'miike-ai/flux-sprites:bfbaa4240a9948bcc5483cceb9abd73db68c63018a4a7ba5b8a01616d291dcc9'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const manifestPath = path.resolve(projectRoot, 'scripts/sprite-manifest.json')

function now() {
  return new Date().toISOString()
}

function log(message) {
  console.log(`[${now()}] ${message}`)
}

function ensureTriggerWord(prompt) {
  if (typeof prompt !== 'string') return 'SPRITES'
  if (/\bSPRITES\b/i.test(prompt)) return prompt
  return `${prompt.trim()} SPRITES`
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function inferExtension(url, contentType) {
  const loweredType = (contentType || '').toLowerCase()
  if (loweredType.includes('image/gif')) return 'gif'
  if (loweredType.includes('image/webp')) return 'webp'
  if (loweredType.includes('image/png')) return 'png'

  try {
    const parsed = new URL(url)
    const ext = path.extname(parsed.pathname).replace('.', '').toLowerCase()
    if (ext) return ext
  } catch {
    // Fall back to png for unknown extensions.
  }

  return 'png'
}

function inferRetryDelayMs(error) {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/"retry_after"\s*:\s*(\d+)/i)
  const retryAfterSeconds = match ? Number(match[1]) : 0
  if (retryAfterSeconds > 0) return retryAfterSeconds * 1000
  if (message.includes('429')) return 12000
  return 0
}

async function fileExists(filePath) {
  try {
    await readFile(filePath)
    return true
  } catch {
    return false
  }
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(value)
}

async function resolveUploadedFileUrl(replicate, sourcePath, spriteId, inputKey) {
  const absolutePath = path.isAbsolute(sourcePath)
    ? sourcePath
    : path.resolve(projectRoot, sourcePath)

  const exists = await fileExists(absolutePath)
  if (!exists) {
    throw new Error(`Missing local input file for ${spriteId}.${inputKey}: ${sourcePath}`)
  }

  const content = await readFile(absolutePath)
  const uploaded = await replicate.files.create(content)
  const uploadedUrl = await extractUrl(uploaded)
  if (!uploadedUrl) {
    throw new Error(`Could not resolve uploaded URL for ${spriteId}.${inputKey}: ${sourcePath}`)
  }

  return uploadedUrl
}

async function normalizeInputFiles(replicate, input, spriteId) {
  const fileInputKeys = ['image', 'input_image', 'mask', 'input_palette']

  for (const key of fileInputKeys) {
    const value = input[key]
    if (typeof value !== 'string' || value.trim().length === 0) continue
    const trimmed = value.trim()
    if (isRemoteUrl(trimmed)) continue

    const uploadedUrl = await resolveUploadedFileUrl(replicate, trimmed, spriteId, key)
    input[key] = uploadedUrl
    log(`-> ${spriteId}: uploaded local ${key} (${trimmed})`)
  }
}

async function extractUrl(entry) {
  if (!entry) return null
  if (typeof entry === 'string') return entry

  if (typeof entry === 'object') {
    if (entry.urls && typeof entry.urls.get === 'string') return entry.urls.get
    if (typeof entry.url === 'string') return entry.url
    if (typeof entry.url === 'function') {
      try {
        const value = await entry.url()
        if (typeof value === 'string') return value
      } catch {
        // Continue to other extraction paths.
      }
    }
    if (typeof entry.href === 'string') return entry.href
    if (typeof entry.toString === 'function') {
      const value = entry.toString()
      if (typeof value === 'string' && value.startsWith('http')) return value
    }
  }

  return null
}

async function normalizeOutputUrls(output) {
  if (!output) return []

  if (Array.isArray(output)) {
    const urls = []
    for (const entry of output) {
      const url = await extractUrl(entry)
      if (url) urls.push(url)
    }
    return urls
  }

  if (output && typeof output === 'object') {
    if (Array.isArray(output.frames)) return normalizeOutputUrls(output.frames)
    if (Array.isArray(output.output)) return normalizeOutputUrls(output.output)
    const url = await extractUrl(output)
    if (url) return [url]
  }

  return []
}

async function downloadAsset(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading frame: ${url}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const contentType = response.headers.get('content-type') || ''
  return { buffer, contentType }
}

async function readManifest() {
  const raw = await readFile(manifestPath, 'utf8')
  return JSON.parse(raw)
}

async function writeManifest(manifest) {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

async function generateSprite(replicate, manifest, sprite) {
  const outputRoot = manifest.outputRoot || 'public/assets/generated/sprites'
  const spriteOutputDir = path.resolve(projectRoot, outputRoot, sprite.id)
  const model = typeof sprite.model === 'string' && sprite.model.trim().length > 0
    ? sprite.model.trim()
    : DEFAULT_MODEL

  await mkdir(spriteOutputDir, { recursive: true })

  const prompt = ensureTriggerWord(sprite.prompt)
  const input = {
    prompt,
    model: 'schnell',
    num_outputs: 1,
    go_fast: true,
    output_format: 'png',
    output_quality: 100,
    aspect_ratio: 'custom',
    width: sprite.resolution?.width ?? 512,
    height: sprite.resolution?.height ?? 512,
    ...sprite.modelInput,
  }

  await normalizeInputFiles(replicate, input, sprite.id)

  log(`-> ${sprite.id}: calling ${model} with model=${input.model ?? 'schnell'} outputs=${input.num_outputs ?? 1}`)
  let output
  try {
    output = await replicate.run(model, { input })
  } catch (error) {
    const retryDelayMs = inferRetryDelayMs(error)
    if (retryDelayMs <= 0) throw error
    log(`-> ${sprite.id}: throttled, retrying in ${Math.ceil(retryDelayMs / 1000)}s`) 
    await sleep(retryDelayMs)
    output = await replicate.run(model, { input })
  }
  const frameUrls = await normalizeOutputUrls(output)

  if (frameUrls.length === 0) {
    throw new Error('Model returned no frame URLs. Check manifest modelInput for supported fields.')
  }

  const outputMode = sprite.outputMode === 'frame_sequence' ? 'frame_sequence' : 'single_asset'
  log(`-> ${sprite.id}: received ${frameUrls.length} output file(s), mode=${outputMode}, saving to ${path.relative(projectRoot, spriteOutputDir)}`)

  if (outputMode === 'single_asset') {
    const primaryUrl = frameUrls[0]
    const asset = await downloadAsset(primaryUrl)
    const extension = inferExtension(primaryUrl, asset.contentType)
    const fileName = `${sprite.id}.${extension}`
    const filePath = path.resolve(spriteOutputDir, fileName)
    await writeFile(filePath, asset.buffer)
    const savedPath = path.relative(projectRoot, filePath).replaceAll('\\', '/')
    log(`   saved ${savedPath}`)
    return {
      outputKind: 'single_asset',
      outputFiles: [savedPath],
      outputUrls: frameUrls,
      modelUsed: model,
    }
  }

  const framePrefix = sprite.framePrefix || `${sprite.id}-f`
  const framePaths = []
  for (let index = 0; index < frameUrls.length; index += 1) {
    const url = frameUrls[index]
    const asset = await downloadAsset(url)
    const extension = inferExtension(url, asset.contentType)
    const fileName = `${framePrefix}${index}.${extension}`
    const filePath = path.resolve(spriteOutputDir, fileName)
    await writeFile(filePath, asset.buffer)
    framePaths.push(path.relative(projectRoot, filePath).replaceAll('\\', '/'))
    log(`   saved ${framePaths[framePaths.length - 1]}`)
  }

  return {
    outputKind: 'frame_sequence',
    outputFiles: framePaths,
    outputUrls: frameUrls,
    modelUsed: model,
  }
}

async function main() {
  if (process.env.ENABLE_SPRITE_GENERATION !== 'true') {
    throw new Error('Sprite generation is paused by default. Set ENABLE_SPRITE_GENERATION=true to run this script intentionally.')
  }

  const token = process.env.REPLICATE_API_TOKEN
  if (!token) {
    throw new Error('Missing REPLICATE_API_TOKEN. Add it to .env (see .env.example).')
  }

  const replicate = new Replicate({ auth: token })
  const manifest = await readManifest()
  const sprites = Array.isArray(manifest.sprites) ? manifest.sprites : []
  const pending = sprites.filter(sprite => sprite.status === 'pending')

  log(`Loaded manifest: ${sprites.length} sprite(s), ${pending.length} pending.`)

  if (pending.length === 0) {
    log('No pending sprites. Nothing to do.')
    return
  }

  let successCount = 0
  let failCount = 0

  for (const sprite of pending) {
    log(`Processing ${sprite.id} (${sprite.animationStyle || 'unspecified animation style'})`)

    const current = sprites.find(entry => entry.id === sprite.id)
    if (!current) continue

    current.status = 'generating'
    current.lastAttemptAt = now()
    current.error = null
    await writeManifest(manifest)

    try {
      const result = await generateSprite(replicate, manifest, current)
      current.status = 'generated'
      current.generatedAt = now()
      current.outputKind = result.outputKind
      current.outputFiles = result.outputFiles
      current.outputFrames = result.outputFiles
      current.outputUrls = result.outputUrls
      current.modelUsed = result.modelUsed
      successCount += 1
      log(`OK ${current.id}: generated ${result.outputFiles.length} file(s)`) 
    } catch (error) {
      current.status = 'failed'
      current.error = error instanceof Error ? error.message : String(error)
      failCount += 1
      log(`FAIL ${current.id}: ${current.error}`)
    }

    await writeManifest(manifest)
  }

  log(`Done. Success: ${successCount}, Failed: ${failCount}`)
}

main().catch((error) => {
  console.error(`[${now()}] Fatal:`, error instanceof Error ? error.message : error)
  process.exitCode = 1
})
