# Data Format

## Rollout JSONL

Each session produces one `rollout.jsonl` file. Every line is a JSON object
representing one environment timestep.

### Human-mode example

```json
{
  "step": 42,
  "obs": "iVBORw0KGgoAAAANS...",
  "latent": [0.123, -0.456, 0.789, "...128 floats total"],
  "action": 5,
  "action_name": "do",
  "reward": 1.0,
  "done": false,
  "inventory": {
    "health": 9, "food": 7, "drink": 6, "energy": 8,
    "sapling": 0, "wood": 3, "stone": 0, "coal": 0,
    "iron": 0, "diamond": 0,
    "wood_pickaxe": 1, "stone_pickaxe": 0, "iron_pickaxe": 0,
    "wood_sword": 0, "stone_sword": 0, "iron_sword": 0
  },
  "achievements_unlocked_this_step": ["collect_wood"],
  "source": "human",
  "checkpoint_id": null,
  "action_probs": null,
  "value_estimate": null,
  "seed": 12345,
  "timestamp": "2026-04-18T14:23:45.123Z"
}
```

### Agent-mode differences

| Field | Human | Agent |
|-------|-------|-------|
| `source` | `"human"` | `"agent"` |
| `checkpoint_id` | `null` | `"ppo-10m"` |
| `action_probs` | `null` | `[17 floats]` |
| `value_estimate` | `null` | `2.3` |

## Field reference

| Field | Type | Description |
|-------|------|-------------|
| `step` | int | Zero-indexed step within the episode |
| `obs` | string | Base64-encoded PNG of the 64×64 RGB frame |
| `latent` | float[128] | Encoder output vector |
| `action` | int | Action index (0–16) |
| `action_name` | string | Human-readable action name |
| `reward` | float | Scalar reward from Crafter |
| `done` | bool | Whether the episode ended on this step |
| `inventory` | object | Item counts (see schema) |
| `achievements_unlocked_this_step` | string[] | Achievement keys newly unlocked |
| `source` | "human"\|"agent" | Who produced this step |
| `checkpoint_id` | string\|null | Policy checkpoint ID (agent only) |
| `action_probs` | float[17]\|null | Softmax action probabilities (agent only) |
| `value_estimate` | float\|null | Critic value estimate (agent only) |
| `seed` | int | Environment seed |
| `timestamp` | ISO-8601 | Wall-clock time of the step |

## Download format

Rollouts are available as `.tar.gz` archives containing one or more `.jsonl`
files, downloadable via `GET /api/rollouts/{session_id}/download`.
