import GUI from 'lil-gui';
import * as THREE from 'three';
import type { Renderer } from './Renderer';
import type { LightingManager } from '../world/LightingManager';
import type { Road } from '../world/Road';
import type { RainSystem } from '../world/RainSystem';

export interface GameTuneConfig {
    exposure: number;
    fogDensity: number;
    fogColor: string;
    ambientIntensity: number;
    moonIntensity: number;
    hemiIntensity: number;
    roadRoughness: number;
    bloomStrength: number;
    bloomRadius: number;
    bloomThreshold: number;
    grainIntensity: number;
    aberrationIntensity: number;
    rainCount: number;
}

export class DebugGUI {
    public gui: GUI;
    public config: GameTuneConfig;

    constructor(
        renderer: Renderer,
        lighting: LightingManager,
        road: Road,
        rain: RainSystem
    ) {
        this.config = {
            exposure: 1.05,
            fogDensity: 0.00045,
            fogColor: '#0a1024',
            ambientIntensity: 0.22,
            moonIntensity: 0.35,
            hemiIntensity: 0.25,
            roadRoughness: 0.32,
            bloomStrength: 1.0,
            bloomRadius: 0.6,
            bloomThreshold: 0.85,
            grainIntensity: 0.03,
            aberrationIntensity: 0.0015,
            rainCount: 4000,
        };

        this.gui = new GUI({ title: 'NIGHTCALL TUNER (Drive 2011)' });
        this.gui.domElement.style.position = 'fixed';
        this.gui.domElement.style.top = '10px';
        this.gui.domElement.style.right = '10px';
        this.gui.domElement.style.zIndex = '9999';
        this.gui.hide(); // Hidden by default, toggle with 'H'

        // 1. Lighting & Exposure Folder
        const lightFolder = this.gui.addFolder('Exposure & Lighting');
        lightFolder.add(this.config, 'exposure', 0.5, 4.5, 0.05).name('Tone Exposure').onChange((v: number) => {
            renderer.renderer.toneMappingExposure = v;
            if (renderer.compositePass) renderer.compositePass.uniforms.uExposure.value = v;
        });
        lightFolder.add(this.config, 'ambientIntensity', 0.0, 1.5, 0.02).name('Ambient Light').onChange((v: number) => {
            lighting.baseAmbientIntensity = v;
            lighting.ambient.intensity = v;
        });
        lightFolder.add(this.config, 'moonIntensity', 0.0, 3.5, 0.05).name('Moonlight').onChange((v: number) => {
            lighting.baseMoonIntensity = v;
            lighting.moon.intensity = v;
        });
        lightFolder.add(this.config, 'hemiIntensity', 0.0, 1.5, 0.02).name('Hemisphere Sky').onChange((v: number) => {
            lighting.baseHemiIntensity = v;
            lighting.hemisphere.intensity = v;
        });

        // 2. Fog & Horizon Folder
        const fogFolder = this.gui.addFolder('Fog & Horizon');
        fogFolder.add(this.config, 'fogDensity', 0.0001, 0.003, 0.00005).name('Fog Density').onChange((v: number) => {
            if (renderer.scene.fog instanceof THREE.FogExp2) {
                renderer.scene.fog.density = v;
            }
        });
        fogFolder.addColor(this.config, 'fogColor').name('Fog Color').onChange((v: string) => {
            if (renderer.scene.fog instanceof THREE.FogExp2) {
                renderer.scene.fog.color.set(v);
                renderer.scene.background = new THREE.Color(v);
            }
        });

        // 3. Materials
        const matFolder = this.gui.addFolder('Materials');
        matFolder.add(this.config, 'roadRoughness', 0.05, 0.95, 0.01).name('Asphalt Roughness').onChange((v: number) => {
            (road as any).material.roughness = v;
        });

        // 4. Post-FX
        const postFolder = this.gui.addFolder('Post-Processing');
        postFolder.add(this.config, 'bloomStrength', 0.0, 2.5, 0.05).name('Bloom Strength').onChange((v: number) => {
            renderer.bloomPass.strength = v;
        });
        postFolder.add(this.config, 'bloomRadius', 0.1, 1.5, 0.05).name('Bloom Radius').onChange((v: number) => {
            renderer.bloomPass.radius = v;
        });
        postFolder.add(this.config, 'bloomThreshold', 0.1, 1.0, 0.02).name('Bloom Threshold').onChange((v: number) => {
            renderer.bloomPass.threshold = v;
        });
        postFolder.add(this.config, 'grainIntensity', 0.0, 0.08, 0.002).name('Film Grain').onChange((v: number) => {
            renderer.compositePass.uniforms.uGrainIntensity.value = v;
        });
        postFolder.add(this.config, 'aberrationIntensity', 0.0, 0.005, 0.0002).name('Aberration Edge').onChange((v: number) => {
            renderer.compositePass.uniforms.uAberrationIntensity.value = v;
        });

        // 5. Rain System
        const atmosFolder = this.gui.addFolder('Atmosphere');
        atmosFolder.add(this.config, 'rainCount', 0, 12000, 500).name('Rain Particles').onChange((v: number) => {
            rain.setCount(v);
        });

        lightFolder.open();
        fogFolder.open();
    }
}
