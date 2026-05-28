const streams = {
  messages: new Map(),
  notifications: new Map(),
  posts: new Map(),
};

export const registerStream = (channel, userId, res) => {
  const channelStreams = streams[channel];
  if (!channelStreams) return;

  const existing = channelStreams.get(userId);
  if (existing && existing !== res) {
    try {
      existing.end();
    } catch {
      // ignore
    }
  }

  channelStreams.set(userId, res);
};

export const unregisterStream = (channel, userId) => {
  streams[channel]?.delete(userId);
};

export const emitStreamEvent = (channel, userId, payload) => {
  const stream = streams[channel]?.get(userId);
  if (!stream) return false;

  stream.write(`data: ${JSON.stringify(payload)}\n\n`);
  return true;
};

export const emitStreamEventToMany = (channel, userIds, payload) => {
  if (!Array.isArray(userIds)) return false;

  return userIds.some((userId) => emitStreamEvent(channel, userId, payload));
};

export const streamChannels = streams;
