const fs = require('fs');
const path = require('path');

const BASE_DIR = process.pkg ? process.cwd() : path.join(__dirname, '..');
const SCHEDULER_FILE = path.join(BASE_DIR, 'data/scheduler.json');

const GOLDEN_SLOTS = [
  { id: 'slot_1', hour: 7, minute: 45, label: '🌅 Đầu sáng (07:30 - 08:00)' },
  { id: 'slot_2', hour: 10, minute: 15, label: '☕ Giữa sáng (10:00 - 10:30)' },
  { id: 'slot_3', hour: 12, minute: 15, label: '☀️ Nghỉ trưa (12:00 - 12:30)' },
  { id: 'slot_4', hour: 15, minute: 15, label: '🏢 Buổi chiều (15:00 - 15:30)' },
  { id: 'slot_5', hour: 17, minute: 45, label: '🌆 Tan tầm (17:30 - 18:00)' },
  { id: 'slot_6', hour: 20, minute: 30, label: '🌙 Buổi tối (20:15 - 20:45)' }
];

function getTodayStr(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calculateSlotsForDate(dateObj, maxJitter = 15) {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth();
  const d = dateObj.getDate();
  const todayStr = getTodayStr(dateObj);

  return GOLDEN_SLOTS.map(slot => {
    let hash = 0;
    const seed = `${todayStr}_${slot.id}_${slot.hour}_${slot.minute}_rand_v2`;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const range = maxJitter * 2 + 1;
    const jitterMin = (Math.abs(hash) % range) - maxJitter; // -maxJitter to +maxJitter

    const baseDate = new Date(y, m, d, slot.hour, slot.minute, 0, 0);
    const triggerDate = new Date(baseDate.getTime() + jitterMin * 60 * 1000);

    return {
      id: slot.id,
      label: slot.label,
      standardTime: `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`,
      jitterMinutes: jitterMin,
      actualTimeStr: `${String(triggerDate.getHours()).padStart(2, '0')}:${String(triggerDate.getMinutes()).padStart(2, '0')}`,
      triggerDate,
      triggerDateIso: triggerDate.toISOString(),
      triggerTimeMs: triggerDate.getTime()
    };
  });
}

/**
 * Check if a golden slot is ready to publish right now
 */
function checkGoldenSlotTrigger(config, now = new Date()) {
  const mode = config.mode || 'golden_slots';
  if (mode !== 'golden_slots') return { shouldPublish: false };

  const todayStr = getTodayStr(now);
  const nowMs = now.getTime();
  const maxJitter = parseInt(config.randomJitterMaxMinutes) || 15;

  const slotsToday = calculateSlotsForDate(now, maxJitter);
  
  // Track executed slots
  if (!config.goldenSlotsState || config.goldenSlotsState.date !== todayStr) {
    config.goldenSlotsState = {
      date: todayStr,
      executedSlots: []
    };
  }

  const executed = new Set(config.goldenSlotsState.executedSlots || []);

  for (const slot of slotsToday) {
    // If not executed today and current time has reached trigger time
    // And within 45 minutes of trigger time (to avoid catching up old slots if machine was off all morning)
    if (!executed.has(slot.id)) {
      const diffMs = nowMs - slot.triggerTimeMs;
      if (diffMs >= 0 && diffMs <= 45 * 60 * 1000) {
        return {
          shouldPublish: true,
          slot,
          todayStr,
          slotsToday
        };
      }
    }
  }

  return { shouldPublish: false, slotsToday };
}

/**
 * Get next upcoming golden slot for countdown display
 */
function getNextUpcomingSlot(config, now = new Date()) {
  const todayStr = getTodayStr(now);
  const nowMs = now.getTime();
  const maxJitter = parseInt(config.randomJitterMaxMinutes) || 15;

  const slotsToday = calculateSlotsForDate(now, maxJitter);
  const executed = new Set((config.goldenSlotsState && config.goldenSlotsState.date === todayStr) 
    ? (config.goldenSlotsState.executedSlots || []) 
    : []);

  // Find next slot today that hasn't executed and trigger time is in future or current
  for (const slot of slotsToday) {
    if (!executed.has(slot.id) && slot.triggerTimeMs >= nowMs - 5 * 60 * 1000) {
      return {
        slot,
        isTomorrow: false,
        remainingSec: Math.max(0, Math.round((slot.triggerTimeMs - nowMs) / 1000)),
        slotsToday
      };
    }
  }

  // All slots today passed -> Next slot is slot_1 of tomorrow
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const slotsTomorrow = calculateSlotsForDate(tomorrow, maxJitter);
  const firstSlotTomorrow = slotsTomorrow[0];

  return {
    slot: firstSlotTomorrow,
    isTomorrow: true,
    remainingSec: Math.max(0, Math.round((firstSlotTomorrow.triggerTimeMs - nowMs) / 1000)),
    slotsToday
  };
}

/**
 * Generate a timeline of upcoming golden slots for pending items queue
 */
function getNextUpcomingSlotsTimeline(config, count = 10, now = new Date()) {
  const maxJitter = parseInt(config.randomJitterMaxMinutes) || 15;
  const nowMs = now.getTime();
  const timeline = [];

  let currentDayOffset = 0;
  const todayStr = getTodayStr(now);
  const executed = new Set((config.goldenSlotsState && config.goldenSlotsState.date === todayStr)
    ? (config.goldenSlotsState.executedSlots || [])
    : []);

  while (timeline.length < count && currentDayOffset <= 7) {
    const targetDate = new Date(nowMs + currentDayOffset * 24 * 60 * 60 * 1000);
    const slots = calculateSlotsForDate(targetDate, maxJitter);

    for (const slot of slots) {
      if (currentDayOffset === 0) {
        if (executed.has(slot.id) || slot.triggerTimeMs < nowMs - 5 * 60 * 1000) {
          continue;
        }
      }

      timeline.push({
        slot,
        estimatedPublishTime: slot.triggerDateIso,
        remainingSec: Math.max(0, Math.round((slot.triggerTimeMs - nowMs) / 1000)),
        dayOffset: currentDayOffset
      });

      if (timeline.length >= count) break;
    }
    currentDayOffset++;
  }

  return timeline;
}

module.exports = {
  GOLDEN_SLOTS,
  calculateSlotsForDate,
  checkGoldenSlotTrigger,
  getNextUpcomingSlot,
  getNextUpcomingSlotsTimeline,
  getTodayStr
};
