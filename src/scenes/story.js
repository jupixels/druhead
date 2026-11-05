// Storybook intro and ending (filled out in step 4).
export class StoryScene { constructor(after) { this.after = after; } update() { this.after(); } draw() {} }
export class EndingScene { update() {} draw() {} }
