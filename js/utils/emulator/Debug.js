/**
 * Debug functions
 */

const Debug = {
  /**
   * Disassemble an instruction
   * Lets debugging view something closer to what the original source
   * looked like. Not readable by modern standards, but pretty dang nice
   * for 1983.
   * @param int opcode
   * @return string Readable instruction
   */
  disAsm: function(opcode) {
    return instructionTable[opcode];
  }
};

const instructionTable = [
  // 0x00
  'NOP', 'LD BC,nn', 'LD (BC),A', 'INC BC', 'INC B', 'DEC B', 'LD B,n', 'RLC A', 'LD (nn),SP', 'ADD HL,BC', 'LD A,(BC)', 'DEC BC', 'INC C', 'DEC C', 'LD C,n', 'RRC A',
  // 1x
  'STOP', 'LD DE,nn', 'LD (DE),A', 'INC DE', 'INC D', 'DEC D', 'LD D,n', 'RL A', 'JR n', 'ADD HL,DE', 'LD A,(DE)', 'DEC DE', 'INC E', 'DEC E', 'LD E,n', 'RR A',
  // 2x
  'JR NZ,n', 'LD HL,nn', 'LDI (HL),A', 'INC HL', 'INC H', 'DEC H', 'LD H,n', 'DAA', 'JR Z,n', 'ADD HL,HL', 'LDI A,(HL)', 'DEC HL', 'INC L', 'DEC L', 'LD L,n', 'CPL',
  // 3x
  'JR NC,n', 'LD SP,nn', 'LDD (HL),A', 'INC SP', 'INC (HL)', 'DEC (HL)', 'LD (HL),n', 'SCF', 'JR C,n', 'ADD HL,SP', 'LDD A,(HL)', 'DEC SP', 'INC A', 'DEC A', 'LD A,n', 'CCF',
  // 4x
  'LD B,B', 'LD B,C', 'LD B,D', 'LD B,E', 'LD B,H', 'LD B,L', 'LD B,(HL)', 'LD B,A', 'LD C,B', 'LD C,C', 'LD C,D', 'LD C,E', 'LD C,H', 'LD C,L', 'LD C,(HL)', 'LD C,A',
  // 5x
  'LD D,B', 'LD D,C', 'LD D,D', 'LD D,E', 'LD D,H', 'LD D,L', 'LD D,(HL)', 'LD D,A', 'LD E,B', 'LD E,C', 'LD E,D', 'LD E,E', 'LD E,H', 'LD E,L', 'LD E,(HL)', 'LD E,A',
  // 6x
  'LD H,B', 'LD H,C', 'LD H,D', 'LD H,E', 'LD H,H', 'LD H,L', 'LD H,(HL)', 'LD H,A', 'LD L,B', 'LD L,C', 'LD L,D', 'LD L,E', 'LD L,H', 'LD L,L', 'LD L,(HL)', 'LD L,A',
  // 7x
  'LD (HL),B', 'LD (HL),C', 'LD (HL),D', 'LD (HL),E', 'LD (HL),H', 'LD (HL),L', 'HALT', 'LD (HL),A', 'LD A,B', 'LD A,C', 'LD A,D', 'LD A,E', 'LD A,H', 'LD A,L', 'LD A,(HL)', 'LD A,A',
  // 8x
  'ADD A,B', 'ADD A,C', 'ADD A,D', 'ADD A,E', 'ADD A,H', 'ADD A,L', 'ADD A,(HL)', 'ADD A,A', 'ADC A,B', 'ADC A,C', 'ADC A,D', 'ADC A,E', 'ADC A,H', 'ADC A,L', 'ADC A,(HL)', 'ADC A,A',
  // 9x
  'SUB A,B', 'SUB A,C', 'SUB A,D', 'SUB A,E', 'SUB A,H', 'SUB A,L', 'SUB A,(HL)', 'SUB A,A', 'SBC A,B', 'SBC A,C', 'SBC A,D', 'SBC A,E', 'SBC A,H', 'SBC A,L', 'SBC A,(HL)', 'SBC A,A',
  // Ax
  'AND B', 'AND C', 'AND D', 'AND E', 'AND H', 'AND L', 'AND (HL)', 'AND A', 'XOR B', 'XOR C', 'XOR D', 'XOR E', 'XOR H', 'XOR L', 'XOR (HL)', 'XOR A',
  // Bx
  'OR B', 'OR C', 'OR D', 'OR E', 'OR H', 'OR L', 'OR (HL)', 'OR A', 'CP B', 'CP C', 'CP D', 'CP E', 'CP H', 'CP L', 'CP (HL)', 'CP A',
  // Cx
  'RET NZ', 'POP BC', 'JP NZ,nn', 'JP nn', 'CALL NZ,nn', 'PUSH BC', 'ADD A,n', 'RST 0', 'RET Z', 'RET', 'JP Z,nn', 'Ext ops', 'CALL Z,nn', 'CALL nn', 'ADC A,n', 'RST 8',
  // Dx
  'RET NC', 'POP DE', 'JP NC,nn', 'XX', 'CALL NC,nn', 'PUSH DE', 'SUB A,n', 'RST 10', 'RET C', 'RETI', 'JP C,nn', 'XX', 'CALL C,nn', 'XX', 'SBC A,n', 'RST 18',
  // Ex
  'LDH (n),A', 'POP HL', 'LDH (C),A', 'XX', 'XX', 'PUSH HL', 'AND n', 'RST 20', 'ADD SP,d', 'JP (HL)', 'LD (nn),A', 'XX', 'XX', 'XX', 'XOR n', 'RST 28',
  // Fx
  'LDH A,(n)', 'POP AF', 'XX', 'DI', 'XX', 'PUSH AF', 'OR n', 'RST 30', 'LDHL SP,d', 'LD SP,HL', 'LD A,(nn)', 'EI', 'XX', 'XX', 'CP n', 'RST 38'
];

export default Debug;
