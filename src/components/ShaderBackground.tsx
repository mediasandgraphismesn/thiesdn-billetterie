import React, { useEffect, useRef } from 'react';

interface ShaderBackgroundProps {
  intensity?: number;
  interactive?: boolean;
}

export const ShaderBackground: React.FC<ShaderBackgroundProps> = ({
  intensity = 0.65,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    let animationFrameId: number;

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fs = `
      precision highp float;
      varying vec2 v_texCoord;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_intensity;

      void main() {
        vec2 uv = v_texCoord;
        // Deep Charcoal background
        vec3 color1 = vec3(0.04, 0.04, 0.05);
        // Electric Violet #8A2BE2
        vec3 color2 = vec3(0.54, 0.17, 0.89);
        // Warm Gold #E9C349
        vec3 color3 = vec3(0.91, 0.76, 0.28);
        
        vec2 pos = uv * 2.0 - 1.0;
        pos.x *= u_resolution.x / max(u_resolution.y, 1.0);
        
        float dist = length(pos);
        
        float f = sin(uv.x * 2.5 + u_time * 0.4) * cos(uv.y * 2.0 + u_time * 0.3);
        f += sin(dist * 3.5 - u_time * 0.6) * 0.4;
        
        vec3 mixedColor = mix(color1, color2, clamp(f * 0.35 + 0.3, 0.0, 1.0));
        mixedColor = mix(mixedColor, color3, clamp(sin(u_time * 0.2 + dist * 2.5) * 0.18, 0.0, 1.0));
        
        // Vignette
        float vignette = 1.0 - smoothstep(0.4, 1.4, dist);
        
        gl_FragColor = vec4(mixedColor * vignette * u_intensity, 1.0);
      }
    `;

    function createShader(type: number, source: string) {
      if (!gl) return null;
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    }

    const vertexShader = createShader(gl.VERTEX_SHADER, vs);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fs);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posAttr = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'u_time');
    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uInt = gl.getUniformLocation(program, 'u_intensity');

    let mouse = { x: canvas.width / 2, y: canvas.height / 2 };

    const handleMouseMove = (event: MouseEvent) => {
      if (!interactive || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const resizeObserver = new ResizeObserver(() => {
      if (!canvas || !gl) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    });

    resizeObserver.observe(canvas);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const render = (time: number) => {
      if (!gl || !canvas) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, time * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      if (uInt) gl.uniform1f(uInt, intensity);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
    };
  }, [intensity, interactive]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-50">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover block"
      />
      <div className="absolute inset-0 bg-[#0F0F0F]/60 backdrop-blur-[2px]" />
    </div>
  );
};
