import { describe, it, expect } from 'vitest';
import { fmtBytes, fmtDuration, outName, mimeFor } from '../../src/hubs/media0/lib/mediafile';

describe('mediafile helpers', () => {
  it('formats bytes', () => {
    expect(fmtBytes(1_500_000)).toBe('1.5 MB');
    expect(fmtBytes(900)).toBe('900 B');
  });
  it('formats durations', () => {
    expect(fmtDuration(3661.5)).toBe('1:01:01');
    expect(fmtDuration(75)).toBe('1:15');
  });
  it('builds output names', () => {
    expect(outName('My Video.MOV', 'mp4')).toBe('My Video.mp4');
    expect(outName('archive.tar.gz', 'mp3')).toBe('archive.tar.mp3');
  });
  it('maps extensions to mime types', () => {
    expect(mimeFor('MP4')).toBe('video/mp4');
    expect(mimeFor('gif')).toBe('image/gif');
    expect(mimeFor('xyz')).toBe('application/octet-stream');
  });
});
