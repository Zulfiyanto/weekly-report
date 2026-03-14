const MAX_WIDTH = 800
const QUALITY = 0.8
const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2MB
const MAX_IMAGES = 10
const KEY_PREFIX = "wr_img_"

async function getLocalforage() {
  if (typeof window === "undefined") {
    throw new Error("localforage is browser-only")
  }
  const lf = (await import("localforage")).default
  lf.config({ name: "weekly-report-app", storeName: "images" })
  return lf
}

function generateKey(): string {
  return KEY_PREFIX + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Compress image file using canvas. Returns base64 data URL. */
export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)

        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("Canvas context tidak tersedia"))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL("image/jpeg", QUALITY))
      }
      img.onerror = () => reject(new Error("Gagal memuat gambar"))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("Gagal membaca file"))
    reader.readAsDataURL(file)
  })
}

/** Validate, compress, store image. Returns the storage key. */
export async function storeImage(file: File, currentCount: number): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`Format tidak didukung: ${file.name}`)
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Gambar "${file.name}" melebihi batas 2MB`)
  }
  if (currentCount >= MAX_IMAGES) {
    throw new Error(`Maksimal ${MAX_IMAGES} gambar`)
  }

  const base64 = await compressImage(file)
  const key = generateKey()
  const lf = await getLocalforage()
  await lf.setItem(key, base64)
  return key
}

/** Load a single image. Returns null if not found. */
export async function loadImage(key: string): Promise<string | null> {
  try {
    const lf = await getLocalforage()
    const val = await lf.getItem<string>(key)
    return val ?? null
  } catch {
    return null
  }
}

/** Load multiple images in parallel. */
export async function loadImages(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return []
  const results = await Promise.all(keys.map(loadImage))
  return results.filter((r): r is string => r !== null)
}

/** Delete a single image from IndexedDB. */
export async function deleteImage(key: string): Promise<void> {
  try {
    const lf = await getLocalforage()
    await lf.removeItem(key)
  } catch {
    // silently ignore
  }
}

/** Delete multiple images. */
export async function deleteImages(keys: string[]): Promise<void> {
  await Promise.all(keys.map(deleteImage))
}

/** Estimate total size from base64 strings and return human-readable label. */
export function getTotalSizeLabel(base64Strings: string[]): string {
  const totalBytes = base64Strings.reduce((sum, s) => {
    // base64 string length * 0.75 ≈ actual bytes
    return sum + Math.round(s.length * 0.75)
  }, 0)
  if (totalBytes < 1024) return `${totalBytes} B`
  if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`
  return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
}
