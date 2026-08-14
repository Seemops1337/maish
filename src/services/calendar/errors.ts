/**
 * A calendar write the server refused.
 *
 * DAV libraries hand back the raw response rather than throwing, so without
 * this the UI reports a save that never happened. The status is kept so the
 * one case a user can act on — the stored object changed since it was read,
 * answered 412 to the If-Match — can be told apart from everything else.
 */
export class CalendarWriteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CalendarWriteError";
  }

  get isConflict(): boolean {
    return this.status === 412;
  }
}
