/**
 * Compare two small grayscale camera samples while removing whole-frame
 * brightness shifts (for example, auto exposure changes).
 */
export function sceneHasNewItem(
  current: Uint8Array,
  background: Uint8Array,
): boolean {
  if (current.length === 0 || current.length !== background.length) return false;

  let signedShift = 0;
  for (let index = 0; index < current.length; index += 1) {
    signedShift += current[index] - background[index];
  }
  signedShift /= current.length;

  let changedPixels = 0;
  let totalResidual = 0;
  for (let index = 0; index < current.length; index += 1) {
    const residual = Math.abs(current[index] - background[index] - signedShift);
    totalResidual += residual;
    if (residual >= 18) changedPixels += 1;
  }

  const changedRatio = changedPixels / current.length;
  const averageResidual = totalResidual / current.length;
  return changedRatio >= 0.035 && averageResidual >= 6;
}
