"use client";

import * as React from "react";

interface State {
  hasError: boolean;
  message: string;
}

export class WebGLErrorBoundary extends React.Component<
  {
    fallback: React.ReactNode;
    children: React.ReactNode;
  },
  State
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || "3D WebGL viewport unavailable.",
    };
  }

  componentDidCatch(error: Error) {
    console.error("Digital Twin 3D viewport error:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl")),
    );
  } catch {
    return false;
  }
}
