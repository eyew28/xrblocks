import {
  BaseOutProperties,
  Container,
  InProperties,
  RenderContext,
  WithSignal,
} from '@pmndrs/uikit';
import {signal} from '@preact/signals-core';

import {Clock} from './Clock';
import {Weather} from './Weather';

export type SystemBarOutProperties = BaseOutProperties;
export type SystemBarProperties = InProperties<SystemBarOutProperties>;

export class SystemBar<
  OutProperties extends SystemBarOutProperties = SystemBarOutProperties,
> extends Container<OutProperties> {
  name = 'System Bar';
  clock = new Clock();
  weather = new Weather();

  constructor(
    properties?: InProperties<OutProperties>,
    initialClasses?: Array<InProperties<BaseOutProperties> | string>,
    config?: {
      renderContext?: RenderContext;
      defaultOverrides?: InProperties<OutProperties>;
      defaults?: WithSignal<OutProperties>;
    }
  ) {
    const height = signal(56);
    const alignItems = signal('center');
    const justifyContent = signal('center');
    const gap = signal(16);
    const fontWeight = signal('semi-bold');
    const color = signal('white');
    const fontSize = signal(24);
    const lineHeight = signal('5px');

    super(properties, initialClasses, {
      ...config,
      defaultOverrides: {
        height,
        alignItems,
        justifyContent,
        gap,
        fontWeight,
        color,
        fontSize,
        lineHeight,
        ...config?.defaultOverrides,
      } as InProperties<OutProperties>,
    });
    this.add(this.clock);
    this.add(this.weather);
  }
}
