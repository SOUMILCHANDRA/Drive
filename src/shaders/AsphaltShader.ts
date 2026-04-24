import * as THREE from 'three';

export const AsphaltShader = {
    uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 0 },
        uCarPos: { value: new THREE.Vector3() },
        uHeadlightPos: { value: [new THREE.Vector3(), new THREE.Vector3()] },
        uNeonColors: { value: new Array(8).fill(new THREE.Color()) },
        uNeonPositions: { value: new Array(8).fill(new THREE.Vector3()) },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform float uSpeed;
        uniform vec3 uCarPos;
        uniform vec3 uHeadlightPos[2];
        uniform vec3 uNeonColors[8];
        uniform vec3 uNeonPositions[8];
        
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;

        void main() {
            // 1. Base Asphalt Color
            vec3 color = vec3(0.04, 0.04, 0.06); // Deep Asphalt Gray
            
            // 2. Fresnel Effect (Mirror at glancing angles)
            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
            float fresnel = pow(1.0 - dot(viewDir, vNormal), 4.0);
            
            // 3. Neon Reflection Smearing
            vec3 reflectionColor = vec3(0.0);
            for(int i = 0; i < 8; i++) {
                float dist = distance(vWorldPosition, uNeonPositions[i]);
                float glow = exp(-dist * 0.05);
                // Smear reflections in Z direction (motion) - stretches with speed
                float smearFactor = 0.001 / (1.0 + uSpeed * 0.2);
                float smear = exp(-pow(vWorldPosition.z - uNeonPositions[i].z, 2.0) * smearFactor);
                reflectionColor += uNeonColors[i] * glow * smear * 0.8;
            }
            
            // 4. Headlight Specular
            float headlightSpec = 0.0;
            for(int i = 0; i < 2; i++) {
                vec3 lightDir = normalize(uHeadlightPos[i] - vWorldPosition);
                vec3 halfDir = normalize(lightDir + viewDir);
                headlightSpec += pow(max(dot(vNormal, halfDir), 0.0), 32.0) * 2.0;
            }
            
            // 5. Final Composition
            color = mix(color, color + reflectionColor, fresnel * 0.8);
            color += headlightSpec * 0.5 * vec3(1.0, 0.95, 0.8); // Warm headlight tint
            
            gl_FragColor = vec4(color, 1.0);
        }
    `
};
