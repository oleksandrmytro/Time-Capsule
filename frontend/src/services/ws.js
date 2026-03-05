import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

let client = null
let connected = false
let subscription = null

function getWsUrl() {
  const base = window.location.origin
  return `${base}/ws`
}

export function connectCapsuleStream({ onEvent, onError }) {
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
      subscription = client.subscribe('/user/queue/capsules/status', (msg) => {
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
    onWebSocketError: (event) => {
      onError?.(event?.message || 'WebSocket error')
    }
  })
  client.activate()
}

export function disconnectCapsuleStream() {
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
