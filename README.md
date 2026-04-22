# 🎬 Drive | Midnight Procedural Road

A moody, restrained cinematic driving experience inspired by the 2011 film **DRIVE**. Explore an infinite, procedurally generated nocturnal landscape designed with a focus on atmosphere, lighting, and tension over arcade speed.

![Drive Aesthetic](https://img.shields.io/badge/Aesthetic-DRIVE_(2011)-black?style=for-the-badge)
![Tech](https://img.shields.io/badge/Powered_by-Three.js-blueviolet?style=for-the-badge)

## 🌌 Cinematic Vision
This project deviates from typical "Neon" racing games. Instead, it captures the grit and isolation of a midnight drive through Los Angeles:
- **Restrained Lighting**: Deep blacks and cold blue-grey environments contrasted by warm halogen headlights.
- **Atmospheric Depth**: Procedural sodium-orange streetlights creating islands of warmth in a vast nocturnal void.
- **Film Grain & Texture**: 35mm celluloid film grain and soft vignettes emulate a high-end cinematic experience.
- **Documentary HUD**: A minimalist, low-profile text overlay replacing traditional arcade gauges.

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
