# 🏎️ Drive: Procedural Adventure

![Drive Splash](public/splash_bg.png)

A high-performance, procedural 3D driving exploration game built for the browser. Inspired by *Slow Roads*, **Drive** offers an infinite, relaxing journey through a synthwave-inspired sunset landscape.

## 🌟 Features

- **Infinite Procedural World**: Never-ending terrain and roads generated in real-time using Simplex Noise.
*   **Local Transform Connection**: A robust road generation system that ensures segments connect perfectly with zero gaps or alignment issues.
- **Cinematic Visuals**:
  - **Dynamic Bloom**: High-quality neon glow effects for car headlights and road sidelines.
  - **Atmospheric Fog**: Exponential fog blending for seamless horizon transitions.
  - **Motion Blur Particles**: Speed-sensitive particle effects to enhance the sense of momentum.
- **Arcade Physics**: Simple yet satisfying car handling with terrain-hugging "ground adhesion" logic.
- **Dynamic HUD**: Real-time tracking of speed, distance, and elevation with a glassmorphic design.
- **Immersive Splash Screen**: A beautiful hand-crafted front screen with smooth transitions into gameplay.

## 🛠️ Tech Stack

- **Core**: [Three.js](https://threejs.org/) (WebGL)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Logic**: Simplex Noise for procedural heightmaps and road curves.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

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

4.  Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🎮 Controls

| Key | Action |
| :--- | :--- |
| **W / Arrow Up** | Accelerate |
| **S / Arrow Down** | Brake / Reverse |
| **A / D / Arrow Left / Right** | Steer |
| **Mouse Click** | Start Game (Splash Screen) |

## 🏗️ Architecture Overview

### `Engine`
Handles the Three.js boilerplate, including Scene, Camera with dynamic FOV, and the Post-processing pipeline (UnrealBloomPass).

### `RoadManager`
Manages the infinite road chain. Each segment stores its specific transform (position/rotation) and connects flawlessly to the previous segment's endpoint.

### `WorldManager`
Orchestrates the chunk-based terrain system. It generates and disposes of 200x200 terrain meshes based on the player's proximity.

### `Car`
Handles input processing and simple Rigidbody-style physics calculations. It uses the `RoadManager`'s height interpolation to stay grounded as the terrain changes.

## 📄 License
MIT License - feel free to use this as a base for your own procedural experiments!
