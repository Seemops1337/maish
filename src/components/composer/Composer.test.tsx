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
