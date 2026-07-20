import { describe, it, expect } from 'vitest';
import { telemetryDisplay } from './telemetry-state';

describe('telemetryDisplay', () => {
  it('derives the badge from data.calibrated (not hard-coded)', () => {
    expect(telemetryDisplay({ calibrated: true, totalTokens: 100, activeUsers: 3 }).calibrationLabel)
      .toBe('live · calibrated');
    expect(telemetryDisplay({ calibrated: false, totalTokens: 100, activeUsers: 3 }).calibrationLabel)
      .toBe('live · not yet calibrated');
  });

  it('shows the estimate caveat only while uncalibrated', () => {
    expect(telemetryDisplay({ calibrated: false, totalTokens: 100, activeUsers: 3 }).showEstimateCaveat).toBe(true);
    expect(telemetryDisplay({ calibrated: true, totalTokens: 100, activeUsers: 3 }).showEstimateCaveat).toBe(false);
  });

  it('emits an honest empty note when there is no live data', () => {
    const d = telemetryDisplay({ calibrated: false, totalTokens: 0, activeUsers: 0 });
    expect(d.hasLiveData).toBe(false);
    expect(d.emptyNote).toMatch(/no goblin-hosted usage/i);
  });

  it('treats any usage (tokens OR active users) as live data', () => {
    expect(telemetryDisplay({ calibrated: false, totalTokens: 0, activeUsers: 2 }).hasLiveData).toBe(true);
    expect(telemetryDisplay({ calibrated: false, totalTokens: 5, activeUsers: 0 }).hasLiveData).toBe(true);
    expect(telemetryDisplay({ calibrated: true, totalTokens: 0, activeUsers: 0 }).emptyNote).not.toBeNull();
  });
});
