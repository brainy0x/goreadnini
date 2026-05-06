// fileStorage.js — Supabase Storage wrapper for epub/pdf files

import { supabase } from './supabase'

const BUCKET = 'epubs'

export async function saveFile(bookId, file) {
  const filePath = `${bookId}/${file.name}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })
  if (error) throw error
  return filePath
}

export async function getFile(filePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filePath)
  if (error) throw error
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
