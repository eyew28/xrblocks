import {describe, it, expect, beforeEach, vi} from 'vitest';

import {GamepadBindings} from './GamepadBindings';

describe('GamepadBindings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default bindings when no storage exists', () => {
    const bindings = new GamepadBindings();
    expect(bindings.getBinding('select')).toBe(0);
    expect(bindings.getBinding('cycleHandPoseLeft')).toBe(14);
    expect(bindings.getBinding('cycleHandPoseRight')).toBe(15);
    expect(bindings.getBinding('cycleSimulatorMode')).toBe(3);
    expect(bindings.getBinding('toggleUI')).toBe(5);
    expect(bindings.getBinding('openSettings')).toBe(9);
  });

  it('persists bindings to localStorage', () => {
    const bindings = new GamepadBindings();
    bindings.setBinding('select', 1);

    const stored = localStorage.getItem(
      'xrblocks:simulator:gamepad-bindings:v1'
    );
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.version).toBe(1);
    expect(parsed.bindings.select).toBe(1);
  });

  it('loads persisted bindings', () => {
    localStorage.setItem(
      'xrblocks:simulator:gamepad-bindings:v1',
      JSON.stringify({version: 1, bindings: {select: 3, toggleUI: 7}})
    );
    const bindings = new GamepadBindings();
    expect(bindings.getBinding('select')).toBe(3);
    expect(bindings.getBinding('toggleUI')).toBe(7);
    // Non-stored keys keep defaults
    expect(bindings.getBinding('cycleHandPoseLeft')).toBe(14);
  });

  it('falls back to defaults on malformed localStorage', () => {
    localStorage.setItem(
      'xrblocks:simulator:gamepad-bindings:v1',
      'not valid json'
    );
    const bindings = new GamepadBindings();
    expect(bindings.getBinding('select')).toBe(0);
  });

  it('falls back to defaults on wrong version', () => {
    localStorage.setItem(
      'xrblocks:simulator:gamepad-bindings:v1',
      JSON.stringify({version: 99, bindings: {select: 5}})
    );
    const bindings = new GamepadBindings();
    expect(bindings.getBinding('select')).toBe(0);
  });

  it('auto-unbinds duplicate when setting a binding', () => {
    const bindings = new GamepadBindings();
    // select = 0 by default, cycleHandPoseLeft = 14
    bindings.setBinding('cycleHandPoseLeft', 0); // steal button 0 from select
    expect(bindings.getBinding('cycleHandPoseLeft')).toBe(0);
    expect(bindings.getBinding('select')).toBe(-1); // unbound
  });

  it('does not unbind self when re-setting same button', () => {
    const bindings = new GamepadBindings();
    bindings.setBinding('select', 0); // same as default
    expect(bindings.getBinding('select')).toBe(0);
  });

  it('refuses to rebind openSettings', () => {
    const bindings = new GamepadBindings();
    bindings.setBinding('openSettings', 0);
    expect(bindings.getBinding('openSettings')).toBe(9);
  });

  it('does not unbind openSettings when another action steals its button', () => {
    const bindings = new GamepadBindings();
    bindings.setBinding('select', 9); // openSettings is on 9
    expect(bindings.getBinding('select')).toBe(0); // refused, kept default
    expect(bindings.getBinding('openSettings')).toBe(9);
  });

  it('resetDefaults restores all to defaults and persists', () => {
    const bindings = new GamepadBindings();
    bindings.setBinding('select', 5);
    bindings.setBinding('toggleUI', 12);
    bindings.resetDefaults();

    expect(bindings.getBinding('select')).toBe(0);
    expect(bindings.getBinding('toggleUI')).toBe(5);

    // Check it persisted the reset
    const stored = JSON.parse(
      localStorage.getItem('xrblocks:simulator:gamepad-bindings:v1')!
    );
    expect(stored.bindings.select).toBe(0);
  });

  it('getAllBindings returns a copy', () => {
    const bindings = new GamepadBindings();
    const all = bindings.getAllBindings();
    all.select = 99;
    expect(bindings.getBinding('select')).toBe(0); // not affected
  });

  it('handles localStorage throwing gracefully', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });
    // Should not throw
    const bindings = new GamepadBindings();
    expect(bindings.getBinding('select')).toBe(0);
    spy.mockRestore();
  });

  it('handles localStorage.setItem throwing gracefully', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
    const bindings = new GamepadBindings();
    // Should not throw
    bindings.setBinding('select', 3);
    expect(bindings.getBinding('select')).toBe(3); // in-memory still works
    spy.mockRestore();
  });
});
