import { describe, it, expect } from 'vitest';
import { toSrt, toVtt, srtTime, vttTime } from '../../src/hubs/media0/lib/subs';

const segs = [
  { start: 0, end: 2.5, text: 'Hello there.' },
  { start: 2.5, end: 61.04, text: 'General Kenobi!' },
];

describe('subtitle builders', () => {
  it('formats srt timestamps (comma millis)', () => {
    expect(srtTime(61.04)).toBe('00:01:01,040');
    expect(srtTime(0)).toBe('00:00:00,000');
  });
  it('formats vtt timestamps (dot millis)', () => {
    expect(vttTime(3661.5)).toBe('01:01:01.500');
  });
  it('builds numbered srt blocks', () => {
    expect(toSrt(segs)).toBe(
      '1\n00:00:00,000 --> 00:00:02,500\nHello there.\n\n2\n00:00:02,500 --> 00:01:01,040\nGeneral Kenobi!\n');
  });
  it('builds vtt with header', () => {
    expect(toVtt(segs).startsWith('WEBVTT\n\n')).toBe(true);
    expect(toVtt(segs)).toContain('00:00:00.000 --> 00:00:02.500');
  });
});
