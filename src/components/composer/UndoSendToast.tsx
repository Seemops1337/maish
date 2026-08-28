import { useRef } from "react";
import { CSSTransition } from "react-transition-group";
import { useComposerStore } from "@/stores/composerStore";

const UNDO_DELAY_SECONDS = 5;

export function UndoSendToast() {
  const {
    undoSendVisible,
    undoSendTimer,
    pendingSend,
    setUndoSendTimer,
    setUndoSendVisible,
    setPendingSend,
    openComposer,
  } = useComposerStore();
  const toastRef = useRef<HTMLDivElement>(null);

  const handleUndo = () => {
    if (undoSendTimer) {
      clearTimeout(undoSendTimer);
      setUndoSendTimer(null);
    }
    setUndoSendVisible(false);

    // Cancelling a send should give the mail back, not throw it away.
    // handleSend closed the composer as soon as the timer was scheduled, so
    // this snapshot is the only copy of what was written.
    if (pendingSend) {
      openComposer({
        mode: pendingSend.mode,
        to: pendingSend.to,
        cc: pendingSend.cc,
        bcc: pendingSend.bcc,
        subject: pendingSend.subject,
        bodyHtml: pendingSend.bodyHtml,
        threadId: pendingSend.threadId,
        inReplyToMessageId: pendingSend.inReplyToMessageId,
        draftId: pendingSend.draftId,
        fromEmail: pendingSend.fromEmail,
        attachments: pendingSend.attachments,
      });
      setPendingSend(null);
    }
  };

  return (
    <CSSTransition nodeRef={toastRef} in={undoSendVisible} timeout={200} classNames="toast" unmountOnExit>
      <div ref={toastRef} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-text-primary text-bg-primary rounded-lg shadow-lg overflow-hidden">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <span className="text-sm">Sending email...</span>
          <button
            onClick={handleUndo}
            className="text-sm font-medium text-accent hover:text-accent-hover underline"
          >
            Undo
          </button>
        </div>
        <div className="h-0.5 bg-white/20">
          <div
            className="h-full bg-accent rounded-full"
            style={{ animation: `countdownBar ${UNDO_DELAY_SECONDS}s linear forwards` }}
          />
        </div>
      </div>
    </CSSTransition>
  );
}
