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

## ⚙️ Technical Features
- **Procedural Spline Generation**: High-performance CatmullRom splines create a smooth, infinite roadway that maps to a "Wet Look" asphalt material.
- **Dynamic Post-Processing Stack**:
  - **ACESFilmic Tone Mapping**: Industry-standard color grading for consistent exposure.
  - **UnrealBloom**: Calibrated to catch only high-intensity specular highlights (headlights/brake lights).
  - **Color Grading**: Cold shadow hues and warm highlight shifts for the LA night-film look.
- **Handheld Camera Logic**: A soft, "breathing" camera follow-system that simulates a handheld rig on the chase vehicle.
- **Advanced Headlight Optics**: Dual-stage SpotLights with inner/outer cones for realistic road-surface illumination spread.

## 🕹️ Controls
- **WASD / ARROWS**: Drive & Steering
- **SPACE**: Drift (Cuts grip and adds lateral slide)
- **DOUBLE TAP A/D**: Trigger a cinematic Barrel Roll
- **CLICK SPLASH**: Initialize Cinematic Audio & Engine

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
