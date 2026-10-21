
import Phaser from "phaser";

const COLS = 10;
const ROWS = 20;
const CELL = 25;
const BOARD_X = 16;
const BOARD_Y = 88;

type Point = { x: number; y: number };
type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

type Piece = {
  type: PieceType;
  cells: Point[];
  x: number;
  y: number;
};

const COLORS: Record<PieceType, number> = {
  I: 0x43e8ff,
  O: 0xffd166,
  T: 0xc084fc,
  S: 0x51f6a8,
  Z: 0xff5c86,
  J: 0x6585ff,
  L: 0xffa45b,
};

const SHAPES: Record<PieceType, Point[]> = {
  I: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
  O: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  T: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  S: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  Z: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  J: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  L: [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
};

export default class TetrisScene extends Phaser.Scene {
  private board: (PieceType | null)[][] = [];
  private active!: Piece;
  private nextType!: PieceType;
  private bag: PieceType[] = [];

  private graphics!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private linesText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;

  private score = 0;
  private lines = 0;
  private level = 1;
  private best = 0;
  private gravityTimer = 0;
  private dropInterval = 800;
  private softDropping = false;
  private started = false;
  private paused = false;
  private gameOver = false;

  constructor() {
    super("Tetris");
  }

  create() {
    this.graphics = this.add.graphics();
    this.best = this.readBest();

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "monospace",
      color: "#eaf0ff",
      fontSize: "13px",
    };

    this.add.text(BOARD_X, 16, "NEON BLOCKS", {
      ...textStyle,
      fontSize: "21px",
      fontStyle: "bold",
      color: "#51f6d2",
    });

    this.add.text(BOARD_X, 49, "STACK SMART. STAY ALIVE.", {
      ...textStyle,
      fontSize: "9px",
      color: "#7e8eb8",
    });

    const sx = 280;
    this.add.text(sx, 91, "SCORE", { ...textStyle, color: "#8c9bc0" });
    this.scoreText = this.add.text(sx, 111, "0", {
      ...textStyle, fontSize: "20px", color: "#51f6d2",
    });

    this.add.text(sx, 153, "BEST", { ...textStyle, color: "#8c9bc0" });
    this.bestText = this.add.text(sx, 173, String(this.best), {
      ...textStyle, fontSize: "15px",
    });

    this.add.text(sx, 215, "LEVEL", { ...textStyle, color: "#8c9bc0" });
    this.levelText = this.add.text(sx, 235, "1", {
      ...textStyle, fontSize: "20px", color: "#ffd166",
    });

    this.add.text(sx, 277, "LINES", { ...textStyle, color: "#8c9bc0" });
    this.linesText = this.add.text(sx, 297, "0", {
      ...textStyle, fontSize: "17px",
    });

    this.add.text(sx, 344, "NEXT", {
      ...textStyle, fontStyle: "bold", color: "#51f6d2",
    });

    this.overlay = this.add.container(0, 0);
    this.overlay.setDepth(20);

    this.input.keyboard?.on("keydown-LEFT", () => this.move(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => this.move(1));
    this.input.keyboard?.on("keydown-DOWN", () => this.softDrop());
    this.input.keyboard?.on("keydown-UP", () => this.rotate());
    this.input.keyboard?.on("keydown-X", () => this.rotate());
    this.input.keyboard?.on("keydown-SPACE", () => this.hardDrop());
    this.input.keyboard?.on("keydown-P", () => this.togglePause());
    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());

    this.resetGame();
    this.showStartScreen();
  }

  update(_time: number, delta: number) {
    if (!this.started || this.paused || this.gameOver) {
      this.renderBoard();
      return;
    }

    this.gravityTimer += delta;
    const interval = this.softDropping
      ? Math.min(55, this.dropInterval)
      : this.dropInterval;

    if (this.gravityTimer >= interval) {
      this.gravityTimer = 0;
      this.stepDown();
    }

    this.renderBoard();
  }

  private resetGame() {
    this.board = Array.from({ length: ROWS }, () =>
      Array<PieceType | null>(COLS).fill(null),
    );

    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = 800;
    this.gravityTimer = 0;
    this.softDropping = false;
    this.paused = false;
    this.gameOver = false;
    this.started = true;

    this.bag = [];
    this.nextType = this.drawBagPiece();
    this.spawnPiece();
    this.refreshStats();
    this.overlay.removeAll(true);
  }

  private drawBagPiece(): PieceType {
    if (this.bag.length === 0) {
      this.bag = (Object.keys(SHAPES) as PieceType[])
        .sort(() => Math.random() - 0.5);
    }
    return this.bag.pop()!;
  }

  private spawnPiece() {
    this.active = {
      type: this.nextType,
      cells: SHAPES[this.nextType].map((p) => ({ ...p })),
      x: 3,
      y: 0,
    };

    this.nextType = this.drawBagPiece();

    if (this.collides(this.active, 0, 0)) {
      this.endGame();
    }
  }

  private collides(piece: Piece, dx: number, dy: number): boolean {
    return piece.cells.some(({ x, y }) => {
      const nx = piece.x + x + dx;
      const ny = piece.y + y + dy;

      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny < 0) return false;
      return this.board[ny][nx] !== null;
    });
  }

  move(direction: -1 | 1) {
    if (!this.canPlay()) return;
    if (!this.collides(this.active, direction, 0)) {
      this.active.x += direction;
    }
  }

  softDrop() {
    if (!this.canPlay()) return;
    if (!this.collides(this.active, 0, 1)) {
      this.active.y++;
      this.score += 1;
      this.refreshStats();
    } else {
      this.lockPiece();
    }
    this.gravityTimer = 0;
  }

  setSoftDropping(value: boolean) {
    this.softDropping = value && this.canPlay();
    if (value) this.softDrop();
  }

  private stepDown() {
    if (!this.collides(this.active, 0, 1)) {
      this.active.y++;
    } else {
      this.lockPiece();
    }
  }

  hardDrop() {
    if (!this.canPlay()) return;

    let distance = 0;
    while (!this.collides(this.active, 0, 1)) {
      this.active.y++;
      distance++;
    }

    this.score += distance * 2;
    this.lockPiece();
    this.refreshStats();
  }

  rotate() {
    if (!this.canPlay() || this.active.type === "O") return;

    const rotated = this.active.cells.map(({ x, y }) => ({
      x: -y,
      y: x,
    }));

    const minX = Math.min(...rotated.map((p) => p.x));
    const minY = Math.min(...rotated.map((p) => p.y));

    const normalized = rotated.map((p) => ({
      x: p.x - minX,
      y: p.y - minY,
    }));

    // Small wall kicks make rotation near the edges feel natural.
    for (const kick of [0, -1, 1, -2, 2]) {
      const candidate: Piece = {
        ...this.active,
        cells: normalized,
        x: this.active.x + kick,
      };

      if (!this.collides(candidate, 0, 0)) {
        this.active = candidate;
        return;
      }
    }
  }

  private lockPiece() {
    for (const cell of this.active.cells) {
      const x = this.active.x + cell.x;
      const y = this.active.y + cell.y;

      if (y < 0) {
        this.endGame();
        return;
      }

      if (y < ROWS && x >= 0 && x < COLS) {
        this.board[y][x] = this.active.type;
      }
    }

    this.clearLines();

    if (!this.gameOver) {
      this.spawnPiece();
    }

    this.gravityTimer = 0;
  }

  private clearLines() {
    let cleared = 0;

    for (let y = ROWS - 1; y >= 0; y--) {
      if (this.board[y].every((cell) => cell !== null)) {
        this.board.splice(y, 1);
        this.board.unshift(Array<PieceType | null>(COLS).fill(null));
        cleared++;
        y++;
      }
    }

    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800];
      this.score += (points[cleared] ?? 800) * this.level;
      this.lines += cleared;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(80, 800 * Math.pow(0.82, this.level - 1));

      if (this.score > this.best) {
        this.best = this.score;
        this.saveBest();
      }

      this.refreshStats();
    }
  }

  private refreshStats() {
    this.scoreText.setText(this.score.toLocaleString());
    this.levelText.setText(String(this.level));
    this.linesText.setText(String(this.lines));
    this.bestText.setText(this.best.toLocaleString());
  }

  private readBest(): number {
    try {
      return Number(localStorage.getItem("neon-blocks-best")) || 0;
    } catch {
      return 0;
    }
  }

  private saveBest() {
    try {
      localStorage.setItem("neon-blocks-best", String(this.best));
    } catch {
      // The game still works if storage is unavailable.
    }
  }

  togglePause() {
    if (this.gameOver) return;

    if (!this.started) {
      this.resetGame();
      return;
    }

    this.paused = !this.paused;
    this.overlay.removeAll(true);

    if (this.paused) {
      this.showOverlay("PAUSED", "Take a breath.", "Tap RESUME to continue");
    }
  }

  private canPlay() {
    return this.started && !this.paused && !this.gameOver;
  }

  private endGame() {
    this.gameOver = true;
    this.softDropping = false;

    if (this.score > this.best) {
      this.best = this.score;
      this.saveBest();
      this.refreshStats();
    }

    this.showOverlay("GAME OVER", `Score: ${this.score}`, "Tap PLAY AGAIN");
  }

  private showStartScreen() {
    this.started = false;
    this.showOverlay("NEON BLOCKS", "Stack. Clear. Repeat.", "Tap PLAY TO START");
  }

  private showOverlay(title: string, subtitle: string, hint: string) {
    this.overlay.removeAll(true);

    const shade = this.add.rectangle(
      195, 340, 390, 680, 0x070a16, 0.88,
    ).setInteractive();

    const heading = this.add.text(195, 260, title, {
      fontFamily: "monospace",
      fontSize: title.length > 10 ? "21px" : "27px",
      fontStyle: "bold",
      color: "#51f6d2",
    }).setOrigin(0.5);

    const sub = this.add.text(195, 310, subtitle, {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#eaf0ff",
    }).setOrigin(0.5);

    const button = this.add.rectangle(
      195, 375, 220, 48, 0x172b3b,
    ).setStrokeStyle(1, 0x51f6d2).setInteractive({ useHandCursor: true });

    const buttonText = this.add.text(195, 375, hint.toUpperCase(), {
      fontFamily: "monospace",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#51f6d2",
    }).setOrigin(0.5);

    const action = () => {
      if (this.paused) {
        this.paused = false;
        this.overlay.removeAll(true);
      } else {
        this.resetGame();
      }
    };

    button.on("pointerdown", action);
    buttonText.setInteractive();
    buttonText.on("pointerdown", action);

    shade.on("pointerdown", () => {
      if (!this.started || this.gameOver) action();
    });

    this.overlay.add([shade, heading, sub, button, buttonText]);
  }

  private renderBoard() {
    const g = this.graphics;
    g.clear();

    // Board background and grid.
    g.fillStyle(0x0b1020, 1);
    g.fillRoundedRect(
      BOARD_X - 2, BOARD_Y - 2, COLS * CELL + 4, ROWS * CELL + 4, 5,
    );

    g.lineStyle(1, 0x1b2541, 0.72);
    for (let x = 0; x <= COLS; x++) {
      g.lineBetween(
        BOARD_X + x * CELL, BOARD_Y,
        BOARD_X + x * CELL, BOARD_Y + ROWS * CELL,
      );
    }

    for (let y = 0; y <= ROWS; y++) {
      g.lineBetween(
        BOARD_X, BOARD_Y + y * CELL,
        BOARD_X + COLS * CELL, BOARD_Y + y * CELL,
      );
    }

    // Locked blocks.
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const type = this.board[y][x];
        if (type) this.drawBlock(g, x, y, COLORS[type], 1);
      }
    }

    if (!this.started && !this.gameOver) return;

    if (this.active) {
      // Ghost landing position.
      let ghostY = this.active.y;
      while (!this.collides({ ...this.active, y: ghostY }, 0, 1)) {
        ghostY++;
      }

      for (const cell of this.active.cells) {
        this.drawBlock(
          g, this.active.x + cell.x, ghostY + cell.y,
          COLORS[this.active.type], 0.19,
        );
      }

      // Current piece.
      for (const cell of this.active.cells) {
        this.drawBlock(
          g, this.active.x + cell.x, this.active.y + cell.y,
          COLORS[this.active.type], 1,
        );
      }
    }

    this.drawNextPiece(g);
  }

  private drawBlock(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    color: number,
    alpha: number,
  ) {
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return;

    const px = BOARD_X + x * CELL;
    const py = BOARD_Y + y * CELL;

    g.fillStyle(color, alpha);
    g.fillRoundedRect(px + 2, py + 2, CELL - 4, CELL - 4, 4);

    if (alpha > 0.5) {
      g.fillStyle(0xffffff, 0.28);
      g.fillRoundedRect(px + 4, py + 3, CELL - 8, 3, 1);
      g.lineStyle(1, color, 1);
      g.strokeRoundedRect(px + 2, py + 2, CELL - 4, CELL - 4, 4);
    }
  }

  private drawNextPiece(g: Phaser.GameObjects.Graphics) {
    const previewX = 284;
    const previewY = 373;
    const size = 15;

    g.fillStyle(0x10182b, 1);
    g.fillRoundedRect(previewX - 6, previewY - 8, 94, 88, 8);

    const cells = SHAPES[this.nextType];
    const minX = Math.min(...cells.map((p) => p.x));
    const maxX = Math.max(...cells.map((p) => p.x));
    const minY = Math.min(...cells.map((p) => p.y));
    const maxY = Math.max(...cells.map((p) => p.y));

    const width = (maxX - minX + 1) * size;
    const height = (maxY - minY + 1) * size;
    const offsetX = previewX + (82 - width) / 2;
    const offsetY = previewY + (68 - height) / 2;

    for (const cell of cells) {
      const x = offsetX + (cell.x - minX) * size;
      const y = offsetY + (cell.y - minY) * size;

      g.fillStyle(COLORS[this.nextType], 1);
      g.fillRoundedRect(x + 1, y + 1, size - 3, size - 3, 3);
      g.fillStyle(0xffffff, 0.25);
      g.fillRect(x + 3, y + 2, size - 7, 2);
    }
  }
}
