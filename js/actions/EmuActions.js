import {ActionTypes} from '../constants/EmuConstants.js';
import AppDispatcher from '../dispatcher/AppDispatcher.js';

export default {
  pause: function() {
    AppDispatcher.dispatch({
      type: ActionTypes.EMU_PAUSE
    });
  },

  reset: function() {
    AppDispatcher.dispatch({
      type: ActionTypes.EMU_RESET
    });
  },

  refreshFps: function(fps) {
    AppDispatcher.dispatch({
      type: ActionTypes.FPS_REFRESH,
      fps: fps
    });
  },

  /**
   * Receives binary ROM data
   * @param arraybuffer rom Binary buffer of the ROM
   * @param string filename Optional filename of the ROM
   */
  receiveRom: function(rom, filename) {
    AppDispatcher.dispatch({
      type: ActionTypes.ROM_RECEIVE,
      rom: rom,
      filename: filename
    });
  }
};
