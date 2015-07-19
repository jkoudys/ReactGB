/**
 * The system timer
 */

import LOG from './log.js';
import MMU from './mmu.js';
import Z80 from './z80.js';

// Basic timer registers
var _div = 0;
var _tma = 0;
var _tima = 0;
var _tac = 0;

// The clock
const _clock = {
  main: 0,
  sub: 0,
  div: 0
};

const Timer = {
  reset: function() {
    _div = 0;
    _tma = 0;
    _tima = 0;
    _tac = 0;
    _clock.main = 0;
    _clock.sub = 0;
    _clock.div = 0;
    LOG.out('TIMER', 'Reset.');
  },

  step: function() {
    _tima++;
    _clock.main = 0;
    if (_tima > 0xFF) {
      _tima = _tma;
      MMU._if |= 4;
    }
  },

  inc: function() {
    var oldclk = _clock.main;

    _clock.sub += Z80._r.m;
    if (_clock.sub > 3) {
      _clock.main++;
      _clock.sub -= 4;

      _clock.div++;
      if (_clock.div == 16) {
        _clock.div = 0;
        _div++;
        _div &= 0xFF;
      }
    }

    if (_tac & 0x4) {
      switch (_tac & 0x3) {
        case 0:
          if (_clock.main >= 0x40) Timer.step();
          break;
        case 1:
          if (_clock.main >= 0x1) Timer.step();
          break;
        case 2:
          if (_clock.main >= 0x4) Timer.step();
          break;
        case 3:
          if (_clock.main >= 0x10) Timer.step();
          break;
      }
    }
  },

  rb: function(addr) {
    switch (addr) {
      case 0xFF04:
        return _div;
      case 0xFF05:
        return _tima;
      case 0xFF06:
        return _tma;
      case 0xFF07:
        return _tac;
    }
  },

  wb: function(addr, val) {
    switch (addr) {
      case 0xFF04:
        _div = 0;
        break;
      case 0xFF05:
        _tima = val;
        break;
      case 0xFF06:
        _tma = val;
        break;
      case 0xFF07:
        _tac = val & 7;
        break;
    }
  }
};

export default Timer;
