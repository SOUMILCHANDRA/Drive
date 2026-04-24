
export const FilmGrainShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uIntensity: { value: 0.05 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uIntensity;
        varying vec2 vUv;
        float random(vec2 p) {
            return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            float grain = (random(vUv + uTime) - 0.5) * uIntensity;
            gl_FragColor = vec4(color.rgb + grain, color.a);
        }
    `
};

export const ChromaticAberrationShader = {
    uniforms: {
        tDiffuse: { value: null },
        uIntensity: { value: 0.002 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
            float r = texture2D(tDiffuse, vUv + vec2(uIntensity, 0.0)).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - vec2(uIntensity, 0.0)).b;
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `
};

export const VignetteShader = {
    uniforms: {
        tDiffuse: { value: null },
        uOffset: { value: 1.0 },
        uDarkness: { value: 1.5 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uOffset;
        uniform float uDarkness;
        varying vec2 vUv;
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            vec2 uv = vUv - 0.5;
            float dist = length(uv);
            float vigor = smoothstep(uOffset, uOffset - 0.5, dist * uDarkness);
            gl_FragColor = vec4(color.rgb * vigor, color.a);
        }
    `
};

export const LetterboxShader = {
    uniforms: {
        tDiffuse: { value: null },
        uSize: { value: 0.35 } // Initial narrow view
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uSize;
        varying vec2 vUv;
        void main() {
            // FIX: Flip Y axis here if the composer is upside down
            vec2 flippedUv = vec2(vUv.x, 1.0 - vUv.y);
            
            if (flippedUv.y < uSize || flippedUv.y > (1.0 - uSize)) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            } else {
                gl_FragColor = texture2D(tDiffuse, flippedUv);
            }
        }
    `
};
