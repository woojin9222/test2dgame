import Phaser from 'phaser'
import { GameScene } from './scenes/GameScene'
import { UIScene }   from './scenes/UIScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#0d0d1a',
  pixelArt: false,
  dom: {
    createContainer: true   // needed for UIScene HTML elements
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene, UIScene],
}

new Phaser.Game(config)
