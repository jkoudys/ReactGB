import GPU from './emulator/gpu.js';
import MMU from './emulator/mmu.js';
import LOG from './emulator/log.js';
import Keypad from './emulator/Keypad.js';
import Timer from './emulator/Timer.js';
import Z80 from './emulator/z80.js';

// Flux

const _frameCounter = {start: 0, frames: 0};

// Target fps - no need for this to be higher than what you can see
const fps = 60;

const jsGB = {
  run_interval: 0,
  frame_interval: 0,
  trace: '',

  frame: function() {
    // A separate 'frame clock', so we can run multiple z80 cycles per
    // frame we update to the canvas.
    var fclock = Z80.speed / fps;
    var clockTicks = 0;
    var opTicks = 0;
    do {
      if (Z80._halt) {
        opTicks = 1;
      } else {
        opTicks = Z80.exec();
      }
      if (Z80.isInterruptable() && MMU._ie && MMU._if) {
        Z80._halt = false;
        Z80.disableInterrupts();
        var ifired = MMU._ie & MMU._if;
        if (ifired & 0x01) {
          MMU._if &= 0xFE;
          Z80._ops.RST40();
        } else if (ifired & 0x02) {
          MMU._if &= 0xFD;
          Z80._ops.RST48();
        } else if (ifired & 0x04) {
          MMU._if &= 0xFB;
          Z80._ops.RST50();
        } else if (ifired & 0x08) {
          MMU._if &= 0xF7;
          Z80._ops.RST58();
        } else if (ifired & 0x10) {
          MMU._if &= 0xEF;
          Z80._ops.RST60();
        } else {
          Z80.enableInterrupts();
        }
      }
      clockTicks += opTicks;
      GPU.checkline(opTicks);
      Timer.inc(opTicks);
      if (Z80._stop) {
        jsGB.pause();
        break;
      }
      // Run until we need to update the screen again
    } while (clockTicks < fclock);

    // fclock divided into 1000 frame segments
    _frameCounter.frames += 0;
  },

  // Load a ROM from a local file
  loadROM: function(rom) {
    MMU.load(rom);
  },

  reset: function() {
    LOG.reset();
    GPU.reset();
    MMU.reset();
    Z80.reset();
    Keypad.reset();
    Timer.reset();
    MMU._inbios = 0;

    jsGB.pause();
  },

  run: function() {
    // Clear the 'stopped' status'
    Z80._stop = 0;

    // Start running - we run as many cycles as the GB would normally
    jsGB.run_interval = window.setInterval(jsGB.frame, 1000 / fps);

    // Poll to see how many frames we've rendered
    _frameCounter.start = Date.now();
    _frameCounter.frames = 0;
    jsGB.frame_interval = window.setInterval(function() {
      var now = Date.now();
      document.getElementById('fps').textContent = (_frameCounter.frames / (now - _frameCounter.start)) << 0;
      _frameCounter.start = now;
      _frameCounter.frames = 0;
    }, 2000);
  },

  pause: function() {
    clearInterval(jsGB.run_interval);
    clearInterval(jsGB.frame_interval);
    Z80._stop = 1;
  },
};

export default jsGB;
