// Tetris Game Engine
const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 400;
const BLOCK_SIZE = 20;
const COLS = CANVAS_WIDTH / BLOCK_SIZE; // 12
const ROWS = CANVAS_HEIGHT / BLOCK_SIZE; // 20

const SHAPES = [
  [], // empty
  [[1, 1, 1, 1]], // I
  [[1, 1], [1, 1]], // O
  [[0, 1, 0], [1, 1, 1]], // T
  [[1, 0, 0], [1, 1, 1]], // L
  [[0, 0, 1], [1, 1, 1]], // J
  [[0, 1, 1], [1, 1, 0]], // S
  [[1, 1, 0], [0, 1, 1]]  // Z
];

const COLORS = [
  null,
  '#00f0f0', // I - Cyan
  '#f0f000', // O - Yellow
  '#a000f0', // T - Purple
  '#f0a000', // L - Orange
  '#0000f0', // J - Blue
  '#00f000', // S - Green
  '#f00000'  // Z - Red
];

class Tetris {
  constructor(canvasId, nextCanvasId, scoreId, linesId, levelId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.nextCanvas = document.getElementById(nextCanvasId);
    this.nextCtx = this.nextCanvas ? this.nextCanvas.getContext('2d') : null;

    this.scoreEl = document.getElementById(scoreId);
    this.linesEl = document.getElementById(linesId);
    this.levelEl = document.getElementById(levelId);

    this.grid = this.createGrid();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.isPaused = false;

    this.dropCounter = 0;
    this.dropInterval = 1000;
    this.lastTime = 0;

    this.currentPiece = null;
    this.nextPiece = null;

    this.init();
  }

  createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  getRandomPiece() {
    const typeId = Math.floor(Math.random() * 7) + 1;
    const matrix = SHAPES[typeId];
    return {
      typeId,
      matrix,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: 0
    };
  }

  init() {
    this.reset();
    this.bindEvents();
  }

  reset() {
    this.grid = this.createGrid();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = 1000;
    this.gameOver = false;
    this.isPaused = false;

    this.currentPiece = this.getRandomPiece();
    this.nextPiece = this.getRandomPiece();

    this.updateStats();
    this.drawNext();
  }

  updateStats() {
    if (this.scoreEl) this.scoreEl.innerText = this.score;
    if (this.linesEl) this.linesEl.innerText = this.lines;
    if (this.levelEl) this.levelEl.innerText = this.level;
  }

  collide(piece, offset = { x: 0, y: 0 }) {
    const m = piece.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] !== 0) {
          const newX = piece.x + c + offset.x;
          const newY = piece.y + r + offset.y;
          if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
          if (newY >= 0 && this.grid[newY][newX] !== 0) return true;
        }
      }
    }
    return false;
  }

  merge(piece) {
    piece.matrix.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value !== 0) {
          const y = piece.y + r;
          const x = piece.x + c;
          if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
            this.grid[y][x] = piece.typeId;
          }
        }
      });
    });
  }

  rotate(matrix) {
    const N = matrix.length;
    const M = matrix[0].length;
    const result = Array.from({ length: M }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < M; c++) {
        result[c][N - 1 - r] = matrix[r][c];
      }
    }
    return result;
  }

  playerRotate() {
    if (this.gameOver || this.isPaused) return;
    const rotated = this.rotate(this.currentPiece.matrix);
    const oldMatrix = this.currentPiece.matrix;
    this.currentPiece.matrix = rotated;

    let offset = 0;
    while (this.collide(this.currentPiece)) {
      this.currentPiece.x += offset;
      offset = -(offset + (offset >= 0 ? 1 : -1));
      if (Math.abs(offset) > this.currentPiece.matrix[0].length) {
        this.currentPiece.matrix = oldMatrix;
        return;
      }
    }
  }

  playerMove(dir) {
    if (this.gameOver || this.isPaused) return;
    if (!this.collide(this.currentPiece, { x: dir, y: 0 })) {
      this.currentPiece.x += dir;
    }
  }

  playerDrop() {
    if (this.gameOver || this.isPaused) return;
    if (!this.collide(this.currentPiece, { x: 0, y: 1 })) {
      this.currentPiece.y++;
      this.score += 1;
      this.updateStats();
    } else {
      this.lockPiece();
    }
    this.dropCounter = 0;
  }

  hardDrop() {
    if (this.gameOver || this.isPaused) return;
    while (!this.collide(this.currentPiece, { x: 0, y: 1 })) {
      this.currentPiece.y++;
      this.score += 2;
    }
    this.lockPiece();
    this.updateStats();
  }

  lockPiece() {
    this.merge(this.currentPiece);
    this.clearLines();
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.getRandomPiece();
    this.drawNext();

    if (this.collide(this.currentPiece)) {
      this.gameOver = true;
    }
  }

  clearLines() {
    let linesCleared = 0;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (this.grid[y][x] === 0) continue outer;
      }
      const row = this.grid.splice(y, 1)[0].fill(0);
      this.grid.unshift(row);
      y++;
      linesCleared++;
    }

    if (linesCleared > 0) {
      const lineScores = [0, 100, 300, 500, 800];
      this.score += (lineScores[linesCleared] || 1000) * this.level;
      this.lines += linesCleared;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 80);
      this.updateStats();
    }
  }

  getGhostPosition() {
    let ghostY = this.currentPiece.y;
    while (!this.collide({ ...this.currentPiece, y: ghostY + 1 })) {
      ghostY++;
    }
    return ghostY;
  }

  draw() {
    this.ctx.fillStyle = '#111827';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] !== 0) {
          this.drawBlock(this.ctx, c, r, COLORS[this.grid[r][c]]);
        }
      }
    }

    if (this.currentPiece && !this.gameOver) {
      // Draw Ghost Piece
      const ghostY = this.getGhostPosition();
      this.drawPiece(this.ctx, this.currentPiece, { x: this.currentPiece.x, y: ghostY }, true);

      // Draw Active Piece
      this.drawPiece(this.ctx, this.currentPiece, { x: this.currentPiece.x, y: this.currentPiece.y });
    }

    if (this.gameOver) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '20px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
      this.ctx.font = '12px sans-serif';
      this.ctx.fillText('Pressione R para reiniciar', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15);
    }
  }

  drawNext() {
    if (!this.nextCtx) return;
    this.nextCtx.fillStyle = '#1f2937';
    this.nextCtx.fillRect(0, 0, 100, 100);

    if (this.nextPiece) {
      const m = this.nextPiece.matrix;
      const offsetX = (100 - m[0].length * BLOCK_SIZE) / 2;
      const offsetY = (100 - m.length * BLOCK_SIZE) / 2;

      m.forEach((row, r) => {
        row.forEach((value, c) => {
          if (value !== 0) {
            this.nextCtx.fillStyle = COLORS[this.nextPiece.typeId];
            this.nextCtx.fillRect(offsetX + c * BLOCK_SIZE, offsetY + r * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
          }
        });
      });
    }
  }

  drawBlock(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
  }

  drawPiece(ctx, piece, pos, isGhost = false) {
    piece.matrix.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value !== 0) {
          if (isGhost) {
            ctx.strokeStyle = COLORS[piece.typeId];
            ctx.lineWidth = 1;
            ctx.strokeRect((pos.x + c) * BLOCK_SIZE + 0.5, (pos.y + r) * BLOCK_SIZE + 0.5, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
          } else {
            this.drawBlock(ctx, pos.x + c, pos.y + r, COLORS[piece.typeId]);
          }
        }
      });
    });
  }

  update(time = 0) {
    const deltaTime = time - this.lastTime;
    this.lastTime = time;

    if (!this.isPaused && !this.gameOver) {
      this.dropCounter += deltaTime;
      if (this.dropCounter > this.dropInterval) {
        this.playerDrop();
      }
    }

    this.draw();
    requestAnimationFrame(this.update.bind(this));
  }

  start() {
    this.lastTime = performance.now();
    requestAnimationFrame(this.update.bind(this));
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => {
      if (this.gameOver && e.key.toLowerCase() === 'r') {
        this.reset();
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          this.playerMove(-1);
          break;
        case 'ArrowRight':
          this.playerMove(1);
          break;
        case 'ArrowDown':
          this.playerDrop();
          break;
        case 'ArrowUp':
          this.playerRotate();
          break;
        case ' ':
          this.hardDrop();
          break;
        case 'p':
        case 'P':
          this.isPaused = !this.isPaused;
          break;
      }
    });
  }
}

// Export for module or global use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Tetris;
} else {
  window.Tetris = Tetris;
}