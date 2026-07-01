import { csvField, csvRow, toCsv } from './csv.util';

describe('csv.util', () => {
  describe('csvField', () => {
    it('passes through plain values', () => {
      expect(csvField('hello')).toBe('hello');
      expect(csvField(42)).toBe('42');
    });

    it('renders null/undefined as empty', () => {
      expect(csvField(null)).toBe('');
      expect(csvField(undefined)).toBe('');
    });

    it('quotes and escapes commas, quotes, and newlines', () => {
      expect(csvField('a,b')).toBe('"a,b"');
      expect(csvField('she said "hi"')).toBe('"she said ""hi"""');
      expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    });

    it('neutralizes formula-injection triggers', () => {
      expect(csvField('=1+1')).toBe("'=1+1");
      expect(csvField('+44')).toBe("'+44");
      expect(csvField('-2')).toBe("'-2");
      expect(csvField('@cmd')).toBe("'@cmd");
    });

    it('quotes a value that is both a formula and contains a comma', () => {
      expect(csvField('=A,B')).toBe('"\'=A,B"');
    });
  });

  describe('csvRow / toCsv', () => {
    it('joins escaped fields', () => {
      expect(csvRow(['a', 'b,c', 1])).toBe('a,"b,c",1');
    });

    it('builds a header + rows document', () => {
      const csv = toCsv(['k', 'v'], [['x', 1], ['y,z', 2]]);
      expect(csv).toBe('k,v\nx,1\n"y,z",2');
    });
  });
});
