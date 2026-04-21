// Cursor (AI-assisted).

import type { KeybindingGroup } from "../lib/keybindings";

interface Props {
  groups: KeybindingGroup[];
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center rounded border border-gray-600 bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-200 shadow-sm">
      {children}
    </kbd>
  );
}

export default function KeybindingsHelp({ groups }: Props) {
  return (
    <div
      className="rounded-lg border border-gray-800 bg-gray-900/80 px-4 py-3 text-sm"
      aria-label="Keyboard controls"
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Directions
      </h3>
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-gray-400 text-xs">
        <li>Click Start and wait until the session is playing.</li>
        <li>
          Use the keys below. Movement and actions only apply while the session
          is active.
        </li>
      </ol>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Keybindings
      </h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.title}>
            <h4 className="mb-2 font-medium text-gray-300">{group.title}</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              {group.rows.map((row) => (
                <li
                  key={`${group.title}-${row.keyLabel}-${row.description}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
                >
                  <Kbd>{row.keyLabel}</Kbd>
                  <span className="text-gray-500">—</span>
                  <span className="text-gray-300">{row.description}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
