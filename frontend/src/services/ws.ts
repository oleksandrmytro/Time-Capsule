import { Client, IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

let client: Client | null = null
let connected = false
let subscription: { unsubscribe(): void } | null = null

// Функція для отримання URL WebSocket, враховуючи базовий URL поточного сайту
function getWsUrl(): string {
  const base = window.location.origin
  return `${base}/ws`
}

export interface CapsuleStreamCallbacks {
  onEvent?: (body: unknown) => void
  onError?: (msg: string) => void
}

// В контексті STOMP/WebSocket "шедулер" — це внутрішній механізм heartbeat, який регулярно перевіряє стан з'єднання.
export function connectCapsuleStream({ onEvent, onError }: CapsuleStreamCallbacks): void {
  if (client) return
  client = new Client({
    webSocketFactory: () => new SockJS(getWsUrl()),
    connectHeaders: {},
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => {},
    onConnect: () => {
      connected = true
      subscription = client!.subscribe('/user/queue/capsules/status', (msg: IMessage) => {
        try {
          const body = JSON.parse(msg.body)
          onEvent?.(body)
        } catch (e) {
          console.error('WS parse error', e)
        }
      })
    },
    onStompError: (frame) => {
      onError?.(frame.headers['message'] || 'WebSocket error')
    },
    onWebSocketError: (event: any) => {
      onError?.(event?.message || 'WebSocket error')
    },
  })
  client.activate()
}

export function disconnectCapsuleStream(): void {
  if (subscription) {
    subscription.unsubscribe()
    subscription = null
  }
  if (client && connected) {
    client.deactivate()
  }
  client = null
  connected = false
}

