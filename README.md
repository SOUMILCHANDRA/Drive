# 🏎️ Drive: Next-Gen Procedural Racer

![Drive Splash](public/splash_bg.png)

A high-performance, procedural 3D racing experience built for the browser. Inspired by *Slow Roads* and *WipEout*, **Drive** offers an infinite journey through a synthwave-inspired neon landscape with anti-gravity mechanics and smooth spline-based generation.

## 🌟 Next-Gen Features

- **Infinite Spline Generation**: Transitioned to a `CatmullRomCurve3` system for perfectly smooth curves and infinite track chunks.
- **Anti-Gravity Physics**:
  - **Gravity-Flip Tunnels**: Enclosed hexagonal tubes where physics inverts and you drive on the ceiling.
  - **Wall-Riding**: Natural banking and vertical loops integrated into the procedural generation.
- **Advanced Car Controls**:
  - **Drift System**: Hold `Space` to slide through corners with dynamic trail effects.
  - **Barrel Rolls**: Double-tap `A/D` to perform cinematic rotations.
  - **Boost Bursts**: Floating rings that grant speed boosts and screen flash effects.
- **Visual Excellence**:
  - **Professional Post-Processing**: `UnrealBloomPass` + `ChromaticAberrationShader` for a premium cinematic look.
  - **Animated Road Shader**: Custom GLSL road material with speed-synced neon grid scrolling.
  - **Dynamic Elements**: Speed-lines, neon ribbons (trails), and orbital camera intros.
- **Pro HUD & Audio**:
  - **Procedural Engine Sounds**: Web Audio API oscillator that modulates frequency based on car speed.
  - **Glassmorphic HUD**: Real-time SVG gauge, boost bar, and a live minimap projection.

## 🛠️ Tech Stack

- **Core**: [Three.js](https://threejs.org/) (WebGL)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Audio**: Web Audio API
- **Build Tool**: [Vite](https://vitejs.dev/)

## 🚀 Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/SOUMILCHANDRA/Drive.git
    cd Drive
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run development server**:
    ```bash
    npm run dev
    ```

## 🎮 Controls

| Key | Action |
| :--- | :--- |
| **W / Arrow Up** | Accelerate |
| **S / Arrow Down** | Brake / Reverse |
| **A / D** | Steer (Double tap for Barrell Roll) |
| **Space** | Drift |
| **Mouse Click** | Start Game / Initial Cinematic |

## 📄 License
MIT License
