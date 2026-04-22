# 🌌 Infinite Zen Driving
### A Procedural Cinematic Experience

Inspired by **Slow Roads** and the atmospheric minimalism of **Drive (2011)**. This is an endless, nocturnal journey through a vast procedural landscape, guided only by your headlights and the rhythm of the road.

![Aesthetic](https://img.shields.io/badge/Aesthetic-DRIVE_(2011)-black?style=for-the-badge)
![Tech](https://img.shields.io/badge/Powered_by-Three.js-blueviolet?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Infinite_Zen-green?style=for-the-badge)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://drive-xi-nine.vercel.app/)

### 🎬 Cinematic Manifesto

This project is a high-fidelity simulation of the *Drive* (2011) nocturnal mountain pass sequence. The technical implementation is guided by three core pillars:

1.  **Orange & Teal Depth**: The rendering pipeline uses a selective 0.15 mix-amount orange/teal color grade to separate the blue-hour mountain silhouettes from the high-intensity sodium streetlights.
2.  **Sodium Glow (Neon Realism)**: All light sources use multi-layered `drop-shadow` and `screen` blend modes to simulate gas-discharge volumetric spill on wet asphalt.
3.  **Kinetic Handling**: Physics are tuned for "heavy" muscle car handling (1970 Chevelle SS), prioritizing angular damping and spring-arm stability over hyper-realistic arcade movement.

---

## 🎥 Cinematic Vision
This project prioritizes **Atmosphere over Mechanics**. It captures the isolation of a midnight drive:
- **Restrained Lighting**: 70-80% darkness. Deep black and indigo shadows contrasted by warm halogen highlights.
- **Isolated Pools of Light**: Sparse sodium-orange streetlights creating islands of safety in the void.
- **Zen Driving**: No timers, no crashes, no traffic. Just you and the infinite path.

## ⚙️ Technical Architecture
- **Scout Generation Engine**: A heuristic path-planner that sampling terrain gradients to ensure natural, drivable road curvature.
- **Planetary fBM Noise**: Layered Fractal Brownian Motion with deterministic parameters for **Earth, Mars, and Moon** geologies.
- **Conforming Terrain System**: A master-spline link that physically deforms mountain geometry to meet the road via **Smoothstep Carving**.
- **Deterministic Seed (Alea)**: High-performance PRNG ensuring every world is reproducible from a single seed.
- **Rhythmic Sodium Lighting**: Warm orange streetlights (#FF9500) spawned every 50m with volumetric gradients and Indigo rim-lights to reveal mountain silhouettes.
- **High-Gloss "Wet" Asphalt**: Advanced MeshPhysicalMaterial with 0.8 Clearcoat and 0.7 Metalness, creating sharp specular streaks from the rhythmic streetlights.
- **Cinematic Cockpit Rig**: A tight, lower camera perspective (4.5m behind, 1.8m above) designed to emphasize the sense of scale and the strobe-like effect of overhead lights.
- **Treadmill LOD System**: High-detail near-player chunks with large-scale low-detail far grids for infinite visibility.

## 🕹️ Controls
- **WASD / ARROWS**: Manual Drive & Steering
- **'A' KEY**: Toggle **Cinematic Autopilot** (Rail-Lock Spline Tracking)
- **CLICK TO START**: Initialize Cinematic Engine & Physics
- **ESC**: Pause / Reset View

## 🛠️ Tech Stack
- **Engine**: Three.js (WebGL)
- **Physics**: Custom procedural spline-alignment system
- **Environment**: Custom GLSL Color Grading & Post-processing
- **Asset Pipeline**: Support for external GLTF/GLB models with procedural fallbacks.
- **Wheel Animation**: Physically calculated wheel rotation mapped to vehicle velocity.

## 🏁 Development State
Currently tuned for **Visual Immersion**. The system is optimized for a 1.8 exposure/0.006 fog density ratio to maintain visibility while preserving the deep nocturnal mood.

---
*Created with focus on visual excellence and cinematic restraint.*
