import { Client, IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

let client: Client | null = null
let connected = false
let capsuleSub: { unsubscribe(): void } | null = null
let chatSub: { unsubscribe(): void } | null = null

function getWsUrl(): string {
  const base = window.location.origin
  return `${base}/ws`
}

export interface CapsuleStreamCallbacks {
  onEvent?: (body: unknown) => void
  onError?: (msg: string) => void
}

export interface ChatStreamCallbacks {
  onMessage?: (msg: ChatWsMessage) => void
}

export interface ChatWsMessage {
  id: string
  type?: 'text' | 'capsule_share'
  text: string
  fromUserId?: string
  fromMe: boolean
  timestamp: string
  status?: string
  capsuleId?: string
  capsuleTitle?: string
}

let chatCallbacks: ChatStreamCallbacks = {}

export function setChatCallbacks(cb: ChatStreamCallbacks): void {
  chatCallbacks = cb
}

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
      capsuleSub = client!.subscribe('/user/queue/capsules/status', (msg: IMessage) => {
        try {
          const body = JSON.parse(msg.body)
          onEvent?.(body)
        } catch (e) {
          console.error('WS parse error', e)
        }
      })
      chatSub = client!.subscribe('/user/queue/chat', (msg: IMessage) => {
        try {
          const body = JSON.parse(msg.body) as ChatWsMessage
          chatCallbacks.onMessage?.(body)
        } catch (e) {
          console.error('WS chat parse error', e)
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
  if (capsuleSub) { capsuleSub.unsubscribe(); capsuleSub = null }
  if (chatSub) { chatSub.unsubscribe(); chatSub = null }
  if (client && connected) { client.deactivate() }
  client = null
  connected = false
  chatCallbacks = {}
}
