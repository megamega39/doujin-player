/** mp4, webm を動画として判定 */
export const VIDEO_EXT = /\.(mp4|webm)(\?|$)/i;

export function isVideoTrack(filePath: string): boolean {
  return VIDEO_EXT.test(filePath);
}
