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

  reset() {
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

  isInterruptable() {
    return interruptsEnabled;
  },

  isHalted() {
    return Z80._halt;
  },

  disableInterrupts() {
    interruptsEnabled = false;
  },

  enabledInterrupts() {
    interruptsEnabled = true;
  },

  /**
   * Execute the opcode pointed to by the program counter, and increment
   * the counter to the next code.
   * @return int Clock ticks
   */
  exec() {
    return _map[MMU.rb(regPC[0]++)]();
  },

  /**
   * Get a nicely-formatted object with the registers state
   * @return object
   */
  getRegisters() {
    return {
      a: regA[0],
      b: regB[0],
      c: regC[0],
      d: regD[0],
      e: regE[0],
      f: regF[0],
      hl: regHL[0],
      sp: regSP[0],
      pc: regPC[0],
      flags: {
        zero: !!(regF[0] & F_ZERO),
        carry: !!(regF[0] & F_CARRY),
        hcarry: !!(regF[0] & F_HCARRY),
        subtract: !!(regF[0] & F_OP)
      }
    };
  }
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

  /**
   * Load a 16-bit literal into a register
   * @param Uint16Array register
   * @return int Clock ticks
   */
  ldReg16Val(register) {
    register[0] = MMU.rw(regPC[0]);
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
    var tr = register[0];
    register[0] = ((tr & 0xF) << 4) | ((tr & 0xF0) >> 4);
    regF[0] = register[0] ? 0 : F_ZERO;
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
    i &= 0xFF;
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

  /**
   * DAA - for dealing with 
   * 0x27
   */
  DAA() {
    // Lookup from our table
    var daaLookupIdx = regA[0];
    daaLookupIdx |= (regF[0] & (F_CARRY | F_HCARRY | F_OP)) << 4;

    regAF[0] = daaTable[daaLookupIdx];
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
    i = ((i << 1) + ci) & 0xFF;
    regF[0] = i ? 0 : F_ZERO;
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
  _ops.NOP, _ops.ldReg16Val.bind(null, regBC), _ops.LDBCmA, _ops.incReg16.bind(null, regBC),
  _ops.incReg.bind(null, regB), _ops.decReg.bind(null, regB), _ops.ldRegVal.bind(null, regB), _ops.RLCA,
  _ops.LDmmSP, _ops.addHLReg.bind(null, regBC), _ops.LDABCm, _ops.decReg16.bind(null, regBC),
  _ops.incReg.bind(null, regC), _ops.decReg.bind(null, regC), _ops.ldRegVal.bind(null, regC), _ops.RRCA,
  // 10
  _ops.stop, _ops.ldReg16Val.bind(null, regDE), _ops.LDDEmA, _ops.incReg16.bind(null, regDE),
  _ops.incReg.bind(null, regD), _ops.decReg.bind(null, regD), _ops.ldRegVal.bind(null, regD), _ops.RLA,
  _ops.JRn, _ops.addHLReg.bind(null, regDE), _ops.LDADEm, _ops.decReg16.bind(null, regDE),
  _ops.incReg.bind(null, regE), _ops.decReg.bind(null, regE), _ops.ldRegVal.bind(null, regE), _ops.RRA,
  // 20
  _ops.JRNZn, _ops.ldReg16Val.bind(null, regHL), _ops.LDHLIA, _ops.incReg16.bind(null, regHL),
  _ops.incReg.bind(null, regH), _ops.decReg.bind(null, regH), _ops.ldRegVal.bind(null, regH), _ops.DAA,
  _ops.JRZn, _ops.addHLReg.bind(null, regHL), _ops.LDAHLI, _ops.decReg16.bind(null, regHL),
  _ops.incReg.bind(null, regL), _ops.decReg.bind(null, regL), _ops.ldRegVal.bind(null, regL), _ops.CPL,
  // 30
  _ops.JRNCn, _ops.ldReg16Val.bind(null, regSP), _ops.LDHLDA, _ops.incReg16.bind(null, regSP),
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

/**
 * A table used for fast lookups for the DAA instruction, aka convert to BCD.
 * BCD is critical to gaming applications, since most numbers will need to
 * be BCD in order to present them to the player. This makes a fast table
 * preferable to trying to replicate the DAA logic the z80 follows, as we're
 * essentially using a little more space in-memory to reduce some tough-to-debug
 * logic around BCD + flag setting. More importantly, that DAA logic was
 * brain-meltingly complex.
 *
 * credit to mednafen, where I found this table built. Sets to AF.
 */
const daaTable = new Uint16Array([
  0x0080, 0x0100, 0x0200, 0x0300, 0x0400, 0x0500, 0x0600, 0x0700,
  0x0800, 0x0900, 0x1000, 0x1100, 0x1200, 0x1300, 0x1400, 0x1500,
  0x1000, 0x1100, 0x1200, 0x1300, 0x1400, 0x1500, 0x1600, 0x1700,
  0x1800, 0x1900, 0x2000, 0x2100, 0x2200, 0x2300, 0x2400, 0x2500,
  0x2000, 0x2100, 0x2200, 0x2300, 0x2400, 0x2500, 0x2600, 0x2700,
  0x2800, 0x2900, 0x3000, 0x3100, 0x3200, 0x3300, 0x3400, 0x3500,
  0x3000, 0x3100, 0x3200, 0x3300, 0x3400, 0x3500, 0x3600, 0x3700,
  0x3800, 0x3900, 0x4000, 0x4100, 0x4200, 0x4300, 0x4400, 0x4500,
  0x4000, 0x4100, 0x4200, 0x4300, 0x4400, 0x4500, 0x4600, 0x4700,
  0x4800, 0x4900, 0x5000, 0x5100, 0x5200, 0x5300, 0x5400, 0x5500,
  0x5000, 0x5100, 0x5200, 0x5300, 0x5400, 0x5500, 0x5600, 0x5700,
  0x5800, 0x5900, 0x6000, 0x6100, 0x6200, 0x6300, 0x6400, 0x6500,
  0x6000, 0x6100, 0x6200, 0x6300, 0x6400, 0x6500, 0x6600, 0x6700,
  0x6800, 0x6900, 0x7000, 0x7100, 0x7200, 0x7300, 0x7400, 0x7500,
  0x7000, 0x7100, 0x7200, 0x7300, 0x7400, 0x7500, 0x7600, 0x7700,
  0x7800, 0x7900, 0x8000, 0x8100, 0x8200, 0x8300, 0x8400, 0x8500,
  0x8000, 0x8100, 0x8200, 0x8300, 0x8400, 0x8500, 0x8600, 0x8700,
  0x8800, 0x8900, 0x9000, 0x9100, 0x9200, 0x9300, 0x9400, 0x9500,
  0x9000, 0x9100, 0x9200, 0x9300, 0x9400, 0x9500, 0x9600, 0x9700,
  0x9800, 0x9900, 0x0090, 0x0110, 0x0210, 0x0310, 0x0410, 0x0510,
  0x0090, 0x0110, 0x0210, 0x0310, 0x0410, 0x0510, 0x0610, 0x0710,
  0x0810, 0x0910, 0x1010, 0x1110, 0x1210, 0x1310, 0x1410, 0x1510,
  0x1010, 0x1110, 0x1210, 0x1310, 0x1410, 0x1510, 0x1610, 0x1710,
  0x1810, 0x1910, 0x2010, 0x2110, 0x2210, 0x2310, 0x2410, 0x2510,
  0x2010, 0x2110, 0x2210, 0x2310, 0x2410, 0x2510, 0x2610, 0x2710,
  0x2810, 0x2910, 0x3010, 0x3110, 0x3210, 0x3310, 0x3410, 0x3510,
  0x3010, 0x3110, 0x3210, 0x3310, 0x3410, 0x3510, 0x3610, 0x3710,
  0x3810, 0x3910, 0x4010, 0x4110, 0x4210, 0x4310, 0x4410, 0x4510,
  0x4010, 0x4110, 0x4210, 0x4310, 0x4410, 0x4510, 0x4610, 0x4710,
  0x4810, 0x4910, 0x5010, 0x5110, 0x5210, 0x5310, 0x5410, 0x5510,
  0x5010, 0x5110, 0x5210, 0x5310, 0x5410, 0x5510, 0x5610, 0x5710,
  0x5810, 0x5910, 0x6010, 0x6110, 0x6210, 0x6310, 0x6410, 0x6510,
  0x6010, 0x6110, 0x6210, 0x6310, 0x6410, 0x6510, 0x6610, 0x6710,
  0x6810, 0x6910, 0x7010, 0x7110, 0x7210, 0x7310, 0x7410, 0x7510,
  0x7010, 0x7110, 0x7210, 0x7310, 0x7410, 0x7510, 0x7610, 0x7710,
  0x7810, 0x7910, 0x8010, 0x8110, 0x8210, 0x8310, 0x8410, 0x8510,
  0x8010, 0x8110, 0x8210, 0x8310, 0x8410, 0x8510, 0x8610, 0x8710,
  0x8810, 0x8910, 0x9010, 0x9110, 0x9210, 0x9310, 0x9410, 0x9510,
  0x9010, 0x9110, 0x9210, 0x9310, 0x9410, 0x9510, 0x9610, 0x9710,
  0x9810, 0x9910, 0xA010, 0xA110, 0xA210, 0xA310, 0xA410, 0xA510,
  0xA010, 0xA110, 0xA210, 0xA310, 0xA410, 0xA510, 0xA610, 0xA710,
  0xA810, 0xA910, 0xB010, 0xB110, 0xB210, 0xB310, 0xB410, 0xB510,
  0xB010, 0xB110, 0xB210, 0xB310, 0xB410, 0xB510, 0xB610, 0xB710,
  0xB810, 0xB910, 0xC010, 0xC110, 0xC210, 0xC310, 0xC410, 0xC510,
  0xC010, 0xC110, 0xC210, 0xC310, 0xC410, 0xC510, 0xC610, 0xC710,
  0xC810, 0xC910, 0xD010, 0xD110, 0xD210, 0xD310, 0xD410, 0xD510,
  0xD010, 0xD110, 0xD210, 0xD310, 0xD410, 0xD510, 0xD610, 0xD710,
  0xD810, 0xD910, 0xE010, 0xE110, 0xE210, 0xE310, 0xE410, 0xE510,
  0xE010, 0xE110, 0xE210, 0xE310, 0xE410, 0xE510, 0xE610, 0xE710,
  0xE810, 0xE910, 0xF010, 0xF110, 0xF210, 0xF310, 0xF410, 0xF510,
  0xF010, 0xF110, 0xF210, 0xF310, 0xF410, 0xF510, 0xF610, 0xF710,
  0xF810, 0xF910, 0x0090, 0x0110, 0x0210, 0x0310, 0x0410, 0x0510,
  0x0090, 0x0110, 0x0210, 0x0310, 0x0410, 0x0510, 0x0610, 0x0710,
  0x0810, 0x0910, 0x1010, 0x1110, 0x1210, 0x1310, 0x1410, 0x1510,
  0x1010, 0x1110, 0x1210, 0x1310, 0x1410, 0x1510, 0x1610, 0x1710,
  0x1810, 0x1910, 0x2010, 0x2110, 0x2210, 0x2310, 0x2410, 0x2510,
  0x2010, 0x2110, 0x2210, 0x2310, 0x2410, 0x2510, 0x2610, 0x2710,
  0x2810, 0x2910, 0x3010, 0x3110, 0x3210, 0x3310, 0x3410, 0x3510,
  0x3010, 0x3110, 0x3210, 0x3310, 0x3410, 0x3510, 0x3610, 0x3710,
  0x3810, 0x3910, 0x4010, 0x4110, 0x4210, 0x4310, 0x4410, 0x4510,
  0x4010, 0x4110, 0x4210, 0x4310, 0x4410, 0x4510, 0x4610, 0x4710,
  0x4810, 0x4910, 0x5010, 0x5110, 0x5210, 0x5310, 0x5410, 0x5510,
  0x5010, 0x5110, 0x5210, 0x5310, 0x5410, 0x5510, 0x5610, 0x5710,
  0x5810, 0x5910, 0x6010, 0x6110, 0x6210, 0x6310, 0x6410, 0x6510,
  0x0600, 0x0700, 0x0800, 0x0900, 0x0A00, 0x0B00, 0x0C00, 0x0D00,
  0x0E00, 0x0F00, 0x1000, 0x1100, 0x1200, 0x1300, 0x1400, 0x1500,
  0x1600, 0x1700, 0x1800, 0x1900, 0x1A00, 0x1B00, 0x1C00, 0x1D00,
  0x1E00, 0x1F00, 0x2000, 0x2100, 0x2200, 0x2300, 0x2400, 0x2500,
  0x2600, 0x2700, 0x2800, 0x2900, 0x2A00, 0x2B00, 0x2C00, 0x2D00,
  0x2E00, 0x2F00, 0x3000, 0x3100, 0x3200, 0x3300, 0x3400, 0x3500,
  0x3600, 0x3700, 0x3800, 0x3900, 0x3A00, 0x3B00, 0x3C00, 0x3D00,
  0x3E00, 0x3F00, 0x4000, 0x4100, 0x4200, 0x4300, 0x4400, 0x4500,
  0x4600, 0x4700, 0x4800, 0x4900, 0x4A00, 0x4B00, 0x4C00, 0x4D00,
  0x4E00, 0x4F00, 0x5000, 0x5100, 0x5200, 0x5300, 0x5400, 0x5500,
  0x5600, 0x5700, 0x5800, 0x5900, 0x5A00, 0x5B00, 0x5C00, 0x5D00,
  0x5E00, 0x5F00, 0x6000, 0x6100, 0x6200, 0x6300, 0x6400, 0x6500,
  0x6600, 0x6700, 0x6800, 0x6900, 0x6A00, 0x6B00, 0x6C00, 0x6D00,
  0x6E00, 0x6F00, 0x7000, 0x7100, 0x7200, 0x7300, 0x7400, 0x7500,
  0x7600, 0x7700, 0x7800, 0x7900, 0x7A00, 0x7B00, 0x7C00, 0x7D00,
  0x7E00, 0x7F00, 0x8000, 0x8100, 0x8200, 0x8300, 0x8400, 0x8500,
  0x8600, 0x8700, 0x8800, 0x8900, 0x8A00, 0x8B00, 0x8C00, 0x8D00,
  0x8E00, 0x8F00, 0x9000, 0x9100, 0x9200, 0x9300, 0x9400, 0x9500,
  0x9600, 0x9700, 0x9800, 0x9900, 0x9A00, 0x9B00, 0x9C00, 0x9D00,
  0x9E00, 0x9F00, 0x0090, 0x0110, 0x0210, 0x0310, 0x0410, 0x0510,
  0x0610, 0x0710, 0x0810, 0x0910, 0x0A10, 0x0B10, 0x0C10, 0x0D10,
  0x0E10, 0x0F10, 0x1010, 0x1110, 0x1210, 0x1310, 0x1410, 0x1510,
  0x1610, 0x1710, 0x1810, 0x1910, 0x1A10, 0x1B10, 0x1C10, 0x1D10,
  0x1E10, 0x1F10, 0x2010, 0x2110, 0x2210, 0x2310, 0x2410, 0x2510,
  0x2610, 0x2710, 0x2810, 0x2910, 0x2A10, 0x2B10, 0x2C10, 0x2D10,
  0x2E10, 0x2F10, 0x3010, 0x3110, 0x3210, 0x3310, 0x3410, 0x3510,
  0x3610, 0x3710, 0x3810, 0x3910, 0x3A10, 0x3B10, 0x3C10, 0x3D10,
  0x3E10, 0x3F10, 0x4010, 0x4110, 0x4210, 0x4310, 0x4410, 0x4510,
  0x4610, 0x4710, 0x4810, 0x4910, 0x4A10, 0x4B10, 0x4C10, 0x4D10,
  0x4E10, 0x4F10, 0x5010, 0x5110, 0x5210, 0x5310, 0x5410, 0x5510,
  0x5610, 0x5710, 0x5810, 0x5910, 0x5A10, 0x5B10, 0x5C10, 0x5D10,
  0x5E10, 0x5F10, 0x6010, 0x6110, 0x6210, 0x6310, 0x6410, 0x6510,
  0x6610, 0x6710, 0x6810, 0x6910, 0x6A10, 0x6B10, 0x6C10, 0x6D10,
  0x6E10, 0x6F10, 0x7010, 0x7110, 0x7210, 0x7310, 0x7410, 0x7510,
  0x7610, 0x7710, 0x7810, 0x7910, 0x7A10, 0x7B10, 0x7C10, 0x7D10,
  0x7E10, 0x7F10, 0x8010, 0x8110, 0x8210, 0x8310, 0x8410, 0x8510,
  0x8610, 0x8710, 0x8810, 0x8910, 0x8A10, 0x8B10, 0x8C10, 0x8D10,
  0x8E10, 0x8F10, 0x9010, 0x9110, 0x9210, 0x9310, 0x9410, 0x9510,
  0x9610, 0x9710, 0x9810, 0x9910, 0x9A10, 0x9B10, 0x9C10, 0x9D10,
  0x9E10, 0x9F10, 0xA010, 0xA110, 0xA210, 0xA310, 0xA410, 0xA510,
  0xA610, 0xA710, 0xA810, 0xA910, 0xAA10, 0xAB10, 0xAC10, 0xAD10,
  0xAE10, 0xAF10, 0xB010, 0xB110, 0xB210, 0xB310, 0xB410, 0xB510,
  0xB610, 0xB710, 0xB810, 0xB910, 0xBA10, 0xBB10, 0xBC10, 0xBD10,
  0xBE10, 0xBF10, 0xC010, 0xC110, 0xC210, 0xC310, 0xC410, 0xC510,
  0xC610, 0xC710, 0xC810, 0xC910, 0xCA10, 0xCB10, 0xCC10, 0xCD10,
  0xCE10, 0xCF10, 0xD010, 0xD110, 0xD210, 0xD310, 0xD410, 0xD510,
  0xD610, 0xD710, 0xD810, 0xD910, 0xDA10, 0xDB10, 0xDC10, 0xDD10,
  0xDE10, 0xDF10, 0xE010, 0xE110, 0xE210, 0xE310, 0xE410, 0xE510,
  0xE610, 0xE710, 0xE810, 0xE910, 0xEA10, 0xEB10, 0xEC10, 0xED10,
  0xEE10, 0xEF10, 0xF010, 0xF110, 0xF210, 0xF310, 0xF410, 0xF510,
  0xF610, 0xF710, 0xF810, 0xF910, 0xFA10, 0xFB10, 0xFC10, 0xFD10,
  0xFE10, 0xFF10, 0x0090, 0x0110, 0x0210, 0x0310, 0x0410, 0x0510,
  0x0610, 0x0710, 0x0810, 0x0910, 0x0A10, 0x0B10, 0x0C10, 0x0D10,
  0x0E10, 0x0F10, 0x1010, 0x1110, 0x1210, 0x1310, 0x1410, 0x1510,
  0x1610, 0x1710, 0x1810, 0x1910, 0x1A10, 0x1B10, 0x1C10, 0x1D10,
  0x1E10, 0x1F10, 0x2010, 0x2110, 0x2210, 0x2310, 0x2410, 0x2510,
  0x2610, 0x2710, 0x2810, 0x2910, 0x2A10, 0x2B10, 0x2C10, 0x2D10,
  0x2E10, 0x2F10, 0x3010, 0x3110, 0x3210, 0x3310, 0x3410, 0x3510,
  0x3610, 0x3710, 0x3810, 0x3910, 0x3A10, 0x3B10, 0x3C10, 0x3D10,
  0x3E10, 0x3F10, 0x4010, 0x4110, 0x4210, 0x4310, 0x4410, 0x4510,
  0x4610, 0x4710, 0x4810, 0x4910, 0x4A10, 0x4B10, 0x4C10, 0x4D10,
  0x4E10, 0x4F10, 0x5010, 0x5110, 0x5210, 0x5310, 0x5410, 0x5510,
  0x5610, 0x5710, 0x5810, 0x5910, 0x5A10, 0x5B10, 0x5C10, 0x5D10,
  0x5E10, 0x5F10, 0x6010, 0x6110, 0x6210, 0x6310, 0x6410, 0x6510,
  0x00C0, 0x0140, 0x0240, 0x0340, 0x0440, 0x0540, 0x0640, 0x0740,
  0x0840, 0x0940, 0x0A40, 0x0B40, 0x0C40, 0x0D40, 0x0E40, 0x0F40,
  0x1040, 0x1140, 0x1240, 0x1340, 0x1440, 0x1540, 0x1640, 0x1740,
  0x1840, 0x1940, 0x1A40, 0x1B40, 0x1C40, 0x1D40, 0x1E40, 0x1F40,
  0x2040, 0x2140, 0x2240, 0x2340, 0x2440, 0x2540, 0x2640, 0x2740,
  0x2840, 0x2940, 0x2A40, 0x2B40, 0x2C40, 0x2D40, 0x2E40, 0x2F40,
  0x3040, 0x3140, 0x3240, 0x3340, 0x3440, 0x3540, 0x3640, 0x3740,
  0x3840, 0x3940, 0x3A40, 0x3B40, 0x3C40, 0x3D40, 0x3E40, 0x3F40,
  0x4040, 0x4140, 0x4240, 0x4340, 0x4440, 0x4540, 0x4640, 0x4740,
  0x4840, 0x4940, 0x4A40, 0x4B40, 0x4C40, 0x4D40, 0x4E40, 0x4F40,
  0x5040, 0x5140, 0x5240, 0x5340, 0x5440, 0x5540, 0x5640, 0x5740,
  0x5840, 0x5940, 0x5A40, 0x5B40, 0x5C40, 0x5D40, 0x5E40, 0x5F40,
  0x6040, 0x6140, 0x6240, 0x6340, 0x6440, 0x6540, 0x6640, 0x6740,
  0x6840, 0x6940, 0x6A40, 0x6B40, 0x6C40, 0x6D40, 0x6E40, 0x6F40,
  0x7040, 0x7140, 0x7240, 0x7340, 0x7440, 0x7540, 0x7640, 0x7740,
  0x7840, 0x7940, 0x7A40, 0x7B40, 0x7C40, 0x7D40, 0x7E40, 0x7F40,
  0x8040, 0x8140, 0x8240, 0x8340, 0x8440, 0x8540, 0x8640, 0x8740,
  0x8840, 0x8940, 0x8A40, 0x8B40, 0x8C40, 0x8D40, 0x8E40, 0x8F40,
  0x9040, 0x9140, 0x9240, 0x9340, 0x9440, 0x9540, 0x9640, 0x9740,
  0x9840, 0x9940, 0x9A40, 0x9B40, 0x9C40, 0x9D40, 0x9E40, 0x9F40,
  0xA040, 0xA140, 0xA240, 0xA340, 0xA440, 0xA540, 0xA640, 0xA740,
  0xA840, 0xA940, 0xAA40, 0xAB40, 0xAC40, 0xAD40, 0xAE40, 0xAF40,
  0xB040, 0xB140, 0xB240, 0xB340, 0xB440, 0xB540, 0xB640, 0xB740,
  0xB840, 0xB940, 0xBA40, 0xBB40, 0xBC40, 0xBD40, 0xBE40, 0xBF40,
  0xC040, 0xC140, 0xC240, 0xC340, 0xC440, 0xC540, 0xC640, 0xC740,
  0xC840, 0xC940, 0xCA40, 0xCB40, 0xCC40, 0xCD40, 0xCE40, 0xCF40,
  0xD040, 0xD140, 0xD240, 0xD340, 0xD440, 0xD540, 0xD640, 0xD740,
  0xD840, 0xD940, 0xDA40, 0xDB40, 0xDC40, 0xDD40, 0xDE40, 0xDF40,
  0xE040, 0xE140, 0xE240, 0xE340, 0xE440, 0xE540, 0xE640, 0xE740,
  0xE840, 0xE940, 0xEA40, 0xEB40, 0xEC40, 0xED40, 0xEE40, 0xEF40,
  0xF040, 0xF140, 0xF240, 0xF340, 0xF440, 0xF540, 0xF640, 0xF740,
  0xF840, 0xF940, 0xFA40, 0xFB40, 0xFC40, 0xFD40, 0xFE40, 0xFF40,
  0xA050, 0xA150, 0xA250, 0xA350, 0xA450, 0xA550, 0xA650, 0xA750,
  0xA850, 0xA950, 0xAA50, 0xAB50, 0xAC50, 0xAD50, 0xAE50, 0xAF50,
  0xB050, 0xB150, 0xB250, 0xB350, 0xB450, 0xB550, 0xB650, 0xB750,
  0xB850, 0xB950, 0xBA50, 0xBB50, 0xBC50, 0xBD50, 0xBE50, 0xBF50,
  0xC050, 0xC150, 0xC250, 0xC350, 0xC450, 0xC550, 0xC650, 0xC750,
  0xC850, 0xC950, 0xCA50, 0xCB50, 0xCC50, 0xCD50, 0xCE50, 0xCF50,
  0xD050, 0xD150, 0xD250, 0xD350, 0xD450, 0xD550, 0xD650, 0xD750,
  0xD850, 0xD950, 0xDA50, 0xDB50, 0xDC50, 0xDD50, 0xDE50, 0xDF50,
  0xE050, 0xE150, 0xE250, 0xE350, 0xE450, 0xE550, 0xE650, 0xE750,
  0xE850, 0xE950, 0xEA50, 0xEB50, 0xEC50, 0xED50, 0xEE50, 0xEF50,
  0xF050, 0xF150, 0xF250, 0xF350, 0xF450, 0xF550, 0xF650, 0xF750,
  0xF850, 0xF950, 0xFA50, 0xFB50, 0xFC50, 0xFD50, 0xFE50, 0xFF50,
  0x00D0, 0x0150, 0x0250, 0x0350, 0x0450, 0x0550, 0x0650, 0x0750,
  0x0850, 0x0950, 0x0A50, 0x0B50, 0x0C50, 0x0D50, 0x0E50, 0x0F50,
  0x1050, 0x1150, 0x1250, 0x1350, 0x1450, 0x1550, 0x1650, 0x1750,
  0x1850, 0x1950, 0x1A50, 0x1B50, 0x1C50, 0x1D50, 0x1E50, 0x1F50,
  0x2050, 0x2150, 0x2250, 0x2350, 0x2450, 0x2550, 0x2650, 0x2750,
  0x2850, 0x2950, 0x2A50, 0x2B50, 0x2C50, 0x2D50, 0x2E50, 0x2F50,
  0x3050, 0x3150, 0x3250, 0x3350, 0x3450, 0x3550, 0x3650, 0x3750,
  0x3850, 0x3950, 0x3A50, 0x3B50, 0x3C50, 0x3D50, 0x3E50, 0x3F50,
  0x4050, 0x4150, 0x4250, 0x4350, 0x4450, 0x4550, 0x4650, 0x4750,
  0x4850, 0x4950, 0x4A50, 0x4B50, 0x4C50, 0x4D50, 0x4E50, 0x4F50,
  0x5050, 0x5150, 0x5250, 0x5350, 0x5450, 0x5550, 0x5650, 0x5750,
  0x5850, 0x5950, 0x5A50, 0x5B50, 0x5C50, 0x5D50, 0x5E50, 0x5F50,
  0x6050, 0x6150, 0x6250, 0x6350, 0x6450, 0x6550, 0x6650, 0x6750,
  0x6850, 0x6950, 0x6A50, 0x6B50, 0x6C50, 0x6D50, 0x6E50, 0x6F50,
  0x7050, 0x7150, 0x7250, 0x7350, 0x7450, 0x7550, 0x7650, 0x7750,
  0x7850, 0x7950, 0x7A50, 0x7B50, 0x7C50, 0x7D50, 0x7E50, 0x7F50,
  0x8050, 0x8150, 0x8250, 0x8350, 0x8450, 0x8550, 0x8650, 0x8750,
  0x8850, 0x8950, 0x8A50, 0x8B50, 0x8C50, 0x8D50, 0x8E50, 0x8F50,
  0x9050, 0x9150, 0x9250, 0x9350, 0x9450, 0x9550, 0x9650, 0x9750,
  0x9850, 0x9950, 0x9A50, 0x9B50, 0x9C50, 0x9D50, 0x9E50, 0x9F50,
  0xFA40, 0xFB40, 0xFC40, 0xFD40, 0xFE40, 0xFF40, 0x00C0, 0x0140,
  0x0240, 0x0340, 0x0440, 0x0540, 0x0640, 0x0740, 0x0840, 0x0940,
  0x0A40, 0x0B40, 0x0C40, 0x0D40, 0x0E40, 0x0F40, 0x1040, 0x1140,
  0x1240, 0x1340, 0x1440, 0x1540, 0x1640, 0x1740, 0x1840, 0x1940,
  0x1A40, 0x1B40, 0x1C40, 0x1D40, 0x1E40, 0x1F40, 0x2040, 0x2140,
  0x2240, 0x2340, 0x2440, 0x2540, 0x2640, 0x2740, 0x2840, 0x2940,
  0x2A40, 0x2B40, 0x2C40, 0x2D40, 0x2E40, 0x2F40, 0x3040, 0x3140,
  0x3240, 0x3340, 0x3440, 0x3540, 0x3640, 0x3740, 0x3840, 0x3940,
  0x3A40, 0x3B40, 0x3C40, 0x3D40, 0x3E40, 0x3F40, 0x4040, 0x4140,
  0x4240, 0x4340, 0x4440, 0x4540, 0x4640, 0x4740, 0x4840, 0x4940,
  0x4A40, 0x4B40, 0x4C40, 0x4D40, 0x4E40, 0x4F40, 0x5040, 0x5140,
  0x5240, 0x5340, 0x5440, 0x5540, 0x5640, 0x5740, 0x5840, 0x5940,
  0x5A40, 0x5B40, 0x5C40, 0x5D40, 0x5E40, 0x5F40, 0x6040, 0x6140,
  0x6240, 0x6340, 0x6440, 0x6540, 0x6640, 0x6740, 0x6840, 0x6940,
  0x6A40, 0x6B40, 0x6C40, 0x6D40, 0x6E40, 0x6F40, 0x7040, 0x7140,
  0x7240, 0x7340, 0x7440, 0x7540, 0x7640, 0x7740, 0x7840, 0x7940,
  0x7A40, 0x7B40, 0x7C40, 0x7D40, 0x7E40, 0x7F40, 0x8040, 0x8140,
  0x8240, 0x8340, 0x8440, 0x8540, 0x8640, 0x8740, 0x8840, 0x8940,
  0x8A40, 0x8B40, 0x8C40, 0x8D40, 0x8E40, 0x8F40, 0x9040, 0x9140,
  0x9240, 0x9340, 0x9440, 0x9540, 0x9640, 0x9740, 0x9840, 0x9940,
  0x9A40, 0x9B40, 0x9C40, 0x9D40, 0x9E40, 0x9F40, 0xA040, 0xA140,
  0xA240, 0xA340, 0xA440, 0xA540, 0xA640, 0xA740, 0xA840, 0xA940,
  0xAA40, 0xAB40, 0xAC40, 0xAD40, 0xAE40, 0xAF40, 0xB040, 0xB140,
  0xB240, 0xB340, 0xB440, 0xB540, 0xB640, 0xB740, 0xB840, 0xB940,
  0xBA40, 0xBB40, 0xBC40, 0xBD40, 0xBE40, 0xBF40, 0xC040, 0xC140,
  0xC240, 0xC340, 0xC440, 0xC540, 0xC640, 0xC740, 0xC840, 0xC940,
  0xCA40, 0xCB40, 0xCC40, 0xCD40, 0xCE40, 0xCF40, 0xD040, 0xD140,
  0xD240, 0xD340, 0xD440, 0xD540, 0xD640, 0xD740, 0xD840, 0xD940,
  0xDA40, 0xDB40, 0xDC40, 0xDD40, 0xDE40, 0xDF40, 0xE040, 0xE140,
  0xE240, 0xE340, 0xE440, 0xE540, 0xE640, 0xE740, 0xE840, 0xE940,
  0xEA40, 0xEB40, 0xEC40, 0xED40, 0xEE40, 0xEF40, 0xF040, 0xF140,
  0xF240, 0xF340, 0xF440, 0xF540, 0xF640, 0xF740, 0xF840, 0xF940,
  0x9A50, 0x9B50, 0x9C50, 0x9D50, 0x9E50, 0x9F50, 0xA050, 0xA150,
  0xA250, 0xA350, 0xA450, 0xA550, 0xA650, 0xA750, 0xA850, 0xA950,
  0xAA50, 0xAB50, 0xAC50, 0xAD50, 0xAE50, 0xAF50, 0xB050, 0xB150,
  0xB250, 0xB350, 0xB450, 0xB550, 0xB650, 0xB750, 0xB850, 0xB950,
  0xBA50, 0xBB50, 0xBC50, 0xBD50, 0xBE50, 0xBF50, 0xC050, 0xC150,
  0xC250, 0xC350, 0xC450, 0xC550, 0xC650, 0xC750, 0xC850, 0xC950,
  0xCA50, 0xCB50, 0xCC50, 0xCD50, 0xCE50, 0xCF50, 0xD050, 0xD150,
  0xD250, 0xD350, 0xD450, 0xD550, 0xD650, 0xD750, 0xD850, 0xD950,
  0xDA50, 0xDB50, 0xDC50, 0xDD50, 0xDE50, 0xDF50, 0xE050, 0xE150,
  0xE250, 0xE350, 0xE450, 0xE550, 0xE650, 0xE750, 0xE850, 0xE950,
  0xEA50, 0xEB50, 0xEC50, 0xED50, 0xEE50, 0xEF50, 0xF050, 0xF150,
  0xF250, 0xF350, 0xF450, 0xF550, 0xF650, 0xF750, 0xF850, 0xF950,
  0xFA50, 0xFB50, 0xFC50, 0xFD50, 0xFE50, 0xFF50, 0x00D0, 0x0150,
  0x0250, 0x0350, 0x0450, 0x0550, 0x0650, 0x0750, 0x0850, 0x0950,
  0x0A50, 0x0B50, 0x0C50, 0x0D50, 0x0E50, 0x0F50, 0x1050, 0x1150,
  0x1250, 0x1350, 0x1450, 0x1550, 0x1650, 0x1750, 0x1850, 0x1950,
  0x1A50, 0x1B50, 0x1C50, 0x1D50, 0x1E50, 0x1F50, 0x2050, 0x2150,
  0x2250, 0x2350, 0x2450, 0x2550, 0x2650, 0x2750, 0x2850, 0x2950,
  0x2A50, 0x2B50, 0x2C50, 0x2D50, 0x2E50, 0x2F50, 0x3050, 0x3150,
  0x3250, 0x3350, 0x3450, 0x3550, 0x3650, 0x3750, 0x3850, 0x3950,
  0x3A50, 0x3B50, 0x3C50, 0x3D50, 0x3E50, 0x3F50, 0x4050, 0x4150,
  0x4250, 0x4350, 0x4450, 0x4550, 0x4650, 0x4750, 0x4850, 0x4950,
  0x4A50, 0x4B50, 0x4C50, 0x4D50, 0x4E50, 0x4F50, 0x5050, 0x5150,
  0x5250, 0x5350, 0x5450, 0x5550, 0x5650, 0x5750, 0x5850, 0x5950,
  0x5A50, 0x5B50, 0x5C50, 0x5D50, 0x5E50, 0x5F50, 0x6050, 0x6150,
  0x6250, 0x6350, 0x6450, 0x6550, 0x6650, 0x6750, 0x6850, 0x6950,
  0x6A50, 0x6B50, 0x6C50, 0x6D50, 0x6E50, 0x6F50, 0x7050, 0x7150,
  0x7250, 0x7350, 0x7450, 0x7550, 0x7650, 0x7750, 0x7850, 0x7950,
  0x7A50, 0x7B50, 0x7C50, 0x7D50, 0x7E50, 0x7F50, 0x8050, 0x8150,
  0x8250, 0x8350, 0x8450, 0x8550, 0x8650, 0x8750, 0x8850, 0x8950,
  0x8A50, 0x8B50, 0x8C50, 0x8D50, 0x8E50, 0x8F50, 0x9050, 0x9150,
  0x9250, 0x9350, 0x9450, 0x9550, 0x9650, 0x9750, 0x9850, 0x9950,
]);

export default Z80;
