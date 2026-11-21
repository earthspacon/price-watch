// A link is checked once a day at this local hour; a store that keeps failing is retried after these delays.
export const DAILY_CHECK_HOUR = 1;
export const RETRY_DELAYS_MINUTES = [15, 60] as const;
export const DEFAULT_TIME_ZONE = "UTC";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;

type WallTime = { year: number; month: number; day: number; hour: number; minute: number; second: number };

// The first moment after `now` when the wall clock in `timeZone` shows `hour`:00.
export function nextLocalTime({ now, timeZone, hour }: { now: Date; timeZone: string; hour: number }) {
  const today = readWallTime({ date: now, timeZone });

  for (let dayOffset = today.hour < hour ? 0 : 1; ; dayOffset++) {
    const candidate = wallTimeToDate({
      wall: {
        year: today.year,
        month: today.month,
        day: today.day + dayOffset,
        hour,
        minute: 0,
        second: 0,
      },
      timeZone,
    });

    if (candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
}

export function minutesLater({ time, minutes }: { time: Date; minutes: number }) {
  return new Date(time.getTime() + minutes * MS_PER_MINUTE);
}

function readWallTime({ date, timeZone }: { date: Date; timeZone: string }) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  const parts = new Map(
    formatter.formatToParts(date).map((part) => {
      return [part.type, Number(part.value)];
    }),
  );
  const wall: WallTime = {
    year: parts.get("year") ?? 0,
    month: parts.get("month") ?? 0,
    day: parts.get("day") ?? 0,
    hour: parts.get("hour") ?? 0,
    minute: parts.get("minute") ?? 0,
    second: parts.get("second") ?? 0,
  };
  return wall;
}

function wallTimeAsUtc(wall: WallTime) {
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
}

function offsetAt({ time, timeZone }: { time: number; timeZone: string }) {
  const wholeSeconds = Math.floor(time / MS_PER_SECOND) * MS_PER_SECOND;
  return wallTimeAsUtc(readWallTime({ date: new Date(wholeSeconds), timeZone })) - wholeSeconds;
}

// The offset is read twice: once near the wall time and once at the first guess, which settles DST changes.
function wallTimeToDate({ wall, timeZone }: { wall: WallTime; timeZone: string }) {
  const asUtc = wallTimeAsUtc(wall);
  const firstGuess = asUtc - offsetAt({ time: asUtc, timeZone });
  return new Date(asUtc - offsetAt({ time: firstGuess, timeZone }));
}
