/**
 * Cinematic Post-Processing Shaders for Nightcall.
 */

export const FilmGrainShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uIntensity: { value: 0.04 }
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
        
        float rand(vec2 co) {
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            float noise = rand(vUv + uTime) * uIntensity;
            gl_FragColor = vec4(color.rgb + noise, color.a);
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
        uRadius: { value: 0.75 },
        uSoftness: { value: 0.6 }
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
        uniform float uRadius;
        uniform float uSoftness;
        varying vec2 vUv;
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            float dist = distance(vUv, vec2(0.5));
            float vignette = smoothstep(uRadius, uRadius - uSoftness, dist);
            gl_FragColor = vec4(color.rgb * vignette, color.a);
        }
    `
};

export const LetterboxShader = {
    uniforms: {
        tDiffuse: { value: null },
        uRatio: { value: 2.39 }
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
        uniform float uRatio;
        varying vec2 vUv;
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            float barHeight = (1.0 - (1.0 / uRatio)) * 0.5;
            if(vUv.y < barHeight || vUv.y > (1.0 - barHeight)) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            } else {
                gl_FragColor = color;
            }
        }
    `
};
