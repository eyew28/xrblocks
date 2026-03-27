import {
  abortableEffect,
  BaseOutProperties,
  Container,
  InProperties,
} from '@pmndrs/uikit';
import {computed} from '@preact/signals-core';
import * as THREE from 'three';

import {ActionButton} from './ActionButton';
import {BoxShadow} from './BoxShadow';

export type CardActionButtonProperties = {
  text: string;
  icon?: string;
  iconStyle?: string;
  iconWeight?: number;
} & BaseOutProperties;

// Shadows from bottom to top.
const shadowDefinitions = [
  {blur: 6, spread: 2, color: '#000000'},
  {blur: 12, spread: 6, color: 'rgba(0, 0, 0, 0.90)'},
];

function generateActionButtonBackgroundTexture(
  actionButtonSize: THREE.Vector2Tuple,
  canvasSize: THREE.Vector2Tuple,
  padding: number,
  radius: number,
  canvas: HTMLCanvasElement
): THREE.Texture {
  canvas.width = canvasSize[0];
  canvas.height = canvasSize[1];
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#00000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw each shadow layer, from bottom to top
  for (const shadow of shadowDefinitions) {
    const spread = shadow.spread || 0;
    const shapeSizeX = actionButtonSize[0] + spread * 2;
    const shapeSizeY = actionButtonSize[1] + spread * 2;

    ctx.shadowBlur = shadow.blur || 0;
    ctx.shadowColor = shadow.color || 'black';

    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.roundRect(
      padding - spread,
      padding - spread,
      shapeSizeX,
      shapeSizeY,
      radius
    );
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

export class CardActionButton extends Container<BaseOutProperties> {
  name = 'Card Action Button';
  private shadowCanvas = document.createElement('canvas');
  private shadowTexture = new THREE.CanvasTexture(this.shadowCanvas);
  constructor(properties: InProperties<CardActionButtonProperties>) {
    const spaceToReserve = computed(() => 56 - 16);
    super({height: spaceToReserve, marginX: 'auto'});

    const paddingAmount = 15;
    const container = new Container(properties, undefined, {
      defaultOverrides: {
        marginTop: -16 - paddingAmount,
        padding: paddingAmount,
        justifyContent: 'center',
        alignContent: 'center',
      },
    });
    this.add(container);

    const actionButton = new ActionButton({
      ...properties,
      backgroundColor: 'black',
    });
    const actionButtonShadow = new BoxShadow({
      boxSize: actionButton.size,
      boxCornerRadius: actionButton.properties.signal.borderTopLeftRadius,
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      positionTop: 0,
      positionLeft: 0,
    });
    container.add(actionButtonShadow);
    container.add(actionButton);

    abortableEffect(() => {
      const actionButtonSize = actionButton.size.value;
      const containerSize = container.size.value;
      if (actionButtonSize && containerSize) {
        generateActionButtonBackgroundTexture(
          actionButtonSize,
          containerSize,
          paddingAmount,
          100,
          this.shadowCanvas
        );
        this.shadowTexture.needsUpdate = true;
      }
    }, this.abortSignal);
  }

  override dispose() {
    this.shadowTexture.dispose();
    super.dispose();
  }
}
