import * as THREE from 'three';

export const createRoadMaterial = () => {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      uSpeed: { value: 0 },
      uOffset: { value: 0 },
      uColor: { value: new THREE.Color(0x00f3ff) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;
      void main() {
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vPosition;
      uniform float uOffset;
      uniform vec3 uColor;

      void main() {
        // Grid calculations
        float strength = step(0.9, fract(vUv.y * 50.0 - uOffset * 2.0));
        strength += step(0.9, fract(vUv.x * 10.0));
        
        vec3 color = mix(vec3(0.02, 0.02, 0.05), uColor, clamp(strength, 0.0, 1.0));
        
        // Add a glow based on grid strength
        float glow = strength * 0.5;
        color += uColor * glow;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    transparent: true,
  });
};
