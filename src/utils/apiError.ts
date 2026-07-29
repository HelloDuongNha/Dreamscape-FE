export function getApiErrorMessage(error: unknown, fallback = ''): string {
  if (error instanceof Error && error.message) {
    const responseMessage = readResponseMessage(error)
    return responseMessage || error.message
  }

  return readResponseMessage(error) || fallback
}

export function getApiErrorStatus(error: unknown): number | undefined {
  const response = readObjectProperty(error, 'response')
  const status = readObjectProperty(response, 'status')
  return typeof status === 'number' ? status : undefined
}

export function getApiErrorCode(error: unknown): string {
  const code = readObjectProperty(error, 'code')
  return typeof code === 'string' ? code : ''
}

function readResponseMessage(error: unknown): string {
  const response = readObjectProperty(error, 'response')
  const data = readObjectProperty(response, 'data')
  const message = readObjectProperty(data, 'message')
  if (typeof message === 'string') return message
  const apiError = readObjectProperty(data, 'error')
  return typeof apiError === 'string' ? apiError : ''
}

function readObjectProperty(value: unknown, property: string): unknown {
  if (!value || typeof value !== 'object' || !(property in value)) return undefined
  return value[property as keyof typeof value]
}
