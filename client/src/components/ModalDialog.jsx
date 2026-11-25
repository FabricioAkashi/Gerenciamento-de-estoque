import { motion, useReducedMotion } from 'motion/react';
import React, { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ModalDialog({ titleId, className = '', onClose, children }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const reducedMotion = Boolean(useReducedMotion());

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    previousFocusRef.current = document.activeElement;
    const dialogEl = dialogRef.current;

    if (dialogEl) {
      const focusable = Array.from(dialogEl.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialogEl.focus();
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current && previousFocusRef.current.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  const cardClass = className ? `modal-card ${className}` : 'modal-card';

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="modal-backdrop"
      initial={reducedMotion ? false : { opacity: 0 }}
      onClick={onClose}
      role="presentation"
      transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.section
        animate={{ opacity: 1, scale: 1, y: 0 }}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cardClass}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.985, y: 12 }}
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.section>
    </motion.div>
  );
}
