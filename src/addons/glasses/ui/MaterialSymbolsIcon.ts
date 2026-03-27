import {
  BaseOutProperties,
  InProperties,
  RenderContext,
  Svg,
  SvgOutProperties,
  WithSignal,
} from '@pmndrs/uikit';
import {computed} from '@preact/signals-core';

import {extractValue} from './utils';

const SVG_BASE_PATH =
  'https://cdn.jsdelivr.net/gh/marella/material-symbols@v0.33.0/svg/{{weight}}/{{style}}/{{icon}}.svg';

export type MaterialSymbolsIconOutProperties = SvgOutProperties & {
  icon?: string;
  iconWeight?: number;
  iconStyle?: string;
};

export type MaterialSymbolsIconProperties =
  InProperties<MaterialSymbolsIconOutProperties>;

export class MaterialSymbolsIcon extends Svg<SvgOutProperties> {
  name = 'Material Symbols Icon';
  constructor(
    properties?: MaterialSymbolsIconProperties,
    initialClasses?: Array<InProperties<BaseOutProperties> | string>,
    config?: {
      renderContext?: RenderContext;
      defaultOverrides?: MaterialSymbolsIconProperties;
      defaults?: WithSignal<MaterialSymbolsIconOutProperties>;
    }
  ) {
    const icon = properties?.icon ?? config?.defaultOverrides?.icon;
    const iconStyle =
      properties?.iconStyle ?? config?.defaultOverrides?.iconStyle;
    const iconWeight =
      properties?.iconWeight ?? config?.defaultOverrides?.iconWeight;

    const svgPath = computed(() => {
      const finalIcon = extractValue(icon) ?? 'question_mark';
      const finalStyle = extractValue(iconStyle) ?? 'outlined';
      const finalWeight = extractValue(iconWeight) ?? 400;

      return SVG_BASE_PATH.replace('{{style}}', finalStyle)
        .replace('{{icon}}', finalIcon)
        .replace('{{weight}}', String(finalWeight));
    });

    super(properties, initialClasses, {
      ...config,
      defaultOverrides: {
        src: svgPath,
        ...config?.defaultOverrides,
      },
    });
  }
}
