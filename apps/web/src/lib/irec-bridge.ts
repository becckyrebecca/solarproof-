import { logger } from '@/lib/logger'

export interface IRecRetirementPayload {
  beneficiary: string
  volumeWh: number
  vintageStart: string
  vintageEnd: string
  notes: string
}

const INTERNAL_SECRET_HEADER = 'X-Internal-Secret'

function getBridgeBaseUrl(): string {
  return process.env.BRIDGE_BASE_URL ?? 'http://localhost:3001'
}

function getInternalSecret(): string | undefined {
  const secret = process.env.INTERNAL_BRIDGE_SECRET
  return secret && secret.length > 0 ? secret : undefined
}

/**
 * Proof of Concept API Adapter for I-REC Registry.
 *
 * In a full integration, this would authenticate via OAuth 2.0
 * and POST to the I-REC registry's retirement endpoint.
 *
 * All outbound calls to the bridge microservice are authenticated with
 * the shared internal secret (X-Internal-Secret header). The secret is
 * never logged.
 */
export async function triggerIRecRetirement(payload: IRecRetirementPayload, correlationId?: string): Promise<boolean> {
  const log = correlationId ? logger.withCorrelationId(correlationId) : logger

  log.info('irec.bridge.retirement_initiated', { payload })

  const secret = getInternalSecret()
  if (!secret) {
    log.error('irec.bridge.missing_internal_secret', {
      message: 'INTERNAL_BRIDGE_SECRET is not configured; refusing to call bridge',
    })
    return false
  }

  try {
    const url = `${getBridgeBaseUrl().replace(/\/+$/, '')}/internal/irec/retirements`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INTERNAL_SECRET_HEADER]: secret,
        ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      log.error('irec.bridge.retirement_failed', {
        status: response.status,
        statusText: response.statusText,
      })
      return false
    }

    log.info('irec.bridge.retirement_success', { beneficiary: payload.beneficiary, volumeWh: payload.volumeWh })
    return true
  } catch (error) {
    log.error('irec.bridge.retirement_failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    return false
  }
}