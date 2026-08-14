import { DAVClient, type DAVCalendar, type DAVObject } from "tsdav";
import type {
  CalendarProvider,
  CalendarProviderType,
  CalendarInfo,
  CalendarEventData,
  CalendarSyncResult,
  CreateEventInput,
  OccurrenceTarget,
  UpdateEventInput,
} from "./types";
import { davFetch } from "./davFetch";
import { generateVEvent, parseVEvent } from "./icalHelper";
import {
  editMaster,
  editOccurrence,
  excludeOccurrence,
  splitSeriesFrom,
  truncateSeriesBefore,
  type EventEdits,
} from "./icalEdit";
import { getAccount } from "@/services/db/accounts";

export class CalDAVProvider implements CalendarProvider {
  readonly type: CalendarProviderType = "caldav";
  private client: DAVClient | null = null;

  constructor(readonly accountId: string) {}

  private async getClient(): Promise<DAVClient> {
    if (this.client) return this.client;

    const account = await getAccount(this.accountId);
    if (!account) throw new Error("Account not found");

    const serverUrl = account.caldav_url;
    const username = account.caldav_username ?? account.email;
    const password = account.caldav_password;

    if (!serverUrl || !password) {
      throw new Error("CalDAV credentials not configured");
    }

    this.client = new DAVClient({
      serverUrl,
      credentials: { username, password },
      authMethod: "Basic",
      defaultAccountType: "caldav",
      fetch: davFetch,
    });

    await this.client.login();
    return this.client;
  }

  async listCalendars(): Promise<CalendarInfo[]> {
    const client = await this.getClient();
    const calendars = await client.fetchCalendars();

    return calendars.map((cal, index) => ({
      remoteId: cal.url,
      displayName: typeof cal.displayName === "string" ? cal.displayName : `Calendar ${index + 1}`,
      color: extractCalendarColor(cal) ?? null,
      isPrimary: index === 0,
    }));
  }

  async fetchEvents(calendarRemoteId: string, timeMin: string, timeMax: string): Promise<CalendarEventData[]> {
    const client = await this.getClient();

    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendarRemoteId } as DAVCalendar,
      timeRange: {
        start: timeMin,
        end: timeMax,
      },
    });

    return objects
      .filter((obj) => obj.data)
      .map((obj) => {
        const event = parseVEvent(obj.data!, obj.url);
        event.etag = obj.etag ?? null;
        return event;
      });
  }

  async createEvent(calendarRemoteId: string, event: CreateEventInput): Promise<CalendarEventData> {
    const client = await this.getClient();
    const uid = crypto.randomUUID();
    const icalData = generateVEvent(event, uid);
    const filename = `${uid}.ics`;

    await client.createCalendarObject({
      calendar: { url: calendarRemoteId } as DAVCalendar,
      filename,
      iCalString: icalData,
    });

    const parsed = parseVEvent(icalData, `${calendarRemoteId}${filename}`);
    return parsed;
  }

  /**
   * Patch the stored calendar object rather than regenerate it.
   *
   * Rebuilding the VEVENT from the fields the composer knows about used to
   * drop everything else the object carried — the recurrence rule, the
   * VTIMEZONE its DTSTART refers to, alarms and per-instance overrides — which
   * turned any edit of a recurring event into a silent data loss.
   */
  async updateEvent(
    calendarRemoteId: string,
    remoteEventId: string,
    event: UpdateEventInput,
    etag?: string,
    occurrence?: OccurrenceTarget,
  ): Promise<CalendarEventData> {
    const client = await this.getClient();
    const existing = await this.fetchObject(client, calendarRemoteId, remoteEventId);
    const edits = toEdits(event);

    if (occurrence?.scope === "thisAndFollowing") {
      // Split the series: bound the original, then store the tail separately.
      const head = truncateSeriesBefore(existing.data, occurrence.recurrenceId);
      await this.putObject(client, remoteEventId, head, etag ?? existing.etag);

      const uid = crypto.randomUUID();
      const tail = splitSeriesFrom(existing.data, occurrence.recurrenceId, uid, edits);
      const filename = `${uid}.ics`;
      await client.createCalendarObject({
        calendar: { url: calendarRemoteId } as DAVCalendar,
        filename,
        iCalString: tail,
      });

      return parseVEvent(tail, `${calendarRemoteId}${filename}`);
    }

    const updated = occurrence?.scope === "this"
      ? editOccurrence(existing.data, occurrence.recurrenceId, edits)
      : editMaster(existing.data, edits);

    await this.putObject(client, remoteEventId, updated, etag ?? existing.etag);
    return parseVEvent(updated, remoteEventId);
  }

  async deleteEvent(
    calendarRemoteId: string,
    remoteEventId: string,
    etag?: string,
    occurrence?: OccurrenceTarget,
  ): Promise<void> {
    const client = await this.getClient();

    // Removing part of a series rewrites the object; only "all" deletes it.
    if (occurrence && occurrence.scope !== "all") {
      const existing = await this.fetchObject(client, calendarRemoteId, remoteEventId);
      const updated = occurrence.scope === "this"
        ? excludeOccurrence(existing.data, occurrence.recurrenceId)
        : truncateSeriesBefore(existing.data, occurrence.recurrenceId);

      await this.putObject(client, remoteEventId, updated, etag ?? existing.etag);
      return;
    }

    const headers: Record<string, string> = {};
    if (etag) headers["If-Match"] = etag;

    await client.deleteCalendarObject({
      calendarObject: {
        url: remoteEventId,
        etag: etag ?? undefined,
      } as DAVObject,
      headers,
    });
  }

  private async fetchObject(
    client: DAVClient,
    calendarRemoteId: string,
    remoteEventId: string,
  ): Promise<{ data: string; etag?: string }> {
    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendarRemoteId } as DAVCalendar,
      objectUrls: [remoteEventId],
    });

    const existing = objects[0];
    if (!existing?.data) throw new Error("Event not found on server");
    return { data: existing.data, etag: existing.etag ?? undefined };
  }

  private async putObject(
    client: DAVClient,
    url: string,
    icalData: string,
    etag?: string,
  ): Promise<void> {
    const headers: Record<string, string> = {};
    if (etag) headers["If-Match"] = etag;

    await client.updateCalendarObject({
      calendarObject: { url, data: icalData, etag: etag ?? undefined } as DAVObject,
      headers,
    });
  }

  async syncEvents(calendarRemoteId: string, _syncToken?: string): Promise<CalendarSyncResult> {
    const client = await this.getClient();
    const created: CalendarEventData[] = [];

    // Full fetch — tsdav's syncCalendars doesn't reliably expose per-object deltas,
    // so we do a time-range fetch and let the DB upsert logic handle deduplication.
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - 90);
    const timeMax = new Date(now);
    timeMax.setFullYear(timeMax.getFullYear() + 1);

    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendarRemoteId } as DAVCalendar,
      timeRange: {
        start: timeMin.toISOString(),
        end: timeMax.toISOString(),
      },
    });

    for (const obj of objects) {
      if (obj.data) {
        const event = parseVEvent(obj.data, obj.url);
        event.etag = obj.etag ?? null;
        created.push(event);
      }
    }

    return { created, updated: [], deletedRemoteIds: [], newSyncToken: null, newCtag: null };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const client = await this.getClient();
      const calendars = await client.fetchCalendars();
      return {
        success: true,
        message: `Connected — found ${calendars.length} calendar${calendars.length !== 1 ? "s" : ""}`,
      };
    } catch (err) {
      // Reset client on failure so next attempt can retry
      this.client = null;
      return { success: false, message: err instanceof Error ? err.message : "Connection failed" };
    }
  }
}

/** The composer speaks ISO strings; the iCal editor works in epoch seconds. */
function toEdits(event: UpdateEventInput): EventEdits {
  const edits: EventEdits = {};
  if (event.summary !== undefined) edits.summary = event.summary;
  if (event.description !== undefined) edits.description = event.description ?? null;
  if (event.location !== undefined) edits.location = event.location ?? null;
  if (event.startTime !== undefined) {
    edits.startTime = Math.floor(new Date(event.startTime).getTime() / 1000);
  }
  if (event.endTime !== undefined) {
    edits.endTime = Math.floor(new Date(event.endTime).getTime() / 1000);
  }
  return edits;
}

function extractCalendarColor(cal: DAVCalendar): string | null {
  // tsdav may expose calendar-color in props
  const props = cal as unknown as Record<string, unknown>;
  if (typeof props.calendarColor === "string") return props.calendarColor;
  return null;
}
