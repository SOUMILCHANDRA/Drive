# 🌌 Infinite Zen Driving
### A Procedural Cinematic Experience

Inspired by **Slow Roads** and the atmospheric minimalism of **Drive (2011)**. This is an endless, nocturnal journey through a vast procedural landscape, guided only by your headlights and the rhythm of the road.

![Aesthetic](https://img.shields.io/badge/Aesthetic-DRIVE_(2011)-black?style=for-the-badge)
![Tech](https://img.shields.io/badge/Powered_by-Three.js-blueviolet?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Infinite_Zen-green?style=for-the-badge)

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
