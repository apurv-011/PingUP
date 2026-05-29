import { io } from 'socket.io-client'
import { apiBaseUrl } from '../api/axios'

let socketInstance = null

export const connectRealtimeSocket = ({ token, userId }) => {
  if (!socketInstance) {
    socketInstance = io(apiBaseUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
  }

  socketInstance.auth = { token, userId }

  if (!socketInstance.connected) {
    socketInstance.connect()
  }

  return socketInstance
}

export const getRealtimeSocket = () => socketInstance

export const disconnectRealtimeSocket = () => {
  if (socketInstance) {
    socketInstance.removeAllListeners()
    socketInstance.disconnect()
    socketInstance = null
  }
}

export const joinConversationRoom = (conversationKey) => {
  if (!socketInstance || !conversationKey) return
  socketInstance.emit('join-conversation', { conversationKey })
}

export const leaveConversationRoom = (conversationKey) => {
  if (!socketInstance || !conversationKey) return
  socketInstance.emit('leave-conversation', { conversationKey })
}
