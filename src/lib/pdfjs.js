// pdfjs.js — loads the PDF engine (PDF.js) only when a PDF is actually opened.

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let pending = null

export function loadPdfjs() {
  if (!pending) {
    pending = import('pdfjs-dist/build/pdf.min.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjs
    })
  }
  return pending
}
