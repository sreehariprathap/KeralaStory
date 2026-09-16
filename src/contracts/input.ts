export type InputSource = 'keyboard' | 'touch' | 'mouse';
export type InputAction = 'jump' | 'toggleSprint' | 'interact';
/** Mutable command bridge: DOM controls never directly move a body. */
export interface InputCommands {
  setMove(source: InputSource, x: number, forward: number): void;
  addLook(source: InputSource, dx: number, dy: number): void;
  press(action: InputAction): void;
  setBrake(held: boolean): void;
  clear(source?: InputSource): void;
}
