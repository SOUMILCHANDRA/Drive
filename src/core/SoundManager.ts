import * as THREE from 'three';

/**
 * SoundManager: Handles background music and spatial audio.
 */
export class SoundManager {
  private listener: THREE.AudioListener;
  private bgm: THREE.Audio;
  private loader: THREE.AudioLoader;

  constructor(camera: THREE.Camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.bgm = new THREE.Audio(this.listener);
    this.loader = new THREE.AudioLoader();
  }

  public async loadBGM(url: string): Promise<void> {
    try {
      const buffer = await this.loader.loadAsync(url);
      this.bgm.setBuffer(buffer);
      this.bgm.setLoop(true);
      this.bgm.setVolume(0.4);
      console.log('BGM Loaded successfully');
    } catch (e) {
      console.error('Failed to load BGM:', e);
    }
  }

  public playBGM(): void {
    if (!this.bgm.isPlaying) {
      this.bgm.play();
    }
  }

  public stopBGM(): void {
    if (this.bgm.isPlaying) {
      this.bgm.stop();
    }
  }
}
