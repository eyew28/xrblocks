import {describe, it, expect, vi, beforeEach} from 'vitest';

// Mock troika-three-text so it fails to import, forcing canvas fallback.
vi.mock('troika-three-text', () => {
  throw new Error('mock: troika not available');
});

import {TextView} from './TextView';

/**
 * Creates a minimal mock CanvasRenderingContext2D that records property
 * assignments and fillText calls so we can assert the rendering behaviour.
 */
function createMockContext() {
  const ctx = {
    clearRect: vi.fn(),
    fillText: vi.fn(),
    font: '',
    fillStyle: '',
    textAlign: '' as CanvasTextAlign,
    textBaseline: '' as CanvasTextBaseline,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('TextView canvas-based text', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  /**
   * Helper: creates a TextView with canvas fallback, injects a mock context,
   * and triggers a text update so the rendering path runs.
   */
  function createCanvasTextView(opts: Record<string, unknown> = {}): {
    view: TextView;
    ctx: ReturnType<typeof createMockContext>;
  } {
    const view = new TextView({useSDFText: false, text: 'test', ...opts});

    // Manually set up the canvas + context like createTextHTML does,
    // but with our mock context so we can inspect it.
    const canvas = document.createElement('canvas');
    const ctx = createMockContext();
    vi.spyOn(canvas, 'getContext').mockReturnValue(
      ctx as unknown as RenderingContext
    );

    // Assign internals that createTextHTML would set.
    view.canvas = canvas;
    view.ctx = ctx;

    // Trigger the rendering path.
    view.text = (opts.text as string) ?? 'test';

    return {view, ctx};
  }

  it('uses configured textAlign=left', () => {
    const {ctx} = createCanvasTextView({textAlign: 'left'});
    expect(ctx.textAlign).toBe('left');
    expect(ctx.fillText).toHaveBeenCalledWith('test', 0, expect.any(Number));
  });

  it('uses configured textAlign=right', () => {
    const {ctx} = createCanvasTextView({textAlign: 'right'});
    expect(ctx.textAlign).toBe('right');
  });

  it('defaults textAlign to center', () => {
    const {ctx} = createCanvasTextView();
    expect(ctx.textAlign).toBe('center');
  });

  it('maps anchorY=top to textBaseline top and drawY=0', () => {
    const {ctx} = createCanvasTextView({anchorY: 'top'});
    expect(ctx.textBaseline).toBe('top');
    expect(ctx.fillText).toHaveBeenCalledWith('test', expect.any(Number), 0);
  });

  it('maps anchorY=bottom to textBaseline bottom', () => {
    const {ctx} = createCanvasTextView({anchorY: 'bottom'});
    expect(ctx.textBaseline).toBe('bottom');
  });

  it('defaults anchorY=middle to textBaseline middle', () => {
    const {ctx} = createCanvasTextView();
    expect(ctx.textBaseline).toBe('middle');
  });

  it('maps anchorY=top-baseline to textBaseline top', () => {
    const {ctx} = createCanvasTextView({anchorY: 'top-baseline'});
    expect(ctx.textBaseline).toBe('top');
  });
});
