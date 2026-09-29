import { Icon } from "@/components/ui/Icon";

function icsStamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(value: string) {
  return value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

/** Downloads a single-event .ics file — works in Google/Apple/Outlook calendars. */
export function AddToCalendar({
  lessonId,
  title,
  courseTitle,
  startsAtIso,
  endsAtIso,
  lessonUrl,
  fileName,
  className = "btn btn-sm",
}: {
  lessonId: string;
  title: string;
  courseTitle: string;
  startsAtIso: string;
  endsAtIso: string;
  lessonUrl: string;
  fileName: string;
  className?: string;
}) {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lexify//UZ",
    "BEGIN:VEVENT",
    `UID:${lessonId}@lexify`,
    `DTSTAMP:${icsStamp(startsAtIso)}`,
    `DTSTART:${icsStamp(startsAtIso)}`,
    `DTEND:${icsStamp(endsAtIso)}`,
    `SUMMARY:${icsText(`${title} — ${courseTitle}`)}`,
    `URL:${lessonUrl}`,
    `DESCRIPTION:${icsText(`Lexify jonli darsi: ${lessonUrl}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return (
    <a
      className={`${className} lx-cal-btn`}
      href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}
      download={fileName}
    >
      <Icon name="calendar" size={16} />
      Taqvimga qo‘shish
    </a>
  );
}
