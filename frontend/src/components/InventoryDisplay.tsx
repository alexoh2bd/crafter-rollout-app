import type { Inventory } from "../types";

interface Props {
  inventory: Inventory | null;
}

const INVENTORY_KEYS: (keyof Inventory)[] = [
  "health",
  "food",
  "drink",
  "energy",
  "sapling",
  "wood",
  "stone",
  "coal",
  "iron",
  "diamond",
  "wood_pickaxe",
  "stone_pickaxe",
  "iron_pickaxe",
  "wood_sword",
  "stone_sword",
  "iron_sword",
];

export default function InventoryDisplay({ inventory }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Inventory
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {INVENTORY_KEYS.map((key) => {
          const value = inventory?.[key] ?? 0;
          const dim = value === 0;
          return (
            <div
              key={key}
              className={`flex justify-between ${dim ? "text-gray-600" : "text-gray-200"}`}
            >
              <span className="capitalize">{key.replace(/_/g, " ")}</span>
              <span className={dim ? "" : "text-white font-medium"}>{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
