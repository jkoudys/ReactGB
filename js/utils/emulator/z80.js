/**
 * jsGB: Z80 core
 * Joshua Koudys, Jul 2015
 * Imran Nazar, May 2009
 * Notes: This is a GameBoy Z80, not a Z80. There are differences. Mainly the F
 */
/**
 * TODO: look into changing all the various functions with generalized ones,
 * e.g. ld8Regfrom16Reg() for all loading 8 bit registers from 16 bit registers
 * Since there's already an array mapping the opcodes to their functions, this
 * would let us severely chop down the number of functions and complexity
 * therin.
 */
import LOG from './log.js';
import MMU from './mmu.js';

/**
 * The Registers!
 * Where the magic happens - the main working space of the CPU
 * For 8 bit and 16 bit addressing, and to keep everything uint, they're all in
 * one space, and packed on 8 bit boundaries. Uint8Array and Uint16Arrays are
 * used to address the space. Modern JS! :)
 *
 * "The internal 8-bit registers are A, B, C, D, E, F, H, & L. These registers
 * may be used in pairs for 16-bit operations as AF, BC, DE, & HL. The two
 * remaining 16-bit registers are the program counter (PC) and the stack
 * pointer (SP)"
 * source: http://gameboy.mongenel.com/dmg/opcodes.html
 */

// Backwards-ordering allows pairing of registers as little-endian numbers
// L H E D C B F A PC SP
var registers = new Uint8Array(12);

// Address the byte-boundaries. Downside is, everything needs a [0], but
// the plus side is, actual uints in JS!
var regHL = new Uint16Array(registers.buffer, 0, 1);
var regDE = new Uint16Array(registers.buffer, 2, 1);
var regBC = new Uint16Array(registers.buffer, 4, 1);
var regAF = new Uint16Array(registers.buffer, 6, 1);
var regPC = new Uint16Array(registers.buffer, 8, 1);
var regSP = new Uint16Array(registers.buffer, 10, 1);

// Address 8-bit boundaries
var regL = new Uint8Array(registers.buffer, 0, 1);
var regH = new Uint8Array(registers.buffer, 1, 1);
var regE = new Uint8Array(registers.buffer, 2, 1);
var regD = new Uint8Array(registers.buffer, 3, 1);
var regC = new Uint8Array(registers.buffer, 4, 1);
var regB = new Uint8Array(registers.buffer, 5, 1);
var regF = new Uint8Array(registers.buffer, 6, 1);
var regA = new Uint8Array(registers.buffer, 7, 1);

// The Interrupts Enabled flag
var interruptsEnabled = true;

const Z80 = {
  // Registers
  _r: {
  },

  _clock: {
    m: 0
  },

  _halt: 0,
  _stop: 0,

  reset: function() {
    for (let i = 0; i < registers.length; i++) {
      registers[i] = 0;
    }
    Z80._r.i = 0;
    Z80._r.r = 0;
    Z80._r.m = 0;
    Z80._halt = 0;
    Z80._stop = 0;
    Z80._clock.m = 0;
    interruptsEnabled = true;
    LOG.out('Z80', 'Reset.');
  },

  exec: function() {
    Z80._r.r = (Z80._r.r + 1) & 127;
    Z80._map[MMU.rb(regPC[0]++)]();
    regPC[0];
    Z80._clock.m += Z80._r.m;
  },

  _ops: {
    /*--- Load/store ---*/
    /**
     * Loads a register from another register
     * @param Uint8Array registerTo
     * @param Uint8Array registerFrom
     * @return int Clock ticks
     */
    ldReg(registerTo, registerFrom) {
      registerTo[0] = registerFrom[0];
      Z80._r.m = 1;
      return 1;
    },

    LDrHLm_b: function() {
      regB[0] = MMU.rb(regHL[0]);
      Z80._r.m = 2;
    },
    LDrHLm_c: function() {
      regC[0] = MMU.rb(regHL[0]);
      Z80._r.m = 2;
    },
    LDrHLm_d: function() {
      regD[0] = MMU.rb(regHL[0]);
      Z80._r.m = 2;
    },
    LDrHLm_e: function() {
      regE[0] = MMU.rb(regHL[0]);
      Z80._r.m = 2;
    },
    LDrHLm_h: function() {
      regH[0] = MMU.rb(regHL[0]);
      Z80._r.m = 2;
    },
    LDrHLm_l: function() {
      regL[0] = MMU.rb(regHL[0]);
      Z80._r.m = 2;
    },
    LDrHLm_a: function() {
      regA[0] = MMU.rb(regHL[0]);
      Z80._r.m = 2;
    },

    LDHLmr_b: function() {
      MMU.wb(regHL[0], regB[0]);
      Z80._r.m = 2;
    },
    LDHLmr_c: function() {
      MMU.wb(regHL[0], regC[0]);
      Z80._r.m = 2;
    },
    LDHLmr_d: function() {
      MMU.wb(regHL[0], regD[0]);
      Z80._r.m = 2;
    },
    LDHLmr_e: function() {
      MMU.wb(regHL[0], regE[0]);
      Z80._r.m = 2;
    },
    LDHLmr_h: function() {
      MMU.wb(regHL[0], regH[0]);
      Z80._r.m = 2;
    },
    LDHLmr_l: function() {
      MMU.wb(regHL[0], regL[0]);
      Z80._r.m = 2;
    },
    LDHLmr_a: function() {
      MMU.wb(regHL[0], regA[0]);
      Z80._r.m = 2;
    },

    LDrn_b: function() {
      regB[0] = MMU.rb(regPC[0]);
      regPC[0]++;
      Z80._r.m = 2;
    },
    LDrn_c: function() {
      regC[0] = MMU.rb(regPC[0]);
      regPC[0]++;
      Z80._r.m = 2;
    },
    LDrn_d: function() {
      regD[0] = MMU.rb(regPC[0]);
      regPC[0]++;
      Z80._r.m = 2;
    },
    LDrn_e: function() {
      regE[0] = MMU.rb(regPC[0]);
      regPC[0]++;
      Z80._r.m = 2;
    },
    LDrn_h: function() {
      regH[0] = MMU.rb(regPC[0]);
      regPC[0]++;
      Z80._r.m = 2;
    },
    LDrn_l: function() {
      regL[0] = MMU.rb(regPC[0]);
      regPC[0]++;
      Z80._r.m = 2;
    },
    LDrn_a: function() {
      regA[0] = MMU.rb(regPC[0]);
      regPC[0]++;
      Z80._r.m = 2;
    },

    LDHLmn: function() {
      MMU.wb(regHL[0], MMU.rb(regPC[0]));
      regPC[0]++;
      Z80._r.m = 3;
    },

    LDBCmA: function() {
      MMU.wb(regBC[0], regA[0]);
      Z80._r.m = 2;
    },
    LDDEmA: function() {
      MMU.wb(regDE[0], regA[0]);
      Z80._r.m = 2;
    },

    LDmmA: function() {
      MMU.wb(MMU.rw(regPC[0]), regA[0]);
      regPC[0] += 2;
      Z80._r.m = 4;
    },

    LDABCm: function() {
      regA[0] = MMU.rb(regBC[0]);
      Z80._r.m = 2;
    },
    LDADEm: function() {
      regA[0] = MMU.rb(regDE[0]);
      Z80._r.m = 2;
    },

    LDAmm: function() {
      regA[0] = MMU.rb(MMU.rw(regPC[0]));
      regPC[0] += 2;
      Z80._r.m = 4;
    },

    LDBCnn: function() {
      regC[0] = MMU.rb(regPC[0]);
      regB[0] = MMU.rb(regPC[0] + 1);
      regPC[0] += 2;
      Z80._r.m = 3;
    },
    LDDEnn: function() {
      regE[0] = MMU.rb(regPC[0]);
      regD[0] = MMU.rb(regPC[0] + 1);
      regPC[0] += 2;
      Z80._r.m = 3;
    },
    LDHLnn: function() {
      regHL[0] = MMU.rw(regPC[0]);
      regPC[0] += 2;
      Z80._r.m = 3;
    },
    LDSPnn: function() {
      regSP[0] = MMU.rw(regPC[0]);
      regPC[0] += 2;
      Z80._r.m = 3;
    },

    LDHLmm: function() {
      var i = MMU.rw(regPC[0]);
      regPC[0] += 2;
      regHL[0] = MMU.rw(i);
      Z80._r.m = 5;
    },
    LDmmHL: function() {
      var i = MMU.rw(regPC[0]);
      regPC[0] += 2;
      MMU.ww(i, regHL[0]);
      Z80._r.m = 5;
    },

    // LD (mm), SP
    // Save SP to given address
    // 0x08
    LDmmSP: function() {
      var addr = MMU.rw(regPC[0]);
      regPC[0] += 2;
      MMU.ww(addr, regSP[0]);
      Z80._r.m = 5;
    },

    // LDI (HL), A
    // Save A to address pointed to by HL, and increment HL
    LDHLIA: function() {
      MMU.wb(regHL[0], regA[0]);
      regHL[0]++;
      Z80._r.m = 2;
    },

    // LDI A, HL
    LDAHLI: function() {
      regA[0] = MMU.rb(regHL[0]);
      regHL[0]++;
      Z80._r.m = 2;
    },

    // LDD HL, A
    LDHLDA: function() {
      MMU.wb(regHL[0], regA[0]);
      regHL[0]--;
      Z80._r.m = 2;
    },

    // LDD A, HL
    LDAHLD: function() {
      regA[0] = MMU.rb(regHL[0]);
      regHL[0]--;
      Z80._r.m = 2;
    },

    LDAIOn: function() {
      regA[0] = MMU.rb(0xFF00 + MMU.rb(regPC[0]));
      regPC[0]++;
      Z80._r.m = 3;
    },
    LDIOnA: function() {
      MMU.wb(0xFF00 + MMU.rb(regPC[0]), regA[0]);
      regPC[0]++;
      Z80._r.m = 3;
    },
    LDAIOC: function() {
      regA[0] = MMU.rb(0xFF00 + regC[0]);
      Z80._r.m = 2;
    },
    LDIOCA: function() {
      MMU.wb(0xFF00 + regC[0], regA[0]);
      Z80._r.m = 2;
    },

    LDHLSPn: function() {
      var i = MMU.rb(regPC[0]);
      if (i > 0x7F) {
        i = -((~i + 1) & 0xFF);
      }
      regPC[0]++;
      i += regSP[0];
      regHL[0] = i;
      Z80._r.m = 3;
    },

    // LD SP, HL
    // 0xF9
    LDSPHL: function() {
      regSP[0] = regHL[0];
      Z80._r.m = 3;
    },

    SWAPr_b: function() {
      var tr = regB[0];
      regB[0] = ((tr & 0xF) << 4) | ((tr & 0xF0) >> 4);
      regF[0] = regB[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    SWAPr_c: function() {
      var tr = regC[0];
      regC[0] = ((tr & 0xF) << 4) | ((tr & 0xF0) >> 4);
      regF[0] = regC[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    SWAPr_d: function() {
      var tr = regD[0];
      regD[0] = ((tr & 0xF) << 4) | ((tr & 0xF0) >> 4);
      regF[0] = regD[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    SWAPr_e: function() {
      var tr = regE[0];
      regE[0] = ((tr & 0xF) << 4) | ((tr & 0xF0) >> 4);
      regF[0] = regE[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    SWAPr_h: function() {
      var tr = regH[0];
      regH[0] = ((tr & 0xF) << 4) | ((tr & 0xF0) >> 4);
      regF[0] = regH[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    SWAPr_l: function() {
      var tr = regL[0];
      regL[0] = ((tr & 0xF) << 4) | ((tr & 0xF0) >> 4);
      regF[0] = regL[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    SWAPr_a: function() {
      var tr = regA[0];
      regA[0] = ((tr & 0xF) << 4) | ((tr & 0xF0) >> 4);
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },

    /*--- Data processing ---*/
    /**
     * Add register to accumulator
     * @param Uint8Array register
     * @return int Clock ticks
     */
    addReg: function(register) {
      var a = regA[0];
      regA[0] += register[0];
      // TODO: make sure all these '< a' checks actually make sense..
      regF[0] = (regA[0] < a) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ register[0] ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 1;
      return 1;
    },

    // ADD A, (HL)
    // Add value pointed to by HL to A
    // 0x86
    ADDHL: function() {
      var a = regA[0];
      var m = MMU.rb(regHL[0]);
      regA[0] += m;
      regF[0] = (regA[0] < a) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ a ^ m) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 2;
    },
    ADDn: function() {
      var a = regA[0];
      var m = MMU.rb(regPC[0]);
      regA[0] += m;
      regPC[0]++;
      regF[0] = (regA[0] < a) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ a ^ m) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 2;
    },

    // ADD HL, BC
    // 0x09
    ADDHLBC: function() {
      // HL + BC
      var sum = regHL[0] + regBC[0];
      var flags = 0;
      if ((regHL[0] & 0xFFF) > (sum & 0xFFF)) {
        flags += 0x20;
      }
      if (sum > 0xFFFF) {
        flags += 0x10;
      }
      regF[0] = (regF[0] & 0x40) + flags;
      regHL[0] = sum;
      Z80._r.m = 3;
    },

    // ADD HL, DE
    // 0x19
    ADDHLDE: function() {
      // HL + DE
      var sum = regHL[0] + regDE[0];
      var flags = 0;
      if ((regHL[0] & 0xFFF) > (sum & 0xFFF)) {
        flags += 0x20;
      }
      if (sum > 0xFFFF) {
        flags += 0x10;
      }
      regF[0] = (regF[0] & 0x40) + flags;
      regHL[0] = sum;
      Z80._r.m = 3;
    },

    // ADD HL, HL
    // 0x29
    ADDHLHL: function() {
      // Optimized add - double the HL
      var sum = regHL[0] << 1;
      var flags = 0;
      if ((regHL[0] & 0xFFF) > (sum & 0xFFF)) {
        flags += 0x20;
      }
      if (sum > 0xFFFF) {
        flags += 0x10;
      }
      regF[0] = (regF[0] & 0x40) + flags;
      regHL[0] = sum;
      Z80._r.m = 3;
    },

    // ADD HL, SP
    // 0x39
    ADDHLSP: function() {
      var sum = regHL[0] + regSP[0];
      var flags = 0;
      if (sum > 0xFFFF) {
        flags += 0x10;
      }
      if ((regHL[0] & 0xFFF) > (sum & 0xFFF)) {
        flags += 0x20;
      }
      flags += regF[0] & 0x80;
      regF[0] = flags;
      regHL[0] = sum;
      Z80._r.m = 3;
    },

    // ADD SP, n
    // 0xE8
    ADDSPn: function() {
      var i = MMU.rb(regPC[0]);
      if (i > 0x7F) {
        i = -((~i + 1) & 0xFF);
      }
      regPC[0]++;
      regSP[0] += i;
      Z80._r.m = 4;
    },

    ADCr_b: function() {
      var a = regA[0];
      regA[0] += regB[0];
      regA[0] += (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (regA[0] < a) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ regB[0] ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 1;
    },

    ADCr_c: function() {
      var a = regA[0];
      regA[0] += regC[0];
      regA[0] += (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (regA[0] < a) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ regC[0] ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 1;
    },
    ADCr_d: function() {
      var a = regA[0];
      regA[0] += regD[0];
      regA[0] += (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (regA[0] < a) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ regD[0] ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 1;
    },
    ADCr_e: function() {
      var a = regA[0];
      regA[0] += regE[0];
      regA[0] += (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (regA[0] < a) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ regE[0] ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 1;
    },
    ADCr_h: function() {
      var a = regA[0];
      regA[0] += regH[0];
      regA[0] += (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (regA[0] < a) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ regH[0] ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 1;
    },
    ADCr_l: function() {
      var a = regA[0];
      regA[0] += regL[0];
      regA[0] += (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (regA[0] < a) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ regL[0] ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 1;
    },
    ADCr_a: function() {
      var a = regA[0];
      regA[0] += regA[0];
      regA[0] += (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (regA[0] < a) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ regA[0] ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 1;
    },
    ADCHL: function() {
      var a = regA[0];
      var m = MMU.rb(regHL[0]);
      regA[0] += m;
      regA[0] += (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (regA[0] < a) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 2;
    },

    // ADC A, n
    // Add 8-bit immediate and carry to A
    // 0xCE
    ADCn: function() {
      var a = regA[0];
      var m = MMU.rb(regPC[0]);
      a += m;
      regPC[0]++;
      a += (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (a > 0xFF) ? 0x10 : 0;
      regA[0] = a;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 2;
    },

    /**
     * Subtract register from accumulator, e.g. SUB A, B
     * @param Uint8Array register The register to load
     * @return int The clock ticks
     */
    subReg: function(register) {
      var a = regA[0];
      a -= register[0];
      regF[0] = (a < 0) ? 0x50 : 0x40;
      regA[0] = a;
      if (!regA[0]) {
        regF[0] |= 0x80;
      }
      if ((regA[0] ^ register[0] ^ a) & 0x10) {
        regF[0] |= 0x20;
      }
      Z80._r.m = 1;
      // TODO: replace the _r.m with the return
      return 1
    },

    SUBHL: function() {
      var a = regA[0];
      var m = MMU.rb(regHL[0]);
      a -= m;
      regF[0] = (a < 0) ? 0x50 : 0x40;
      regA[0] = a
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 2;
    },

    // Subtract 8-bit immediate from A
    // 0xD6
    SUBn: function() {
      var a = regA[0];
      var m = MMU.rb(regPC[0]);
      a -= m;
      regPC[0]++;
      regF[0] = (a < 0) ? 0x50 : 0x40;
      regA[0] = a;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 2;
    },

    /**
     * Subtract and carry register from A
     * @param Uint8Array register
     * @return int Clock ticks
     */
    subcReg: function(register) {
      var a = regA[0];
      a -= register[0];
      a -= (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (a < 0) ? 0x50 : 0x40;
      regA[0] = a;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ register[0] ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 1;
      return 1;
    },

    SBCHL: function() {
      var a = regA[0];
      var m = MMU.rb(regHL[0]);
      a -= m;
      a -= (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (a < 0) ? 0x50 : 0x40;
      regA[0] = a;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 2;
    },
    SBCn: function() {
      var a = regA[0];
      var m = MMU.rb(regPC[0]);
      a -= m;
      regPC[0]++;
      a -= (regF[0] & 0x10) ? 1 : 0;
      regF[0] = (a < 0) ? 0x50 : 0x40;
      regA[0] = a;
      if (!regA[0]) regF[0] |= 0x80;
      if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 2;
    },

    /**
     * Compare 8-bit against accumulator
     * @param Uint8Array register
     * @return int Clock ticks
     */
    cpReg: function(register) {
      var i = regA[0];
      i -= register[0];
      regF[0] = (i < 0) ? 0x50 : 0x40;
      i &= 255;
      if (!i) regF[0] |= 0x80;
      if ((regA[0] ^ register[0] ^ i) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 1;
      return 1;
    },
    CPHL: function() {
      var i = regA[0];
      var m = MMU.rb(regHL[0]);
      i -= m;
      regF[0] = (i < 0) ? 0x50 : 0x40;
      i &= 255;
      if (!i) regF[0] |= 0x80;
      if ((regA[0] ^ i ^ m) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 2;
    },
    CPn: function() {
      var i = regA[0];
      var m = MMU.rb(regPC[0]);
      i -= m;
      regPC[0]++;
      regF[0] = (i < 0) ? 0x50 : 0x40;
      i &= 255;
      if (!i) regF[0] |= 0x80;
      if ((regA[0] ^ i ^ m) & 0x10) regF[0] |= 0x20;
      Z80._r.m = 2;
    },

    // DAA
    // 0x27
    DAA: function() {
      /**
       Flag Register
       7 	6 	5 	4 	3 	2 	1 	0
       Z 	N 	H 	C 	0 	0 	0 	0
       Zero Add/Subtract Half Carry Carry
       0x80 0x40         0x20       0x10
       */
      if (!(regF[0] & 0x40)) {
        if ((regF[0] & 0x10) || regA[0] > 0x99) {
          regA[0] = regA[0] + 0x60
          regF[0] |= 0x10;
        }
        if ((regF[0] & 0x20) || (regA[0] & 0xF) > 0x9) {
          regA[0] = regA[0] + 0x06
          regF[0] &= 0b11010000;
        }
      }
      else if ((regF[0] & 0x30) === 0x30) {
        regA[0] = regA[0] + 0x9A;
        regF[0] &= 0b11010000;
      }
      else if ((regF[0] & 0x10)) {
        regA[0] = regA[0] + 0xA0
      }
      else if (regF[0] & 0x20) {
        regA[0] = regA[0] + 0xFA;
        regF[0] &= 0b11010000;
      }

      if (regA[0] === 0) {
        regF[0] |= 0x80;
      } else {
        regF[0] &= 0b01110000;
      }
      Z80._r.m = 4;
    },

    ANDr_b: function() {
      regA[0] &= regB[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ANDr_c: function() {
      regA[0] &= regC[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ANDr_d: function() {
      regA[0] &= regD[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ANDr_e: function() {
      regA[0] &= regE[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ANDr_h: function() {
      regA[0] &= regH[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ANDr_l: function() {
      regA[0] &= regL[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ANDr_a: function() {
      regA[0] &= regA[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ANDHL: function() {
      regA[0] &= MMU.rb(regHL[0]);
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 2;
    },

    // AND n
    // 0xE6
    ANDn: function() {
      regA[0] &= MMU.rb(regPC[0]);
      regPC[0]++;
      regF[0] = (regA[0] ? 0 : 0x80) | 0x20;
      Z80._r.m = 2;
    },

    ORr_b: function() {
      regA[0] |= regB[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ORr_c: function() {
      regA[0] |= regC[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ORr_d: function() {
      regA[0] |= regD[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ORr_e: function() {
      regA[0] |= regE[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ORr_h: function() {
      regA[0] |= regH[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ORr_l: function() {
      regA[0] |= regL[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ORr_a: function() {
      regA[0] |= regA[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    ORHL: function() {
      regA[0] |= MMU.rb(regHL[0]);
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 2;
    },
    ORn: function() {
      regA[0] |= MMU.rb(regPC[0]);
      regPC[0]++;
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 2;
    },

    XORr_b: function() {
      regA[0] ^= regB[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    XORr_c: function() {
      regA[0] ^= regC[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    XORr_d: function() {
      regA[0] ^= regD[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    XORr_e: function() {
      regA[0] ^= regE[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    XORr_h: function() {
      regA[0] ^= regH[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    XORr_l: function() {
      regA[0] ^= regL[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    XORr_a: function() {
      regA[0] ^= regA[0];
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    XORHL: function() {
      regA[0] ^= MMU.rb(regHL[0]);
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 2;
    },
    XORn: function() {
      regA[0] ^= MMU.rb(regPC[0]);
      regPC[0]++;
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 2;
    },

    INCr_b: function() {
      regB[0]++;
      regF[0] = regB[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    INCr_c: function() {
      regC[0]++;
      regF[0] = regC[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    INCr_d: function() {
      regD[0]++;
      regF[0] = regD[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    INCr_e: function() {
      regE[0]++;
      regF[0] = regE[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    INCr_h: function() {
      regH[0]++;
      regF[0] = regH[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    INCr_l: function() {
      regL[0]++;
      regF[0] = regL[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    INCr_a: function() {
      regA[0]++;
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    INCHLm: function() {
      var i = MMU.rb(regHL[0]) + 1;
      i &= 255;
      MMU.wb(regHL[0], i);
      regF[0] = i ? 0 : 0x80;
      Z80._r.m = 3;
    },

    // DEC b
    // 0x05
    DECr_b: function() {
      regB[0]--;
      regB[0] &= 0xFF;
      // Set the zero flag if 0, half-carry if decremented to 0b00001111, and
      // the subtract flag to true
      regF[0] = (regB[0] ? 0 : 0x80) |
        (((regB[0] & 0xF) === 0xF) ? 0x20 : 0) |
        0x40;
      Z80._r.m = 1;
    },
    DECr_c: function() {
      regC[0]--;
      regF[0] = regC[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    DECr_d: function() {
      regD[0]--;
      regF[0] = regD[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    DECr_e: function() {
      regE[0]--;
      regF[0] = regE[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    DECr_h: function() {
      regH[0]--;
      regF[0] = regH[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    DECr_l: function() {
      regL[0]--;
      regF[0] = regL[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    DECr_a: function() {
      regA[0]--;
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    DECHLm: function() {
      var i = MMU.rb(regHL[0]) - 1;
      i &= 255;
      MMU.wb(regHL[0], i);
      regF[0] = i ? 0 : 0x80;
      Z80._r.m = 3;
    },

    INCBC: function() {
      regBC[0]++;
      Z80._r.m = 1;
    },
    INCDE: function() {
      regE[0] = regE[0] + 1;
      if (!regE[0]) {
        regD[0] = (regD[0] + 1);
      }
      Z80._r.m = 1;
    },

    // INC HL
    // Increment the HL
    // 0x23
    INCHL: function() {
      regHL[0]++;
      Z80._r.m = 1;
    },

    INCSP: function() {
      regSP[0]++;
      Z80._r.m = 1;
    },

    DECBC: function() {
      regBC[0]--;
      Z80._r.m = 1;
    },
    DECDE: function() {
      regDE[0]--;
      Z80._r.m = 1;
    },

    // DEC HL
    // Decrement the HL
    // 0x2B
    DECHL: function() {
      regHL[0]--;
      Z80._r.m = 1;
    },

    DECSP: function() {
      regSP[0]--;
      Z80._r.m = 1;
    },

    /*--- Bit manipulation ---*/
    BIT0b: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regB[0] & 0x01) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT0c: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regC[0] & 0x01) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT0d: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regD[0] & 0x01) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT0e: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regE[0] & 0x01) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT0h: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regH[0] & 0x01) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT0l: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regL[0] & 0x01) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT0a: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regA[0] & 0x01) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT0m: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (MMU.rb(regHL[0]) & 0x01) ? 0 : 0x80;
      Z80._r.m = 3;
    },

    RES0b: function() {
      regB[0] &= 0xFE;
      Z80._r.m = 2;
    },
    RES0c: function() {
      regC[0] &= 0xFE;
      Z80._r.m = 2;
    },
    RES0d: function() {
      regD[0] &= 0xFE;
      Z80._r.m = 2;
    },
    RES0e: function() {
      regE[0] &= 0xFE;
      Z80._r.m = 2;
    },
    RES0h: function() {
      regH[0] &= 0xFE;
      Z80._r.m = 2;
    },
    RES0l: function() {
      regL[0] &= 0xFE;
      Z80._r.m = 2;
    },
    RES0a: function() {
      regA[0] &= 0xFE;
      Z80._r.m = 2;
    },
    RES0m: function() {
      var i = MMU.rb(regHL[0]);
      i &= 0xFE;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    SET0b: function() {
      regB[0] |= 0x01;
      Z80._r.m = 2;
    },
    SET0c: function() {
      regB[0] |= 0x01;
      Z80._r.m = 2;
    },
    SET0d: function() {
      regB[0] |= 0x01;
      Z80._r.m = 2;
    },
    SET0e: function() {
      regB[0] |= 0x01;
      Z80._r.m = 2;
    },
    SET0h: function() {
      regB[0] |= 0x01;
      Z80._r.m = 2;
    },
    SET0l: function() {
      regB[0] |= 0x01;
      Z80._r.m = 2;
    },
    SET0a: function() {
      regB[0] |= 0x01;
      Z80._r.m = 2;
    },
    SET0m: function() {
      var i = MMU.rb(regHL[0]);
      i |= 0x01;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    BIT1b: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regB[0] & 0x02) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT1c: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regC[0] & 0x02) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT1d: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regD[0] & 0x02) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT1e: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regE[0] & 0x02) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT1h: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regH[0] & 0x02) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT1l: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regL[0] & 0x02) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT1a: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regA[0] & 0x02) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT1m: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (MMU.rb(regHL[0]) & 0x02) ? 0 : 0x80;
      Z80._r.m = 3;
    },

    RES1b: function() {
      regB[0] &= 0xFD;
      Z80._r.m = 2;
    },
    RES1c: function() {
      regC[0] &= 0xFD;
      Z80._r.m = 2;
    },
    RES1d: function() {
      regD[0] &= 0xFD;
      Z80._r.m = 2;
    },
    RES1e: function() {
      regE[0] &= 0xFD;
      Z80._r.m = 2;
    },
    RES1h: function() {
      regH[0] &= 0xFD;
      Z80._r.m = 2;
    },
    RES1l: function() {
      regL[0] &= 0xFD;
      Z80._r.m = 2;
    },
    RES1a: function() {
      regA[0] &= 0xFD;
      Z80._r.m = 2;
    },
    RES1m: function() {
      var i = MMU.rb(regHL[0]);
      i &= 0xFD;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    SET1b: function() {
      regB[0] |= 0x02;
      Z80._r.m = 2;
    },
    SET1c: function() {
      regB[0] |= 0x02;
      Z80._r.m = 2;
    },
    SET1d: function() {
      regB[0] |= 0x02;
      Z80._r.m = 2;
    },
    SET1e: function() {
      regB[0] |= 0x02;
      Z80._r.m = 2;
    },
    SET1h: function() {
      regB[0] |= 0x02;
      Z80._r.m = 2;
    },
    SET1l: function() {
      regB[0] |= 0x02;
      Z80._r.m = 2;
    },
    SET1a: function() {
      regB[0] |= 0x02;
      Z80._r.m = 2;
    },
    SET1m: function() {
      var i = MMU.rb(regHL[0]);
      i |= 0x02;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    BIT2b: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regB[0] & 0x04) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT2c: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regC[0] & 0x04) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT2d: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regD[0] & 0x04) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT2e: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regE[0] & 0x04) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT2h: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regH[0] & 0x04) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT2l: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regL[0] & 0x04) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT2a: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regA[0] & 0x04) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT2m: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (MMU.rb(regHL[0]) & 0x04) ? 0 : 0x80;
      Z80._r.m = 3;
    },

    RES2b: function() {
      regB[0] &= 0xFB;
      Z80._r.m = 2;
    },
    RES2c: function() {
      regC[0] &= 0xFB;
      Z80._r.m = 2;
    },
    RES2d: function() {
      regD[0] &= 0xFB;
      Z80._r.m = 2;
    },
    RES2e: function() {
      regE[0] &= 0xFB;
      Z80._r.m = 2;
    },
    RES2h: function() {
      regH[0] &= 0xFB;
      Z80._r.m = 2;
    },
    RES2l: function() {
      regL[0] &= 0xFB;
      Z80._r.m = 2;
    },
    RES2a: function() {
      regA[0] &= 0xFB;
      Z80._r.m = 2;
    },
    RES2m: function() {
      var i = MMU.rb(regHL[0]);
      i &= 0xFB;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    SET2b: function() {
      regB[0] |= 0x04;
      Z80._r.m = 2;
    },
    SET2c: function() {
      regB[0] |= 0x04;
      Z80._r.m = 2;
    },
    SET2d: function() {
      regB[0] |= 0x04;
      Z80._r.m = 2;
    },
    SET2e: function() {
      regB[0] |= 0x04;
      Z80._r.m = 2;
    },
    SET2h: function() {
      regB[0] |= 0x04;
      Z80._r.m = 2;
    },
    SET2l: function() {
      regB[0] |= 0x04;
      Z80._r.m = 2;
    },
    SET2a: function() {
      regB[0] |= 0x04;
      Z80._r.m = 2;
    },
    SET2m: function() {
      var i = MMU.rb(regHL[0]);
      i |= 0x04;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    BIT3b: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regB[0] & 0x08) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT3c: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regC[0] & 0x08) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT3d: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regD[0] & 0x08) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT3e: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regE[0] & 0x08) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT3h: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regH[0] & 0x08) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT3l: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regL[0] & 0x08) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT3a: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regA[0] & 0x08) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT3m: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (MMU.rb(regHL[0]) & 0x08) ? 0 : 0x80;
      Z80._r.m = 3;
    },

    RES3b: function() {
      regB[0] &= 0xF7;
      Z80._r.m = 2;
    },
    RES3c: function() {
      regC[0] &= 0xF7;
      Z80._r.m = 2;
    },
    RES3d: function() {
      regD[0] &= 0xF7;
      Z80._r.m = 2;
    },
    RES3e: function() {
      regE[0] &= 0xF7;
      Z80._r.m = 2;
    },
    RES3h: function() {
      regH[0] &= 0xF7;
      Z80._r.m = 2;
    },
    RES3l: function() {
      regL[0] &= 0xF7;
      Z80._r.m = 2;
    },
    RES3a: function() {
      regA[0] &= 0xF7;
      Z80._r.m = 2;
    },
    RES3m: function() {
      var i = MMU.rb(regHL[0]);
      i &= 0xF7;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    SET3b: function() {
      regB[0] |= 0x08;
      Z80._r.m = 2;
    },
    SET3c: function() {
      regB[0] |= 0x08;
      Z80._r.m = 2;
    },
    SET3d: function() {
      regB[0] |= 0x08;
      Z80._r.m = 2;
    },
    SET3e: function() {
      regB[0] |= 0x08;
      Z80._r.m = 2;
    },
    SET3h: function() {
      regB[0] |= 0x08;
      Z80._r.m = 2;
    },
    SET3l: function() {
      regB[0] |= 0x08;
      Z80._r.m = 2;
    },
    SET3a: function() {
      regB[0] |= 0x08;
      Z80._r.m = 2;
    },
    SET3m: function() {
      var i = MMU.rb(regHL[0]);
      i |= 0x08;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    BIT4b: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regB[0] & 0x10) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT4c: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regC[0] & 0x10) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT4d: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regD[0] & 0x10) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT4e: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regE[0] & 0x10) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT4h: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regH[0] & 0x10) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT4l: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regL[0] & 0x10) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT4a: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regA[0] & 0x10) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT4m: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (MMU.rb(regHL[0]) & 0x10) ? 0 : 0x80;
      Z80._r.m = 3;
    },

    RES4b: function() {
      regB[0] &= 0xEF;
      Z80._r.m = 2;
    },
    RES4c: function() {
      regC[0] &= 0xEF;
      Z80._r.m = 2;
    },
    RES4d: function() {
      regD[0] &= 0xEF;
      Z80._r.m = 2;
    },
    RES4e: function() {
      regE[0] &= 0xEF;
      Z80._r.m = 2;
    },
    RES4h: function() {
      regH[0] &= 0xEF;
      Z80._r.m = 2;
    },
    RES4l: function() {
      regL[0] &= 0xEF;
      Z80._r.m = 2;
    },
    RES4a: function() {
      regA[0] &= 0xEF;
      Z80._r.m = 2;
    },
    RES4m: function() {
      var i = MMU.rb(regHL[0]);
      i &= 0xEF;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    SET4b: function() {
      regB[0] |= 0x10;
      Z80._r.m = 2;
    },
    SET4c: function() {
      regB[0] |= 0x10;
      Z80._r.m = 2;
    },
    SET4d: function() {
      regB[0] |= 0x10;
      Z80._r.m = 2;
    },
    SET4e: function() {
      regB[0] |= 0x10;
      Z80._r.m = 2;
    },
    SET4h: function() {
      regB[0] |= 0x10;
      Z80._r.m = 2;
    },
    SET4l: function() {
      regB[0] |= 0x10;
      Z80._r.m = 2;
    },
    SET4a: function() {
      regB[0] |= 0x10;
      Z80._r.m = 2;
    },
    SET4m: function() {
      var i = MMU.rb(regHL[0]);
      i |= 0x10;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    BIT5b: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regB[0] & 0x20) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT5c: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regC[0] & 0x20) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT5d: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regD[0] & 0x20) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT5e: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regE[0] & 0x20) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT5h: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regH[0] & 0x20) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT5l: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regL[0] & 0x20) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT5a: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regA[0] & 0x20) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT5m: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (MMU.rb(regHL[0]) & 0x20) ? 0 : 0x80;
      Z80._r.m = 3;
    },

    RES5b: function() {
      regB[0] &= 0xDF;
      Z80._r.m = 2;
    },
    RES5c: function() {
      regC[0] &= 0xDF;
      Z80._r.m = 2;
    },
    RES5d: function() {
      regD[0] &= 0xDF;
      Z80._r.m = 2;
    },
    RES5e: function() {
      regE[0] &= 0xDF;
      Z80._r.m = 2;
    },
    RES5h: function() {
      regH[0] &= 0xDF;
      Z80._r.m = 2;
    },
    RES5l: function() {
      regL[0] &= 0xDF;
      Z80._r.m = 2;
    },
    RES5a: function() {
      regA[0] &= 0xDF;
      Z80._r.m = 2;
    },
    RES5m: function() {
      var i = MMU.rb(regHL[0]);
      i &= 0xDF;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    SET5b: function() {
      regB[0] |= 0x20;
      Z80._r.m = 2;
    },
    SET5c: function() {
      regB[0] |= 0x20;
      Z80._r.m = 2;
    },
    SET5d: function() {
      regB[0] |= 0x20;
      Z80._r.m = 2;
    },
    SET5e: function() {
      regB[0] |= 0x20;
      Z80._r.m = 2;
    },
    SET5h: function() {
      regB[0] |= 0x20;
      Z80._r.m = 2;
    },
    SET5l: function() {
      regB[0] |= 0x20;
      Z80._r.m = 2;
    },
    SET5a: function() {
      regB[0] |= 0x20;
      Z80._r.m = 2;
    },
    SET5m: function() {
      var i = MMU.rb(regHL[0]);
      i |= 0x20;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    BIT6b: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regB[0] & 0x40) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT6c: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regC[0] & 0x40) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT6d: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regD[0] & 0x40) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT6e: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regE[0] & 0x40) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT6h: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regH[0] & 0x40) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT6l: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regL[0] & 0x40) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT6a: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regA[0] & 0x40) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT6m: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (MMU.rb(regHL[0]) & 0x40) ? 0 : 0x80;
      Z80._r.m = 3;
    },

    RES6b: function() {
      regB[0] &= 0xBF;
      Z80._r.m = 2;
    },
    RES6c: function() {
      regC[0] &= 0xBF;
      Z80._r.m = 2;
    },
    RES6d: function() {
      regD[0] &= 0xBF;
      Z80._r.m = 2;
    },
    RES6e: function() {
      regE[0] &= 0xBF;
      Z80._r.m = 2;
    },
    RES6h: function() {
      regH[0] &= 0xBF;
      Z80._r.m = 2;
    },
    RES6l: function() {
      regL[0] &= 0xBF;
      Z80._r.m = 2;
    },
    RES6a: function() {
      regA[0] &= 0xBF;
      Z80._r.m = 2;
    },
    RES6m: function() {
      var i = MMU.rb(regHL[0]);
      i &= 0xBF;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    SET6b: function() {
      regB[0] |= 0x40;
      Z80._r.m = 2;
    },
    SET6c: function() {
      regB[0] |= 0x40;
      Z80._r.m = 2;
    },
    SET6d: function() {
      regB[0] |= 0x40;
      Z80._r.m = 2;
    },
    SET6e: function() {
      regB[0] |= 0x40;
      Z80._r.m = 2;
    },
    SET6h: function() {
      regB[0] |= 0x40;
      Z80._r.m = 2;
    },
    SET6l: function() {
      regB[0] |= 0x40;
      Z80._r.m = 2;
    },
    SET6a: function() {
      regB[0] |= 0x40;
      Z80._r.m = 2;
    },
    SET6m: function() {
      var i = MMU.rb(regHL[0]);
      i |= 0x40;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    BIT7b: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regB[0] & 0x80) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT7c: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regC[0] & 0x80) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT7d: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regD[0] & 0x80) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT7e: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regE[0] & 0x80) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT7h: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regH[0] & 0x80) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT7l: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regL[0] & 0x80) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT7a: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (regA[0] & 0x80) ? 0 : 0x80;
      Z80._r.m = 2;
    },
    BIT7m: function() {
      regF[0] &= 0x1F;
      regF[0] |= 0x20;
      regF[0] = (MMU.rb(regHL[0]) & 0x80) ? 0 : 0x80;
      Z80._r.m = 3;
    },

    RES7b: function() {
      regB[0] &= 0x7F;
      Z80._r.m = 2;
    },
    RES7c: function() {
      regC[0] &= 0x7F;
      Z80._r.m = 2;
    },
    RES7d: function() {
      regD[0] &= 0x7F;
      Z80._r.m = 2;
    },
    RES7e: function() {
      regE[0] &= 0x7F;
      Z80._r.m = 2;
    },
    RES7h: function() {
      regH[0] &= 0x7F;
      Z80._r.m = 2;
    },
    RES7l: function() {
      regL[0] &= 0x7F;
      Z80._r.m = 2;
    },
    RES7a: function() {
      regA[0] &= 0x7F;
      Z80._r.m = 2;
    },
    RES7m: function() {
      var i = MMU.rb(regHL[0]);
      i &= 0x7F;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    SET7b: function() {
      regB[0] |= 0x80;
      Z80._r.m = 2;
    },
    SET7c: function() {
      regB[0] |= 0x80;
      Z80._r.m = 2;
    },
    SET7d: function() {
      regB[0] |= 0x80;
      Z80._r.m = 2;
    },
    SET7e: function() {
      regB[0] |= 0x80;
      Z80._r.m = 2;
    },
    SET7h: function() {
      regB[0] |= 0x80;
      Z80._r.m = 2;
    },
    SET7l: function() {
      regB[0] |= 0x80;
      Z80._r.m = 2;
    },
    SET7a: function() {
      regB[0] |= 0x80;
      Z80._r.m = 2;
    },
    SET7m: function() {
      var i = MMU.rb(regHL[0]);
      i |= 0x80;
      MMU.wb(regHL[0], i);
      Z80._r.m = 4;
    },

    RLA: function() {
      var ci = regF[0] & 0x10 ? 1 : 0;
      var co = regA[0] & 0x80 ? 0x10 : 0;
      regA[0] = (regA[0] << 1) + ci;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 1;
    },
    RLCA: function() {
      var ci = regA[0] & 0x80 ? 1 : 0;
      var co = regA[0] & 0x80 ? 0x10 : 0;
      regA[0] = (regA[0] << 1) + ci;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 1;
    },
    RRA: function() {
      var ci = regF[0] & 0x10 ? 0x80 : 0;
      var co = regA[0] & 1 ? 0x10 : 0;
      regA[0] = (regA[0] >> 1) + ci;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 1;
    },
    RRCA: function() {
      var ci = regA[0] & 1 ? 0x80 : 0;
      var co = regA[0] & 1 ? 0x10 : 0;
      regA[0] = (regA[0] >> 1) + ci;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 1;
    },

    RLr_b: function() {
      var ci = regF[0] & 0x10 ? 1 : 0;
      var co = regB[0] & 0x80 ? 0x10 : 0;
      regB[0] = (regB[0] << 1) + ci;
      regF[0] = (regB[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLr_c: function() {
      var ci = regF[0] & 0x10 ? 1 : 0;
      var co = regC[0] & 0x80 ? 0x10 : 0;
      regC[0] = (regC[0] << 1) + ci;
      regF[0] = (regC[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLr_d: function() {
      var ci = regF[0] & 0x10 ? 1 : 0;
      var co = regD[0] & 0x80 ? 0x10 : 0;
      regD[0] = (regD[0] << 1) + ci;
      regF[0] = (regD[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLr_e: function() {
      var ci = regF[0] & 0x10 ? 1 : 0;
      var co = regE[0] & 0x80 ? 0x10 : 0;
      regE[0] = (regE[0] << 1) + ci;
      regF[0] = (regE[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLr_h: function() {
      var ci = regF[0] & 0x10 ? 1 : 0;
      var co = regH[0] & 0x80 ? 0x10 : 0;
      regH[0] = (regH[0] << 1) + ci;
      regF[0] = (regH[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLr_l: function() {
      var ci = regF[0] & 0x10 ? 1 : 0;
      var co = regL[0] & 0x80 ? 0x10 : 0;
      regL[0] = (regL[0] << 1) + ci;
      regF[0] = (regL[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLr_a: function() {
      var ci = regF[0] & 0x10 ? 1 : 0;
      var co = regA[0] & 0x80 ? 0x10 : 0;
      regA[0] = (regA[0] << 1) + ci;
      regF[0] = (regA[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLHL: function() {
      var i = MMU.rb(regHL[0]);
      var ci = regF[0] & 0x10 ? 1 : 0;
      var co = i & 0x80 ? 0x10 : 0;
      i = (i << 1) + ci;
      i &= 255;
      regF[0] = (i) ? 0 : 0x80;
      MMU.wb(regHL[0], i);
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 4;
    },

    RLCr_b: function() {
      var ci = regB[0] & 0x80 ? 1 : 0;
      var co = regB[0] & 0x80 ? 0x10 : 0;
      regB[0] = (regB[0] << 1) + ci;
      regF[0] = (regB[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLCr_c: function() {
      var ci = regC[0] & 0x80 ? 1 : 0;
      var co = regC[0] & 0x80 ? 0x10 : 0;
      regC[0] = (regC[0] << 1) + ci;
      regF[0] = (regC[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLCr_d: function() {
      var ci = regD[0] & 0x80 ? 1 : 0;
      var co = regD[0] & 0x80 ? 0x10 : 0;
      regD[0] = (regD[0] << 1) + ci;
      regF[0] = (regD[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLCr_e: function() {
      var ci = regE[0] & 0x80 ? 1 : 0;
      var co = regE[0] & 0x80 ? 0x10 : 0;
      regE[0] = (regE[0] << 1) + ci;
      regF[0] = (regE[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLCr_h: function() {
      var ci = regH[0] & 0x80 ? 1 : 0;
      var co = regH[0] & 0x80 ? 0x10 : 0;
      regH[0] = (regH[0] << 1) + ci;
      regF[0] = (regH[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLCr_l: function() {
      var ci = regL[0] & 0x80 ? 1 : 0;
      var co = regL[0] & 0x80 ? 0x10 : 0;
      regL[0] = (regL[0] << 1) + ci;
      regF[0] = (regL[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLCr_a: function() {
      var ci = regA[0] & 0x80 ? 1 : 0;
      var co = regA[0] & 0x80 ? 0x10 : 0;
      regA[0] = (regA[0] << 1) + ci;
      regF[0] = (regA[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RLCHL: function() {
      var i = MMU.rb(regHL[0]);
      var ci = i & 0x80 ? 1 : 0;
      var co = i & 0x80 ? 0x10 : 0;
      i = (i << 1) + ci;
      i &= 255;
      regF[0] = (i) ? 0 : 0x80;
      MMU.wb(regHL[0], i);
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 4;
    },

    RRr_b: function() {
      var ci = regF[0] & 0x10 ? 0x80 : 0;
      var co = regB[0] & 1 ? 0x10 : 0;
      regB[0] = (regB[0] >> 1) + ci;
      regF[0] = (regB[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRr_c: function() {
      var ci = regF[0] & 0x10 ? 0x80 : 0;
      var co = regC[0] & 1 ? 0x10 : 0;
      regC[0] = (regC[0] >> 1) + ci;
      regF[0] = (regC[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRr_d: function() {
      var ci = regF[0] & 0x10 ? 0x80 : 0;
      var co = regD[0] & 1 ? 0x10 : 0;
      regD[0] = (regD[0] >> 1) + ci;
      regF[0] = (regD[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRr_e: function() {
      var ci = regF[0] & 0x10 ? 0x80 : 0;
      var co = regE[0] & 1 ? 0x10 : 0;
      regE[0] = (regE[0] >> 1) + ci;
      regF[0] = (regE[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRr_h: function() {
      var ci = regF[0] & 0x10 ? 0x80 : 0;
      var co = regH[0] & 1 ? 0x10 : 0;
      regH[0] = (regH[0] >> 1) + ci;
      regF[0] = (regH[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRr_l: function() {
      var ci = regF[0] & 0x10 ? 0x80 : 0;
      var co = regL[0] & 1 ? 0x10 : 0;
      regL[0] = (regL[0] >> 1) + ci;
      regF[0] = (regL[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRr_a: function() {
      var ci = regF[0] & 0x10 ? 0x80 : 0;
      var co = regA[0] & 1 ? 0x10 : 0;
      regA[0] = (regA[0] >> 1) + ci;
      regF[0] = (regA[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRHL: function() {
      var i = MMU.rb(regHL[0]);
      var ci = regF[0] & 0x10 ? 0x80 : 0;
      var co = i & 1 ? 0x10 : 0;
      i = (i >> 1) + ci;
      i &= 255;
      MMU.wb(regHL[0], i);
      regF[0] = (i) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 4;
    },

    RRCr_b: function() {
      var ci = regB[0] & 1 ? 0x80 : 0;
      var co = regB[0] & 1 ? 0x10 : 0;
      regB[0] = (regB[0] >> 1) + ci;
      regF[0] = (regB[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRCr_c: function() {
      var ci = regC[0] & 1 ? 0x80 : 0;
      var co = regC[0] & 1 ? 0x10 : 0;
      regC[0] = (regC[0] >> 1) + ci;
      regF[0] = (regC[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRCr_d: function() {
      var ci = regD[0] & 1 ? 0x80 : 0;
      var co = regD[0] & 1 ? 0x10 : 0;
      regD[0] = (regD[0] >> 1) + ci;
      regF[0] = (regD[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRCr_e: function() {
      var ci = regE[0] & 1 ? 0x80 : 0;
      var co = regE[0] & 1 ? 0x10 : 0;
      regE[0] = (regE[0] >> 1) + ci;
      regF[0] = (regE[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRCr_h: function() {
      var ci = regH[0] & 1 ? 0x80 : 0;
      var co = regH[0] & 1 ? 0x10 : 0;
      regH[0] = (regH[0] >> 1) + ci;
      regF[0] = (regH[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRCr_l: function() {
      var ci = regL[0] & 1 ? 0x80 : 0;
      var co = regL[0] & 1 ? 0x10 : 0;
      regL[0] = (regL[0] >> 1) + ci;
      regF[0] = (regL[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRCr_a: function() {
      var ci = regA[0] & 1 ? 0x80 : 0;
      var co = regA[0] & 1 ? 0x10 : 0;
      regA[0] = (regA[0] >> 1) + ci;
      regF[0] = (regA[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    RRCHL: function() {
      var i = MMU.rb(regHL[0]);
      var ci = i & 1 ? 0x80 : 0;
      var co = i & 1 ? 0x10 : 0;
      i = (i >> 1) + ci;
      i &= 255;
      MMU.wb(regHL[0], i);
      regF[0] = (i) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 4;
    },

    SLAr_b: function() {
      var co = regB[0] & 0x80 ? 0x10 : 0;
      regB[0] = regB[0] << 1;
      regF[0] = (regB[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLAr_c: function() {
      var co = regC[0] & 0x80 ? 0x10 : 0;
      regC[0] = regC[0] << 1;
      regF[0] = (regC[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLAr_d: function() {
      var co = regD[0] & 0x80 ? 0x10 : 0;
      regD[0] = regD[0] << 1;
      regF[0] = (regD[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLAr_e: function() {
      var co = regE[0] & 0x80 ? 0x10 : 0;
      regE[0] = regE[0] << 1;
      regF[0] = (regE[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLAr_h: function() {
      var co = regH[0] & 0x80 ? 0x10 : 0;
      regH[0] = regH[0] << 1;
      regF[0] = (regH[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLAr_l: function() {
      var co = regL[0] & 0x80 ? 0x10 : 0;
      regL[0] = regL[0] << 1;
      regF[0] = (regL[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLAr_a: function() {
      var co = regA[0] & 0x80 ? 0x10 : 0;
      regA[0] = regA[0] << 1;
      regF[0] = (regA[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },

    SLLr_b: function() {
      var co = regB[0] & 0x80 ? 0x10 : 0;
      regB[0] = (regB[0] << 1) + 1;
      regF[0] = (regB[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLLr_c: function() {
      var co = regC[0] & 0x80 ? 0x10 : 0;
      regC[0] = (regC[0] << 1) + 1;
      regF[0] = (regC[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLLr_d: function() {
      var co = regD[0] & 0x80 ? 0x10 : 0;
      regD[0] = (regD[0] << 1) + 1;
      regF[0] = (regD[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLLr_e: function() {
      var co = regE[0] & 0x80 ? 0x10 : 0;
      regE[0] = (regE[0] << 1) + 1;
      regF[0] = (regE[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLLr_h: function() {
      var co = regH[0] & 0x80 ? 0x10 : 0;
      regH[0] = (regH[0] << 1) + 1;
      regF[0] = (regH[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLLr_l: function() {
      var co = regL[0] & 0x80 ? 0x10 : 0;
      regL[0] = (regL[0] << 1) + 1;
      regF[0] = (regL[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SLLr_a: function() {
      var co = regA[0] & 0x80 ? 0x10 : 0;
      regA[0] = (regA[0] << 1) + 1;
      regF[0] = (regA[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },

    SRAr_b: function() {
      var ci = regB[0] & 0x80;
      var co = regB[0] & 1 ? 0x10 : 0;
      regB[0] = (regB[0] >> 1) + ci;
      regF[0] = (regB[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRAr_c: function() {
      var ci = regC[0] & 0x80;
      var co = regC[0] & 1 ? 0x10 : 0;
      regC[0] = (regC[0] >> 1) + ci;
      regF[0] = (regC[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRAr_d: function() {
      var ci = regD[0] & 0x80;
      var co = regD[0] & 1 ? 0x10 : 0;
      regD[0] = (regD[0] >> 1) + ci;
      regF[0] = (regD[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRAr_e: function() {
      var ci = regE[0] & 0x80;
      var co = regE[0] & 1 ? 0x10 : 0;
      regE[0] = (regE[0] >> 1) + ci;
      regF[0] = (regE[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRAr_h: function() {
      var ci = regH[0] & 0x80;
      var co = regH[0] & 1 ? 0x10 : 0;
      regH[0] = (regH[0] >> 1) + ci;
      regF[0] = (regH[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRAr_l: function() {
      var ci = regL[0] & 0x80;
      var co = regL[0] & 1 ? 0x10 : 0;
      regL[0] = (regL[0] >> 1) + ci;
      regF[0] = (regL[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRAr_a: function() {
      var ci = regA[0] & 0x80;
      var co = regA[0] & 1 ? 0x10 : 0;
      regA[0] = (regA[0] >> 1) + ci;
      regF[0] = (regA[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },

    SRLr_b: function() {
      var co = regB[0] & 1 ? 0x10 : 0;
      regB[0] = regB[0] >> 1;
      regF[0] = (regB[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRLr_c: function() {
      var co = regC[0] & 1 ? 0x10 : 0;
      regC[0] = regC[0] >> 1;
      regF[0] = (regC[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRLr_d: function() {
      var co = regD[0] & 1 ? 0x10 : 0;
      regD[0] = regD[0] >> 1;
      regF[0] = (regD[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRLr_e: function() {
      var co = regE[0] & 1 ? 0x10 : 0;
      regE[0] = regE[0] >> 1;
      regF[0] = (regE[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRLr_h: function() {
      var co = regH[0] & 1 ? 0x10 : 0;
      regH[0] = regH[0] >> 1;
      regF[0] = (regH[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRLr_l: function() {
      var co = regL[0] & 1 ? 0x10 : 0;
      regL[0] = regL[0] >> 1;
      regF[0] = (regL[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },
    SRLr_a: function() {
      var co = regA[0] & 1 ? 0x10 : 0;
      regA[0] = regA[0] >> 1;
      regF[0] = (regA[0]) ? 0 : 0x80;
      regF[0] = (regF[0] & 0xEF) + co;
      Z80._r.m = 2;
    },

    CPL: function() {
      regA[0] ^= 255;
      regF[0] = regA[0] ? 0 : 0x80;
      Z80._r.m = 1;
    },
    NEG: function() {
      regA[0] = 0 - regA[0];
      regF[0] = (regA[0] < 0) ? 0x10 : 0;
      if (!regA[0]) regF[0] |= 0x80;
      Z80._r.m = 2;
    },

    CCF: function() {
      var ci = regF[0] & 0x10 ? 0 : 0x10;
      regF[0] = (regF[0] & 0xEF) + ci;
      Z80._r.m = 1;
    },
    SCF: function() {
      regF[0] |= 0x10;
      Z80._r.m = 1;
    },

    /*--- Stack ---*/
    PUSHBC: function() {
      regSP[0]--;
      MMU.wb(regSP[0], regB[0]);
      regSP[0]--;
      MMU.wb(regSP[0], regC[0]);
      Z80._r.m = 3;
    },
    PUSHDE: function() {
      regSP[0]--;
      MMU.wb(regSP[0], regD[0]);
      regSP[0]--;
      MMU.wb(regSP[0], regE[0]);
      Z80._r.m = 3;
    },
    PUSHHL: function() {
      // TODO: check if this can use MMU.ww()
      regSP[0]--;
      MMU.wb(regSP[0], regH[0]);
      regSP[0]--;
      MMU.wb(regSP[0], regL[0]);
      Z80._r.m = 3;
    },
    PUSHAF: function() {
      regSP[0]--;
      MMU.wb(regSP[0], regA[0]);
      regSP[0]--;
      MMU.wb(regSP[0], regF[0]);
      Z80._r.m = 3;
    },

    POPBC: function() {
      regC[0] = MMU.rb(regSP[0]);
      regSP[0]++;
      regB[0] = MMU.rb(regSP[0]);
      regSP[0]++;
      Z80._r.m = 3;
    },
    POPDE: function() {
      regE[0] = MMU.rb(regSP[0]);
      regSP[0]++;
      regD[0] = MMU.rb(regSP[0]);
      regSP[0]++;
      Z80._r.m = 3;
    },
    POPHL: function() {
      // TODO check if this can use MMU.rw()
      regL[0] = MMU.rb(regSP[0]);
      regSP[0]++;
      regH[0] = MMU.rb(regSP[0]);
      regSP[0]++;
      Z80._r.m = 3;
    },

    // POP AF
    // 0xF1
    POPAF: function() {
      // Flags register keeps bottom 4 bits clear
      regF[0] = MMU.rb(regSP[0]) & 0xF0;
      regSP[0]++;
      regA[0] = MMU.rb(regSP[0]);
      regSP[0]++;
      Z80._r.m = 3;
    },

    /*--- Jump ---*/
    JPnn: function() {
      regPC[0] = MMU.rw(regPC[0]);
      Z80._r.m = 3;
    },
    JPHL: function() {
      regPC[0] = regHL[0];
      Z80._r.m = 1;
    },
    JPNZnn: function() {
      Z80._r.m = 3;
      if ((regF[0] & 0x80) == 0x00) {
        regPC[0] = MMU.rw(regPC[0]);
        Z80._r.m++;
      } else regPC[0] += 2;
    },
    JPZnn: function() {
      Z80._r.m = 3;
      if ((regF[0] & 0x80) == 0x80) {
        regPC[0] = MMU.rw(regPC[0]);
        Z80._r.m++;
      } else regPC[0] += 2;
    },
    JPNCnn: function() {
      Z80._r.m = 3;
      if ((regF[0] & 0x10) == 0x00) {
        regPC[0] = MMU.rw(regPC[0]);
        Z80._r.m++;
      } else regPC[0] += 2;
    },
    JPCnn: function() {
      Z80._r.m = 3;
      if ((regF[0] & 0x10) == 0x10) {
        regPC[0] = MMU.rw(regPC[0]);
        Z80._r.m++;
      } else regPC[0] += 2;
    },

    JRn: function() {
      var i = MMU.rb(regPC[0]);
      if (i > 0x7F) {
        i = -((~i + 1) & 0xFF);
      }
      regPC[0]++;
      Z80._r.m = 2;
      regPC[0] += i;
      Z80._r.m++;
    },
    JRNZn: function() {
      var i = MMU.rb(regPC[0]);
      if (i > 127) i = -((~i + 1) & 255);
      regPC[0]++;
      Z80._r.m = 2;
      if ((regF[0] & 0x80) == 0x00) {
        regPC[0] += i;
        Z80._r.m++;
      }
    },
    JRZn: function() {
      var i = MMU.rb(regPC[0]);
      if (i > 127) i = -((~i + 1) & 255);
      regPC[0]++;
      Z80._r.m = 2;
      if ((regF[0] & 0x80) == 0x80) {
        regPC[0] += i;
        Z80._r.m++;
      }
    },
    JRNCn: function() {
      var i = MMU.rb(regPC[0]);
      if (i > 127) i = -((~i + 1) & 255);
      regPC[0]++;
      Z80._r.m = 2;
      if ((regF[0] & 0x10) == 0x00) {
        regPC[0] += i;
        Z80._r.m++;
      }
    },
    JRCn: function() {
      var i = MMU.rb(regPC[0]);
      if (i > 127) i = -((~i + 1) & 255);
      regPC[0]++;
      Z80._r.m = 2;
      if ((regF[0] & 0x10) == 0x10) {
        regPC[0] += i;
        Z80._r.m++;
      }
    },

    DJNZn: function() {
      var i = MMU.rb(regPC[0]);
      if (i > 127) i = -((~i + 1) & 255);
      regPC[0]++;
      Z80._r.m = 2;
      regB[0]--;
      if (regB[0]) {
        regPC[0] += i;
        Z80._r.m++;
      }
    },

    CALLnn: function() {
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0] + 2);
      regPC[0] = MMU.rw(regPC[0]);
      Z80._r.m = 5;
    },
    CALLNZnn: function() {
      Z80._r.m = 3;
      if ((regF[0] & 0x80) == 0x00) {
        regSP[0] -= 2;
        MMU.ww(regSP[0], regPC[0] + 2);
        regPC[0] = MMU.rw(regPC[0]);
        Z80._r.m += 2;
      } else regPC[0] += 2;
    },
    CALLZnn: function() {
      Z80._r.m = 3;
      if ((regF[0] & 0x80) == 0x80) {
        regSP[0] -= 2;
        MMU.ww(regSP[0], regPC[0] + 2);
        regPC[0] = MMU.rw(regPC[0]);
        Z80._r.m += 2;
      } else regPC[0] += 2;
    },
    CALLNCnn: function() {
      Z80._r.m = 3;
      if ((regF[0] & 0x10) == 0x00) {
        regSP[0] -= 2;
        MMU.ww(regSP[0], regPC[0] + 2);
        regPC[0] = MMU.rw(regPC[0]);
        Z80._r.m += 2;
      } else regPC[0] += 2;
    },
    CALLCnn: function() {
      Z80._r.m = 3;
      if ((regF[0] & 0x10) == 0x10) {
        regSP[0] -= 2;
        MMU.ww(regSP[0], regPC[0] + 2);
        regPC[0] = MMU.rw(regPC[0]);
        Z80._r.m += 2;
      } else regPC[0] += 2;
    },

    RET: function() {
      regPC[0] = MMU.rw(regSP[0]);
      regSP[0] += 2;
      Z80._r.m = 3;
    },
    RETI: function() {
      interruptsEnabled = true;
      Z80._ops.rrs();
      regPC[0] = MMU.rw(regSP[0]);
      regSP[0] += 2;
      Z80._r.m = 3;
    },
    RETNZ: function() {
      Z80._r.m = 1;
      if ((regF[0] & 0x80) == 0x00) {
        regPC[0] = MMU.rw(regSP[0]);
        regSP[0] += 2;
        Z80._r.m += 2;
      }
    },
    RETZ: function() {
      Z80._r.m = 1;
      if ((regF[0] & 0x80) == 0x80) {
        regPC[0] = MMU.rw(regSP[0]);
        regSP[0] += 2;
        Z80._r.m += 2;
      }
    },
    RETNC: function() {
      Z80._r.m = 1;
      if ((regF[0] & 0x10) == 0x00) {
        regPC[0] = MMU.rw(regSP[0]);
        regSP[0] += 2;
        Z80._r.m += 2;
      }
    },
    RETC: function() {
      Z80._r.m = 1;
      if ((regF[0] & 0x10) == 0x10) {
        regPC[0] = MMU.rw(regSP[0]);
        regSP[0] += 2;
        Z80._r.m += 2;
      }
    },

    RST00: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x00;
      Z80._r.m = 3;
    },
    RST08: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x08;
      Z80._r.m = 3;
    },
    RST10: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x10;
      Z80._r.m = 3;
    },
    RST18: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x18;
      Z80._r.m = 3;
    },
    RST20: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x20;
      Z80._r.m = 3;
    },
    RST28: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x28;
      Z80._r.m = 3;
    },
    RST30: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x30;
      Z80._r.m = 3;
    },
    RST38: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x38;
      Z80._r.m = 3;
    },
    RST40: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x40;
      Z80._r.m = 3;
    },
    RST48: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x48;
      Z80._r.m = 3;
    },
    RST50: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x50;
      Z80._r.m = 3;
    },
    RST58: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x58;
      Z80._r.m = 3;
    },
    RST60: function() {
      Z80._ops.rsv();
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0]);
      regPC[0] = 0x60;
      Z80._r.m = 3;
    },

    NOP: function() {
      Z80._r.m = 1;
    },

    HALT: function() {
      if (interruptsEnabled) {
        Z80._halt = true;
      }
      Z80._r.m = 1;
    },

    DI: function() {
      interruptsEnabled = false;
      Z80._r.m = 1;
    },

    // EI
    // Enable Interrupts
    // 0xFB
    EI: function() {
      interruptsEnabled = true;
      Z80._r.m = 1;
    },

    /*--- Helper functions ---*/
    rsv: function() {
      // TODO: save registers
    },

    rrs: function() {
      // TODO restore registers
    },

    MAPcb: function() {
      var i = MMU.rb(regPC[0]);
      regPC[0]++;
      if (Z80._cbmap[i]) Z80._cbmap[i]();
      else console.log(i);
    },

    XX: function(instruction) {
      /*Undefined map entry*/
      var opc = regPC[0] - 1;
      LOG.out('Z80', 'Unimplemented map instruction ' + instruction + ' at $' + opc.toString(16) + ', stopping.');
      Z80._stop = 1;
    },

    XY: function() {
      /*Undefined cbmap entry*/
      var opc = regPC[0] - 1;
      LOG.out('Z80', 'Unimplemented cbmap instruction at $' + opc.toString(16) + ', stopping.');
      Z80._stop = 1;
    }

  },
  _cbmap: []
};

Z80._map = [
  // 00
  Z80._ops.NOP, Z80._ops.LDBCnn, Z80._ops.LDBCmA, Z80._ops.INCBC,
  Z80._ops.INCr_b, Z80._ops.DECr_b, Z80._ops.LDrn_b, Z80._ops.RLCA,
  Z80._ops.LDmmSP, Z80._ops.ADDHLBC, Z80._ops.LDABCm, Z80._ops.DECBC,
  Z80._ops.INCr_c, Z80._ops.DECr_c, Z80._ops.LDrn_c, Z80._ops.RRCA,
  // 10
  Z80._ops.DJNZn, Z80._ops.LDDEnn, Z80._ops.LDDEmA, Z80._ops.INCDE,
  Z80._ops.INCr_d, Z80._ops.DECr_d, Z80._ops.LDrn_d, Z80._ops.RLA,
  Z80._ops.JRn, Z80._ops.ADDHLDE, Z80._ops.LDADEm, Z80._ops.DECDE,
  Z80._ops.INCr_e, Z80._ops.DECr_e, Z80._ops.LDrn_e, Z80._ops.RRA,
  // 20
  Z80._ops.JRNZn, Z80._ops.LDHLnn, Z80._ops.LDHLIA, Z80._ops.INCHL,
  Z80._ops.INCr_h, Z80._ops.DECr_h, Z80._ops.LDrn_h, Z80._ops.DAA,
  Z80._ops.JRZn, Z80._ops.ADDHLHL, Z80._ops.LDAHLI, Z80._ops.DECHL,
  Z80._ops.INCr_l, Z80._ops.DECr_l, Z80._ops.LDrn_l, Z80._ops.CPL,
  // 30
  Z80._ops.JRNCn, Z80._ops.LDSPnn, Z80._ops.LDHLDA, Z80._ops.INCSP,
  Z80._ops.INCHLm, Z80._ops.DECHLm, Z80._ops.LDHLmn, Z80._ops.SCF,
  Z80._ops.JRCn, Z80._ops.ADDHLSP, Z80._ops.LDAHLD, Z80._ops.DECSP,
  Z80._ops.INCr_a, Z80._ops.DECr_a, Z80._ops.LDrn_a, Z80._ops.CCF,
  // 40
  Z80._ops.ldReg.bind(null, regB, regB), Z80._ops.ldReg.bind(null, regB, regC), Z80._ops.ldReg.bind(null, regB, regD), Z80._ops.ldReg.bind(null, regB, regE),
  Z80._ops.ldReg.bind(null, regB, regH), Z80._ops.ldReg.bind(null, regB, regL), Z80._ops.LDrHLm_b, Z80._ops.ldReg.bind(null, regB, regA),
  Z80._ops.ldReg.bind(null, regC, regB), Z80._ops.ldReg.bind(null, regC, regC), Z80._ops.ldReg.bind(null, regC, regD), Z80._ops.ldReg.bind(null, regC, regE),
  Z80._ops.ldReg.bind(null, regC, regH), Z80._ops.ldReg.bind(null, regC, regL), Z80._ops.LDrHLm_c, Z80._ops.ldReg.bind(null, regC, regA),
  // 50
  Z80._ops.ldReg.bind(null, regD, regB), Z80._ops.ldReg.bind(null, regD, regC), Z80._ops.ldReg.bind(null, regD, regD), Z80._ops.ldReg.bind(null, regD, regE),
  Z80._ops.ldReg.bind(null, regD, regH), Z80._ops.ldReg.bind(null, regD, regL), Z80._ops.LDrHLm_d, Z80._ops.ldReg.bind(null, regD, regA),
  Z80._ops.ldReg.bind(null, regE, regB), Z80._ops.ldReg.bind(null, regE, regC), Z80._ops.ldReg.bind(null, regE, regD), Z80._ops.ldReg.bind(null, regE, regE),
  Z80._ops.ldReg.bind(null, regE, regH), Z80._ops.ldReg.bind(null, regE, regL), Z80._ops.LDrHLm_e, Z80._ops.ldReg.bind(null, regE, regA),
  // 60
  Z80._ops.ldReg.bind(null, regH, regB), Z80._ops.ldReg.bind(null, regH, regC), Z80._ops.ldReg.bind(null, regH, regD), Z80._ops.ldReg.bind(null, regH, regE),
  Z80._ops.ldReg.bind(null, regH, regH), Z80._ops.ldReg.bind(null, regH, regL), Z80._ops.LDrHLm_h, Z80._ops.ldReg.bind(null, regH, regA),
  Z80._ops.ldReg.bind(null, regL, regB), Z80._ops.ldReg.bind(null, regL, regC), Z80._ops.ldReg.bind(null, regL, regD), Z80._ops.ldReg.bind(null, regL, regE),
  Z80._ops.ldReg.bind(null, regL, regH), Z80._ops.ldReg.bind(null, regL, regL), Z80._ops.LDrHLm_l, Z80._ops.ldReg.bind(null, regL, regA),
  // 70
  Z80._ops.LDHLmr_b, Z80._ops.LDHLmr_c, Z80._ops.LDHLmr_d, Z80._ops.LDHLmr_e,
  Z80._ops.LDHLmr_h, Z80._ops.LDHLmr_l, Z80._ops.HALT, Z80._ops.LDHLmr_a,
  Z80._ops.ldReg.bind(null, regA, regB), Z80._ops.ldReg.bind(null, regA, regC), Z80._ops.ldReg.bind(null, regA, regD), Z80._ops.ldReg.bind(null, regA, regE),
  Z80._ops.ldReg.bind(null, regA, regH), Z80._ops.ldReg.bind(null, regA, regL), Z80._ops.LDrHLm_a, Z80._ops.ldReg.bind(null, regA, regA),
  // 80
  Z80._ops.addReg.bind(null, regB), Z80._ops.addReg.bind(null, regC), Z80._ops.addReg.bind(null, regD), Z80._ops.addReg.bind(null, regE),
  Z80._ops.addReg.bind(null, regH), Z80._ops.addReg.bind(null, regL), Z80._ops.ADDHL, Z80._ops.addReg.bind(null, regA), //FIXME: optimize with << 1
  Z80._ops.ADCr_b, Z80._ops.ADCr_c, Z80._ops.ADCr_d, Z80._ops.ADCr_e,
  Z80._ops.ADCr_h, Z80._ops.ADCr_l, Z80._ops.ADCHL, Z80._ops.ADCr_a,
  // 90
  Z80._ops.subReg.bind(null, regB), Z80._ops.subReg.bind(null, regC), Z80._ops.subReg.bind(null, regD), Z80._ops.subReg.bind(null, regE),
  Z80._ops.subReg.bind(null, regH), Z80._ops.subReg.bind(null, regL), Z80._ops.SUBHL, Z80._ops.subReg.bind(null, regA), // FIXME: SUB A, A could be optimized as a NOP
  Z80._ops.subcReg.bind(null, regB), Z80._ops.subcReg.bind(null, regC), Z80._ops.subcReg.bind(null, regD), Z80._ops.subcReg.bind(null, regE),
  Z80._ops.subcReg_h, Z80._ops.subcReg_l, Z80._ops.SBCHL, Z80._ops.subcReg_a,
  // A0
  Z80._ops.ANDr_b, Z80._ops.ANDr_c, Z80._ops.ANDr_d, Z80._ops.ANDr_e,
  Z80._ops.ANDr_h, Z80._ops.ANDr_l, Z80._ops.ANDHL, Z80._ops.ANDr_a,
  Z80._ops.XORr_b, Z80._ops.XORr_c, Z80._ops.XORr_d, Z80._ops.XORr_e,
  Z80._ops.XORr_h, Z80._ops.XORr_l, Z80._ops.XORHL, Z80._ops.XORr_a,
  // B0
  Z80._ops.ORr_b, Z80._ops.ORr_c, Z80._ops.ORr_d, Z80._ops.ORr_e,
  Z80._ops.ORr_h, Z80._ops.ORr_l, Z80._ops.ORHL, Z80._ops.ORr_a,
  Z80._ops.cpReg.bind(null, regB), Z80._ops.cpReg.bind(null, regC), Z80._ops.cpReg.bind(null, regD), Z80._ops.cpReg.bind(null, regE),
  Z80._ops.cpReg.bind(null, regH), Z80._ops.cpReg.bind(null, regL), Z80._ops.CPHL, Z80._ops.cpReg.bind(null, regA),
  // C0
  Z80._ops.RETNZ, Z80._ops.POPBC, Z80._ops.JPNZnn, Z80._ops.JPnn,
  Z80._ops.CALLNZnn, Z80._ops.PUSHBC, Z80._ops.ADDn, Z80._ops.RST00,
  Z80._ops.RETZ, Z80._ops.RET, Z80._ops.JPZnn, Z80._ops.MAPcb,
  Z80._ops.CALLZnn, Z80._ops.CALLnn, Z80._ops.ADCn, Z80._ops.RST08,
  // D0
  Z80._ops.RETNC, Z80._ops.POPDE, Z80._ops.JPNCnn, Z80._ops.XX.bind(null, 'D3'),
  Z80._ops.CALLNCnn, Z80._ops.PUSHDE, Z80._ops.SUBn, Z80._ops.RST10,
  Z80._ops.RETC, Z80._ops.RETI, Z80._ops.JPCnn, Z80._ops.XX.bind(null, 'DB'),
  Z80._ops.CALLCnn, Z80._ops.XX.bind(null, 'DD'), Z80._ops.SBCn, Z80._ops.RST18,
  // E0
  Z80._ops.LDIOnA, Z80._ops.POPHL, Z80._ops.LDIOCA, Z80._ops.XX.bind(null, 'E3'),
  Z80._ops.XX.bind(null, 'E4'), Z80._ops.PUSHHL, Z80._ops.ANDn, Z80._ops.RST20,
  Z80._ops.ADDSPn, Z80._ops.JPHL, Z80._ops.LDmmA, Z80._ops.XX.bind(null, 'EB'),
  Z80._ops.XX.bind(null, 'EC'), Z80._ops.XX.bind(null, 'ED'), Z80._ops.XORn, Z80._ops.RST28,
  // F0
  Z80._ops.LDAIOn, Z80._ops.POPAF, Z80._ops.LDAIOC, Z80._ops.DI,
  Z80._ops.XX.bind(null, 'F4'), Z80._ops.PUSHAF, Z80._ops.ORn, Z80._ops.RST30,
  Z80._ops.LDHLSPn, Z80._ops.LDSPHL, Z80._ops.LDAmm, Z80._ops.EI,
  Z80._ops.XX.bind(null, 'FC'), Z80._ops.XX.bind(null, 'FD'), Z80._ops.CPn, Z80._ops.RST38
];

Z80._cbmap = [
  // CB00
  Z80._ops.RLCr_b, Z80._ops.RLCr_c, Z80._ops.RLCr_d, Z80._ops.RLCr_e,
  Z80._ops.RLCr_h, Z80._ops.RLCr_l, Z80._ops.RLCHL, Z80._ops.RLCr_a,
  Z80._ops.RRCr_b, Z80._ops.RRCr_c, Z80._ops.RRCr_d, Z80._ops.RRCr_e,
  Z80._ops.RRCr_h, Z80._ops.RRCr_l, Z80._ops.RRCHL, Z80._ops.RRCr_a,
  // CB10
  Z80._ops.RLr_b, Z80._ops.RLr_c, Z80._ops.RLr_d, Z80._ops.RLr_e,
  Z80._ops.RLr_h, Z80._ops.RLr_l, Z80._ops.RLHL, Z80._ops.RLr_a,
  Z80._ops.RRr_b, Z80._ops.RRr_c, Z80._ops.RRr_d, Z80._ops.RRr_e,
  Z80._ops.RRr_h, Z80._ops.RRr_l, Z80._ops.RRHL, Z80._ops.RRr_a,
  // CB20
  Z80._ops.SLAr_b, Z80._ops.SLAr_c, Z80._ops.SLAr_d, Z80._ops.SLAr_e,
  Z80._ops.SLAr_h, Z80._ops.SLAr_l, Z80._ops.XY, Z80._ops.SLAr_a,
  Z80._ops.SRAr_b, Z80._ops.SRAr_c, Z80._ops.SRAr_d, Z80._ops.SRAr_e,
  Z80._ops.SRAr_h, Z80._ops.SRAr_l, Z80._ops.XY, Z80._ops.SRAr_a,
  // CB30
  Z80._ops.SWAPr_b, Z80._ops.SWAPr_c, Z80._ops.SWAPr_d, Z80._ops.SWAPr_e,
  Z80._ops.SWAPr_h, Z80._ops.SWAPr_l, Z80._ops.XY, Z80._ops.SWAPr_a,
  Z80._ops.SRLr_b, Z80._ops.SRLr_c, Z80._ops.SRLr_d, Z80._ops.SRLr_e,
  Z80._ops.SRLr_h, Z80._ops.SRLr_l, Z80._ops.XY, Z80._ops.SRLr_a,
  // CB40
  Z80._ops.BIT0b, Z80._ops.BIT0c, Z80._ops.BIT0d, Z80._ops.BIT0e,
  Z80._ops.BIT0h, Z80._ops.BIT0l, Z80._ops.BIT0m, Z80._ops.BIT0a,
  Z80._ops.BIT1b, Z80._ops.BIT1c, Z80._ops.BIT1d, Z80._ops.BIT1e,
  Z80._ops.BIT1h, Z80._ops.BIT1l, Z80._ops.BIT1m, Z80._ops.BIT1a,
  // CB50
  Z80._ops.BIT2b, Z80._ops.BIT2c, Z80._ops.BIT2d, Z80._ops.BIT2e,
  Z80._ops.BIT2h, Z80._ops.BIT2l, Z80._ops.BIT2m, Z80._ops.BIT2a,
  Z80._ops.BIT3b, Z80._ops.BIT3c, Z80._ops.BIT3d, Z80._ops.BIT3e,
  Z80._ops.BIT3h, Z80._ops.BIT3l, Z80._ops.BIT3m, Z80._ops.BIT3a,
  // CB60
  Z80._ops.BIT4b, Z80._ops.BIT4c, Z80._ops.BIT4d, Z80._ops.BIT4e,
  Z80._ops.BIT4h, Z80._ops.BIT4l, Z80._ops.BIT4m, Z80._ops.BIT4a,
  Z80._ops.BIT5b, Z80._ops.BIT5c, Z80._ops.BIT5d, Z80._ops.BIT5e,
  Z80._ops.BIT5h, Z80._ops.BIT5l, Z80._ops.BIT5m, Z80._ops.BIT5a,
  // CB70
  Z80._ops.BIT6b, Z80._ops.BIT6c, Z80._ops.BIT6d, Z80._ops.BIT6e,
  Z80._ops.BIT6h, Z80._ops.BIT6l, Z80._ops.BIT6m, Z80._ops.BIT6a,
  Z80._ops.BIT7b, Z80._ops.BIT7c, Z80._ops.BIT7d, Z80._ops.BIT7e,
  Z80._ops.BIT7h, Z80._ops.BIT7l, Z80._ops.BIT7m, Z80._ops.BIT7a,
  // CB80
  Z80._ops.RES0b, Z80._ops.RES0c, Z80._ops.RES0d, Z80._ops.RES0e,
  Z80._ops.RES0h, Z80._ops.RES0l, Z80._ops.RES0m, Z80._ops.RES0a,
  Z80._ops.RES1b, Z80._ops.RES1c, Z80._ops.RES1d, Z80._ops.RES1e,
  Z80._ops.RES1h, Z80._ops.RES1l, Z80._ops.RES1m, Z80._ops.RES1a,
  // CB90
  Z80._ops.RES2b, Z80._ops.RES2c, Z80._ops.RES2d, Z80._ops.RES2e,
  Z80._ops.RES2h, Z80._ops.RES2l, Z80._ops.RES2m, Z80._ops.RES2a,
  Z80._ops.RES3b, Z80._ops.RES3c, Z80._ops.RES3d, Z80._ops.RES3e,
  Z80._ops.RES3h, Z80._ops.RES3l, Z80._ops.RES3m, Z80._ops.RES3a,
  // CBA0
  Z80._ops.RES4b, Z80._ops.RES4c, Z80._ops.RES4d, Z80._ops.RES4e,
  Z80._ops.RES4h, Z80._ops.RES4l, Z80._ops.RES4m, Z80._ops.RES4a,
  Z80._ops.RES5b, Z80._ops.RES5c, Z80._ops.RES5d, Z80._ops.RES5e,
  Z80._ops.RES5h, Z80._ops.RES5l, Z80._ops.RES5m, Z80._ops.RES5a,
  // CBB0
  Z80._ops.RES6b, Z80._ops.RES6c, Z80._ops.RES6d, Z80._ops.RES6e,
  Z80._ops.RES6h, Z80._ops.RES6l, Z80._ops.RES6m, Z80._ops.RES6a,
  Z80._ops.RES7b, Z80._ops.RES7c, Z80._ops.RES7d, Z80._ops.RES7e,
  Z80._ops.RES7h, Z80._ops.RES7l, Z80._ops.RES7m, Z80._ops.RES7a,
  // CBC0
  Z80._ops.SET0b, Z80._ops.SET0c, Z80._ops.SET0d, Z80._ops.SET0e,
  Z80._ops.SET0h, Z80._ops.SET0l, Z80._ops.SET0m, Z80._ops.SET0a,
  Z80._ops.SET1b, Z80._ops.SET1c, Z80._ops.SET1d, Z80._ops.SET1e,
  Z80._ops.SET1h, Z80._ops.SET1l, Z80._ops.SET1m, Z80._ops.SET1a,
  // CBD0
  Z80._ops.SET2b, Z80._ops.SET2c, Z80._ops.SET2d, Z80._ops.SET2e,
  Z80._ops.SET2h, Z80._ops.SET2l, Z80._ops.SET2m, Z80._ops.SET2a,
  Z80._ops.SET3b, Z80._ops.SET3c, Z80._ops.SET3d, Z80._ops.SET3e,
  Z80._ops.SET3h, Z80._ops.SET3l, Z80._ops.SET3m, Z80._ops.SET3a,
  // CBE0
  Z80._ops.SET4b, Z80._ops.SET4c, Z80._ops.SET4d, Z80._ops.SET4e,
  Z80._ops.SET4h, Z80._ops.SET4l, Z80._ops.SET4m, Z80._ops.SET4a,
  Z80._ops.SET5b, Z80._ops.SET5c, Z80._ops.SET5d, Z80._ops.SET5e,
  Z80._ops.SET5h, Z80._ops.SET5l, Z80._ops.SET5m, Z80._ops.SET5a,
  // CBF0
  Z80._ops.SET6b, Z80._ops.SET6c, Z80._ops.SET6d, Z80._ops.SET6e,
  Z80._ops.SET6h, Z80._ops.SET6l, Z80._ops.SET6m, Z80._ops.SET6a,
  Z80._ops.SET7b, Z80._ops.SET7c, Z80._ops.SET7d, Z80._ops.SET7e,
  Z80._ops.SET7h, Z80._ops.SET7l, Z80._ops.SET7m, Z80._ops.SET7a,
];

export default Z80;
