export interface ReadResult<T> {
  success: boolean
  data?: { value?: T[]; '@odata.nextLink'?: string }
  error?: unknown
}
export async function readAll<T>(
  label: string,
  read: (options: { $skiptoken?: string }) => Promise<ReadResult<T>>,
): Promise<T[]> {
  const rows: T[] = []
  const seen = new Set<string>()
  let token: string | undefined
  do {
    const result = await read({ $skiptoken: token })
    if (!result.success || !result.data || !Array.isArray(result.data.value)) {
      const detail = result.error instanceof Error ? result.error.message :
        typeof result.error === 'string' ? result.error : JSON.stringify(result.error ?? 'No rows payload returned')
      throw new Error(`${label} could not be loaded: ${detail}`)
    }
    rows.push(...result.data.value)
    const next = result.data['@odata.nextLink']
    token = undefined
    if (next) {
      token = new URL(next, 'https://managedapps.cloud.microsoft').searchParams.get('$skiptoken') ?? undefined
      if (!token || seen.has(token)) throw new Error(`${label}: invalid or repeated pagination token; results are incomplete.`)
      seen.add(token)
    }
  } while (token)
  return rows
}
