// Shared by the image element and production preload: identical candidate selection.
export const networkPreviewSizes = '(max-width: 850px) calc(100vw - 48px), (max-width: 1179px) calc(100vw - 460px), (max-width: 1600px) calc(100vw - 740px), 900px';
export const networkPreviewCandidates = [480, 768, 982];
export const networkPreviewName = width => width === 982 ? 'oxphos-network-preview.webp' : `oxphos-network-preview-${width}.webp`;
export function networkPreviewSrcset(base) {
  return networkPreviewCandidates.map(width=>`${new URL(networkPreviewName(width),base).href} ${width}w`).join(', ');
}
