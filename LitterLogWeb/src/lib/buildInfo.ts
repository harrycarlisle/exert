/** Injected at build time via Vite `define`. */
declare const __LITTER_LOG_BUILD_SHA__: string
declare const __LITTER_LOG_BUILD_TIME__: string

function readDefine(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

export const BUILD_SHA = readDefine(
  typeof __LITTER_LOG_BUILD_SHA__ !== 'undefined'
    ? __LITTER_LOG_BUILD_SHA__
    : undefined,
  'dev',
)

export const BUILD_TIME = readDefine(
  typeof __LITTER_LOG_BUILD_TIME__ !== 'undefined'
    ? __LITTER_LOG_BUILD_TIME__
    : undefined,
  '',
)

export function shortBuildSha(sha = BUILD_SHA): string {
  if (!sha || sha === 'dev') return sha || 'dev'
  return sha.slice(0, 7)
}

export interface DeployedVersionInfo {
  sha: string
  shortSha: string
  builtAt: string
}

export async function fetchDeployedVersion(
  baseUrl = import.meta.env.BASE_URL || '/',
): Promise<DeployedVersionInfo> {
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const url = `${root}version.json?t=${Date.now()}`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`version.json HTTP ${response.status}`)
  }
  const data = (await response.json()) as Partial<DeployedVersionInfo>
  if (!data.sha || !data.shortSha) {
    throw new Error('version.json missing sha fields')
  }
  return {
    sha: data.sha,
    shortSha: data.shortSha,
    builtAt: data.builtAt ?? '',
  }
}
