import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
// 웹에서 우클릭 컨텍스트 메뉴 방지
document.addEventListener('contextmenu', (e) => e.preventDefault());
const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 1280,
    height: 720,
    backgroundColor: '#0d0d1a',
    pixelArt: true, // 도트 디자인용
    dom: {
        createContainer: true
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
        activePointers: 3, // 멀티터치 지원
    },
    scene: [GameScene, UIScene],
};
new Phaser.Game(config);
