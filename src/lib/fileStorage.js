// fileStorage.js — Supabase Storage wrapper for epub/pdf files with local cache fallback

import { supabase } from './supabase'

const BUCKET = 'epubs'
const CACHE_DB = 'goreadnini-file-cache'
const CACHE_STORE = 'files'
const CACHE_VERSION = 1

function openCacheDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB, CACHE_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'path' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getCachedFile(filePath) {
  try {
    const db = await openCacheDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly')
      const store = tx.objectStore(CACHE_STORE)
      const req = store.get(filePath)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function cacheFile(filePath, file) {
  try {
    const db = await openCacheDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite')
      const store = tx.objectStore(CACHE_STORE)
      const req = store.put({ path: filePath, file, updatedAt: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (error) {
    console.warn('[FileStorage] Cache write failed:', error)
  }
}

async function removeCachedFile(filePath) {
  try {
    const db = await openCacheDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite')
      const store = tx.objectStore(CACHE_STORE)
      const req = store.delete(filePath)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (error) {
    console.warn('[FileStorage] Cache delete failed:', error)
  }
}

export async function saveFile(bookId, file) {
  const filePath = `${bookId}/${file.name}`
  console.log(`[FileStorage] Uploading to ${BUCKET}/${filePath}, size: ${file.size} bytes`)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })
  if (error) {
    console.error(`[FileStorage] Upload failed:`, error)
    throw error
  }
  await cacheFile(filePath, file)
  console.log(`[FileStorage] Upload successful: ${filePath}`)
  return filePath
}

export async function getFile(filePath) {
  if (!filePath) throw new Error('filePath is required')
  console.log(`[Supabase] Attempting to access: ${BUCKET}/${filePath}`)

  if (!filePath.includes('/')) {
    throw new Error(`Invalid file path format: "${filePath}". Expected format: "bookId/filename.ext". This file may not have been uploaded correctly. Please re-upload the file.`)
  }

  const cached = await getCachedFile(filePath)
  if (cached?.file instanceof Blob) {
    console.log(`[FileStorage] Using cached file for ${filePath}`)
    const name = filePath.split('/')[1]
    const type = name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/epub+zip'
    return { file: cached.file, name, type, fromCache: true }
  }

  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(filePath)
    if (error) throw error
    await cacheFile(filePath, data)
    console.log(`[Supabase] Successfully downloaded ${filePath}, size: ${data.size} bytes`)
    const name = filePath.split('/')[1]
    const type = name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/epub+zip'
    return { file: data, name, type, fromCache: false }
  } catch (error) {
    const msg = error?.message || JSON.stringify(error)
    console.error(`[Supabase] Download failed for ${filePath}:`, error)

    if (msg.includes('Object not found')) {
      throw new Error(`File not found in Supabase Storage. The file "${filePath}" does not exist. Please re-upload the file.`)
    }

    if (cached?.file instanceof Blob) {
      console.warn(`[FileStorage] Falling back to cached file for ${filePath} after download failure.`)
      const name = filePath.split('/')[1]
      const type = name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/epub+zip'
      return { file: cached.file, name, type, fromCache: true }
    }

    if (!navigator.onLine) {
      throw new Error('The book is not cached locally yet and the device is offline. Please reconnect to the internet once to download it.')
    }

    throw new Error(`Supabase download failed for "${filePath}": ${msg}`)
  }
}

export async function deleteFile(filePath) {
  await removeCachedFile(filePath)
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath])
  if (error) throw error
}
