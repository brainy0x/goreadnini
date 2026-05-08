// fileStorage.js — Supabase Storage wrapper for epub/pdf files

import { supabase } from './supabase'

const BUCKET = 'epubs'

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
  console.log(`[FileStorage] Upload successful: ${filePath}`)
  return filePath
}

export async function getFile(filePath) {
  if (!filePath) throw new Error('filePath is required')
  console.log(`[Supabase] Attempting to download: ${BUCKET}/${filePath}`)

  // Check if filePath looks like a proper path (should contain '/')
  if (!filePath.includes('/')) {
    throw new Error(`Invalid file path format: "${filePath}". Expected format: "bookId/filename.ext". This file may not have been uploaded correctly. Please re-upload the file.`)
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filePath)
  if (error) {
    const msg = error.message || JSON.stringify(error)
    console.error(`[Supabase] Download failed for ${filePath}:`, error)

    // Provide more helpful error messages
    if (msg.includes('Object not found')) {
      throw new Error(`File not found in Supabase Storage. The file "${filePath}" does not exist. Please re-upload the file.`)
    }

    throw new Error(`Supabase download failed for "${filePath}": ${msg}`)
  }
  console.log(`[Supabase] Successfully downloaded ${filePath}, size: ${data.size} bytes`)
  // Assuming filePath is like 'bookId/filename.ext'
  const name = filePath.split('/')[1]
  const type = name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/epub+zip'
  return { file: data, name, type }
}

export async function deleteFile(filePath) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath])
  if (error) throw error
}
