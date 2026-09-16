export interface LocationBoardLayout {
  boardHeight: number;
  boardCenterY: number;
  boardBottomY: number;
  postCenterY: number;
  postHeight: number;
  postTopY: number;
}

/** Keeps a board support behind its lower edge rather than across the painted face. */
export function locationBoardLayout(width: number): LocationBoardLayout {
  const boardHeight = width * 0.32;
  const postHeight = Math.max(1.4, boardHeight + 0.4);
  const boardBottomY = postHeight;
  return {
    boardHeight,
    boardBottomY,
    boardCenterY: boardBottomY + boardHeight / 2,
    postHeight,
    postCenterY: postHeight / 2,
    postTopY: postHeight,
  };
}
