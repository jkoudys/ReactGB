const LOG = {
  _start: 0,
  _entries: [],
  _lastRender: 0,

  reset: () => {
    LOG._start = Date.now();
  },

  out: (module, str) => {
    let entry = {time: Date.now(), name: module, msg: str};
    LOG._entries.push(entry);
    console.log(entry);
  }
};

export default LOG;
