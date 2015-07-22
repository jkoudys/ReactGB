/**
 * GameBoy Emulator, main app
 */
import Keypad from './utils/emulator/Keypad.js';
import GameBoy from './components/GameBoy.jsx';

document.addEventListener('DOMContentLoaded', function() {
  React.render(
    <GameBoy />,
    document.getElementById('reactboy')
  );

  // Bind keyboard to the GB keypad
  window.onkeydown = Keypad.keydown;
  window.onkeyup = Keypad.keyup;
});
