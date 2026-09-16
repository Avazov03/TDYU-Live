"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type WebGLGradientCanvasProps = {
  className?: string;
  colors?: string[];
  speed?: number;
  resolutionScale?: number;
  paused?: boolean;
};

/** Aceternity Login Form With Gradient — right-panel WebGL canvas (live-preview source). */
export function WebGLGradientCanvas({
  className,
  colors = ["var(--color-orange-500)", "#2762E7", "#3ECF8E", "#FFB86B"],
  speed = 1,
  resolutionScale = 1,
  paused = false,
}: WebGLGradientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      premultipliedAlpha: true,
      alpha: true,
    });
    if (!gl) return;

    const getDpr = () =>
      Math.min(window.devicePixelRatio || 1, 1.75) * resolutionScale;

    function createShader(type: number, source: string) {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        console.error("Shader compile error", gl!.getShaderInfoLog(shader));
        gl!.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = createShader(
      gl.VERTEX_SHADER,
      `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `,
    );

    const fragmentShader = createShader(
      gl.FRAGMENT_SHADER,
      `
      precision mediump float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform vec3 u_colors[5];

      float hash(vec2 p) {
        p = fract(p*vec2(123.34, 456.21));
        p += dot(p, p+45.32);
        return fract(p.x*p.y);
      }

      void main() {
        vec2 uv = v_uv;
        uv.x *= u_resolution.x / u_resolution.y;

        float t = u_time;
        vec2 p0 = 0.52 + 0.35*vec2(sin(0.7*t), cos(0.9*t));
        vec2 p1 = 0.48 + 0.35*vec2(sin(0.6*t+1.7), cos(0.8*t+2.3));
        vec2 p2 = 0.50 + 0.38*vec2(sin(0.9*t+0.7), cos(0.7*t+1.7));
        vec2 p3 = 0.46 + 0.33*vec2(sin(0.5*t+2.9), cos(1.1*t+0.2));
        vec2 p4 = 0.50 + 0.30*vec2(sin(0.8*t-1.4), cos(0.6*t-0.9));

        vec2 m = u_mouse * 0.12;
        p0 += m; p1 -= m; p2 += m*0.5; p3 -= m*0.5; p4 += m*0.3;

        float d0 = distance(uv, p0);
        float d1 = distance(uv, p1);
        float d2 = distance(uv, p2);
        float d3 = distance(uv, p3);
        float d4 = distance(uv, p4);

        float w0 = smoothstep(0.85, 0.05, d0);
        float w1 = smoothstep(0.85, 0.05, d1);
        float w2 = smoothstep(0.90, 0.05, d2);
        float w3 = smoothstep(0.95, 0.05, d3);
        float w4 = smoothstep(0.90, 0.05, d4);

        vec3 col = vec3(0.0);
        col += u_colors[0] * w0;
        col += u_colors[1] * w1;
        col += u_colors[2] * w2;
        col += u_colors[3] * w3;
        col += u_colors[4] * w4;

        float wsum = w0 + w1 + w2 + w3 + w4 + 1e-3;
        col /= wsum;

        float g = hash(uv * u_resolution * 0.5 + u_time);
        col += (g - 0.5) * 0.02;

        float vign = smoothstep(1.1, 0.35, length(uv - vec2(0.5)));
        col *= vign;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    );

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const mouseLoc = gl.getUniformLocation(program, "u_mouse");
    const colorsLoc = gl.getUniformLocation(program, "u_colors");

    const mouse = { x: 0, y: 0 };
    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = (event.clientY - rect.top) / rect.height;
      mouse.x = 2 * nx - 1;
      mouse.y = 1 - 2 * ny;
    };
    window.addEventListener("mousemove", onMouseMove);

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const resize = () => {
      const dpr = getDpr();
      const { clientWidth, clientHeight } = canvas;
      const width = Math.max(1, Math.floor(clientWidth * dpr));
      const height = Math.max(1, Math.floor(clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    function parseCssColor(input: string): [number, number, number] {
      const el = document.createElement("div");
      el.style.color = input;
      document.body.appendChild(el);
      const computed = getComputedStyle(el).color;
      document.body.removeChild(el);
      const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!match) return [241, 116, 99];
      return [
        parseInt(match[1], 10),
        parseInt(match[2], 10),
        parseInt(match[3], 10),
      ];
    }

    const padded = [...colors];
    while (padded.length < 5) {
      padded.push(padded[padded.length - 1] ?? "#ffffff");
    }
    const colorData = new Float32Array(
      padded
        .slice(0, 5)
        .map((c) => {
          const [r, g, b] = parseCssColor(c);
          return [r / 255, g / 255, b / 255];
        })
        .flat(),
    );
    gl.uniform3fv(colorsLoc, colorData);

    const started = performance.now();
    const tick = () => {
      const t =
        ((performance.now() - started) / 1000) *
        (paused || prefersReduced ? 0 : speed);
      gl.uniform1f(timeLoc, t);
      gl.uniform2f(mouseLoc, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      gl.useProgram(null);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(buffer);
    };
  }, [colors, speed, resolutionScale, paused]);

  return (
    <canvas ref={canvasRef} className={cn("h-full w-full", className)} />
  );
}
