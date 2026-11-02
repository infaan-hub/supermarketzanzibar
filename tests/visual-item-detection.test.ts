import { describe, expect, it } from "vitest";
import { sceneHasNewItem } from "../lib/visual-item-detection";

describe("sceneHasNewItem", () => {
  it("does not count an unchanged empty view", () => {
    const background = new Uint8Array(32 * 32).fill(110);
    expect(sceneHasNewItem(background, background)).toBe(false);
  });

  it("ignores a uniform brightness change across the frame", () => {
    const background = new Uint8Array(32 * 32).fill(100);
    const brighterView = new Uint8Array(32 * 32).fill(118);
    expect(sceneHasNewItem(brighterView, background)).toBe(false);
  });

  it("detects an item that changes a local part of the view", () => {
    const background = new Uint8Array(32 * 32).fill(100);
    const itemView = background.slice();
    for (let row = 8; row < 24; row += 1) {
      for (let column = 10; column < 22; column += 1) {
        itemView[row * 32 + column] = 210;
      }
    }
    expect(sceneHasNewItem(itemView, background)).toBe(true);
  });
});

