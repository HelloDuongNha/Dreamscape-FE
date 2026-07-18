const DEFAULT_PDF_MAX_FILE_SIZE_MB = 250

const configuredLimit = Number(import.meta.env.VITE_PDF_MAX_FILE_SIZE_MB)

export const PDF_MAX_FILE_SIZE_MB =
  Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_PDF_MAX_FILE_SIZE_MB

export const PDF_MAX_FILE_SIZE_BYTES = Math.floor(PDF_MAX_FILE_SIZE_MB * 1024 * 1024)
export const PDF_MAX_FILE_SIZE_LABEL = `${PDF_MAX_FILE_SIZE_MB}MB`
