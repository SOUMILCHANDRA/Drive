import * as THREE from 'three';

export class SoundManager {
  private listener: THREE.AudioListener;
  private bgm: THREE.Audio | null = null;
  private loader: THREE.AudioLoader;

  constructor(camera: THREE.Camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.loader = new THREE.AudioLoader();
  }

  public async loadBGM(url: string): Promise<void> {
    this.bgm = new THREE.Audio(this.listener);
    const buffer = await this.loader.loadAsync(url);
    this.bgm.setBuffer(buffer);
    this.bgm.setLoop(true);
    this.bgm.setVolume(0.5);
  }

  public playBGM(): void {
    if (this.bgm && !this.bgm.isPlaying) {
      this.bgm.play();
    }
  }
}
