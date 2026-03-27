import {ReadonlySignal, Signal} from '@preact/signals-core';

export function isSignal<T>(
  value: T | Signal<T> | ReadonlySignal<T>
): value is Signal<T> | ReadonlySignal<T> {
  return (
    value != null &&
    typeof value === 'object' &&
    'value' in value &&
    (value as {brand: unknown}).brand === Symbol.for('preact-signals')
  );
}

export function extractValue<T>(
  value:
    | T
    | 'initial'
    | undefined
    | Signal<T | 'initial' | undefined>
    | ReadonlySignal<T | 'initial' | undefined>
): T | undefined {
  const valueOrInitial = isSignal(value) ? value.value : value;
  return valueOrInitial !== 'initial' ? valueOrInitial : undefined;
}
