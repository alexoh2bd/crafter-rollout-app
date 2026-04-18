/**
 * Human play mode: keyboard → Crafter action index (matches backend env order).
 * Used by Play.tsx and KeybindingsHelp.
 */

export type KeybindingGroup = {
  title: string;
  rows: ReadonlyArray<{
    /** Keys that trigger this action (KeyboardEvent.key semantics) */
    keys: string[];
    /** Shown in the UI (e.g. "Space" for " ") */
    keyLabel: string;
    description: string;
    actionIndex: number;
  }>;
};

export const HUMAN_PLAY_KEYBINDING_GROUPS: KeybindingGroup[] = [
  {
    title: "Movement",
    rows: [
      { keys: ["w"], keyLabel: "W", description: "Move up", actionIndex: 3 },
      { keys: ["s"], keyLabel: "S", description: "Move down", actionIndex: 4 },
      { keys: ["a"], keyLabel: "A", description: "Move left", actionIndex: 1 },
      { keys: ["d"], keyLabel: "D", description: "Move right", actionIndex: 2 },
    ],
  },
  {
    title: "Interaction",
    rows: [
      {
        keys: ["e", " "],
        keyLabel: "E or Space",
        description: "Do / interact",
        actionIndex: 5,
      },
      { keys: ["0"], keyLabel: "0", description: "Sleep", actionIndex: 6 },
    ],
  },
  {
    title: "Place & craft",
    rows: [
      { keys: ["1"], keyLabel: "1", description: "Place stone", actionIndex: 7 },
      { keys: ["2"], keyLabel: "2", description: "Place table", actionIndex: 8 },
      { keys: ["3"], keyLabel: "3", description: "Place furnace", actionIndex: 9 },
      { keys: ["4"], keyLabel: "4", description: "Place plant", actionIndex: 10 },
      { keys: ["5"], keyLabel: "5", description: "Make wood pickaxe", actionIndex: 11 },
      { keys: ["6"], keyLabel: "6", description: "Make stone pickaxe", actionIndex: 12 },
      { keys: ["7"], keyLabel: "7", description: "Make iron pickaxe", actionIndex: 13 },
      { keys: ["8"], keyLabel: "8", description: "Make wood sword", actionIndex: 14 },
      { keys: ["9"], keyLabel: "9", description: "Make stone sword", actionIndex: 15 },
    ],
  },
];

/** Maps KeyboardEvent.key (after toLowerCase for letters, or raw for space/digits) to action index */
export function buildKeyToActionMap(
  groups: KeybindingGroup[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of groups) {
    for (const row of g.rows) {
      for (const k of row.keys) {
        if (k === " ") {
          out[" "] = row.actionIndex;
        } else if (k.length === 1 && /[a-z]/i.test(k)) {
          out[k.toLowerCase()] = row.actionIndex;
        } else {
          out[k] = row.actionIndex;
        }
      }
    }
  }
  return out;
}

export const KEY_TO_ACTION = buildKeyToActionMap(HUMAN_PLAY_KEYBINDING_GROUPS);
