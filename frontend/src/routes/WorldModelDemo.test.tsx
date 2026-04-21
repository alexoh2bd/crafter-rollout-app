import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { FrameMessage } from "../types";

const { navigateMock, listWMGoalsMock, mockUseGameSession } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  listWMGoalsMock: vi.fn(),
  mockUseGameSession: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => navigateMock };
});

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    API_URL: "http://localhost:8000",
    listWMGoals: (...args: unknown[]) => listWMGoalsMock(...args),
  };
});

vi.mock("../hooks/useGameSession", () => ({
  useGameSession: (...args: unknown[]) => mockUseGameSession(...args),
}));

import WorldModelDemo from "./WorldModelDemo";

function defaultGoals() {
  return {
    goals: ["collect_wood"],
    wm_base_available: true,
    hwm_available: false,
    checkpoint_source: "s3_bucket" as const,
    s3_prefix: "wm-prefix/",
    latent_dim: 128,
  };
}

function defaultSession() {
  return {
    phase: "idle" as const,
    frame: null,
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
    download: vi.fn(),
  };
}

function minimalFrame(overrides: Partial<FrameMessage> = {}): FrameMessage {
  return {
    step: 3,
    obs: "",
    latent: [0.1, 0.2],
    action: 0,
    action_name: "noop",
    reward: 0,
    done: false,
    inventory: {
      health: 9,
      food: 0,
      drink: 0,
      energy: 0,
      sapling: 0,
      wood: 0,
      stone: 0,
      coal: 0,
      iron: 0,
      diamond: 0,
      wood_pickaxe: 0,
      stone_pickaxe: 0,
      iron_pickaxe: 0,
      wood_sword: 0,
      stone_sword: 0,
      iron_sword: 0,
    },
    achievements_unlocked_this_step: [],
    source: "agent",
    checkpoint_id: null,
    action_probs: null,
    value_estimate: null,
    seed: 0,
    timestamp: "",
    planning_ms: 1,
    z_goal_dist: 0.5,
    model_type: "wm_base",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WorldModelDemo />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockClear();
  listWMGoalsMock.mockResolvedValue(defaultGoals());
  mockUseGameSession.mockReturnValue(defaultSession());
});

describe("WorldModelDemo", () => {
  it("renders title and session controls", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /world model demo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/live inference/i)).toBeInTheDocument();
    });
  });

  it("shows backend host and S3 prefix after goals load", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("localhost:8000")).toBeInTheDocument();
      expect(screen.getByText("wm-prefix/")).toBeInTheDocument();
    });
  });

  it("shows goals fetch error when listWMGoals rejects", async () => {
    listWMGoalsMock.mockRejectedValueOnce(new Error("network down"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/network down/i)).toBeInTheDocument();
    });
  });

  it("navigates home when Back is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    const backButtons = screen.getAllByRole("button", { name: /^← Back$/ });
    await user.click(backButtons[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("shows streaming status when playing", async () => {
    mockUseGameSession.mockReturnValue({
      phase: "playing",
      frame: minimalFrame(),
      error: null,
      start: vi.fn(),
      stop: vi.fn(),
      download: vi.fn(),
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/streaming/i)).toBeInTheDocument();
      expect(screen.getByText(/step 3/)).toBeInTheDocument();
    });
  });
});
