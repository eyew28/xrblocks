import {Container} from '@pmndrs/uikit';

import {SystemBar} from './SystemBar';

const FONTS_ROOT_DIR =
  'https://cdn.jsdelivr.net/gh/xrblocks/proprietary-assets@21e7f18c263663a1c126891babe4a444d92000a9/fonts/';

export class SystemUI extends Container {
  name = 'System UI';
  canvas: Container;
  private systemBar = new SystemBar();

  constructor(
    sizeX = 1,
    sizeY: number | null = 1,
    containerHeight: number | null = 364
  ) {
    super({
      flexDirection: 'column',
      padding: 0,
      gap: 0,
      sizeX: sizeX ?? undefined,
      sizeY: sizeY ?? undefined,
      pixelSize: sizeX / 420,
      fontFamilies: {
        googleSansFlex: {
          750: `${FONTS_ROOT_DIR}/GoogleSansFlex_750.json`,
          600: `${FONTS_ROOT_DIR}/GoogleSansFlex_600.json`,
        },
      },
    });

    this.canvas = new Container({
      height: containerHeight ?? undefined,
      flexDirection: 'column',
      overflow: 'scroll',
      justifyContent: 'flex-end',
    });

    this.add(this.canvas);
    this.add(this.systemBar);
  }
}
