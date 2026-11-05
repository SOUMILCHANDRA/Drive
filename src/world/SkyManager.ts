import * as THREE from 'three';

/**
 * SkyManager: Majestic nocturnal Los Angeles sky (Drive / Slow Roads aesthetic).
 * Features:
 * - Rich midnight navy-to-twilight-indigo sky dome (no mud brown)
 * - Layered mountain ridgelines along the horizon
 * - 3D instanced downtown skyscraper skyline with procedural sparkling window facades
 * - Crisp silver moon and twinkling celestial starfield
 */
export class SkyManager {
    private scene: THREE.Scene;
    private starField: THREE.Points;
    private moon: THREE.Mesh;
    private skyDome: THREE.Mesh;
    private mountainRing: THREE.Mesh;
    private instancedSkyline: THREE.InstancedMesh;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // 1. Distant Starfield — realistic brightness variation
        const starGeo = new THREE.BufferGeometry();
        const starCount = 650;
        const starPos = new Float32Array(starCount * 3);
        const starSizes = new Float32Array(starCount);

        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 0.88); // cluster toward zenith
            const r = 3800;

            starPos[i3]     = r * Math.sin(phi) * Math.cos(theta);
            starPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            starPos[i3 + 2] = r * Math.cos(phi);
            starSizes[i] = 1.0 + Math.random() * 2.0;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

        const starMat = new THREE.PointsMaterial({
            color: 0xe8f0ff,
            size: 2.2,
            transparent: true,
            opacity: 0.65,
            sizeAttenuation: false,
            fog: false,
        });
        this.starField = new THREE.Points(starGeo, starMat);
        this.scene.add(this.starField);

        // 2. Moon — crisp glowing silver orb with atmospheric halo
        const moonGeo = new THREE.CircleGeometry(42, 32);
        const moonMat = new THREE.MeshBasicMaterial({
            color: 0xebf2ff,
            transparent: true,
            opacity: 0.85,
            fog: false,
        });
        this.moon = new THREE.Mesh(moonGeo, moonMat);
        this.moon.position.set(200, 480, -1200);
        this.scene.add(this.moon);

        // 3. Sky dome — deep indigo to luminous twilight horizon (noir synthwave)
        this.skyDome = this.createSkyDome();
        this.skyDome.layers.enable(1); // Enable reflection in wet road CubeCamera
        this.scene.add(this.skyDome);

        // 4. Distant Mountain Ridge Silhouettes (Slow Roads feel)
        this.mountainRing = this.createMountainRing();
        this.scene.add(this.mountainRing);

        // 5. Instanced 3D Skyline Skyscrapers with illuminated windows (~1600m - 2100m radius)
        this.instancedSkyline = this.createInstancedSkyline();
        this.scene.add(this.instancedSkyline);
    }

    private createSkyDome(): THREE.Mesh {
        // Vertical gradient with triangle-noise dithering (Bug 3c fix for color banding)
        const vertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz - cameraPosition;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec3 dir = normalize(vWorldPosition);
                float h = clamp(dir.y, 0.0, 1.0);

                // Vertical gradient: zenith #05060f -> mid #0d0b2a -> horizon #3a1840 with thin warm #7a2e4a band
                vec3 zenith   = vec3(0.0196, 0.0235, 0.0588); // #05060f
                vec3 mid      = vec3(0.0510, 0.0431, 0.1647); // #0d0b2a
                vec3 horizon  = vec3(0.2275, 0.0941, 0.2510); // #3a1840
                vec3 warmBand = vec3(0.4784, 0.1804, 0.2902); // #7a2e4a

                vec3 color = mix(mid, zenith, smoothstep(0.15, 0.85, h));
                color = mix(horizon, color, smoothstep(0.02, 0.28, h));

                // Subtle warm sunset horizon line
                float warmFactor = exp(-pow((h - 0.025) / 0.025, 2.0));
                color += warmBand * warmFactor * 0.40;

                // Ground nadir fade (below horizon)
                if (dir.y < 0.0) {
                    color = mix(horizon, vec3(0.01, 0.015, 0.03), clamp(-dir.y * 4.0, 0.0, 1.0));
                }

                // Triangle-noise dithering to eliminate 8-bit sky banding (Bug 3c)
                float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
                color += dither;

                gl_FragColor = vec4(color, 1.0);
            }
        `;

        const geo = new THREE.SphereGeometry(2400, 32, 24);
        const mat = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
        });

        return new THREE.Mesh(geo, mat);
    }

    /**
     * Procedural mountain silhouettes forming a majestic natural backdrop on the horizon.
     */
    private createMountainRing(): THREE.Mesh {
        const segs = 96;
        const radius = 1950;
        const geo = new THREE.BufferGeometry();
        const positions: number[] = [];
        const indices: number[] = [];

        for (let i = 0; i <= segs; i++) {
            const angle = (i / segs) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            // Multi-frequency rolling California coastal mountain ridgeline
            const h = 75 + 
                      Math.sin(angle * 4) * 60 + 
                      Math.cos(angle * 9) * 35 + 
                      Math.sin(angle * 19) * 18;

            // Base vertex (below horizon)
            positions.push(x, -60, z);
            // Peak vertex
            positions.push(x, h, z);

            if (i < segs) {
                const a = i * 2;
                const b = a + 1;
                const c = (i + 1) * 2;
                const d = c + 1;
                indices.push(a, b, c, b, d, c);
            }
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        // Shaded dark indigo silhouette against the starry sky
        const mat = new THREE.MeshBasicMaterial({
            color: 0x05091a,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false,
        });

        return new THREE.Mesh(geo, mat);
    }

    /**
     * Builds an InstancedMesh of 160 towers at 1600m - 2200m radius with a procedural
     * illuminated window facade shader that glitters in the night.
     */
    private createInstancedSkyline(): THREE.InstancedMesh {
        const count = 160;
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        boxGeo.clearGroups();

        const skylineMat = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec2 vFacadeCoord;
                varying float vIsFacade;
                void main() {
                    float instW = length(instanceMatrix[0].xyz);
                    float instH = length(instanceMatrix[1].xyz);
                    float instD = length(instanceMatrix[2].xyz);
                    if (abs(normal.y) < 0.25) {
                        vIsFacade = 1.0;
                        if (abs(normal.x) > 0.5) {
                            vFacadeCoord = vec2(position.z * instD, (position.y + 0.5) * instH);
                        } else {
                            vFacadeCoord = vec2(position.x * instW, (position.y + 0.5) * instH);
                        }
                    } else {
                        vIsFacade = 0.0;
                        vFacadeCoord = vec2(0.0);
                    }
                    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }
            `,
            fragmentShader: `
                varying vec2 vFacadeCoord;
                varying float vIsFacade;
                void main() {
                    // Deep indigo skyscraper body
                    vec3 baseColor = vec3(0.04, 0.06, 0.12);

                    // Axis-aligned crisp rectangular windows on vertical facades (~20% lit)
                    if (vIsFacade > 0.5) {
                        float cellW = 3.6; // window cell width 3.6m
                        float cellH = 4.2; // window floor height 4.2m

                        vec2 cellCoord = vec2(vFacadeCoord.x / cellW, vFacadeCoord.y / cellH);
                        vec2 g = fract(cellCoord);
                        vec2 cellId = floor(cellCoord);

                        // Axis-aligned crisp window rectangle
                        vec2 wBox = step(vec2(0.20, 0.18), g) * (1.0 - step(vec2(0.80, 0.82), g));
                        float isWin = wBox.x * wBox.y;

                        if (isWin > 0.5) {
                            float rand = fract(sin(dot(cellId, vec2(12.9898, 78.233))) * 43758.5453);
                            // ~20% lit windows (warm and cool)
                            if (rand < 0.20) {
                                vec3 winColor;
                                if (rand < 0.06) {
                                    winColor = vec3(0.35, 0.88, 1.0); // cool cyan
                                } else if (rand < 0.13) {
                                    winColor = vec3(1.0, 0.85, 0.52); // warm halogen
                                } else {
                                    winColor = vec3(1.0, 0.65, 0.24); // sodium amber
                                }
                                baseColor = winColor * 2.5;
                            }
                        }
                    }

                    gl_FragColor = vec4(baseColor, 1.0);
                }
            `,
            depthWrite: false,
            fog: false,
        });

        const instancedMesh = new THREE.InstancedMesh(boxGeo, skylineMat, count);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.04;
            const dist = 1600 + Math.random() * 500;
            const w = 40 + Math.random() * 80;
            const d = 40 + Math.random() * 80;
            const h = 180 + Math.random() * 380;

            dummy.position.set(
                Math.cos(angle) * dist,
                h * 0.5 - 20,
                Math.sin(angle) * dist
            );
            dummy.scale.set(w, h, d);
            dummy.rotation.y = angle + Math.PI / 2;
            dummy.updateMatrix();

            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        return instancedMesh;
    }

    public update(carPos: THREE.Vector3): void {
        this.starField.position.copy(carPos);
        this.skyDome.position.copy(carPos);
        this.mountainRing.position.copy(carPos);
        this.instancedSkyline.position.copy(carPos);

        this.moon.position.x = carPos.x + 350;
        this.moon.position.y = 520;
        this.moon.position.z = carPos.z - 1800;
        this.moon.lookAt(carPos);
    }
}
