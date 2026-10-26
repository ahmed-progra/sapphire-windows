import type { Transition } from 'framer-motion';

export const motionTiming = {
  feedback: 120,
  content: 160,
  theme: 180,
  ease: [.22, 1, .36, 1] as [number, number, number, number],
  morph: { type: 'spring', stiffness: 420, damping: 42, mass: 1 } satisfies Transition,
};
export const contentTransition = { duration: motionTiming.content / 1000, ease: motionTiming.ease };
