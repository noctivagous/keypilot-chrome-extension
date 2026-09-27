import {
  ensureSession,
  onboardingState,
  overlayOpen,
  paintedTasks,
  reconnectIfNeeded,
  waitUntil
} from '../cdp.mjs';
import { dismissOverlayIfOpen, runWhenHandler } from '../handlers.mjs';

async function assertPaintedTasksMatch(session, slide) {
  const expected = (slide.tasks || []).map((task) => task.id);
  if (!expected.length) return;
  const rows = await waitUntil(async () => {
    const painted = await paintedTasks(session);
    if (painted.length === expected.length
      && expected.every((id, i) => painted[i]?.id === id)) {
      return painted;
    }
    return null;
  }, 12_000, `Painted tasks did not match slide "${slide.id}": expected ${expected.join(', ')}`);
  return rows;
}

export async function walkOnboardingModel(session, model, ctx) {
  for (const slide of model.slides) {
    console.log(`  Slide ${slide.id}`);
    await reconnectIfNeeded(session, ctx.port, ctx.origin);
    await ensureSession(session);

    await waitUntil(async () => {
      const state = await onboardingState(session);
      if (state.completed) return true;
      return state.slideId === slide.id;
    }, 20_000, `Did not reach slide "${slide.id}"`);

    const state = await onboardingState(session);
    if (state.completed && slide.id !== model.slides[model.slides.length - 1]?.id) {
      throw new Error(`Onboarding completed before slide "${slide.id}"`);
    }

    const hasOverlay = (slide.onEnter || []).some((entry) => entry.type === 'overlay');
    if (hasOverlay && !state.completed) {
      await waitUntil(async () => overlayOpen(session), 12_000, `Overlay did not open on slide "${slide.id}"`);
      await dismissOverlayIfOpen(session);
    }

    if (!state.completed) {
      await assertPaintedTasksMatch(session, slide);
    }

    for (const task of slide.tasks || []) {
      const progress = await onboardingState(session);
      if (progress.completedTaskIds?.includes(String(task.id))) {
        console.log(`    Task ${task.id} (already done)`);
        continue;
      }
      console.log(`    Task ${task.id}`);
      await runWhenHandler(session, task, ctx);
    }
  }

  await waitUntil(async () => {
    const next = await onboardingState(session);
    return Boolean(next.completed);
  }, 15_000, 'Walkthrough did not mark progress.completed');
  console.log('  Flow 2: walkthrough model completed');
}
