import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/axios";

const initialState = {
  messages: [],
  recentMessages: [],
  lastEventAt: null,
};

const getMessageKeys = (message) => {
  const keys = [
    message?._id,
    message?.id,
    message?.client_message_id,
    message?.clientMessageId,
  ];

  return keys.filter(Boolean).map(String);
};

const upsertMessage = (messages, nextMessage) => {
  const nextKeys = getMessageKeys(nextMessage);
  if (nextKeys.length === 0) return messages;

  const index = messages.findIndex((message) => {
    const messageKeys = getMessageKeys(message);
    return messageKeys.some((key) => nextKeys.includes(key));
  });
  if (index === -1) {
    return [...messages, nextMessage];
  }

  const nextMessages = [...messages];
  nextMessages[index] = { ...nextMessages[index], ...nextMessage };
  return nextMessages;
};

export const fetchMessages = createAsyncThunk("messages/fetchMessages", async ({ token, userId }) => {
  const { data } = await api.post(
    "/api/message/get",
    { to_user_id: userId },
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data.success ? data : null;
});

export const fetchRecentMessages = createAsyncThunk(
  "messages/fetchRecentMessages",
  async (token) => {
    const { data } = await api.get("/api/message/recent", {
      headers: { Authorization: `Bearer ${token}` },
    });

    return data.success ? data : null;
  },
);

const mergeRecentMessages = (messages, nextMessage) => {
  const nextConversationKey = nextMessage?.conversation_key || null;
  if (!nextConversationKey) {
    return messages;
  }

  const index = messages.findIndex(
    (message) => message?.conversation_key === nextConversationKey,
  );

  if (index === -1) {
    return [nextMessage, ...messages];
  }

  const nextMessages = [...messages];
  const existing = nextMessages[index] || {};
  nextMessages[index] = {
    ...existing,
    ...nextMessage,
    preview:
      nextMessage.preview ||
      existing.preview ||
      nextMessage.text ||
      existing.text ||
      "Media",
  };

  return nextMessages.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
};

const messagesSlice = createSlice({
  name: "messages",
  initialState,
  reducers: {
    setMessages: (state, action) => {
      state.messages = Array.isArray(action.payload) ? action.payload : [];
      state.lastEventAt = new Date().toISOString();
    },
    addMessage: (state, action) => {
      state.messages = upsertMessage(state.messages, action.payload);
      state.lastEventAt = new Date().toISOString();
    },
    upsertRecentMessage: (state, action) => {
      state.recentMessages = mergeRecentMessages(state.recentMessages, action.payload);
      state.lastEventAt = new Date().toISOString();
    },
    setRecentMessages: (state, action) => {
      state.recentMessages = Array.isArray(action.payload) ? action.payload : [];
      state.lastEventAt = new Date().toISOString();
    },
    updateMessage: (state, action) => {
      state.messages = upsertMessage(state.messages, action.payload);
      state.recentMessages = mergeRecentMessages(state.recentMessages, action.payload);
      state.lastEventAt = new Date().toISOString();
    },
    removeMessage: (state, action) => {
      const messageId = String(action.payload);
      state.messages = state.messages.filter(
        (message) => !getMessageKeys(message).includes(messageId),
      );
      state.lastEventAt = new Date().toISOString();
    },
    removeMessageForViewer: (state, action) => {
      const messageId = String(action.payload);
      state.messages = state.messages.filter(
        (message) => !getMessageKeys(message).includes(messageId),
      );
      state.lastEventAt = new Date().toISOString();
    },
    touchMessageFeed: (state) => {
      state.lastEventAt = new Date().toISOString();
    },
    resetMessages: (state) => {
      state.messages = [];
      state.recentMessages = [];
      state.lastEventAt = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchMessages.fulfilled, (state, action) => {
      if (action.payload) {
        state.messages = action.payload.messages || [];
        state.lastEventAt = new Date().toISOString();
      }
    });
    builder.addCase(fetchRecentMessages.fulfilled, (state, action) => {
      if (action.payload) {
        state.recentMessages = action.payload.messages || [];
        state.lastEventAt = new Date().toISOString();
      }
    });
  },
});

export const {
  setMessages,
  addMessage,
  upsertRecentMessage,
  setRecentMessages,
  updateMessage,
  removeMessage,
  removeMessageForViewer,
  touchMessageFeed,
  resetMessages,
} = messagesSlice.actions;

export default messagesSlice.reducer;
