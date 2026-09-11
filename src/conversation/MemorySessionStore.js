'use strict';

function emptySession(userId, channel) {
  return {
    userId,
    channel,
    activeFlow: null,
    step: null,
    data: {},
    handoff: false,
  };
}

class MemorySessionStore {
  constructor() {
    this.map = new Map();
  }

  key(userId, channel) {
    return `${channel || 'http'}:${userId}`;
  }

  get(userId, channel) {
    const k = this.key(userId, channel);
    if (!this.map.has(k)) {
      this.map.set(k, emptySession(userId, channel));
    }
    return this.map.get(k);
  }

  reset(session) {
    session.activeFlow = null;
    session.step = null;
    session.data = {};
    session.handoff = false;
  }
}

module.exports = { MemorySessionStore, emptySession };
