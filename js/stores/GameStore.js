/**
 * Game Store
 *
 * Store for Game Boy on React
 */

import AppDispatcher from '../dispatcher/AppDispatcher';
import {EventEmitter} from 'events';
import Const, {ActionTypes} from '../constants/EmuConstants';

var CHANGE_EVENT = 'change';

const GameStore = Object.assign({}, EventEmitter.prototype, {
  emitChange() {
    this.emit(CHANGE_EVENT);
  },

  /**
   * @param {function} callback
   */
  addChangeListener(callback) {
    this.on(CHANGE_EVENT, callback);
  },

  getAll() {
    return _stories;
  }
});

// Register our dispatch token as a static method
GameStore.dispatchToken = AppDispatcher.register(function(payload) {

  // Go through the various actions
  switch(payload.type) {
    // Story actions
    case ActionTypes.ROM_RECEIVE:
      GameStore.emitChange();
    break;
    default:
      // do nothing
  }
});

export default GameStore;
