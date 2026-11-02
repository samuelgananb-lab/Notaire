import { randomUUID } from 'node:crypto';
import { supabase } from '../database/supabase.js';

export function createNotificationDeliveryService({
  client = supabase,
  createToken = randomUUID,
  leaseSeconds = 300
} = {}) {
  async function callRpc(name, parameters) {
    const { data, error } = await client.rpc(name, parameters);
    if (error) throw new Error(`${name} falló: ${error.message}`);
    return data;
  }

  async function releaseClaim(delivery, claimToken, error) {
    const released = await callRpc('release_notification_delivery', {
      p_source_type: delivery.sourceType,
      p_source_id: delivery.sourceId,
      p_notification_type: delivery.notificationType,
      p_source_version: delivery.sourceVersion,
      p_claim_token: claimToken,
      p_error: error instanceof Error ? error.message : String(error || 'Envío no confirmado')
    });

    if (released !== true) {
      throw new Error('No se pudo liberar la reclamación del aviso para reintentar.');
    }
  }

  return async function deliverNotificationOnce({
    sourceType,
    sourceId,
    notificationType,
    sourceVersion = '1',
    send
  }) {
    const delivery = {
      sourceType: String(sourceType || ''),
      sourceId: String(sourceId ?? ''),
      notificationType: String(notificationType || ''),
      sourceVersion: String(sourceVersion ?? '1')
    };
    if (Object.values(delivery).some(value => !value) || typeof send !== 'function') {
      throw new Error('Faltan datos para registrar el envío idempotente del aviso.');
    }

    const idempotencyKey = [
      delivery.sourceType,
      delivery.sourceId,
      delivery.notificationType,
      delivery.sourceVersion
    ].join('/');
    if (idempotencyKey.length > 256) {
      throw new Error('La clave idempotente del aviso supera los 256 caracteres.');
    }

    const claimToken = createToken();
    const claim = await callRpc('claim_notification_delivery', {
      p_source_type: delivery.sourceType,
      p_source_id: delivery.sourceId,
      p_notification_type: delivery.notificationType,
      p_source_version: delivery.sourceVersion,
      p_claim_token: claimToken,
      p_lease_seconds: leaseSeconds
    });

    if (claim === 'sent') return { status: 'already-sent', idempotencyKey };
    if (claim !== 'claimed') return { status: 'not-claimed', idempotencyKey };

    let released = false;
    try {
      const sent = await send(idempotencyKey);
      if (sent !== true) {
        await releaseClaim(delivery, claimToken, 'El proveedor no confirmó el envío.');
        released = true;
        return { status: 'not-sent', idempotencyKey };
      }

      const completed = await callRpc('complete_notification_delivery', {
        p_source_type: delivery.sourceType,
        p_source_id: delivery.sourceId,
        p_notification_type: delivery.notificationType,
        p_source_version: delivery.sourceVersion,
        p_claim_token: claimToken
      });
      if (completed !== true) {
        throw new Error('La reclamación del aviso expiró antes de confirmar el envío.');
      }

      return { status: 'sent', idempotencyKey };
    } catch (error) {
      if (!released) {
        try {
          await releaseClaim(delivery, claimToken, error);
        } catch (releaseError) {
          throw new AggregateError([error, releaseError], 'Falló el envío y no se pudo liberar su reclamación.');
        }
      }
      throw error;
    }
  };
}

export const deliverNotificationOnce = createNotificationDeliveryService();
