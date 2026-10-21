
import Phaser from "phaser";
import TetrisScene from "./game/TetrisScene";
import "./style.css";


const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 390,
  height: 650,
  backgroundColor: "#090d1b",
  antialias: true,
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,
    height: 650,
  },
  input: {
    activePointers: 3,
  },
  scene: [TetrisScene],
});


declare global {
  interface Window {
    tetrisGame: Phaser.Game;
  }
}

window.tetrisGame = game;

function getScene(): TetrisScene | undefined {
  return game.scene.getScene("Tetris") as TetrisScene | undefined;
}

document.querySelectorAll<HTMLButtonElement>("[data-action]")
  .forEach((button) => {
    const action = button.dataset.action!;
    let repeatTimer: number | undefined;

    const execute = () => {
      const scene = getScene();
      if (!scene?.sys.isActive()) return;

      switch (action) {
        case "left":
          scene.move(-1);
          break;
        case "right":
          scene.move(1);
          break;
        case "down":
          scene.softDrop();
          break;
        case "rotate":
          scene.rotate();
          break;
        case "hardDrop":
          scene.hardDrop();
          break;
      }
    };

    const start = (event: PointerEvent) => {
      event.preventDefault();
      if (button.disabled) return;

      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional.
      }

      execute();

      // Hold left/right/down to repeat movement.
      if (["left", "right", "down"].includes(action)) {
        repeatTimer = window.setTimeout(() => {
          repeatTimer = window.setInterval(execute, 75);
        }, 180);
      }
    };

    const stop = () => {
      if (repeatTimer !== undefined) {
        window.clearTimeout(repeatTimer);
        window.clearInterval(repeatTimer);
        repeatTimer = undefined;
      }
    };

    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", stop);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  });

document.getElementById("pauseBtn")?.addEventListener("click", () => {
  getScene()?.togglePause();
});
