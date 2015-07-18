/**
 * GameBoy Emulator, main app
 */
import KEY from './utils/emulator/key.js';
import jsGB from './utils/jsGB.js';

document.addEventListener('DOMContentLoaded', function() {
  jsGB.reset();

  window.onkeydown = KEY.keydown;
  window.onkeyup = KEY.keyup;
});
