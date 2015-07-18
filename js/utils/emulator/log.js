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

    // TODO: Replace with a proper ReactJS render
    LOG.render();
  },

  render: () => {
    let msgBox = document.getElementById('msg');
    LOG._entries.slice(LOG._lastRender).forEach((entry, i) => {
      let li = document.createElement('li');
      li.textContent = '{' + (entry.time - LOG._start) + 'ms} [' + entry.name + '] ' + entry.msg;
      msgBox.appendChild(li);
      LOG._lastRender++;
    });
  }
};

export default LOG;
