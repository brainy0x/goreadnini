// pupLines.js — the gentle things Anabelle says. Warm and short, and never guilt.

const GENERAL = [
  "I'm right here with you.",
  'Take your time. The story will wait.',
  'One more page?',
  "I'm proud of you.",
  'You make reading look easy.',
  'Cozy spot, good book. Perfect.',
]

const STUDYING = [
  "Slow and steady. You've got this.",
  "Let's study together.",
  'One small step at a time.',
  "I'll keep you company.",
]

const GOAL_REACHED = [
  'You did it today! I knew you would.',
  "That's your goal done. So proud of you.",
  'What a lovely reading day.',
]

const QUIET_DAY = [
  "No rush. I'm happy just sitting with you.",
  'Whenever you are ready.',
  "I'll be here.",
]

const CELEBRATE = [
  "You finished it! I'm so proud of you.",
  'Another one done. Look at you!',
]

const pick = (list) => list[Math.floor(Math.random() * list.length)]

export function pupLine({ reachedGoal, studying, minutesToday }) {
  if (reachedGoal) return pick(GOAL_REACHED)
  if (studying) return pick(STUDYING)
  if (minutesToday === 0) return pick([...QUIET_DAY, ...GENERAL])
  return pick(GENERAL)
}

export const celebrationLine = () => pick(CELEBRATE)
