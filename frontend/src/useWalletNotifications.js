// Real-time wallet notifications hook.
// Connects to /api/ws/notifications?user_id=... and surfaces toast notifications
// + dispatches a global "hemeley:wallet-updated" event so any WalletCard /
// TransactionsList currently mounted can refresh itself.

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const getWsBase = () => {
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  const raw = (!envUrl || envUrl.includes('emergentagent.com'))
    ? (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'https:' : 'http:'}//${window.location.hostname}:8000` : 'http://localhost:8000')
    : envUrl;
  return raw.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
};
const WS_BASE = getWsBase();

const EVENT_META = {
  'wallet.recharge.success': { icon: '💰', kind: 'success' },
  'order.placed':            { icon: '🔔', kind: 'success' },
  'order.paid':              { icon: '🍽️', kind: 'success' },
  'order.refunded':          { icon: '↩️', kind: 'info' },
  'escrow.released':         { icon: '✅', kind: 'success' },
  'withdrawal.approved':     { icon: '🚀', kind: 'success' },
  'withdrawal.rejected':     { icon: '❌', kind: 'error' },
};

/**
 * useWalletNotifications subscribes to the WS feed for the current user.
 *
 * @param {string|null} userId       The user_id to subscribe with. Pass null to disable.
 * @param {object}      opts
 * @param {boolean}     opts.showToasts  Show a toast on every event (default: true)
 * @param {(evt:object)=>void} opts.onEvent  Optional per-event callback
 */
export default function useWalletNotifications(userId, { showToasts = true, onEvent } = {}) {
  const wsRef = useRef(null);
  const reconnectRef = useRef({ attempts: 0, timer: null });
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!userId) return undefined;
    stoppedRef.current = false;

    const open = () => {
      if (stoppedRef.current) return;
      const url = `${WS_BASE}/api/ws/notifications?user_id=${encodeURIComponent(userId)}`;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (_) {
        return;
      }
      wsRef.current = ws;

      const heartbeat = setInterval(() => {
        if (ws.readyState === 1) ws.send('ping');
      }, 30000);

      ws.onopen = () => {
        reconnectRef.current.attempts = 0;
      };

      ws.onmessage = (msg) => {
        if (msg.data === 'pong') return;
        let parsed;
        try { parsed = JSON.parse(msg.data); } catch { return; }
        const { event, payload } = parsed || {};
        if (!event) return;

        const meta = EVENT_META[event] || { icon: '🔔', kind: 'info' };
        if (showToasts) {
          const fn = meta.kind === 'error' ? toast.error : meta.kind === 'info' ? toast.info : toast.success;
          fn(`${meta.icon} ${payload?.message || event}`, {
            description: payload?.tx_reference || payload?.reference || undefined,
            duration: 6000,
          });
        }

        // Tell every wallet-aware component to refresh
        try {
          window.dispatchEvent(new CustomEvent('hemeley:wallet-updated', { detail: { event, payload } }));
        } catch (_) { /* IE11 — ignored */ }

        onEvent?.({ event, payload });
      };

      ws.onclose = () => {
        clearInterval(heartbeat);
        if (stoppedRef.current) return;
        // Exponential backoff up to 30s
        const attempts = ++reconnectRef.current.attempts;
        const delay = Math.min(1000 * Math.pow(1.7, attempts), 30000);
        reconnectRef.current.timer = setTimeout(open, delay);
      };

      ws.onerror = () => {
        try { ws.close(); } catch (_) { /* */ }
      };
    };

    open();

    return () => {
      stoppedRef.current = true;
      if (reconnectRef.current.timer) clearTimeout(reconnectRef.current.timer);
      try { wsRef.current?.close(); } catch (_) { /* */ }
    };
  }, [userId, showToasts, onEvent]);
}
