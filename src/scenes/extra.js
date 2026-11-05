// Registers the overworld, shop, story and ending scenes.
import { MapScene } from './map.js';
import { ShopScene } from './shop.js';
import { StoryScene, EndingScene } from './story.js';

export function registerExtraScenes(nav) {
  nav.register('map', () => new MapScene());
  nav.register('shop', () => new ShopScene());
  nav.register('story', (after) => new StoryScene(after));
  nav.register('ending', () => new EndingScene());
}
