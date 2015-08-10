import LOG from './log.js';

const Keypad = {
  _keys: [0x0F, 0x0F],
  _colidx: 0,

  reset: function() {
    Keypad._keys = [0x0F, 0x0F];
    Keypad._colidx = 0;
    LOG.out('Keypad', 'Reset.');
  },

  rb: function() {
    switch (Keypad._colidx) {
      case 0x00:
        return 0x00;
        break;
      case 0x10:
        return Keypad._keys[0];
        break;
      case 0x20:
        return Keypad._keys[1];
        break;
      default:
        return 0x00;
        break;
    }
  },

  wb: function(v) {
    Keypad._colidx = v & 0x30;
  },

  keydown: function(e) {
    switch (e.keyCode) {
      case 39:
        Keypad._keys[1] &= 0xE;
        break;
      case 37:
        Keypad._keys[1] &= 0xD;
        break;
      case 38:
        Keypad._keys[1] &= 0xB;
        break;
      case 40:
        Keypad._keys[1] &= 0x7;
        break;
      case 90:
        Keypad._keys[0] &= 0xE;
        break;
      case 88:
        Keypad._keys[0] &= 0xD;
        break;
      case 32:
        Keypad._keys[0] &= 0xB;
        break;
      case 13:
        Keypad._keys[0] &= 0x7;
        break;
    }
  },

  keyup: function(e) {
    switch (e.keyCode) {
      case 39:
        Keypad._keys[1] |= 0x1;
        break;
      case 37:
        Keypad._keys[1] |= 0x2;
        break;
      case 38:
        Keypad._keys[1] |= 0x4;
        break;
      case 40:
        Keypad._keys[1] |= 0x8;
        break;
      case 90:
        Keypad._keys[0] |= 0x1;
        break;
      case 88:
        Keypad._keys[0] |= 0x2;
        break;
      case 32:
        Keypad._keys[0] |= 0x5;
        break;
      case 13:
        Keypad._keys[0] |= 0x8;
        break;
    }
  }
};

export default Keypad;
