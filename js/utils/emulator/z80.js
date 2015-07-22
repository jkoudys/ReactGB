/**
 * jsGB: Z80 core
 * Joshua Koudys, Jul 2015
 * Imran Nazar, May 2009
 * Notes: This is a GameBoy Z80, not a Z80. There are differences. Mainly the F
 */
import LOG from './log.js';
import MMU from './mmu.js';
import Debug from './Debug.js';

/**
 * Flag constants
 * I have faith that a modern JIT, especially once es6 rolls around, will
 * be able to optimize a bunch of consts as equivalent to inlining them. Other
 * implementations use bools for the flags, but since F is actually a register,
 * this more C-like approach makes sense.
 */
// Set if result was zero
const F_ZERO = 0x80;
// Set if result was > 0xFF for addition, or < 0x00 for subtraction
const F_CARRY = 0x10;
// Set if lower nibble went > 0x0F for add, or upper nibble < 0xF0 for sub
const F_HCARRY = 0x20;
// Set if last op was a subtraction
const F_OP = 0x40;

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
var registers = new ArrayBuffer(12);

// Address the byte-boundaries. Downside is, everything needs a [0], but
// the plus side is, actual uints in JS!
var regHL = new Uint16Array(registers, 0, 1);
var regDE = new Uint16Array(registers, 2, 1);
var regBC = new Uint16Array(registers, 4, 1);
var regAF = new Uint16Array(registers, 6, 1);
var regPC = new Uint16Array(registers, 8, 1);
var regSP = new Uint16Array(registers, 10, 1);

// Address 8-bit boundaries
var regL = new Uint8Array(registers, 0, 1);
var regH = new Uint8Array(registers, 1, 1);
var regE = new Uint8Array(registers, 2, 1);
var regD = new Uint8Array(registers, 3, 1);
var regC = new Uint8Array(registers, 4, 1);
var regB = new Uint8Array(registers, 5, 1);
var regF = new Uint8Array(registers, 6, 1);
var regA = new Uint8Array(registers, 7, 1);

// The Interrupts Enabled flag
var interruptsEnabled = true;

const Z80 = {
  _halt: false,
  _stop: false,

  // Clock speed, in Hz
  // TODO: add speed modes for GBC support
  speed: 4190000,

  reset: function() {
    //CPU Registers and Flags:
    regAF[0] = 0x01B0;
    regBC[0] = 0x0013;
    regDE[0] = 0x00D8;
    regHL[0] = 0x014D;
    regSP[0] = 0xFFFE;
    regPC[0] = 0x0100;

    Z80._halt = 0;
    Z80._stop = 0;
    interruptsEnabled = true;
    LOG.out('Z80', 'Reset.');
  },

  isInterruptable: function() {
    return interruptsEnabled;
  },

  isHalted: function() {
    return Z80._halt;
  },

  disableInterrupts: function() {
    interruptsEnabled = false;
  },

  enabledInterrupts: function() {
    interruptsEnabled = true;
  },

  /**
   * Execute the opcode pointed to by the program counter, and increment
   * the counter to the next code.
   * @return int Clock ticks
   */
  exec: function() {
    return _map[MMU.rb(regPC[0]++)]();
  },
};

const _ops = {
  /*--- Load/store ---*/
  /**
   * Loads a register from another register
   * @param Uint8Array registerTo
   * @param Uint8Array registerFrom
   * @return int Clock ticks
   */
  ldReg(registerTo, registerFrom) {
    registerTo[0] = registerFrom[0];
    return 4;
  },

  /**
   * Loads a register with memory from HL
   * @param Uint8Array register
   * @return int Clock ticks
   */
  ldRegMem(register) {
    register[0] = MMU.rb(regHL[0]);
    return 8;
  },

  /**
   * Load into memory from a register
   * @param Uint8Array register
   * @return int Clock ticks
   */
  ldMemReg(register) {
    MMU.wb(regHL[0], register[0]);
    return 8;
  },

  /**
   * Load a literal value into a 8-bit register
   * LD B, n
   * @param Uint8Array register
   * @return int Clock ticks
   */
  ldRegVal(register) {
    register[0] = MMU.rb(regPC[0]);
    regPC[0]++;
    return 8;
  },

  /**
   * Load a literal value into HL
   * @return int Clock ticks
   */
  LDHLmn() {
    MMU.wb(regHL[0], MMU.rb(regPC[0]));
    regPC[0]++;
    return 12;
  },

  LDBCmA() {
    MMU.wb(regBC[0], regA[0]);
    return 8;
  },
  LDDEmA() {
    MMU.wb(regDE[0], regA[0]);
    return 8;
  },

  LDmmA() {
    MMU.wb(MMU.rw(regPC[0]), regA[0]);
    regPC[0] += 2;
    return 16;
  },

  LDABCm() {
    regA[0] = MMU.rb(regBC[0]);
    return 8;
  },
  LDADEm() {
    regA[0] = MMU.rb(regDE[0]);
    return 8;
  },

  LDAmm() {
    regA[0] = MMU.rb(MMU.rw(regPC[0]));
    regPC[0] += 2;
    return 16;
  },

  LDBCnn() {
    regC[0] = MMU.rb(regPC[0]);
    regB[0] = MMU.rb(regPC[0] + 1);
    regPC[0] += 2;
    return 12;
  },
  LDDEnn() {
    regE[0] = MMU.rb(regPC[0]);
    regD[0] = MMU.rb(regPC[0] + 1);
    regPC[0] += 2;
    return 12;
  },
  LDHLnn() {
    regHL[0] = MMU.rw(regPC[0]);
    regPC[0] += 2;
    return 12;
  },
  LDSPnn() {
    regSP[0] = MMU.rw(regPC[0]);
    regPC[0] += 2;
    return 12;
  },

  LDHLmm() {
    var i = MMU.rw(regPC[0]);
    regPC[0] += 2;
    regHL[0] = MMU.rw(i);
    return 20;
  },
  LDmmHL() {
    var i = MMU.rw(regPC[0]);
    regPC[0] += 2;
    MMU.ww(i, regHL[0]);
    return 20;
  },

  // LD (mm), SP
  // Save SP to given address
  // 0x08
  LDmmSP() {
    var addr = MMU.rw(regPC[0]);
    regPC[0] += 2;
    MMU.ww(addr, regSP[0]);
    return 20;
  },

  // LDI (HL), A
  // Save A to address pointed to by HL, and increment HL
  LDHLIA() {
    MMU.wb(regHL[0], regA[0]);
    regHL[0]++;
    return 8;
  },

  // LDI A, HL
  LDAHLI() {
    regA[0] = MMU.rb(regHL[0]);
    regHL[0]++;
    return 8;
  },

  // LDD HL, A
  LDHLDA() {
    MMU.wb(regHL[0], regA[0]);
    regHL[0]--;
    return 8;
  },

  // LDD A, HL
  LDAHLD() {
    regA[0] = MMU.rb(regHL[0]);
    regHL[0]--;
    return 8;
  },

  LDAIOn() {
    regA[0] = MMU.rb(0xFF00 + MMU.rb(regPC[0]));
    regPC[0]++;
    return 12;
  },
  LDIOnA() {
    MMU.wb(0xFF00 + MMU.rb(regPC[0]), regA[0]);
    regPC[0]++;
    return 12;
  },
  LDAIOC() {
    regA[0] = MMU.rb(0xFF00 + regC[0]);
    return 8;
  },
  LDIOCA() {
    MMU.wb(0xFF00 + regC[0], regA[0]);
    return 8;
  },

  LDHLSPn() {
    var i = MMU.rb(regPC[0]);
    if (i > 0x7F) {
      i = -((~i + 1) & 0xFF);
    }
    regPC[0]++;
    i += regSP[0];
    regHL[0] = i;
    return 12;
  },

  // LD SP, HL
  // 0xF9
  LDSPHL() {
    regSP[0] = regHL[0];
    return 12;
  },

  /**
   * Swap nibbles in 8-bit register
   * @param Uint8Array register
   * @return int Clock ticks
   */
  swapNibbles(register) {
    var tr = regB[0];
    regB[0] = ((tr & 0xF) << 4) | ((tr & 0xF0) >> 4);
    regF[0] = regB[0] ? 0 : F_ZERO;
    return 4;
  },

  /**
   * Swap nibbles in memory
   * @return int Clock ticks
   */
  swapNibblesMem() {
    var i = MMU.rb(regHL[0]);
    i = ((i & 0xF) << 4) | ((i & 0xF0) >> 4);
    MMU.wb(HL[0], i);
    // Best guess
    return 8;
  },

  /*--- Data processing ---*/
  /**
   * Add register to accumulator
   * @param Uint8Array register
   * @return int Clock ticks
   */
  addReg(register) {
    var a = regA[0];
    regA[0] += register[0];
    // TODO: make sure all these '< a' checks actually make sense..
    regF[0] = ((regA[0] < a) ? 0x10 : 0) | (regA[0] ? 0 : F_ZERO);
    if ((regA[0] ^ register[0] ^ a) & 0x10) regF[0] |= F_HCARRY;
    return 4;
  },

  // ADD A, (HL)
  // Add value pointed to by HL to A
  // 0x86
  ADDHL() {
    var a = regA[0];
    var m = MMU.rb(regHL[0]);
    regA[0] += m;
    regF[0] = (regA[0] < a) ? F_CARRY : 0;
    if (!regA[0]) regF[0] |= F_ZERO;
    if ((regA[0] ^ a ^ m) & 0x10) regF[0] |= F_HCARRY;
    return 8;
  },
  ADDn() {
    var a = regA[0];
    var m = MMU.rb(regPC[0]);
    regA[0] += m;
    regPC[0]++;
    regF[0] = (regA[0] < a) ? F_CARRY : 0;
    if (!regA[0]) regF[0] |= F_ZERO;
    if ((regA[0] ^ a ^ m) & 0x10) regF[0] |= F_HCARRY;
    return 8;
  },

  /**
  * Add a 16-bit to HL
  * ADD HL, BC
  * @param Uint16Array register
  * @return int Clock ticks
  */
  addHLReg(register) {
    var sum = regHL[0] + register[0];
    var flags = 0;
    if ((regHL[0] & 0xFFF) > (sum & 0xFFF)) {
      flags += F_HCARRY;
    }
    if (sum > 0xFFFF) {
      flags += F_CARRY;
    }
    regF[0] = (regF[0] & F_OP) + flags;
    regHL[0] = sum;
    return 12;
  },

  // ADD SP, n
  // 0xE8
  ADDSPn() {
    var i = MMU.rb(regPC[0]);
    if (i > 0x7F) {
      i = -((~i + 1) & 0xFF);
    }
    regPC[0]++;
    regSP[0] += i;
    return 16;
  },

  /**
   * Add with carry
   * ADC A, n
   * @param Uint8Array register
   * @return int Clock ticks
   */
  adcReg(register) {
    var a = regA[0];
    regA[0] += register[0];
    regA[0] += (regF[0] & F_CARRY) ? 1 : 0;
    regF[0] = ((regA[0] < a) ? F_CARRY : 0) | (regA[0] ? 0 : F_ZERO);
    if ((regA[0] ^ register[0] ^ a) & 0x10) regF[0] |= F_HCARRY;
    return 4;
  },

  ADCHL() {
    var a = regA[0];
    var m = MMU.rb(regHL[0]);
    regA[0] += m + ((regF[0] & F_CARRY) ? 1 : 0);
    regF[0] = ((regA[0] < a) ? F_CARRY : 0) | (regA[0] ? 0 : F_ZERO);
    if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= F_HCARRY;
    return 8;
  },

  // ADC A, n
  // Add 8-bit immediate and carry to A
  // 0xCE
  ADCn() {
    var a = regA[0];
    var m = MMU.rb(regPC[0]);
    a += m + ((regF[0] & F_CARRY) ? 1 : 0);
    regPC[0]++;
    regA[0] = a;
    regF[0] = ((a > 0xFF) ? F_CARRY : 0) | (regA[0] ? 0 : F_ZERO);
    if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= F_HCARRY;
    return 8;
  },

  /**
   * Subtract register from accumulator, e.g. SUB A, B
   * @param Uint8Array register The register to load
   * @return int The clock ticks
   */
  subReg(register) {
    var a = regA[0];
    a -= register[0];
    regA[0] = a;
    // All flags are updated
    regF[0] = F_OP | ((a < 0) ? F_CARRY : 0) | (regA[0] ? 0 : F_ZERO);
    if ((regA[0] ^ register[0] ^ a) & 0x10) {
      regF[0] |= F_HCARRY;
    }
    return 1
  },

  SUBHL() {
    var a = regA[0];
    var m = MMU.rb(regHL[0]);
    a -= m;
    regA[0] = a
    regF[0] = F_OP | ((a < 0) ? F_CARRY : 0) | (regA[0] ? 0 : F_ZERO);
    if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= F_HCARRY;
    return 8;
  },

  // Subtract 8-bit immediate from A
  // 0xD6
  SUBn() {
    var a = regA[0];
    var m = MMU.rb(regPC[0]);
    a -= m;
    regPC[0]++;
    regA[0] = a;
    regF[0] = F_OP | ((a < 0) ? F_CARRY : 0) | (regA[0] ? 0 : F_ZERO);
    if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= F_HCARRY;
    return 8;
  },

  /**
   * Subtract and carry register from A
   * @param Uint8Array register
   * @return int Clock ticks
   */
  subcReg(register) {
    var sum = regA[0] - register[0] - ((regF[0] & F_CARRY) ? 1 : 0);
    regA[0] = sum;
    var flags = F_OP | (regA[0] ? 0 : F_ZERO) | ((sum < 0) ? F_CARRY : 0);
    if ((regA[0] ^ register[0] ^ sum) & 0x10) regF[0] |= F_HCARRY;
    return 4;
  },

  SBCHL() {
    var a = regA[0];
    var m = MMU.rb(regHL[0]);
    a -= m - ((regF[0] & F_CARRY) ? 1 : 0);
    regA[0] = a;
    regF[0] = F_OP | ((a < 0) ? F_CARRY : 0) | (regA[0] ? 0 : F_ZERO);
    if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= F_HCARRY;
    return 8;
  },

  SBCn() {
    var a = regA[0];
    var m = MMU.rb(regPC[0]);
    a -= m - ((regF[0] & F_CARRY) ? 1 : 0);
    regA[0] = a;
    regF[0] = F_OP | ((a < 0) ? F_CARRY : 0) | (regA[0] ? 0 : F_ZERO);
    if ((regA[0] ^ m ^ a) & 0x10) regF[0] |= F_HCARRY;
    regPC[0]++;
    return 8;
  },

  /**
   * Compare 8-bit against accumulator
   * @param Uint8Array register
   * @return int Clock ticks
   */
  cpReg(register) {
    var i = regA[0];
    i -= register[0];
    // TODO: does this need an op flag?
    regF[0] = F_OP | ((i < 0) ? F_CARRY : 0);
    i &= 255;
    if (!i) regF[0] |= F_ZERO;
    if ((regA[0] ^ register[0] ^ i) & 0x10) regF[0] |= F_HCARRY;
    return 4;
  },
  CPHL() {
    var i = regA[0];
    var m = MMU.rb(regHL[0]);
    i -= m;
    // TODO: check F_OP
    regF[0] = F_OP | ((i < 0) ? F_CARRY : 0);
    i &= 0xFF;
    if (!i) regF[0] |= F_ZERO;
    if ((regA[0] ^ i ^ m) & 0x10) regF[0] |= F_HCARRY;
    return 8;
  },
  CPn() {
    var i = regA[0];
    var m = MMU.rb(regPC[0]);
    i -= m;
    regPC[0]++;
    regF[0] = F_OP | ((i < 0) ? F_CARRY : 0);
    i &= 0xFF;
    if (!i) regF[0] |= F_ZERO;
    if ((regA[0] ^ i ^ m) & 0x10) regF[0] |= F_HCARRY;
    return 8;
  },

  // DAA
  // 0x27
  DAA() {
    if (!(regF[0] & F_OP)) {
      if ((regF[0] & F_CARRY) || regA[0] > 0x99) {
        regA[0] = regA[0] + 0x60
        regF[0] |= F_CARRY;
      }
      if ((regF[0] & F_HCARRY) || (regA[0] & 0xF) > 0x9) {
        regA[0] = regA[0] + 0x06
        regF[0] &= ~F_HCARRY;
      }
    }
    else if ((regF[0] & (F_HCARRY | F_CARRY)) === (F_HCARRY | F_CARRY)) {
      regA[0] = regA[0] + 0x9A;
      regF[0] &= ~F_HCARRY;
    }
    else if ((regF[0] & F_CARRY)) {
      regA[0] = regA[0] + 0xA0
    }
    else if (regF[0] & F_HCARRY) {
      regA[0] = regA[0] + 0xFA;
      regF[0] &= ~F_HCARRY;
    }

    if (regA[0] === 0) {
      regF[0] |= F_ZERO;
    } else {
      regF[0] &= ~F_ZERO;
    }
    return 16;
  },

  /**
   * Logic and a register with accumulator
   * @param Uint8Array register Register to AND
   * @return int Clock ticks
   */
  andReg(register) {
    regA[0] &= register[0];
    regF[0] = regA[0] ? 0 : F_ZERO;
    return 4;
  },

  ANDHL() {
    regA[0] &= MMU.rb(regHL[0]);
    regF[0] = regA[0] ? 0 : F_ZERO;
    return 8;
  },

  // AND n
  // 0xE6
  ANDn() {
    regA[0] &= MMU.rb(regPC[0]);
    regPC[0]++;
    regF[0] = (regA[0] ? 0 : F_ZERO) | F_HCARRY;
    return 8;
  },

  /**
   * Logic or a register with accumulator
   * @param Uint8Array register
   * @return int Clock ticks
   */
  orReg(register) {
    regA[0] |= register[0];
    regF[0] = regA[0] ? 0 : F_ZERO;
    return 4;
  },

  ORHL() {
    regA[0] |= MMU.rb(regHL[0]);
    regF[0] = regA[0] ? 0 : F_ZERO;
    return 8;
  },
  ORn() {
    regA[0] |= MMU.rb(regPC[0]);
    regPC[0]++;
    regF[0] = regA[0] ? 0 : 0x80;
    return 8;
  },

  /**
   * Logic xor a register with accumulator
   * @param Uint8Array register
   * @return int Clock ticks
   */
  xorReg(register) {
    regA[0] ^= register[0];
    regF[0] = regA[0] ? 0 : F_ZERO;
    return 4;
  },

  XORHL() {
    regA[0] ^= MMU.rb(regHL[0]);
    regF[0] = regA[0] ? 0 : F_ZERO;
    return 8;
  },

  XORn() {
    regA[0] ^= MMU.rb(regPC[0]);
    regPC[0]++;
    regF[0] = regA[0] ? 0 : F_ZERO;
    return 8;
  },

  /**
   * Increment 8-bit register
   * @param Uint8Array register
   * @return int Clock ticks
   */
  incReg(register) {
    register[0]++;
    regF[0] = register[0] ? 0 : F_ZERO;
    return 4;
  },

  INCHLm() {
    var i = MMU.rb(regHL[0]) + 1;
    i &= 0xFF;
    MMU.wb(regHL[0], i);
    regF[0] = i ? 0 : F_ZERO;
    return 12;
  },

  /**
   * Decrement an 8-bit register
   * DEC B
   * @param Uint8Array register
   * @return int Clock ticks
   */
  decReg(register) {
    register[0]--;
    // Set the zero flag if 0, half-carry if decremented to 0b00001111, and
    // the subtract flag to true
    regF[0] = (register[0] ? 0 : F_ZERO) |
      (((register[0] & 0xF) === 0xF) ? F_HCARRY : 0) |
      F_OP;
    return 4;
  },

  DECHLm() {
    var i = MMU.rb(regHL[0]) - 1;
    i &= 0xFF;
    MMU.wb(regHL[0], i);
    regF[0] = i ? 0 : F_ZERO;
    return 12;
  },

  /**
   * Increment a 16-bit register
   * Needs a separate instruction as F is untouched on 16-bit
   * INC DE
   * @param Uint16Array register
   * @return int Clock ticks
   */
  incReg16(register) {
    register[0]++;
    return 4;
  },

  /**
   * Decrement a 16-bit register
   * Needs a separate instruction as F is untouched on 16-bit
   * DEC BC
   * @param Uint16Array register
   * @return int Clock ticks
   */
  decReg16(register) {
    register[0]--;
    return 4;
  },

  /*--- Bit manipulation ---*/
  /**
   * Set a register of a bitmask
   * Generalizes all the "SET 2, C" etc. instructions
   * @param int bitmask The bitmask to set
   * @param Uint8Array register The register to mask
   * @return int Clock ticks
   */
  setReg(bitmask, register) {
    register[0] |= bitmask;
    return 8;
  },

 /**
   * Set a mem address of a bitmask
   * Generalizes all the "SET 2, (HL)" etc. instructions
   * @param int bitmask The bitmask to set
   * @return int Clock ticks
   */
  setMem(bitmask) {
    var i = MMU.rb(regHL[0]);
    i |= bitmask;
    MMU.wb(regHL[0], i);
    return 16;
  },

  /**
   * Test a bit of a register
   * @param int bitmask The bit to test
   * @param Uint8Array register The register to test
   * @return int Clock ticks
   */
  bitReg(bitmask, register) {
    regF[0] &= 0x1F;
    regF[0] |= 0x20;
    regF[0] = (register[0] & bitmask) ? 0 : 0x80;
    return 8;
  },

  /**
   * Test a bit against memory
   * @param int bitmask
   * @return int Clock ticks
   */
  bitMem(bitmask) {
    regF[0] &= 0x1F;
    regF[0] |= 0x20;
    regF[0] = (MMU.rb(regHL[0]) & bitmask) ? 0 : 0x80;
    return 12;
  },

  /**
   * Reset (clear) the bit of a register
   * @param int bitmask
   * @param Uint8Array register
   * @return int Clock ticks
   */
  resReg(bitmask, register) {
    register[0] &= ~bitmask;
    return 8;
  },

  /**
   * Reset (clear) the bit of memory
   * @param int bitmask
   * @return int Clock ticks
   */
  resMem(bitmask) {
    var i = MMU.rb(regHL[0]);
    i &= ~bitmask;
    MMU.wb(regHL[0], i);
    return 16;
  },

  RLA() {
    var ci = regF[0] & F_CARRY ? 1 : 0;
    var co = regA[0] & 0x80 ? F_CARRY : 0;
    regA[0] = (regA[0] << 1) + ci;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 4;
  },
  RLCA() {
    var ci = regA[0] & 0x80 ? 1 : 0;
    var co = regA[0] & 0x80 ? F_CARRY : 0;
    regA[0] = (regA[0] << 1) + ci;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 4;
  },
  RRA() {
    var ci = regF[0] & F_CARRY ? 0x80 : 0;
    var co = regA[0] & 1 ? F_CARRY : 0;
    regA[0] = (regA[0] >> 1) + ci;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 4;
  },
  RRCA() {
    var ci = regA[0] & 1 ? 0x80 : 0;
    var co = regA[0] & 1 ? F_CARRY : 0;
    regA[0] = (regA[0] >> 1) + ci;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 4;
  },

  /**
   * Rotate left
   * @param Uint8Array register
   * @return int Clock ticks
   */
  rlReg(register) {
    var ci = regF[0] & F_CARRY ? 1 : 0;
    var co = register[0] & 0x80 ? 0x10 : 0;
    register[0] = (register[0] << 1) + ci;
    regF[0] = (register[0]) ? 0 : F_ZERO;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 8;
  },

  RLHL() {
    var i = MMU.rb(regHL[0]);
    var ci = regF[0] & F_CARRY ? 1 : 0;
    var co = i & 0x80 ? 0x10 : 0;
    i = (i << 1) + ci;
    i &= 0xFF;
    regF[0] = (i) ? 0 : F_ZERO;
    MMU.wb(regHL[0], i);
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 16;
  },

  /**
   * Rotate with left carry register
   * @param Uint8Array register
   * @return int Clock ticks
   */
  rlcReg(register) {
    var ci = register[0] & 0x80 ? 1 : 0;
    var co = register[0] & 0x80 ? F_CARRY : 0;
    register[0] = (register[0] << 1) + ci;
    regF[0] = (register[0]) ? 0 : F_ZERO;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 8;
  },

  /**
   * Rotate memory left with carry register
   * @return int Clock ticks
   */
  RLCHL() {
    var i = MMU.rb(regHL[0]);
    var ci = i & 0x80 ? 1 : 0;
    var co = i & 0x80 ? F_CARRY : 0;
    i = (i << 1) + ci;
    i &= 0xFF;
    regF[0] = (i) ? 0 : F_ZERO;
    MMU.wb(regHL[0], i);
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 16;
  },

  /**
   * Rotate right
   * @param Uint8Array register
   * @return int Clock ticks
   */
  rrReg(register) {
    var ci = regF[0] & 0x10 ? 0x80 : 0;
    var co = register[0] & 1 ? 0x10 : 0;
    register[0] = (register[0] >> 1) + ci;
    regF[0] = (register[0]) ? 0 : 0x80;
    regF[0] = (regF[0] & 0xEF) + co;
    return 8;
  },

  RRHL() {
    var i = MMU.rb(regHL[0]);
    var ci = regF[0] & F_CARRY ? 0x80 : 0;
    var co = i & 1 ? F_CARRY : 0;
    i = (i >> 1) + ci;
    i &= 0xFF;
    MMU.wb(regHL[0], i);
    regF[0] = (i) ? 0 : F_ZERO;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 16;
  },

  /**
   * Rotate right with carry
   * @param Uint8Array register
   * @return int Clock ticks
   */
  rrcReg(register) {
    var ci = register[0] & 1 ? 0x80 : 0;
    var co = register[0] & 1 ? F_CARRY : 0;
    register[0] = (register[0] >> 1) + ci;
    regF[0] = (register[0]) ? 0 : F_ZERO;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 8;
  },

  RRCHL() {
    var i = MMU.rb(regHL[0]);
    var ci = i & 1 ? 0x80 : 0;
    var co = i & 1 ? F_CARRY : 0;
    i = (i >> 1) + ci;
    i &= 0xFF;
    MMU.wb(regHL[0], i);
    regF[0] = (i) ? 0 : F_ZERO;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 16;
  },

  /**
   * Shift left preserving sign
   * @param Uint8Array register
   * @return int Clock ticks
   */
  slaReg(register) {
    var co = register[0] & 0x80 ? F_CARRY : 0;
    register[0] <<= 1;
    regF[0] = register[0] ? 0 : F_ZERO;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 8;
  },

  /**
   * Shift value in memory left, preserving sign
   * SLA (HL)
   * @return int Clock ticks
   */
  slaMem() {
    // Get val in memory
    var i = MMU.rb(regHL[0]);
    // If top bit set, then we're carrying
    var carry = i & 0x80 ? F_CARRY : 0;
    i <<= 1;
    regF[0] = i ? 0 : F_ZERO;
    regF[0] = (regF[0] & ~F_CARRY) + carry;
    // Best guess to the clock cycles
    return 16;
  },

  /**
   * Shift right preserving sign
   * @param Uint8Array register
   * @return int Clock ticks
   */
  sraReg(register) {
    var ci = register[0] & 0x80;
    var co = register[0] & 1 ? F_CARRY : 0;
    register[0] = (register[0] >> 1) + ci;
    regF[0] = (register[0]) ? 0 : F_ZERO;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 8;
  },

  /**
   * Shift value in memory right, preserving sign
   * SRA (HL)
   * @return int Clock ticks
   */
  sraMem() {
    // Get val in memory
    var i = MMU.rb(regHL[0]);
    // If bottom bit set, then we're carrying
    var carry = i & 0x01 ? F_CARRY : 0;
    // Shift right
    i >>= 1;
    regF[0] = (i ? 0 : F_ZERO) | carry;
    //TODO Best guess to the clock cycles
    return 16;
  },

  /**
   * Shift right
   * @param Uint8Array register
   * @return int Clock ticks
   */
  srlReg(register) {
    var co = register[0] & 1 ? F_CARRY : 0;
    register[0] = register[0] >> 1;
    regF[0] = (register[0]) ? 0 : F_ZERO;
    regF[0] = (regF[0] & ~F_CARRY) + co;
    return 2
  },

  /**
   * Shift value in memory right
   * @return int Clock ticks
   */
  srlMem() {
    var i = MMU.rb(regHL[0]);
    var carry = (i & 0x01) ? F_CARRY : 0;
    i >>= 1;
    regF[0] = ((register[0]) ? 0 : F_ZERO) | carry;
    return 16
  },

  CPL() {
    regA[0] ^= 0xFF;
    regF[0] = regA[0] ? 0 : F_ZERO;
    return 4;
  },
  NEG() {
    regA[0] = 0 - regA[0];
    regF[0] = (regA[0] < 0) ? F_CARRY : 0;
    if (!regA[0]) regF[0] |= F_ZERO;
    return 8;
  },

  CCF() {
    var ci = regF[0] & 0x10 ? 0 : F_CARRY;
    regF[0] = (regF[0] & ~F_CARRY) + ci;
    return 4;
  },
  SCF() {
    regF[0] |= F_CARRY;
    return 4;
  },

  /*--- Stack ---*/
  PUSHBC() {
    regSP[0]--;
    MMU.wb(regSP[0], regB[0]);
    regSP[0]--;
    MMU.wb(regSP[0], regC[0]);
    return 12;
  },
  PUSHDE() {
    regSP[0]--;
    MMU.wb(regSP[0], regD[0]);
    regSP[0]--;
    MMU.wb(regSP[0], regE[0]);
    return 12;
  },
  PUSHHL() {
    // TODO: check if this can use MMU.ww()
    regSP[0]--;
    MMU.wb(regSP[0], regH[0]);
    regSP[0]--;
    MMU.wb(regSP[0], regL[0]);
    return 12;
  },
  PUSHAF() {
    regSP[0]--;
    MMU.wb(regSP[0], regA[0]);
    regSP[0]--;
    MMU.wb(regSP[0], regF[0]);
    return 12;
  },

  POPBC() {
    regC[0] = MMU.rb(regSP[0]);
    regSP[0]++;
    regB[0] = MMU.rb(regSP[0]);
    regSP[0]++;
    return 12;
  },
  POPDE() {
    regE[0] = MMU.rb(regSP[0]);
    regSP[0]++;
    regD[0] = MMU.rb(regSP[0]);
    regSP[0]++;
    return 12;
  },
  POPHL() {
    // TODO check if this can use MMU.rw()
    regL[0] = MMU.rb(regSP[0]);
    regSP[0]++;
    regH[0] = MMU.rb(regSP[0]);
    regSP[0]++;
    return 12;
  },

  // POP AF
  // 0xF1
  POPAF() {
    // Flags register keeps bottom 4 bits clear
    regF[0] = MMU.rb(regSP[0]) & 0xF0;
    regSP[0]++;
    regA[0] = MMU.rb(regSP[0]);
    regSP[0]++;
    return 12;
  },

  /*--- Jump ---*/
  JPnn() {
    regPC[0] = MMU.rw(regPC[0]);
    return 12;
  },
  JPHL() {
    regPC[0] = regHL[0];
    return 4;
  },
  JPNZnn() {
    if ((regF[0] & F_ZERO) === 0x00) {
      regPC[0] = MMU.rw(regPC[0]);
      return 16;
    } else {
      regPC[0] += 2;
      return 12;
    }
  },
  JPZnn() {
    if ((regF[0] & F_ZERO) === F_ZERO) {
      regPC[0] = MMU.rw(regPC[0]);
      return 16;
    } else {
      regPC[0] += 2;
      return 12;
    }
  },
  JPNCnn() {
    if ((regF[0] & F_CARRY) === 0) {
      regPC[0] = MMU.rw(regPC[0]);
      return 16;
    } else {
      regPC[0] += 2;
      return 12;
    }
  },
  JPCnn() {
    if ((regF[0] & F_CARRY) !== 0) {
      regPC[0] = MMU.rw(regPC[0]);
      return 16;
    } else {
      regPC[0] += 2;
      return 12;
    }
  },

  JRn() {
    var i = MMU.rb(regPC[0]);
    if (i > 0x7F) {
      i = -((~i + 1) & 0xFF);
    }
    regPC[0] += i + 1;
    return 12;
  },
  JRNZn() {
    var i = MMU.rb(regPC[0]);
    if (i > 0x7F) i = -((~i + 1) & 0xFF);
    regPC[0]++;
    if ((regF[0] & F_ZERO) === 0x00) {
      regPC[0] += i;
      return 12;
    } else {
      return 8;
    }
  },
  JRZn() {
    var i = MMU.rb(regPC[0]);
    if (i > 0x7F) i = -((~i + 1) & 0xFF);
    regPC[0]++;
    if (regF[0] & F_ZERO) {
      regPC[0] += i;
      return 12;
    } else {
      return 8;
    }
  },
  JRNCn() {
    var i = MMU.rb(regPC[0]);
    if (i > 0x7F) i = -((~i + 1) & 0xFF);
    regPC[0]++;
    if ((regF[0] & F_CARRY) === 0) {
      regPC[0] += i;
      return 12;
    } else {
      return 8;
    }
  },
  JRCn() {
    var i = MMU.rb(regPC[0]);
    if (i > 0x7F) i = -((~i + 1) & 0xFF);
    regPC[0]++;
    if (regF[0] & F_CARRY) {
      regPC[0] += i;
      return 12;
    } else {
      return 8;
    }
  },

  /**
   * Stops processor and screen until button press
   * Its instruction is different than z80, which gives 0x10 as DJNZ (decrements
   * B and skips next instruction if B is zero).
   * STOP
   * @return int Clock ticks
   */
  stop() {
    // TODO: set a 'stop' mode, that waits for a button press
    // TODO: check if this instruction's overloaded to also change the CPU clock
    // speed on GBC
    return 0;
  },

  CALLnn() {
    regSP[0] -= 2;
    MMU.ww(regSP[0], regPC[0] + 2);
    regPC[0] = MMU.rw(regPC[0]);
    return 20;
  },

  CALLNZnn() {
    if ((regF[0] & F_ZERO) === 0x00) {
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0] + 2);
      regPC[0] = MMU.rw(regPC[0]);
      return 20;
    } else {
      regPC[0] += 2;
      return 12;
    }
  },

  CALLNCnn() {
    if ((regF[0] & F_CARRY) === 0x00) {
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0] + 2);
      regPC[0] = MMU.rw(regPC[0]);
      return 20;
    } else {
      regPC[0] += 2;
      return 12;
    }
  },

  CALLCnn() {
    if ((regF[0] & 0x10) == 0x10) {
      regSP[0] -= 2;
      MMU.ww(regSP[0], regPC[0] + 2);
      regPC[0] = MMU.rw(regPC[0]);
      return 20;
    } else {
      regPC[0] += 2;
      return 12;
    }
  },

  RET() {
    regPC[0] = MMU.rw(regSP[0]);
    regSP[0] += 2;
    return 12;
  },
  RETI() {
    interruptsEnabled = true;
    _ops.rrs();
    regPC[0] = MMU.rw(regSP[0]);
    regSP[0] += 2;
    return 12;
  },
  RETNZ() {
    if ((regF[0] & F_ZERO) == 0x00) {
      regPC[0] = MMU.rw(regSP[0]);
      regSP[0] += 2;
      return 12;
    } else {
      return 4;
    }
  },
  RETZ() {
    if (regF[0] & F_ZERO) {
      regPC[0] = MMU.rw(regSP[0]);
      regSP[0] += 2;
      return 12;
    } else {
      return 4;
    }
  },
  RETNC() {
    if ((regF[0] & F_CARRY) == 0x00) {
      regPC[0] = MMU.rw(regSP[0]);
      regSP[0] += 2;
      return 12;
    } else {
      return 4;
    }
  },
  RETC() {
    if ((regF[0] & F_CARRY) == 0x10) {
      regPC[0] = MMU.rw(regSP[0]);
      regSP[0] += 2;
      return 12;
    } else {
      return 4;
    }
  },

  /**
   * Call routine set at address
   * @param int addr Address of routine to run
   * @return int Clock ticks
   */
  rst(addr) {
    _ops.rsv();
    regSP[0] -= 2;
    MMU.ww(regSP[0], regPC[0]);
    regPC[0] = addr;
    return 12;
  },

  NOP() {
    return 4;
  },

  HALT() {
    if (interruptsEnabled) {
      Z80._halt = true;
    }
    return 4;
  },

  DI() {
    interruptsEnabled = false;
    return 4;
  },

  // EI
  // Enable Interrupts
  // 0xFB
  EI() {
    interruptsEnabled = true;
    return 4;
  },

  /*--- Helper functions ---*/
  rsv() {
    // TODO: save registers
  },

  rrs() {
    // TODO restore registers
  },

  MAPcb() {
    var i = MMU.rb(regPC[0]);
    regPC[0]++;
    if (_cbmap[i]) {
      return _cbmap[i]();
    } else {
      console.log(i);
      return 0;
    }
  },

  XX(instruction) {
    /*Undefined map entry*/
    var opc = regPC[0] - 1;
    LOG.out('Z80', 'Unimplemented instruction ' + instruction + ' at $' + opc.toString(16) + ', stopping.');
    Z80._stop = 1;
  }
};

const _map = [
  // 00
  _ops.NOP, _ops.LDBCnn, _ops.LDBCmA, _ops.incReg16.bind(null, regBC),
  _ops.incReg.bind(null, regB), _ops.decReg.bind(null, regB), _ops.ldRegVal.bind(null, regB), _ops.RLCA,
  _ops.LDmmSP, _ops.addHLReg.bind(null, regBC), _ops.LDABCm, _ops.decReg16.bind(null, regBC),
  _ops.incReg.bind(null, regC), _ops.decReg.bind(null, regC), _ops.ldRegVal.bind(null, regC), _ops.RRCA,
  // 10
  _ops.stop, _ops.LDDEnn, _ops.LDDEmA, _ops.incReg16.bind(null, regDE),
  _ops.incReg.bind(null, regD), _ops.decReg.bind(null, regD), _ops.ldRegVal.bind(null, regD), _ops.RLA,
  _ops.JRn, _ops.addHLReg.bind(null, regDE), _ops.LDADEm, _ops.decReg16.bind(null, regDE),
  _ops.incReg.bind(null, regE), _ops.decReg.bind(null, regE), _ops.ldRegVal.bind(null, regE), _ops.RRA,
  // 20
  _ops.JRNZn, _ops.LDHLnn, _ops.LDHLIA, _ops.incReg16.bind(null, regHL),
  _ops.incReg.bind(null, regH), _ops.decReg.bind(null, regH), _ops.ldRegVal.bind(null, regH), _ops.DAA,
  _ops.JRZn, _ops.addHLReg.bind(null, regHL), _ops.LDAHLI, _ops.decReg16.bind(null, regHL),
  _ops.incReg.bind(null, regL), _ops.decReg.bind(null, regL), _ops.ldRegVal.bind(null, regL), _ops.CPL,
  // 30
  _ops.JRNCn, _ops.LDSPnn, _ops.LDHLDA, _ops.incReg16.bind(null, regSP),
  _ops.INCHLm, _ops.DECHLm, _ops.LDHLmn, _ops.SCF,
  _ops.JRCn, _ops.addHLReg.bind(null, regSP), _ops.LDAHLD, _ops.decReg16.bind(null, regSP),
  _ops.incReg.bind(null, regA), _ops.decReg.bind(null, regA), _ops.ldRegVal.bind(null, regA), _ops.CCF,
  // 40
  _ops.ldReg.bind(null, regB, regB), _ops.ldReg.bind(null, regB, regC), _ops.ldReg.bind(null, regB, regD), _ops.ldReg.bind(null, regB, regE),
  _ops.ldReg.bind(null, regB, regH), _ops.ldReg.bind(null, regB, regL), _ops.ldRegMem.bind(null, regB), _ops.ldReg.bind(null, regB, regA),
  _ops.ldReg.bind(null, regC, regB), _ops.ldReg.bind(null, regC, regC), _ops.ldReg.bind(null, regC, regD), _ops.ldReg.bind(null, regC, regE),
  _ops.ldReg.bind(null, regC, regH), _ops.ldReg.bind(null, regC, regL), _ops.ldRegMem.bind(null, regC), _ops.ldReg.bind(null, regC, regA),
  // 50
  _ops.ldReg.bind(null, regD, regB), _ops.ldReg.bind(null, regD, regC), _ops.ldReg.bind(null, regD, regD), _ops.ldReg.bind(null, regD, regE),
  _ops.ldReg.bind(null, regD, regH), _ops.ldReg.bind(null, regD, regL), _ops.ldRegMem.bind(null, regD), _ops.ldReg.bind(null, regD, regA),
  _ops.ldReg.bind(null, regE, regB), _ops.ldReg.bind(null, regE, regC), _ops.ldReg.bind(null, regE, regD), _ops.ldReg.bind(null, regE, regE),
  _ops.ldReg.bind(null, regE, regH), _ops.ldReg.bind(null, regE, regL), _ops.ldRegMem.bind(null, regE), _ops.ldReg.bind(null, regE, regA),
  // 60
  _ops.ldReg.bind(null, regH, regB), _ops.ldReg.bind(null, regH, regC), _ops.ldReg.bind(null, regH, regD), _ops.ldReg.bind(null, regH, regE),
  _ops.ldReg.bind(null, regH, regH), _ops.ldReg.bind(null, regH, regL), _ops.ldRegMem.bind(null, regH), _ops.ldReg.bind(null, regH, regA),
  _ops.ldReg.bind(null, regL, regB), _ops.ldReg.bind(null, regL, regC), _ops.ldReg.bind(null, regL, regD), _ops.ldReg.bind(null, regL, regE),
  _ops.ldReg.bind(null, regL, regH), _ops.ldReg.bind(null, regL, regL), _ops.ldRegMem.bind(null, regL), _ops.ldReg.bind(null, regL, regA),
  // 70
  _ops.ldMemReg.bind(null, regB), _ops.ldMemReg.bind(null, regC), _ops.ldMemReg.bind(null, regD), _ops.ldMemReg.bind(null, regE),
  _ops.ldMemReg.bind(null, regH), _ops.ldMemReg.bind(null, regL), _ops.HALT, _ops.ldMemReg.bind(null, regA),
  _ops.ldReg.bind(null, regA, regB), _ops.ldReg.bind(null, regA, regC), _ops.ldReg.bind(null, regA, regD), _ops.ldReg.bind(null, regA, regE),
  _ops.ldReg.bind(null, regA, regH), _ops.ldReg.bind(null, regA, regL), _ops.ldRegMem.bind(null, regA), _ops.ldReg.bind(null, regA, regA),
  // 80
  _ops.addReg.bind(null, regB), _ops.addReg.bind(null, regC), _ops.addReg.bind(null, regD), _ops.addReg.bind(null, regE),
  _ops.addReg.bind(null, regH), _ops.addReg.bind(null, regL), _ops.ADDHL, _ops.addReg.bind(null, regA), //FIXME: optimize with << 1
  _ops.adcReg.bind(null, regB), _ops.adcReg.bind(null, regC), _ops.adcReg.bind(null, regD), _ops.adcReg.bind(null, regE),
  _ops.adcReg.bind(null, regH), _ops.adcReg.bind(null, regL), _ops.ADCHL, _ops.adcReg.bind(null, regA),
  // 90
  _ops.subReg.bind(null, regB), _ops.subReg.bind(null, regC), _ops.subReg.bind(null, regD), _ops.subReg.bind(null, regE),
  _ops.subReg.bind(null, regH), _ops.subReg.bind(null, regL), _ops.SUBHL, _ops.subReg.bind(null, regA), // FIXME: SUB A, A could be optimized as a NOP
  _ops.subcReg.bind(null, regB), _ops.subcReg.bind(null, regC), _ops.subcReg.bind(null, regD), _ops.subcReg.bind(null, regE),
  _ops.subcReg.bind(null, regH), _ops.subcReg.bind(null, regL), _ops.SBCHL, _ops.subcReg.bind(null, regA),
  // A0
  _ops.andReg.bind(null, regB), _ops.andReg.bind(null, regC), _ops.andReg.bind(null, regD), _ops.andReg.bind(null, regE),
  _ops.andReg.bind(null, regH), _ops.andReg.bind(null, regL), _ops.ANDHL, _ops.andReg.bind(null, regA),
  _ops.xorReg.bind(null, regB), _ops.xorReg.bind(null, regC), _ops.xorReg.bind(null, regD), _ops.xorReg.bind(null, regE),
  _ops.xorReg.bind(null, regH), _ops.xorReg.bind(null, regL), _ops.XORHL, _ops.xorReg.bind(null, regA),
  // B0
  _ops.orReg.bind(null, regB), _ops.orReg.bind(null, regC), _ops.orReg.bind(null, regD), _ops.orReg.bind(null, regE),
  _ops.orReg.bind(null, regH), _ops.orReg.bind(null, regL), _ops.ORHL, _ops.orReg.bind(null, regA),
  _ops.cpReg.bind(null, regB), _ops.cpReg.bind(null, regC), _ops.cpReg.bind(null, regD), _ops.cpReg.bind(null, regE),
  _ops.cpReg.bind(null, regH), _ops.cpReg.bind(null, regL), _ops.CPHL, _ops.cpReg.bind(null, regA),
  // C0
  _ops.RETNZ, _ops.POPBC, _ops.JPNZnn, _ops.JPnn,
  _ops.CALLNZnn, _ops.PUSHBC, _ops.ADDn, _ops.rst.bind(null, 0x00),
  _ops.RETZ, _ops.RET, _ops.JPZnn, _ops.MAPcb,
  _ops.CALLZnn, _ops.CALLnn, _ops.ADCn, _ops.rst.bind(null, 0x08),
  // D0
  _ops.RETNC, _ops.POPDE, _ops.JPNCnn, _ops.XX.bind(null, 'D3'),
  _ops.CALLNCnn, _ops.PUSHDE, _ops.SUBn, _ops.rst.bind(null, 0x10),
  _ops.RETC, _ops.RETI, _ops.JPCnn, _ops.XX.bind(null, 'DB'),
  _ops.CALLCnn, _ops.XX.bind(null, 'DD'), _ops.SBCn, _ops.rst.bind(null, 0x18),
  // E0
  _ops.LDIOnA, _ops.POPHL, _ops.LDIOCA, _ops.XX.bind(null, 'E3'),
  _ops.XX.bind(null, 'E4'), _ops.PUSHHL, _ops.ANDn, _ops.rst.bind(null, 0x20),
  _ops.ADDSPn, _ops.JPHL, _ops.LDmmA, _ops.XX.bind(null, 'EB'),
  _ops.XX.bind(null, 'EC'), _ops.XX.bind(null, 'ED'), _ops.XORn, _ops.rst.bind(null, 0x28),
  // F0
  _ops.LDAIOn, _ops.POPAF, _ops.LDAIOC, _ops.DI,
  _ops.XX.bind(null, 'F4'), _ops.PUSHAF, _ops.ORn, _ops.rst.bind(null, 0x30),
  _ops.LDHLSPn, _ops.LDSPHL, _ops.LDAmm, _ops.EI,
  _ops.XX.bind(null, 'FC'), _ops.XX.bind(null, 'FD'), _ops.CPn, _ops.rst.bind(null, 0x38)
];

const _cbmap = [
  // CB00
  _ops.rlcReg.bind(null, regB), _ops.rlcReg.bind(null, regC), _ops.rlcReg.bind(null, regD), _ops.rlcReg.bind(null, regE),
  _ops.rlcReg.bind(null, regH), _ops.rlcReg.bind(null, regL), _ops.RLCHL, _ops.rlcReg.bind(null, regA),
  _ops.rrcReg.bind(null, regB), _ops.rrcReg.bind(null, regC), _ops.rrcReg.bind(null, regD), _ops.rrcReg.bind(null, regE),
  _ops.rrcReg.bind(null, regH), _ops.rrcReg.bind(null, regL), _ops.RRCHL, _ops.rrcReg.bind(null, regA),
  // CB10
  _ops.rlReg.bind(null, regB), _ops.rlReg.bind(null, regC), _ops.rlReg.bind(null, regD), _ops.rlReg.bind(null, regE),
  _ops.rlReg.bind(null, regH), _ops.rlReg.bind(null, regL), _ops.RLHL, _ops.rlReg.bind(null, regA),
  _ops.rrReg.bind(null, regB), _ops.rrReg.bind(null, regC), _ops.rrReg.bind(null, regD), _ops.rrReg.bind(null, regE),
  _ops.rrReg.bind(null, regH), _ops.rrReg.bind(null, regL), _ops.RRHL, _ops.rrReg.bind(null, regA),
  // CB20
  _ops.slaReg.bind(null, regB), _ops.slaReg.bind(null, regC), _ops.slaReg.bind(null, regD), _ops.slaReg.bind(null, regE),
  _ops.slaReg.bind(null, regH), _ops.slaReg.bind(null, regL), _ops.slaMem, _ops.slaReg.bind(null, regA),
  _ops.sraReg.bind(null, regB), _ops.sraReg.bind(null, regC), _ops.sraReg.bind(null, regD), _ops.sraReg.bind(null, regE),
  _ops.sraReg.bind(null, regH), _ops.sraReg.bind(null, regL), _ops.sraMem, _ops.sraReg.bind(null, regA),
  // CB30
  _ops.swapNibbles.bind(null, regB), _ops.swapNibbles.bind(null, regC), _ops.swapNibbles.bind(null, regD), _ops.swapNibbles.bind(null, regE),
  _ops.swapNibbles.bind(null, regH), _ops.swapNibbles.bind(null, regL), _ops.swapNibblesMem, _ops.swapNibbles.bind(null, regA),
  _ops.srlReg.bind(null, regB), _ops.srlReg.bind(null, regC), _ops.srlReg.bind(null, regD), _ops.srlReg.bind(null, regE),
  _ops.srlReg.bind(null, regH), _ops.srlReg.bind(null, regL), _ops.srlMem, _ops.srlReg.bind(null, regA),
  // CB40
  _ops.bitReg.bind(null, 0x01, regB), _ops.bitReg.bind(null, 0x01, regC), _ops.bitReg.bind(null, 0x01, regD), _ops.bitReg.bind(null, 0x01, regE),
  _ops.bitReg.bind(null, 0x01, regH), _ops.bitReg.bind(null, 0x01, regL), _ops.bitMem.bind(null, 0x01), _ops.bitReg.bind(null, 0x01, regA),
  _ops.bitReg.bind(null, 0x02, regB), _ops.bitReg.bind(null, 0x02, regC), _ops.bitReg.bind(null, 0x02, regD), _ops.bitReg.bind(null, 0x02, regE),
  _ops.bitReg.bind(null, 0x02, regH), _ops.bitReg.bind(null, 0x02, regL), _ops.bitMem.bind(null, 0x02), _ops.bitReg.bind(null, 0x02, regA),
  // CB50
  _ops.bitReg.bind(null, 0x04, regB), _ops.bitReg.bind(null, 0x04, regC), _ops.bitReg.bind(null, 0x04, regD), _ops.bitReg.bind(null, 0x04, regE),
  _ops.bitReg.bind(null, 0x04, regH), _ops.bitReg.bind(null, 0x04, regL), _ops.bitMem.bind(null, 0x04), _ops.bitReg.bind(null, 0x04, regA),
  _ops.bitReg.bind(null, 0x08, regB), _ops.bitReg.bind(null, 0x08, regC), _ops.bitReg.bind(null, 0x08, regD), _ops.bitReg.bind(null, 0x08, regE),
  _ops.bitReg.bind(null, 0x08, regH), _ops.bitReg.bind(null, 0x08, regL), _ops.bitMem.bind(null, 0x08), _ops.bitReg.bind(null, 0x08, regA),
  // CB60
  _ops.bitReg.bind(null, 0x10, regB), _ops.bitReg.bind(null, 0x10, regC), _ops.bitReg.bind(null, 0x10, regD), _ops.bitReg.bind(null, 0x10, regE),
  _ops.bitReg.bind(null, 0x10, regH), _ops.bitReg.bind(null, 0x10, regL), _ops.bitMem.bind(null, 0x10), _ops.bitReg.bind(null, 0x10, regA),
  _ops.bitReg.bind(null, 0x20, regB), _ops.bitReg.bind(null, 0x20, regC), _ops.bitReg.bind(null, 0x20, regD), _ops.bitReg.bind(null, 0x20, regE),
  _ops.bitReg.bind(null, 0x20, regH), _ops.bitReg.bind(null, 0x20, regL), _ops.bitMem.bind(null, 0x20), _ops.bitReg.bind(null, 0x20, regA),
  // CB70
  _ops.bitReg.bind(null, 0x40, regB), _ops.bitReg.bind(null, 0x40, regC), _ops.bitReg.bind(null, 0x40, regD), _ops.bitReg.bind(null, 0x40, regE),
  _ops.bitReg.bind(null, 0x40, regH), _ops.bitReg.bind(null, 0x40, regL), _ops.bitMem.bind(null, 0x40), _ops.bitReg.bind(null, 0x40, regA),
  _ops.bitReg.bind(null, 0x80, regB), _ops.bitReg.bind(null, 0x80, regC), _ops.bitReg.bind(null, 0x80, regD), _ops.bitReg.bind(null, 0x80, regE),
  _ops.bitReg.bind(null, 0x80, regH), _ops.bitReg.bind(null, 0x80, regL), _ops.bitMem.bind(null, 0x80), _ops.bitReg.bind(null, 0x80, regA),
  // CB80
  _ops.resReg.bind(null, 0x01, regB), _ops.resReg.bind(null, 0x01, regC), _ops.resReg.bind(null, 0x01, regD), _ops.resReg.bind(null, 0x01, regE),
  _ops.resReg.bind(null, 0x01, regH), _ops.resReg.bind(null, 0x01, regL), _ops.resMem.bind(null, 0x01), _ops.resReg.bind(null, 0x01, regA),
  _ops.resReg.bind(null, 0x02, regB), _ops.resReg.bind(null, 0x02, regC), _ops.resReg.bind(null, 0x02, regD), _ops.resReg.bind(null, 0x02, regE),
  _ops.resReg.bind(null, 0x02, regH), _ops.resReg.bind(null, 0x02, regL), _ops.resMem.bind(null, 0x02), _ops.resReg.bind(null, 0x02, regA),
  // CB90
  _ops.resReg.bind(null, 0x04, regB), _ops.resReg.bind(null, 0x04, regC), _ops.resReg.bind(null, 0x04, regD), _ops.resReg.bind(null, 0x04, regE),
  _ops.resReg.bind(null, 0x04, regH), _ops.resReg.bind(null, 0x04, regL), _ops.resMem.bind(null, 0x04), _ops.resReg.bind(null, 0x04, regA),
  _ops.resReg.bind(null, 0x08, regB), _ops.resReg.bind(null, 0x08, regC), _ops.resReg.bind(null, 0x08, regD), _ops.resReg.bind(null, 0x08, regE),
  _ops.resReg.bind(null, 0x08, regH), _ops.resReg.bind(null, 0x08, regL), _ops.resMem.bind(null, 0x08), _ops.resReg.bind(null, 0x08, regA),
  // CBA0
  _ops.resReg.bind(null, 0x10, regB), _ops.resReg.bind(null, 0x10, regC), _ops.resReg.bind(null, 0x10, regD), _ops.resReg.bind(null, 0x10, regE),
  _ops.resReg.bind(null, 0x10, regH), _ops.resReg.bind(null, 0x10, regL), _ops.resMem.bind(null, 0x10), _ops.resReg.bind(null, 0x10, regA),
  _ops.resReg.bind(null, 0x20, regB), _ops.resReg.bind(null, 0x20, regC), _ops.resReg.bind(null, 0x20, regD), _ops.resReg.bind(null, 0x20, regE),
  _ops.resReg.bind(null, 0x20, regH), _ops.resReg.bind(null, 0x20, regL), _ops.resMem.bind(null, 0x20), _ops.resReg.bind(null, 0x20, regA),
  // CBB0
  _ops.resReg.bind(null, 0x40, regB), _ops.resReg.bind(null, 0x40, regC), _ops.resReg.bind(null, 0x40, regD), _ops.resReg.bind(null, 0x40, regE),
  _ops.resReg.bind(null, 0x40, regH), _ops.resReg.bind(null, 0x40, regL), _ops.resMem.bind(null, 0x40), _ops.resReg.bind(null, 0x40, regA),
  _ops.resReg.bind(null, 0x80, regB), _ops.resReg.bind(null, 0x80, regC), _ops.resReg.bind(null, 0x80, regD), _ops.resReg.bind(null, 0x80, regE),
  _ops.resReg.bind(null, 0x80, regH), _ops.resReg.bind(null, 0x80, regL), _ops.resMem.bind(null, 0x80), _ops.resReg.bind(null, 0x80, regA),
  // CBC0
  _ops.setReg.bind(null, 0x01, regB), _ops.setReg.bind(null, 0x01, regC), _ops.setReg.bind(null, 0x01, regD), _ops.setReg.bind(null, 0x01, regE),
  _ops.setReg.bind(null, 0x01, regH), _ops.setReg.bind(null, 0x01, regL), _ops.setMem.bind(null, 0x01), _ops.setReg.bind(null, 0x01, regA),
  _ops.setReg.bind(null, 0x02, regB), _ops.setReg.bind(null, 0x02, regC), _ops.setReg.bind(null, 0x02, regD), _ops.setReg.bind(null, 0x02, regE),
  _ops.setReg.bind(null, 0x02, regH), _ops.setReg.bind(null, 0x02, regL), _ops.setMem.bind(null, 0x02), _ops.setReg.bind(null, 0x02, regA),
  // CBD0
  _ops.setReg.bind(null, 0x04, regB), _ops.setReg.bind(null, 0x04, regC), _ops.setReg.bind(null, 0x04, regD), _ops.setReg.bind(null, 0x04, regE),
  _ops.setReg.bind(null, 0x04, regH), _ops.setReg.bind(null, 0x04, regL), _ops.setMem.bind(null, 0x04), _ops.setReg.bind(null, 0x04, regA),
  _ops.setReg.bind(null, 0x08, regB), _ops.setReg.bind(null, 0x08, regC), _ops.setReg.bind(null, 0x08, regD), _ops.setReg.bind(null, 0x08, regE),
  _ops.setReg.bind(null, 0x08, regH), _ops.setReg.bind(null, 0x08, regL), _ops.setMem.bind(null, 0x08), _ops.setReg.bind(null, 0x08, regA),
  // CBE0
  _ops.setReg.bind(null, 0x10, regB), _ops.setReg.bind(null, 0x10, regC), _ops.setReg.bind(null, 0x10, regD), _ops.setReg.bind(null, 0x10, regE),
  _ops.setReg.bind(null, 0x10, regH), _ops.setReg.bind(null, 0x10, regL), _ops.setMem.bind(null, 0x10), _ops.setReg.bind(null, 0x10, regA),
  _ops.setReg.bind(null, 0x20, regB), _ops.setReg.bind(null, 0x20, regC), _ops.setReg.bind(null, 0x20, regD), _ops.setReg.bind(null, 0x20, regE),
  _ops.setReg.bind(null, 0x20, regH), _ops.setReg.bind(null, 0x20, regL), _ops.setMem.bind(null, 0x20), _ops.setReg.bind(null, 0x20, regA),
  // CBF0
  _ops.setReg.bind(null, 0x40, regB), _ops.setReg.bind(null, 0x40, regC), _ops.setReg.bind(null, 0x40, regD), _ops.setReg.bind(null, 0x40, regE),
  _ops.setReg.bind(null, 0x40, regH), _ops.setReg.bind(null, 0x40, regL), _ops.setMem.bind(null, 0x40), _ops.setReg.bind(null, 0x40, regA),
  _ops.setReg.bind(null, 0x80, regB), _ops.setReg.bind(null, 0x80, regC), _ops.setReg.bind(null, 0x80, regD), _ops.setReg.bind(null, 0x80, regE),
  _ops.setReg.bind(null, 0x80, regH), _ops.setReg.bind(null, 0x80, regL), _ops.setMem.bind(null, 0x80), _ops.setReg.bind(null, 0x80, regA),
];

export default Z80;
