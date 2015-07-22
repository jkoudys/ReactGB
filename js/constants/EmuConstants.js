const EmuConstants = {
  ActionTypes: (function() {
    var actions = {};
    [
      'ROM_RECEIVE',
      'RESET'
    ].forEach((val) => { actions[val] = val; });
    return actions;
  })()
};

export default EmuConstants;
