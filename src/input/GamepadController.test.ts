import {describe, it, expect} from 'vitest';

import {GamepadController} from './GamepadController';

describe('GamepadController', () => {
  describe('applyDeadzone', () => {
    it('returns 0 for values within deadzone', () => {
      expect(GamepadController.applyDeadzone(0)).toBe(0);
      expect(GamepadController.applyDeadzone(0.1)).toBe(0);
      expect(GamepadController.applyDeadzone(-0.1)).toBe(0);
      expect(GamepadController.applyDeadzone(0.14)).toBe(0);
    });

    it('returns remapped value outside deadzone', () => {
      const result = GamepadController.applyDeadzone(1.0);
      expect(result).toBeCloseTo(1.0, 2);
    });

    it('returns negative remapped value for negative input', () => {
      const result = GamepadController.applyDeadzone(-1.0);
      expect(result).toBeCloseTo(-1.0, 2);
    });

    it('remaps linearly from deadzone edge', () => {
      // At exactly the deadzone boundary, should be ~0
      const atEdge = GamepadController.applyDeadzone(0.15);
      expect(atEdge).toBeCloseTo(0, 1);

      // Halfway between deadzone and 1.0
      const mid = GamepadController.applyDeadzone(0.575);
      expect(mid).toBeCloseTo(0.5, 1);
    });

    it('returns 0 for NaN', () => {
      expect(GamepadController.applyDeadzone(NaN)).toBe(0);
    });

    it('returns 0 for Infinity', () => {
      expect(GamepadController.applyDeadzone(Infinity)).toBe(0);
      expect(GamepadController.applyDeadzone(-Infinity)).toBe(0);
    });
  });
});
