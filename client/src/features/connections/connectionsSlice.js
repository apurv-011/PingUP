import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/axios";

const initialState = {
  connections: [],
  pendingConnections: [],
  followers: [],
  following: [],
};

export const fetchConnections = createAsyncThunk("connections/fetchConnections", async (token) => {
  const { data } = await api.get("/api/user/connections", {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data.success ? data : null;
});

const removeUserFromCollection = (collection, userId) =>
  collection.filter((user) => String(user?._id) !== String(userId));

const connectionsSlice = createSlice({
  name: "connections",
  initialState,
  reducers: {
    removeConnectionLocally: (state, action) => {
      const payload = action.payload || {};
      const targetUserId = payload.userId || payload.targetUserId || payload.id;

      state.connections = removeUserFromCollection(state.connections, targetUserId);
      state.followers = removeUserFromCollection(state.followers, targetUserId);
      state.following = removeUserFromCollection(state.following, targetUserId);
      state.pendingConnections = removeUserFromCollection(state.pendingConnections, targetUserId);
    },
    replaceConnectionsSnapshot: (state, action) => {
      const payload = action.payload || {};
      state.connections = payload.connections || [];
      state.pendingConnections = payload.pendingConnections || [];
      state.followers = payload.followers || [];
      state.following = payload.following || [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchConnections.fulfilled, (state, action) => {
      if (action.payload) {
        state.connections = action.payload.connections;
        state.pendingConnections = action.payload.pendingConnections;
        state.followers = action.payload.followers;
        state.following = action.payload.following;
      }
    });
  },
});

export const { removeConnectionLocally, replaceConnectionsSnapshot } = connectionsSlice.actions;

export default connectionsSlice.reducer;
