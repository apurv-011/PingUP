import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/axios";

const initialState = {
  messages: [],
  lastEventAt: null,
};

const normalizeMessageId = (message) => message?._id || message?.id || null;

const upsertMessage = (messages, nextMessage) => {
  const nextId = normalizeMessageId(nextMessage);
  if (!nextId) return messages;

  const index = messages.findIndex((message) => normalizeMessageId(message) === nextId);
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
    updateMessage: (state, action) => {
      state.messages = upsertMessage(state.messages, action.payload);
      state.lastEventAt = new Date().toISOString();
    },
    removeMessage: (state, action) => {
      const messageId = action.payload;
      state.messages = state.messages.filter((message) => normalizeMessageId(message) !== messageId);
      state.lastEventAt = new Date().toISOString();
    },
    removeMessageForViewer: (state, action) => {
      const messageId = action.payload;
      state.messages = state.messages.filter((message) => normalizeMessageId(message) !== messageId);
      state.lastEventAt = new Date().toISOString();
    },
    touchMessageFeed: (state) => {
      state.lastEventAt = new Date().toISOString();
    },
    resetMessages: (state) => {
      state.messages = [];
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
  },
});

export const {
  setMessages,
  addMessage,
  updateMessage,
  removeMessage,
  removeMessageForViewer,
  touchMessageFeed,
  resetMessages,
} = messagesSlice.actions;

export default messagesSlice.reducer;
