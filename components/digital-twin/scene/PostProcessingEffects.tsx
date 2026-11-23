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
        <EffectComposer multisampling={0} enableNormalPass>
          <N8AO
            halfRes
            aoRadius={0.48}
            distanceFalloff={1.0}
            intensity={1.35}
            quality="medium"
            color="#102126"
          />
          <Bloom
            mipmapBlur
            luminanceThreshold={1.05}
            luminanceSmoothing={0.24}
            intensity={0.3}
          />
          <Vignette eskil={false} offset={0.36} darkness={0.14} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </React.Suspense>
    </PostProcessGuard>
  );
}
