/**
 * SkeletalCharacter.tsx
 *
 * A React Three Fiber 2D character rendered as a hierarchy of flat geometric
 * limbs, animated with GSAP timelines.
 *
 * Hierarchy (scene-graph order matches anatomical parent → child):
 *
 *   rootRef  (Group)          ← world position, translate on MOVE
 *   └─ torsoRef  (Group)      ← torso mesh + all limb pivot groups
 *      ├─ headPivotRef        ← pivot at neck; head mesh offset upward
 *      ├─ lShoulderRef        ← pivot at left  shoulder; left arm mesh
 *      ├─ rShoulderRef        ← pivot at right shoulder; right arm mesh
 *      ├─ lHipRef             ← pivot at left  hip;      left leg mesh
 *      └─ rHipRef             ← pivot at right hip;      right leg mesh
 *
 * Props:
 *   color          – base hex color for the character (default auto from name)
 *   name           – character name (used to derive deterministic color)
 *   position       – [x, y] world-space placement
 *   action         – current CharacterAction to animate
 *   onActionComplete – called when the action animation finishes
 *
 * Supported actions:
 *   { type: 'idle' }
 *   { type: 'enter' }
 *   { type: 'exit' }
 *   { type: 'move',  dir: 'LEFT'|'RIGHT'|'UP'|'DOWN', steps: number }
 *   { type: 'emote', emotion: 'happy'|'sad'|'angry'|'scared'|
 *                              'surprised'|'thinking'|'wave'|'jump'|
 *                              'love'|'laughing' }
 */

import React, { useEffect, useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MoveAction = {
  type: "move";
  dir: "LEFT" | "RIGHT" | "UP" | "DOWN";
  steps: number;
};

export type EmoteAction = {
  type: "emote";
  emotion:
    | "happy"
    | "sad"
    | "angry"
    | "scared"
    | "surprised"
    | "thinking"
    | "wave"
    | "jump"
    | "love"
    | "laughing";
};

export type CharacterAction =
  | { type: "idle" }
  | { type: "enter" }
  | { type: "exit" }
  | MoveAction
  | EmoteAction;

export interface SkeletalCharacterProps {
  /** Display name — used for deterministic coloring if `color` is omitted */
  name?: string;
  /** Override base body color (CSS hex, e.g. "#4a90e2") */
  color?: string;
  /** World-space [x, y] position */
  position?: [number, number];
  /** Action to execute. Change this prop to trigger the animation. */
  action?: CharacterAction;
  /** Fired once the action's GSAP timeline completes */
  onActionComplete?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Color utilities
// ─────────────────────────────────────────────────────────────────────────────

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 60%, 55%)`;
}

function skinColor(base: string): string {
  // Skin is always a warm beige regardless of character color
  return "#f5cba7";
}

// ─────────────────────────────────────────────────────────────────────────────
// Limb geometry constants  (all units in Three.js world space)
// ─────────────────────────────────────────────────────────────────────────────

const DEPTH = 0.01; // all limbs are flat planes

const TORSO_W = 0.38;
const TORSO_H = 0.50;

const HEAD_R = 0.18;   // rendered as a square plane — looks like a face

const ARM_W = 0.13;
const ARM_H = 0.46;

const LEG_W = 0.16;
const LEG_H = 0.50;

// Pivot offsets FROM torso center
const HEAD_PIVOT_Y = TORSO_H / 2;              // top of torso = neck
const SHOULDER_X   = TORSO_W / 2 + ARM_W / 2; // edge of torso
const SHOULDER_Y   = TORSO_H / 2 - 0.06;      // near top of torso
const HIP_X        = TORSO_W / 2 - LEG_W / 2;
const HIP_Y        = -(TORSO_H / 2);           // bottom of torso

// Step size per step unit in world space
const STEP_UNIT = 0.6;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — each is a group whose local origin is the joint pivot
// ─────────────────────────────────────────────────────────────────────────────

interface LimbProps {
  width: number;
  height: number;
  color: string;
  pivotRef: React.RefObject<THREE.Group>;
  /** Offset of mesh center from pivot.  For arms/legs the mesh hangs below. */
  meshOffsetY?: number;
  zIndex?: number;
}

const Limb: React.FC<LimbProps> = ({
  width,
  height,
  color,
  pivotRef,
  meshOffsetY = 0,
  zIndex = 0,
}) => (
  <group ref={pivotRef}>
    <mesh position={[0, meshOffsetY, zIndex * 0.001]}>
      <boxGeometry args={[width, height, DEPTH]} />
      <meshBasicMaterial color={color} />
    </mesh>
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const SkeletalCharacter: React.FC<SkeletalCharacterProps> = ({
  name = "Character",
  color,
  position = [0, 0],
  action = { type: "idle" },
  onActionComplete,
}) => {
  const bodyColor  = color ?? nameToColor(name);
  const skin       = skinColor(bodyColor);
  const legColor   = bodyColor;
  const torsoColor = bodyColor;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const rootRef      = useRef<THREE.Group>(null!);
  const torsoRef     = useRef<THREE.Group>(null!);
  const torsoMeshRef = useRef<THREE.Mesh>(null!);
  const headPivotRef = useRef<THREE.Group>(null!);
  const lShoulderRef = useRef<THREE.Group>(null!);
  const rShoulderRef = useRef<THREE.Group>(null!);
  const lHipRef      = useRef<THREE.Group>(null!);
  const rHipRef      = useRef<THREE.Group>(null!);

  // Active timelines — stored so they can be killed before a new action starts
  const activeTl  = useRef<gsap.core.Timeline | null>(null);
  const idleTl    = useRef<gsap.core.Timeline | null>(null);

  // ── Rest pose helper ─────────────────────────────────────────────────────
  // Instantly snaps all limbs to neutral rotation / scale
  const snapToRest = useCallback((duration = 0) => {
    const targets = [
      headPivotRef.current?.rotation,
      lShoulderRef.current?.rotation,
      rShoulderRef.current?.rotation,
      lHipRef.current?.rotation,
      rHipRef.current?.rotation,
      torsoMeshRef.current?.scale,
    ].filter(Boolean);

    targets.forEach((t) => {
      if (!t) return;
      if ("z" in t) gsap.to(t, { z: 0, duration });
      if ("x" in t && "y" in t && "z" in t && !("w" in t)) {
        // scale object
        gsap.to(t, { x: 1, y: 1, duration });
      }
    });
  }, []);

  // ── Idle breathing loop ───────────────────────────────────────────────────
  const startIdle = useCallback(() => {
    if (idleTl.current) idleTl.current.kill();

    if (!torsoMeshRef.current) return;

    idleTl.current = gsap.timeline({ repeat: -1, yoyo: true });
    idleTl.current
      .to(torsoMeshRef.current.scale, {
        y: 1.03,
        duration: 1.2,
        ease: "sine.inOut",
      })
      .to(
        headPivotRef.current?.position ?? {},
        { y: 0.01, duration: 1.2, ease: "sine.inOut" },
        "<"
      );
  }, []);

  const stopIdle = useCallback(() => {
    idleTl.current?.kill();
    idleTl.current = null;
  }, []);

  // ── Animation builders ────────────────────────────────────────────────────

  const playEnter = useCallback((onComplete: () => void) => {
    const tl = gsap.timeline({ onComplete });
    if (!rootRef.current) return tl;

    rootRef.current.scale.set(0, 0, 1);
    tl.to(rootRef.current.scale, {
      x: 1, y: 1,
      duration: 0.4,
      ease: "back.out(1.7)",
    });
    return tl;
  }, []);

  const playExit = useCallback((onComplete: () => void) => {
    const tl = gsap.timeline({ onComplete });
    if (!rootRef.current) return tl;

    tl.to(rootRef.current.scale, {
      x: 0, y: 0,
      duration: 0.35,
      ease: "back.in(1.7)",
    });
    return tl;
  }, []);

  const playStep = useCallback(
    (dir: MoveAction["dir"], steps: number, onComplete: () => void) => {
      const tl = gsap.timeline({ onComplete });
      if (!rootRef.current) return tl;

      const dx =
        dir === "LEFT" ? -STEP_UNIT * steps :
        dir === "RIGHT" ?  STEP_UNIT * steps : 0;
      const dy =
        dir === "UP"   ?  STEP_UNIT * steps :
        dir === "DOWN" ? -STEP_UNIT * steps : 0;

      const strideTime = 0.22; // seconds per half-stride

      // Translate root
      tl.to(rootRef.current.position, {
        x: `+=${dx}`,
        y: `+=${dy}`,
        duration: strideTime * 2 * steps,
        ease: "none",
      });

      // Leg/arm stride cycles — overlaid on the translate
      for (let i = 0; i < steps; i++) {
        const offset = i * strideTime * 2;
        const legAngle = 0.45; // radians
        const armAngle = 0.30;

        // Left leg forward, right leg back
        tl.to(lHipRef.current?.rotation ?? {}, {
          z: -legAngle, duration: strideTime, ease: "sine.inOut",
        }, offset);
        tl.to(rHipRef.current?.rotation ?? {}, {
          z:  legAngle, duration: strideTime, ease: "sine.inOut",
        }, offset);
        // Left arm back (opposite leg), right arm forward
        tl.to(lShoulderRef.current?.rotation ?? {}, {
          z:  armAngle, duration: strideTime, ease: "sine.inOut",
        }, offset);
        tl.to(rShoulderRef.current?.rotation ?? {}, {
          z: -armAngle, duration: strideTime, ease: "sine.inOut",
        }, offset);

        // Swap
        tl.to(lHipRef.current?.rotation ?? {}, {
          z:  legAngle, duration: strideTime, ease: "sine.inOut",
        }, offset + strideTime);
        tl.to(rHipRef.current?.rotation ?? {}, {
          z: -legAngle, duration: strideTime, ease: "sine.inOut",
        }, offset + strideTime);
        tl.to(lShoulderRef.current?.rotation ?? {}, {
          z: -armAngle, duration: strideTime, ease: "sine.inOut",
        }, offset + strideTime);
        tl.to(rShoulderRef.current?.rotation ?? {}, {
          z:  armAngle, duration: strideTime, ease: "sine.inOut",
        }, offset + strideTime);
      }

      // Return limbs to rest after walking
      tl.to(lHipRef.current?.rotation      ?? {}, { z: 0, duration: 0.15 })
        .to(rHipRef.current?.rotation      ?? {}, { z: 0, duration: 0.15 }, "<")
        .to(lShoulderRef.current?.rotation ?? {}, { z: 0, duration: 0.15 }, "<")
        .to(rShoulderRef.current?.rotation ?? {}, { z: 0, duration: 0.15 }, "<");

      return tl;
    },
    []
  );

  const playEmote = useCallback(
    (emotion: EmoteAction["emotion"], onComplete: () => void) => {
      const tl = gsap.timeline({ onComplete });

      switch (emotion) {

        // ── wave: right arm raises and oscillates ──────────────────────────
        case "wave": {
          tl.to(rShoulderRef.current?.rotation ?? {}, {
            z: -1.2, duration: 0.25, ease: "power2.out",
          })
          .to(rShoulderRef.current?.rotation ?? {}, {
            z: -0.85, duration: 0.15, ease: "sine.inOut", yoyo: true, repeat: 5,
          })
          .to(rShoulderRef.current?.rotation ?? {}, {
            z: 0, duration: 0.25, ease: "power2.in",
          });
          break;
        }

        // ── jump: whole character bounces up then down ─────────────────────
        case "jump": {
          tl.to(rootRef.current?.position ?? {}, {
            y: `+=0.9`, duration: 0.35, ease: "power2.out",
          })
          .to(lShoulderRef.current?.rotation ?? {}, {
            z:  0.7, duration: 0.35, ease: "power2.out",
          }, "<")
          .to(rShoulderRef.current?.rotation ?? {}, {
            z: -0.7, duration: 0.35, ease: "power2.out",
          }, "<")
          .to(rootRef.current?.position ?? {}, {
            y: `-=0.9`, duration: 0.4, ease: "bounce.out",
          })
          .to(lShoulderRef.current?.rotation ?? {}, {
            z: 0, duration: 0.2,
          }, "<")
          .to(rShoulderRef.current?.rotation ?? {}, {
            z: 0, duration: 0.2,
          }, "<");
          break;
        }

        // ── happy: small double-bounce ─────────────────────────────────────
        case "happy":
        case "love":
        case "laughing": {
          tl.to(rootRef.current?.position ?? {}, {
            y: `+=0.18`, duration: 0.18, ease: "power1.out",
            yoyo: true, repeat: 3,
          })
          .to(lShoulderRef.current?.rotation ?? {}, {
            z:  0.4, duration: 0.18, yoyo: true, repeat: 3,
          }, "<")
          .to(rShoulderRef.current?.rotation ?? {}, {
            z: -0.4, duration: 0.18, yoyo: true, repeat: 3,
          }, "<");
          break;
        }

        // ── sad: head droops, arms hang forward ───────────────────────────
        case "sad": {
          tl.to(headPivotRef.current?.rotation ?? {}, {
            z: -0.3, duration: 0.5, ease: "power2.out",
          })
          .to(lShoulderRef.current?.rotation ?? {}, {
            z: -0.25, duration: 0.5, ease: "power2.out",
          }, "<")
          .to(rShoulderRef.current?.rotation ?? {}, {
            z:  0.25, duration: 0.5, ease: "power2.out",
          }, "<")
          .to({}, { duration: 0.8 }) // hold the pose
          .to(headPivotRef.current?.rotation ?? {}, { z: 0, duration: 0.4 })
          .to(lShoulderRef.current?.rotation ?? {}, { z: 0, duration: 0.4 }, "<")
          .to(rShoulderRef.current?.rotation ?? {}, { z: 0, duration: 0.4 }, "<");
          break;
        }

        // ── angry: rapid lateral body shake ───────────────────────────────
        case "angry": {
          tl.to(torsoRef.current?.position ?? {}, {
            x:  0.06, duration: 0.05, ease: "none",
            yoyo: true, repeat: 9,
          })
          .to(headPivotRef.current?.rotation ?? {}, {
            z:  0.15, duration: 0.05, yoyo: true, repeat: 9,
          }, "<");
          break;
        }

        // ── scared: shrink + shiver ────────────────────────────────────────
        case "scared": {
          tl.to(rootRef.current?.scale ?? {}, {
            x: 0.88, y: 0.88, duration: 0.15, ease: "power2.out",
          })
          .to(torsoRef.current?.position ?? {}, {
            x: 0.05, duration: 0.06, yoyo: true, repeat: 7, ease: "none",
          })
          .to(rootRef.current?.scale ?? {}, {
            x: 1, y: 1, duration: 0.25, ease: "elastic.out(1, 0.5)",
          });
          break;
        }

        // ── surprised: quick jump + arms fly out ──────────────────────────
        case "surprised": {
          tl.to(rootRef.current?.position ?? {}, {
            y: `+=0.4`, duration: 0.2, ease: "power3.out",
          })
          .to(lShoulderRef.current?.rotation ?? {}, {
            z:  1.1, duration: 0.2, ease: "power3.out",
          }, "<")
          .to(rShoulderRef.current?.rotation ?? {}, {
            z: -1.1, duration: 0.2, ease: "power3.out",
          }, "<")
          .to(rootRef.current?.position ?? {}, {
            y: `-=0.4`, duration: 0.35, ease: "bounce.out",
          })
          .to(lShoulderRef.current?.rotation ?? {}, {
            z: 0, duration: 0.3,
          }, "<")
          .to(rShoulderRef.current?.rotation ?? {}, {
            z: 0, duration: 0.3,
          }, "<");
          break;
        }

        // ── thinking: head tilts, right arm raises to chin ────────────────
        case "thinking": {
          tl.to(headPivotRef.current?.rotation ?? {}, {
            z: 0.2, duration: 0.3, ease: "power2.out",
          })
          .to(rShoulderRef.current?.rotation ?? {}, {
            z: -0.65, duration: 0.35, ease: "power2.out",
          }, "<")
          .to({}, { duration: 1.0 }) // hold pose
          .to(headPivotRef.current?.rotation ?? {}, { z: 0, duration: 0.3 })
          .to(rShoulderRef.current?.rotation ?? {}, { z: 0, duration: 0.3 }, "<");
          break;
        }

        default: {
          // Unknown emote — complete immediately
          tl.to({}, { duration: 0.01 });
          break;
        }
      }

      return tl;
    },
    []
  );

  // ── Action dispatcher ─────────────────────────────────────────────────────
  useEffect(() => {
    // Kill any running timeline; stop idle
    activeTl.current?.kill();
    stopIdle();

    const done = () => {
      onActionComplete?.();
      startIdle();
    };

    let tl: gsap.core.Timeline | null = null;

    switch (action.type) {
      case "idle":
        startIdle();
        return;

      case "enter":
        snapToRest(0);
        tl = playEnter(done);
        break;

      case "exit":
        tl = playExit(done);
        break;

      case "move":
        tl = playStep(action.dir, action.steps, done);
        break;

      case "emote":
        tl = playEmote(action.emotion, done);
        break;

      default:
        startIdle();
        return;
    }

    activeTl.current = tl;

    return () => {
      tl?.kill();
    };
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start idle on mount
  useEffect(() => {
    startIdle();
    return () => {
      stopIdle();
      activeTl.current?.kill();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <group ref={rootRef} position={[position[0], position[1], 0]}>
      {/* ── Torso (parent of all limbs) ────────────────────────────────── */}
      <group ref={torsoRef}>
        <mesh ref={torsoMeshRef}>
          <boxGeometry args={[TORSO_W, TORSO_H, DEPTH]} />
          <meshBasicMaterial color={torsoColor} />
        </mesh>

        {/* ── Left arm  (pivot at left shoulder) ──────────────────────── */}
        <group
          ref={lShoulderRef}
          position={[-SHOULDER_X, SHOULDER_Y, -0.002]}
        >
          {/* mesh center is half arm-height below pivot */}
          <mesh position={[0, -ARM_H / 2, 0]}>
            <boxGeometry args={[ARM_W, ARM_H, DEPTH]} />
            <meshBasicMaterial color={skin} />
          </mesh>
        </group>

        {/* ── Right arm (pivot at right shoulder) ─────────────────────── */}
        <group
          ref={rShoulderRef}
          position={[SHOULDER_X, SHOULDER_Y, -0.002]}
        >
          <mesh position={[0, -ARM_H / 2, 0]}>
            <boxGeometry args={[ARM_W, ARM_H, DEPTH]} />
            <meshBasicMaterial color={skin} />
          </mesh>
        </group>

        {/* ── Left leg  (pivot at left hip) ───────────────────────────── */}
        <group
          ref={lHipRef}
          position={[-HIP_X, HIP_Y, -0.001]}
        >
          <mesh position={[0, -LEG_H / 2, 0]}>
            <boxGeometry args={[LEG_W, LEG_H, DEPTH]} />
            <meshBasicMaterial color={legColor} />
          </mesh>
        </group>

        {/* ── Right leg (pivot at right hip) ──────────────────────────── */}
        <group
          ref={rHipRef}
          position={[HIP_X, HIP_Y, -0.001]}
        >
          <mesh position={[0, -LEG_H / 2, 0]}>
            <boxGeometry args={[LEG_W, LEG_H, DEPTH]} />
            <meshBasicMaterial color={legColor} />
          </mesh>
        </group>

        {/* ── Head (pivot at neck = top of torso) ─────────────────────── */}
        <group
          ref={headPivotRef}
          position={[0, HEAD_PIVOT_Y, 0.001]}
        >
          {/* Face */}
          <mesh position={[0, HEAD_R, 0]}>
            <boxGeometry args={[HEAD_R * 2, HEAD_R * 2, DEPTH]} />
            <meshBasicMaterial color={skin} />
          </mesh>
          {/* Left eye */}
          <mesh position={[-HEAD_R * 0.3, HEAD_R + HEAD_R * 0.1, 0.006]}>
            <boxGeometry args={[0.045, 0.045, DEPTH]} />
            <meshBasicMaterial color="#1a1a2e" />
          </mesh>
          {/* Right eye */}
          <mesh position={[HEAD_R * 0.3, HEAD_R + HEAD_R * 0.1, 0.006]}>
            <boxGeometry args={[0.045, 0.045, DEPTH]} />
            <meshBasicMaterial color="#1a1a2e" />
          </mesh>
          {/* Mouth */}
          <mesh position={[0, HEAD_R - HEAD_R * 0.35, 0.006]}>
            <boxGeometry args={[0.1, 0.025, DEPTH]} />
            <meshBasicMaterial color="#c0392b" />
          </mesh>
        </group>
      </group>
    </group>
  );
};

export default SkeletalCharacter;
