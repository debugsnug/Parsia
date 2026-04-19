/**
 * ParsiaScene.tsx
 *
 * Drives one or more SkeletalCharacter instances from a Parsia animation.json.
 * Actions are dispatched sequentially; each completes before the next starts.
 *
 * Usage:
 *   import animationData from "../../animation.json";
 *   <Canvas><ParsiaScene data={animationData} /></Canvas>
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { OrthographicCamera } from "@react-three/drei";
import SkeletalCharacter, { CharacterAction } from "./SkeletalCharacter";

// ─────────────────────────────────────────────────────────────────────────────
// Types matching Parsia animation.json
// ─────────────────────────────────────────────────────────────────────────────

interface ParsiaAction {
  type: "enter" | "exit" | "say" | "move" | "emote" | "wait";
  who?: string;
  text?: string;
  dir?: "LEFT" | "RIGHT" | "UP" | "DOWN";
  steps?: number;
  emotion?: string;
  duration?: number;
}

interface ParsiaAnimationData {
  scene: string;
  characters: string[];
  actions: ParsiaAction[];
}

interface ParsiaSceneProps {
  data: ParsiaAnimationData;
  /** Called when the last action in the sequence finishes */
  onComplete?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Character state
// ─────────────────────────────────────────────────────────────────────────────

interface CharState {
  onStage: boolean;
  position: [number, number];
  action: CharacterAction;
}

// Spread characters evenly across the stage at entry
function entryX(index: number, total: number): number {
  const spread = Math.min(total - 1, 4) * 1.2;
  return total === 1 ? 0 : -spread / 2 + index * (spread / (total - 1));
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const ParsiaScene: React.FC<ParsiaSceneProps> = ({ data, onComplete }) => {
  const [charStates, setCharStates] = useState<Record<string, CharState>>(
    () =>
      Object.fromEntries(
        data.characters.map((name, i) => [
          name,
          {
            onStage: false,
            position: [entryX(i, data.characters.length), -0.5] as [number, number],
            action: { type: "idle" } as CharacterAction,
          },
        ])
      )
  );

  const [speechBubble, setSpeechBubble] = useState<{
    who: string;
    text: string;
  } | null>(null);

  const actionIndex = useRef(0);
  const waitTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dispatch next action in the queue ─────────────────────────────────────
  const advance = useCallback(() => {
    const idx = actionIndex.current;
    if (idx >= data.actions.length) {
      onComplete?.();
      return;
    }
    actionIndex.current = idx + 1;

    const raw = data.actions[idx];

    setSpeechBubble(null);

    switch (raw.type) {
      case "enter": {
        if (!raw.who) { advance(); return; }
        setCharStates((prev) => ({
          ...prev,
          [raw.who!]: {
            ...prev[raw.who!],
            onStage: true,
            action: { type: "enter" },
          },
        }));
        break;
      }

      case "exit": {
        if (!raw.who) { advance(); return; }
        setCharStates((prev) => ({
          ...prev,
          [raw.who!]: {
            ...prev[raw.who!],
            action: { type: "exit" },
          },
        }));
        break;
      }

      case "move": {
        if (!raw.who || !raw.dir) { advance(); return; }
        setCharStates((prev) => {
          const cur = prev[raw.who!];
          return {
            ...prev,
            [raw.who!]: {
              ...cur,
              action: {
                type: "move",
                dir: raw.dir!,
                steps: raw.steps ?? 1,
              },
            },
          };
        });
        break;
      }

      case "emote": {
        if (!raw.who || !raw.emotion) { advance(); return; }
        setCharStates((prev) => ({
          ...prev,
          [raw.who!]: {
            ...prev[raw.who!],
            action: {
              type: "emote",
              emotion: raw.emotion as CharacterAction extends { type: "emote"; emotion: infer E } ? E : never,
            },
          },
        }));
        break;
      }

      case "say": {
        if (!raw.who || !raw.text) { advance(); return; }
        setSpeechBubble({ who: raw.who, text: raw.text });
        // Say actions auto-advance after a read delay (40 ms per char, min 1.2s)
        const delay = Math.max(1200, raw.text.length * 40);
        waitTimer.current = setTimeout(() => {
          setSpeechBubble(null);
          advance();
        }, delay);
        break;
      }

      case "wait": {
        const ms = (raw.duration ?? 1) * 1000;
        waitTimer.current = setTimeout(advance, ms);
        break;
      }

      default:
        advance();
    }
  }, [data.actions, onComplete]);

  // Start the sequence on mount
  useEffect(() => {
    advance();
    return () => {
      if (waitTimer.current) clearTimeout(waitTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-character action-complete handler ─────────────────────────────────
  const makeOnComplete = (name: string) => () => {
    setCharStates((prev) => {
      const cur = prev[name];
      // If exiting, take off stage
      if (cur.action.type === "exit") {
        return { ...prev, [name]: { ...cur, onStage: false, action: { type: "idle" } } };
      }
      return { ...prev, [name]: { ...cur, action: { type: "idle" } } };
    });
    advance();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <OrthographicCamera makeDefault zoom={120} position={[0, 0, 10]} />
      <ambientLight intensity={1} />

      {data.characters
        .filter((name) => charStates[name]?.onStage)
        .map((name) => {
          const state = charStates[name];
          return (
            <SkeletalCharacter
              key={name}
              name={name}
              position={state.position}
              action={state.action}
              onActionComplete={makeOnComplete(name)}
            />
          );
        })}

      {/* Speech bubbles rendered as HTML overlay via R3F Html */}
      {speechBubble && (
        <SpeechBubble
          who={speechBubble.who}
          text={speechBubble.text}
          position={
            charStates[speechBubble.who]?.position ?? [0, 0]
          }
        />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Speech bubble (uses @react-three/drei Html for 3D-anchored DOM overlay)
// ─────────────────────────────────────────────────────────────────────────────

import { Html } from "@react-three/drei";

interface SpeechBubbleProps {
  who: string;
  text: string;
  position: [number, number];
}

const SpeechBubble: React.FC<SpeechBubbleProps> = ({ who, text, position }) => (
  <Html
    position={[position[0], position[1] + 1.2, 0]}
    center
    style={{ pointerEvents: "none" }}
  >
    <div
      style={{
        background: "white",
        border: "2px solid #333",
        borderRadius: 8,
        padding: "6px 10px",
        maxWidth: 160,
        fontSize: 13,
        fontFamily: "sans-serif",
        textAlign: "center",
        boxShadow: "2px 2px 6px rgba(0,0,0,0.2)",
        whiteSpace: "pre-wrap",
      }}
    >
      <strong style={{ display: "block", marginBottom: 2, fontSize: 11, color: "#555" }}>
        {who}
      </strong>
      {text}
    </div>
  </Html>
);

export default ParsiaScene;
