import GPU from './emulator/gpu.js';
import MMU from './emulator/mmu.js';
import LOG from './emulator/log.js';
import KEY from './emulator/key.js';
import Timer from './emulator/Timer.js';
import Z80 from './emulator/z80.js';
import tabMagic from './emulator/tabs.js';
import BinFileReader from './emulator/fileread.js';

var _frameCounter = {start: 0, frames: 0};

// Target fps - no need for this to be higher than what you can see
const fps = 60;

const jsGB = {
  run_interval: 0,
  frame_interval: 0,
  trace: '',

  frame: function() {
    // A separate 'frame clock', so we can run multiple z80 cycles per
    // frame we update to the canvas.
    var fclock = Z80.speed * fps;
    var clockTicks = 0;
    var brk = document.getElementById('breakpoint').value;
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
      if ((brk && parseInt(brk, 16) == Z80._r.pc) || Z80._stop) {
        jsGB.pause();
        break;
      }
      // Run until we need to update the screen again
    } while (clockTicks < fclock);

    // fclock divided into 1000 frame segments
    _frameCounter.frames += 0;
  },

  // Load a remote ROM
  getROM: function(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      MMU.load(this.response);
    };
    xhr.send();
  },

  reset: function() {
    LOG.reset();
    GPU.reset();
    MMU.reset();
    Z80.reset();
    KEY.reset();
    Timer.reset();
    MMU._inbios = 0;

    var xhr = new XMLHttpRequest();
    jsGB.getROM(document.getElementById('file').value);

    document.getElementById('op_reset').onclick = jsGB.reset;
    document.getElementById('op_run').onclick = jsGB.run;
    document.getElementById('op_run').innerHTML = 'Run';

    document.getElementById('tilepixels').innerHTML = '';
    var tp = document.createElement('div');
    var x;
    for (var i = 0; i < 64; i++) {
      document.getElementById('tilepixels').appendChild(tp);
      tp = tp.cloneNode(false);
    }
    document.getElementById('tilenum').onupdate = jsGB.dbgtile();
    document.getElementById('tileprev').onclick = function() {
      var t = parseInt(document.getElementById('tilenum').value);
      t--;
      if (t < 0) t = 383;
      document.getElementById('tilenum').value = t.toString();
      jsGB.dbgtile();
    };
    document.getElementById('tilenext').onclick = function() {
      var t = parseInt(document.getElementById('tilenum').value);
      t++;
      if (t > 383) t = 0;
      document.getElementById('tilenum').value = t.toString();
      jsGB.dbgtile();
    };

    jsGB.dbgupdate();
    jsGB.dbgtile();
    jsGB.trace = '';
    tabMagic.init();
    jsGB.pause();

    LOG.out('MAIN', 'Reset.');
  },

  run: function() {
    Z80._stop = 0;
//    jsGB.run_interval = window.setInterval(jsGB.frame, 15);
    jsGB.run_interval = window.setInterval(jsGB.frame, 1);
    jsGB.frameCounter = {start: Date.now(), frames: 0};
    jsGB.frame_interval = window.setInterval(function() {
      var now = Date.now();
      document.getElementById('fps').textContent = (_frameCounter.frames / (now - _frameCounter.start)) << 0;
      _frameCounter = {start: now, frames: 0};
    }, 2000);
    var t0 = Date.now();
    document.getElementById('op_run').textContent = 'Pause';
    document.getElementById('op_run').onclick = jsGB.pause;
  },

  pause: function() {
    clearInterval(jsGB.run_interval);
    clearInterval(jsGB.frame_interval);
    Z80._stop = 1;
    jsGB.dbgupdate();

    document.getElementById('op_run').innerHTML = 'Run';
    document.getElementById('op_run').onclick = jsGB.run;
  },

  dbgupdate: function() {
    // TODO: write out the current debug state
  },

  dbgtrace: function() {
    // TODO: Run a debug trace
  },

  dbgtile: function() {
    var tn = parseInt(document.getElementById('tilenum').value);
    var t = GPU._tilemap[tn];
    var c = ['#ffffff', '#c0c0c0', '#606060', '#000000'];
    var d = document.getElementById('tilepixels').getElementsByTagName('div');

    for (var y = 0; y < 8; y++) {
      for (var x = 0; x < 8; x++) {
        d[y * 8 + x].style.backgroundColor = c[t[y][x]];
      }
    }
  },
};

export default jsGB;
