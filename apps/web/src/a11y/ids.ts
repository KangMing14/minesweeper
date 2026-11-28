// M3-T08. The ids that tie the play screen to the skip link and to the key help. One place, so a test and
// the markup cannot drift apart.

/** The id of the canvas that the input controller is attached to: the skip link moves the focus here. */
export const PLAY_BOARD_ID = 'play-board';

/** The id of the visually hidden key help that the board points to with `aria-describedby`. */
export const PLAY_BOARD_HELP_ID = 'play-board-help';
