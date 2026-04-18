/**
 * Shared TypeScript types for the Crafter Rollout Collector frontend.
 * Expanded in subsequent PRs as schemas are defined.
 */

export type SessionMode = "human" | "agent" | "imagination";

export interface CheckpointMeta {
  checkpoint_id: string;
  display_name: string;
  ckpt_type: string;
  description: string;
}

export interface Inventory {
  health: number;
  food: number;
  drink: number;
  energy: number;
  sapling: number;
  wood: number;
  stone: number;
  coal: number;
  iron: number;
  diamond: number;
  wood_pickaxe: number;
  stone_pickaxe: number;
  iron_pickaxe: number;
  wood_sword: number;
  stone_sword: number;
  iron_sword: number;
}

export interface FrameMessage {
  step: number;
  obs: string; // base64 PNG
  latent: number[]; // 128-d
  action: number;
  action_name: string;
  reward: number;
  done: boolean;
  inventory: Inventory;
  achievements_unlocked_this_step: string[];
  source: "human" | "agent";
  checkpoint_id: string | null;
  action_probs: number[] | null; // 17-d
  value_estimate: number | null;
  seed: number;
  timestamp: string;
}

export interface ImaginationRollout {
  latents: number[][]; // (H+1, 128)
  pca_2d: [number, number][]; // (H+1, 2) projected
}

export interface ImaginationMessage {
  rollouts: ImaginationRollout[]; // K rollouts
  real_pca_2d: [number, number][]; // real trajectory so far
}
