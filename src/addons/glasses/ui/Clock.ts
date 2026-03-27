import {
  abortableEffect,
  BaseOutProperties,
  InProperties,
  RenderContext,
  Text,
  TextOutProperties,
  WithSignal,
} from '@pmndrs/uikit';
import {signal} from '@preact/signals-core';

export class Clock<
  OutProperties extends TextOutProperties = TextOutProperties,
> extends Text<OutProperties> {
  name = 'Clock';
  private lastUpdatedTime = Date.now();
  private text;

  constructor(
    properties?: InProperties<OutProperties>,
    initialClasses?: Array<InProperties<BaseOutProperties> | string>,
    config?: {
      renderContext?: RenderContext;
      defaultOverrides?: InProperties<OutProperties>;
      defaults?: WithSignal<OutProperties>;
    }
  ) {
    const timeText = signal('8:32');
    super(properties, initialClasses, {
      ...config,
      defaultOverrides: {
        text: timeText,
        ...config?.defaultOverrides,
      } as InProperties<OutProperties>,
    });
    this.text = timeText;

    abortableEffect(() => {
      const fn = this.updateTime.bind(this);
      const root = this.root.value;
      root.onFrameSet.add(fn);
      return () => root.onFrameSet.delete(fn);
    }, this.abortSignal);
  }

  private updateTime() {
    const msSinceEpoch = Date.now();
    const timeSinceLastUpdate = msSinceEpoch - this.lastUpdatedTime;
    if (timeSinceLastUpdate < 60) {
      return;
    }
    const date = new Date();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const hourString = (((hour + 11) % 12) + 1).toString();
    const minuteString = minute.toString().padStart(2, '0');
    this.text.value = `${hourString}:${minuteString}`;
    this.lastUpdatedTime = msSinceEpoch;
  }
}
