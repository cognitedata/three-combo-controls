const keyMap: { [s: string]: string } = {
  16: 'shift',
  17: 'ctrl',
  18: 'alt',
  27: 'escape',
  32: 'space',
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  65: 'a',
  68: 'd',
  69: 'e',
  81: 'q',
  83: 's',
  87: 'w'
};

export default class Keyboard {
  private keys: { [s: string]: number } = {};
  constructor() {
    Object.keys(keyMap).forEach((key: string) => {
      this.keys[keyMap[key]] = 0;
    });

    window.addEventListener('keydown', event => {
      if (event.metaKey) {
        return;
      }

      if (event.keyCode in keyMap) {
        if (this.keys[keyMap[event.keyCode]] === 0) {
          this.keys[keyMap[event.keyCode]] = 2;
        }
      }
    });

    window.addEventListener('keyup', event => {
      if (event.keyCode in keyMap) {
        this.keys[keyMap[event.keyCode]] = 0;
      }
    });

    window.addEventListener('blur', () => {
      Object.keys(this.keys).forEach(key => {
        this.keys[key] = 0;
      });
    });
  }

  public isPressed = (key: string) => this.keys[key] >= 1;

  public comsumePressed = (key: string) => {
    const p = this.keys[key] === 2;
    if (p) {
      this.keys[key] = 1;
    }
    return p;
  };
}
