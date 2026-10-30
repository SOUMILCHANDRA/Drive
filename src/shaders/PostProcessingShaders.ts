/**
 * CinematicCompositeShader:
 * Single-pass post-processing filter combining:
 * 1. Radial Chromatic Aberration (zero in center, subtle fringing at screen corners)
 * 2. Luminance-Weighted Monochrome Film Grain (no colored speckle noise)
 * 3. Optical Vignette
 * 4. ACES Filmic Tone Mapping + sRGB Output Mapping
 */
export const CinematicCompositeShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uExposure: { value: 2.0 },
        uAberrationIntensity: { value: 0.0015 },
        uGrainIntensity: { value: 0.03 },
        uGrainEnabled: { value: 1.0 },
        uAberrationEnabled: { value: 1.0 },
        uVignetteDarkness: { value: 0.35 },
        uVignetteOffset: { value: 0.3 }
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
        uniform float uExposure;
        uniform float uAberrationIntensity;
        uniform float uGrainIntensity;
        uniform float uGrainEnabled;
        uniform float uAberrationEnabled;
        uniform float uVignetteDarkness;
        uniform float uVignetteOffset;

        varying vec2 vUv;

        // Pseudo-random noise
        float random(vec2 p) {
            return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        // ACES Filmic Tone Mapping (Narkowicz 2015 fit)
        vec3 applyACESFilmic(vec3 x) {
            float a = 2.51;
            float b = 0.03;
            float c = 2.43;
            float d = 0.59;
            float e = 0.14;
            return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        // Exact sRGB Transfer Function
        vec3 applySRGB(vec3 color) {
            vec3 safeColor = max(color, vec3(0.0));
            vec3 higher = 1.055 * pow(safeColor, vec3(0.416666667)) - 0.055;
            vec3 lower = safeColor * 12.92;
            vec3 cutoff = step(vec3(0.0031308), safeColor);
            return mix(lower, higher, cutoff);
        }

        void main() {
            vec3 color;
            vec2 centered = vUv - 0.5;
            float dist = length(centered);

            // 1. Radial Chromatic Aberration (zero at center, gentle edge falloff)
            if (uAberrationEnabled > 0.5 && uAberrationIntensity > 0.00001) {
                float edgeFactor = clamp(dist * 1.5, 0.0, 1.0);
                edgeFactor = edgeFactor * edgeFactor; // quadratic falloff
                vec2 dir = dist > 0.0001 ? (centered / dist) : vec2(0.0);
                vec2 offset = dir * (uAberrationIntensity * edgeFactor);

                float r = texture2D(tDiffuse, vUv + offset).r;
                float g = texture2D(tDiffuse, vUv).g;
                float b = texture2D(tDiffuse, vUv - offset).b;
                color = vec3(r, g, b);
            } else {
                color = texture2D(tDiffuse, vUv).rgb;
            }

            // 2. Luminance-Weighted Monochrome Film Grain (NOT per-channel color speckles)
            if (uGrainEnabled > 0.5 && uGrainIntensity > 0.00001) {
                float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
                // Grain is strongest in shadows/midtones, softly attenuated in blown highlights
                float lumWeight = clamp(1.0 - lum * 0.75, 0.15, 1.0);
                float noise = (random(vUv + fract(uTime * 17.13)) - 0.5) * uGrainIntensity;
                color += vec3(noise * lumWeight);
            }

            // 3. Optical Vignette
            if (uVignetteDarkness > 0.001) {
                float vigor = smoothstep(uVignetteOffset + 0.5, uVignetteOffset, dist * uVignetteDarkness * 2.0);
                color *= vigor;
            }

            gl_FragColor = vec4(color, 1.0);
        }
    `
};

export const LetterboxShader = {
    uniforms: {
        tDiffuse: { value: null },
        uSize: { value: 0.35 }
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
            vec2 flippedUv = vec2(vUv.x, 1.0 - vUv.y);
            if (flippedUv.y < uSize || flippedUv.y > (1.0 - uSize)) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            } else {
                gl_FragColor = texture2D(tDiffuse, flippedUv);
            }
        }
    `
};
