import {Signal, signal} from '@preact/signals-core';
import * as xb from 'xrblocks';

import {ButtonProperties} from './ButtonProperties';
import {Card} from './Card';

export class CardManager extends xb.Script {
  private cardActiveSignals = new Map<Card, Signal<boolean>>();
  private emptyCard = new Card({
    flexGrow: 1,
  });
  scrollPosition = signal(0);
  scrollTarget = 0;
  cards = signal<Card[]>([]);
  autoscroll = true;
  autoscrollToLastCard = true;

  createNewCard() {
    const cardTitleSignal = signal<string | undefined>();
    const cardBodySignal = signal<string | undefined>();
    const cardImageSrcSignal = signal<string | undefined>();
    const cardActionButtonSignal = signal<ButtonProperties | undefined>();
    const cardActiveSignal = signal<boolean>(true);
    const newCard = new Card({
      title: cardTitleSignal,
      imageSrc: cardImageSrcSignal,
      body: cardBodySignal,
      actionButton: cardActionButtonSignal,
      flexGrow: 1,
    });
    this.cardActiveSignals.set(newCard, cardActiveSignal);
    this.cards.value = [
      ...this.cards.value.slice(0, -1),
      newCard,
      this.emptyCard,
    ];
    return {
      cardTitleSignal,
      cardBodySignal,
      cardImageSrcSignal,
      cardActionButtonSignal,
      cardActiveSignal,
    };
  }

  override update() {
    if (!this.autoscroll) {
      return;
    }
    if (this.autoscrollToLastCard) {
      this.scrollTarget = Math.max(0, this.cards.value.length - 2);
    }
    // Scroll to the target card.
    const deltaTime = xb.getDeltaTime();
    this.scrollPosition.value = xb.clamp(
      this.scrollPosition.value +
        deltaTime * Math.sign(this.scrollTarget - this.scrollPosition.value),
      0,
      this.scrollTarget
    );
  }
}
