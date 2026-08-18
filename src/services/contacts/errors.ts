/**
 * A contact write the server refused.
 *
 * tsdav hands back the raw response and throws only on a transport failure, so
 * without this a 401 or a 412 would pass for a successful save — the same trap
 * the calendar module documents in `CalendarWriteError`. The status is kept so
 * the two cases a user can act on can be told apart: the card changed on the
 * server since it was read (412), and the address book does not accept writes
 * (403).
 */
export class ContactWriteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ContactWriteError";
  }

  get isConflict(): boolean {
    return this.status === 412;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}
