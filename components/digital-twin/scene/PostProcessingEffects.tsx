"use client";

import * as React from "react";
import {
  Bloom,
  EffectComposer,
  N8AO,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { GraphicsQuality } from "@/types/digital-twin";

class PostProcessGuard extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Selective post-processing active on `high` quality:
 * - N8AO ambient occlusion grounding shelf kickplates, brackets, and product bases
 * - Restrained mipmap Bloom (luminanceThreshold: 1.05) strictly for ceiling luminaires
 *   and under-shelf / chilled-case LED strips
 * - Subtle edge vignette + ACES Filmic tone mapping
 */
export function PostProcessingEffects({
  quality,
}: {
  quality: GraphicsQuality;
}) {
  if (quality !== "high") return null;

  return (
    <PostProcessGuard>
      <React.Suspense fallback={null}>
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO
            halfRes
            aoRadius={0.44}
            distanceFalloff={1.0}
            intensity={1.15}
            quality="medium"
            color="#102126"
          />
          <Bloom
            mipmapBlur
            luminanceThreshold={1.12}
            luminanceSmoothing={0.22}
            intensity={0.2}
          />
          <Vignette eskil={false} offset={0.38} darkness={0.1} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </React.Suspense>
    </PostProcessGuard>
  );
}
