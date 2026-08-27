import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";

/**
 * The editor object TipTap would hand back. Only the parts Composer touches
 * are here; the point of the test is the wiring between the store and the
 * editor, not ProseMirror's behaviour.
 */
const setContent = vi.fn();
let editorHtml = "";

const fakeEditor = {
  commands: {
    setContent: (content: string, options?: unknown) => {
      setContent(content, options);
      editorHtml = content;
    },
  },
  chain: () => ({
    focus: () => ({ run: () => true }),
  }),
  getHTML: () => editorHtml,
  isActive: () => false,
  isEmpty: false,
  can: () => ({ chain: () => ({ focus: () => ({ run: () => false }) }) }),
};

vi.mock("@tiptap/react", () => ({
  useEditor: () => fakeEditor,
  EditorContent: () => null,
}));
vi.mock("@tiptap/starter-kit", () => ({ default: { configure: () => ({}) } }));
vi.mock("@tiptap/extension-placeholder", () => ({ default: { configure: () => ({}) } }));
vi.mock("@tiptap/extension-image", () => ({ default: { configure: () => ({}) } }));

vi.mock("./EditorToolbar", () => ({ EditorToolbar: () => null }));
vi.mock("./AiAssistPanel", () => ({ AiAssistPanel: () => null }));
vi.mock("./AttachmentPicker", () => ({ AttachmentPicker: () => null }));
vi.mock("./ScheduleSendDialog", () => ({ ScheduleSendDialog: () => null }));
vi.mock("./SignatureSelector", () => ({ SignatureSelector: () => null }));
vi.mock("./TemplatePicker", () => ({ TemplatePicker: () => null }));
vi.mock("./FromSelector", () => ({ FromSelector: () => null }));
vi.mock("./AddressInput", () => ({ AddressInput: () => null }));

vi.mock("@/services/emailActions", () => ({
  sendEmail: vi.fn(() => Promise.resolve({ success: true })),
  archiveThread: vi.fn(() => Promise.resolve({ success: true })),
  deleteDraft: vi.fn(() => Promise.resolve({ success: true })),
}));
vi.mock("@/services/db/contacts", () => ({ upsertContact: vi.fn(() => Promise.resolve()) }));
vi.mock("@/services/db/settings", () => ({ getSetting: vi.fn(() => Promise.resolve(null)) }));
vi.mock("@/services/db/scheduledEmails", () => ({ insertScheduledEmail: vi.fn(() => Promise.resolve()) }));
vi.mock("@/services/db/signatures", () => ({ getDefaultSignature: vi.fn(() => Promise.resolve(null)) }));
vi.mock("@/services/db/sendAsAliases", () => ({
  getAliasesForAccount: vi.fn(() => Promise.resolve([])),
  mapDbAlias: (a: unknown) => a,
}));
vi.mock("@/services/db/templates", () => ({ getTemplatesForAccount: vi.fn(() => Promise.resolve([])) }));
vi.mock("@/services/composer/draftAutoSave", () => ({
  startAutoSave: vi.fn(),
  stopAutoSave: vi.fn(),
}));
vi.mock("@/utils/emailBuilder", () => ({ buildRawEmail: vi.fn(() => "") }));

import { Composer } from "./Composer";
import { useComposerStore } from "@/stores/composerStore";
import { useAccountStore } from "@/stores/accountStore";

/**
 * <Composer /> is mounted unconditionally by App, so useEditor runs once at
 * app start — when the store is still empty. The CSSTransition's
 * unmountOnExit sits on the overlay inside the component, not on the
 * component, so the editor is never rebuilt. Without an explicit push a
 * reply's quote, a forwarded message and a loaded draft all opened into an
 * empty editor, and whatever was typed last stayed behind in it.
 */
describe("Composer editor content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorHtml = "";
    useComposerStore.setState({ isOpen: false, session: 0, bodyHtml: "" });
    useAccountStore.setState({
      accounts: [{ id: "acct-1", email: "simon@hochreiner.xyz" }],
      activeAccountId: "acct-1",
    } as never);
  });

  it("puts the reply quote into the editor when the composer opens", () => {
    render(<Composer />);

    act(() => {
      useComposerStore.getState().openComposer({
        mode: "reply",
        bodyHtml: "<blockquote>the message being answered</blockquote>",
      });
    });

    expect(setContent).toHaveBeenCalledWith(
      "<blockquote>the message being answered</blockquote>",
      expect.objectContaining({ emitUpdate: false }),
    );
  });

  it("clears the editor for a fresh compose after an earlier one", () => {
    render(<Composer />);

    act(() => {
      useComposerStore.getState().openComposer({ bodyHtml: "<p>first draft</p>" });
    });
    act(() => {
      useComposerStore.getState().closeComposer();
    });
    setContent.mockClear();

    act(() => {
      useComposerStore.getState().openComposer();
    });

    expect(setContent).toHaveBeenCalledWith("", expect.objectContaining({ emitUpdate: false }));
  });

  it("reloads the body when a composer that is already open is reused", () => {
    render(<Composer />);

    act(() => {
      useComposerStore.getState().openComposer({ bodyHtml: "<p>draft</p>" });
    });
    setContent.mockClear();

    // A mailto: deep link or a reply raised while the composer is up never
    // takes isOpen back to false.
    act(() => {
      useComposerStore.getState().openComposer({ bodyHtml: "<p>a different mail</p>" });
    });

    expect(setContent).toHaveBeenCalledWith(
      "<p>a different mail</p>",
      expect.objectContaining({ emitUpdate: false }),
    );
  });
});

/**
 * handleSend hands the mail to a timer and closes the composer straight away,
 * so the undo window runs with no composer on screen. Two things follow from
 * that, and both used to be wrong.
 */
describe("Composer send guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorHtml = "";
    useComposerStore.setState({
      isOpen: false,
      session: 0,
      bodyHtml: "",
      undoSendTimer: null,
      undoSendVisible: false,
      pendingSend: null,
    });
    useAccountStore.setState({
      accounts: [{ id: "acct-1", email: "simon@hochreiner.xyz" }],
      activeAccountId: "acct-1",
    } as never);
  });

  async function clickSend(getByText: (t: string) => HTMLElement) {
    await act(async () => {
      getByText("Send").click();
    });
  }

  it("can send again once the undo window has been cancelled", async () => {
    const { getByText } = render(<Composer />);

    act(() => {
      useComposerStore.getState().openComposer({ to: ["bob@example.com"] });
    });
    await clickSend(getByText);

    const timer = useComposerStore.getState().undoSendTimer;
    expect(timer).not.toBeNull();

    // What UndoSendToast does: drop the timer, so the callback that used to
    // be the only thing clearing the guard never runs.
    act(() => {
      clearTimeout(timer!);
      useComposerStore.getState().setUndoSendTimer(null);
      useComposerStore.getState().setUndoSendVisible(false);
    });

    // A second attempt must actually schedule a send rather than return
    // silently on a guard nobody reset.
    act(() => {
      useComposerStore.getState().openComposer({ to: ["carol@example.com"] });
    });
    await clickSend(getByText);

    expect(useComposerStore.getState().undoSendTimer).not.toBeNull();
  });

  it("can send a second mail while the first is still in its undo window", async () => {
    const { getByText } = render(<Composer />);

    act(() => {
      useComposerStore.getState().openComposer({ to: ["bob@example.com"] });
    });
    await clickSend(getByText);
    const first = useComposerStore.getState().undoSendTimer;

    act(() => {
      useComposerStore.getState().openComposer({ to: ["carol@example.com"] });
    });
    await clickSend(getByText);

    expect(useComposerStore.getState().undoSendTimer).not.toBe(first);
    expect(useComposerStore.getState().undoSendTimer).not.toBeNull();
  });

  it("keeps the composed mail so undo can put it back", async () => {
    const { getByText } = render(<Composer />);

    act(() => {
      useComposerStore.getState().openComposer({
        to: ["bob@example.com"],
        subject: "Half-written",
        bodyHtml: "<p>text that must not be lost</p>",
      });
    });
    await clickSend(getByText);

    // closeComposer has already emptied the store by now, so the snapshot is
    // the only remaining copy of what the user wrote.
    const pending = useComposerStore.getState().pendingSend;
    expect(pending).not.toBeNull();
    expect(pending!.to).toEqual(["bob@example.com"]);
    expect(pending!.subject).toBe("Half-written");
    expect(pending!.bodyHtml).toContain("text that must not be lost");
  });
});
