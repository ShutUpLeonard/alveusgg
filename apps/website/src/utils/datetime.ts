import { DateTime } from "luxon";

import type { PartialDateString } from "@alveusgg/data/build/types";

export type DateTimeFormat = {
  style: "short" | "long";
  time: "minutes" | "seconds" | undefined;
  timezone: boolean;
};

const getFormat = ({
  style,
  time,
  timezone,
}: DateTimeFormat): Intl.DateTimeFormatOptions => {
  const defaults: Partial<Intl.DateTimeFormatOptions> = {
    timeZoneName: timezone ? "shortGeneric" : undefined,
  };

  if (time === "seconds") {
    return {
      ...(style === "short"
        ? DateTime.DATETIME_SHORT_WITH_SECONDS
        : DateTime.DATETIME_FULL_WITH_SECONDS),
      ...defaults,
    };
  }

  if (time === "minutes") {
    return {
      ...(style === "short" ? DateTime.DATETIME_SHORT : DateTime.DATETIME_FULL),
      ...defaults,
    };
  }

  return {
    ...(style === "short" ? DateTime.DATE_SHORT : DateTime.DATE_FULL),
    ...defaults,
  };
};

export type DateTimeOptions = {
  locale: string | null;
  zone: string | null;
};

export const formatDateTime = (
  dateTime: Date,
  {
    style = "short",
    time = undefined,
    timezone = false,
  }: Partial<DateTimeFormat> = {},
  { locale = "en-US", zone = "UTC" }: Partial<DateTimeOptions> = {},
) =>
  DateTime.fromJSDate(dateTime)
    .setZone(zone ?? undefined)
    .reconfigure({ locale: locale ?? undefined })
    .toLocaleString(getFormat({ style, time, timezone }));

export const formatDateTimeParts = (
  dateTime: Date,
  {
    style = "short",
    time = undefined,
    timezone = false,
  }: Partial<DateTimeFormat> = {},
  { locale = "en-US", zone = "UTC" }: Partial<DateTimeOptions> = {},
) =>
  DateTime.fromJSDate(dateTime)
    .setZone(zone ?? undefined)
    .reconfigure({ locale: locale ?? undefined })
    .toLocaleParts(getFormat({ style, time, timezone }));

const foundMinMax = (arr: number[]) => {
  const filtered = arr.filter((x) => x !== -1);
  if (filtered.length === 0) throw new Error("No parts found");
  return [Math.min(...filtered), Math.max(...filtered)] as [number, number];
};

export const formatDateTimeRelative = (
  dateTime: Date,
  {
    style = "short",
    time = undefined,
    timezone = false,
  }: Partial<DateTimeFormat> = {},
  { locale = "en-US", zone = "UTC" }: Partial<DateTimeOptions> = {},
) => {
  // Format the date
  const parts = formatDateTimeParts(
    dateTime,
    { style, time, timezone },
    { locale, zone },
  );

  // Determine how many days away the date is
  const dateToday = DateTime.now().setZone(zone ?? undefined);
  const dateGiven = DateTime.fromJSDate(dateTime).setZone(zone ?? undefined);
  const daysToday = Math.floor(
    dateToday.startOf("day").toUnixInteger() / (60 * 60 * 24),
  );
  const daysGiven = Math.floor(
    dateGiven.startOf("day").toUnixInteger() / (60 * 60 * 24),
  );
  const daysDiff = daysGiven - daysToday;

  // If the date is today or tomorrow, show relative date
  if (daysDiff === 0 || daysDiff === 1) {
    // Get the year -> day parts
    const yearIdx = parts.findIndex((part) => part.type === "year");
    const monthIdx = parts.findIndex((part) => part.type === "month");
    const dayIdx = parts.findIndex((part) => part.type === "day");
    const [minIdx, maxIdx] = foundMinMax([yearIdx, monthIdx, dayIdx]);

    // Replace the year -> day parts with the relative date
    parts.splice(minIdx, maxIdx - minIdx + 1, {
      type: "literal",
      value: daysDiff === 0 ? "Today" : "Tomorrow",
    });

    // If the date is today, and time was requested, show the time
    if (daysDiff === 0 && time) {
      parts.splice(minIdx + 1, 0, {
        type: "literal",
        value: ` in ${formatSeconds(dateGiven.diff(dateToday).as("seconds"), {
          style: "long",
          seconds: time === "seconds",
        })}`,
      });
    }
  }

  return parts.map((part) => part.value).join("");
};

export const formatDateTimeLocal = (
  dateTime: Date,
  format: Partial<DateTimeFormat> = {},
) =>
  formatDateTime(
    dateTime,
    { ...format, timezone: format.timezone ?? true },
    {
      locale: null,
      zone: null,
    },
  );

export const getShortTimezoneName = ({
  locale,
  timeZone,
}: Partial<{ locale: string; timeZone: string }>) =>
  Intl.DateTimeFormat(locale, {
    timeZoneName: "short",
    timeZone,
  })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;

export const DATETIME_ALVEUS_ZONE = "America/Chicago";
export const DATETIME_ALVEUS_ZONE_SHORT = getShortTimezoneName({
  locale: "en-US",
  timeZone: DATETIME_ALVEUS_ZONE,
});

export const parsePartialDateString = (
  date: PartialDateString,
): Date | null => {
  const arr = date.split("-");
  const d = parseInt(arr[2] || "");
  const m = parseInt(arr[1] || "");
  const y = parseInt(arr[0] || "");

  if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
  if (!isNaN(m) && !isNaN(y)) return new Date(y, m - 1);
  if (!isNaN(y)) return new Date(y, 0);

  return null;
};

export const sortPartialDateString = (
  a: PartialDateString | null,
  b: PartialDateString | null,
): number => {
  const parsedA = (
    typeof a === "string" ? parsePartialDateString(a) : null
  )?.getTime();
  const parsedB = (
    typeof b === "string" ? parsePartialDateString(b) : null
  )?.getTime();

  // If they match (same date or both unknown), no change
  if (parsedA === parsedB) return 0;

  // If the first date is unknown, the second date moves up
  if (parsedA === undefined) return 1;

  // If the second date is unknown, the first date moves up
  if (parsedB === undefined) return -1;

  // Otherwise, sort by date
  return parsedA > parsedB ? -1 : 1;
};

export const formatPartialDateString = (
  date: PartialDateString | null,
): string => {
  if (!date) return "Unknown";

  const [year, month, day] = date.split("-");
  const parsed = new Date(
    Number(year),
    Number(month || 1) - 1,
    Number(day || 1),
  );

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: month ? "long" : undefined,
    day: day ? "numeric" : undefined,
  });
};

export const formatSeconds = (
  seconds: number,
  {
    style = "short",
    seconds: showSeconds = true,
  }: Partial<{ style: "short" | "long"; seconds: boolean }> = {},
): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  // If short, output as hh:mm:ss
  // If we're showing seconds, hh is optional
  // mm is padded if hh is present, ss is always padded (if shown)
  if (style === "short") {
    return [
      ...(!showSeconds || hours > 0 ? [hours] : []),
      minutes.toString().padStart(!showSeconds || hours > 0 ? 2 : 1, "0"),
      ...(showSeconds ? [remainingSeconds.toString().padStart(2, "0")] : []),
    ].join(":");
  }

  // If long, output as hh hours, mm minutes, ss seconds
  // If we're showing seconds, hh and mm are optional
  // If we're not showing seconds, hh only is optional
  return [
    ...(hours > 0 ? [`${hours} hour${hours === 1 ? "" : "s"}`] : []),
    ...(!showSeconds || minutes > 0
      ? [`${minutes} minute${minutes === 1 ? "" : "s"}`]
      : []),
    ...(showSeconds
      ? [`${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}`]
      : []),
  ].join(", ");
};
