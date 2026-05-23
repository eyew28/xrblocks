export class SetSimulatorEnvironmentEvent extends Event {
  static type = 'setSimulatorEnvironment';
  constructor(public environmentIndex: number) {
    super(SetSimulatorEnvironmentEvent.type, {bubbles: true, composed: true});
  }
}
