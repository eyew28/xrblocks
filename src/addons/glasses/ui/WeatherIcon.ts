import {
  BaseOutProperties,
  InProperties,
  RenderContext,
  SvgOutProperties,
  WithSignal,
} from '@pmndrs/uikit';
import {computed} from '@preact/signals-core';

import {MaterialSymbolsIcon} from './MaterialSymbolsIcon';
import {extractValue} from './utils';
import {WMO_CODE_TO_ICON} from './WeatherIconMapping';

const LOCATION_DISABLED_ICON = 'location_disabled';
const UNKNOWN_WEATHER_CODE_ICON = 'unknown_med';

export type WeatherIconOutProperties = SvgOutProperties & {
  wmoCode: number;
  showLocationDisabledIcon?: boolean;
  iconStyle?: string;
  iconWeight?: number;
};

export type WeatherIconProperties = InProperties<WeatherIconOutProperties>;

export class WeatherIcon extends MaterialSymbolsIcon {
  name = 'Weather Icon';
  constructor(
    properties?: WeatherIconProperties,
    initialClasses?: Array<InProperties<BaseOutProperties> | string>,
    config?: {
      renderContext?: RenderContext;
      defaultOverrides?: WeatherIconProperties;
      defaults?: WithSignal<WeatherIconOutProperties>;
    }
  ) {
    const wmoCode =
      properties?.wmoCode ?? config?.defaultOverrides?.wmoCode ?? 0;
    const showLocationDisabledIcon =
      properties?.showLocationDisabledIcon ??
      config?.defaultOverrides?.showLocationDisabledIcon;

    const icon = computed(() => {
      if (extractValue(showLocationDisabledIcon) ?? false) {
        return LOCATION_DISABLED_ICON;
      }
      const wmoCodeValue = extractValue<number>(wmoCode) ?? -1;
      return wmoCodeValue in WMO_CODE_TO_ICON
        ? WMO_CODE_TO_ICON[wmoCodeValue]
        : UNKNOWN_WEATHER_CODE_ICON;
    });
    const iconStyle = 'rounded';
    const iconWeight = 600;

    super(properties, initialClasses, {
      ...config,
      defaultOverrides: {
        icon: icon,
        iconStyle: iconStyle,
        iconWeight: iconWeight,
        ...config?.defaultOverrides,
      },
    });
  }
}
