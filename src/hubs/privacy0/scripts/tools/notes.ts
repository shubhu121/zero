import { sealNote, openNote } from '../../lib/notecrypto';
import type { SealedBox } from '../../lib/notecrypto';

interface StoredNote { id: string; title: string; box: SealedBox; createdAt: number; }

const STORE_KEY = 'privacy0-notes';

function loadNotes(): StoredNote[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]'); } catch { return []; }
}

function saveNotes(notes: StoredNote[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(notes));
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

interface ModalOptions {
  title: string;
  body?: string;
  input?: { type: 'password' | 'text'; placeholder?: string };
  confirmLabel: string;
  cancelLabel?: string; // omit for a single-button notice (acknowledge only)
  danger?: boolean;     // red confirm button (destructive actions)
}

/**
 * In-page modal that replaces native prompt/confirm/alert. The native dialogs are
 * blocked in some embedded contexts and clash with the suite's styling, so notes
 * uses this instead. Resolves to:
 *   - the input value (string) when confirmed and an input is present,
 *   - true when confirmed without an input,
 *   - null when cancelled, dismissed (Esc / backdrop click), or a notice is acknowledged.
 */
function modal(opts: ModalOptions): Promise<string | boolean | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 fade-in';
    // Backdrop set inline: the Tailwind palette is semantic-only (no `black`), so a
    // `bg-black/50` utility would not exist.
    overlay.style.background = 'rgba(0, 0, 0, 0.5)';

    const card = document.createElement('div');
    card.className = 'w-full max-w-sm rounded-lg border border-rule bg-raised p-5 shadow-xl';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    const heading = document.createElement('p');
    heading.className = 'text-sm font-medium text-ink';
    heading.textContent = opts.title;
    card.appendChild(heading);

    if (opts.body) {
      const body = document.createElement('p');
      body.className = 'mt-1.5 text-xs text-muted';
      body.textContent = opts.body;
      card.appendChild(body);
    }

    let input: HTMLInputElement | null = null;
    if (opts.input) {
      input = document.createElement('input');
      input.type = opts.input.type;
      input.placeholder = opts.input.placeholder ?? '';
      input.className =
        'mt-3 w-full rounded border border-rule bg-bg px-3 py-2 font-mono text-sm text-ink focus:outline-none focus:border-accent';
      card.appendChild(input);
    }

    const row = document.createElement('div');
    row.className = 'mt-4 flex justify-end gap-2';

    function done(value: string | boolean | null): void {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(value);
    }

    if (opts.cancelLabel) {
      const cancel = document.createElement('button');
      cancel.className = 'btn-secondary';
      cancel.textContent = opts.cancelLabel;
      cancel.addEventListener('click', () => done(null));
      row.appendChild(cancel);
    }

    const confirm = document.createElement('button');
    confirm.className = 'btn';
    confirm.textContent = opts.confirmLabel;
    if (opts.danger) {
      confirm.style.background = 'var(--err)';
      confirm.style.color = '#fff';
    }
    confirm.addEventListener('click', () => done(input ? input.value : true));
    row.appendChild(confirm);

    card.appendChild(row);
    overlay.appendChild(card);

    // Dismiss on backdrop click; Esc cancels; Enter from the input confirms.
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) done(null); });
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') done(null);
      else if (e.key === 'Enter' && input && document.activeElement === input) done(input.value);
    }
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    (input ?? confirm).focus();
  });
}

export function initNotes(): void {
  const noteList = document.getElementById('note-list')!;
  const noteTitle = document.getElementById('note-title') as HTMLInputElement;
  const noteContent = document.getElementById('note-content') as HTMLTextAreaElement;
  const notePass = document.getElementById('note-pass') as HTMLInputElement;
  const saveBtn = document.getElementById('note-save')!;
  const status = document.getElementById('note-status')!;
  const exportBtn = document.getElementById('note-export')!;
  const importInput = document.getElementById('note-import') as HTMLInputElement;

  function renderList(): void {
    const notes = loadNotes();
    noteList.innerHTML = '';
    if (notes.length === 0) {
      noteList.innerHTML = '<p class="text-muted text-sm">No encrypted notes yet.</p>';
      return;
    }
    for (const note of notes) {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 p-3 rounded border border-rule bg-raised';

      const info = document.createElement('div');
      info.className = 'flex-1 min-w-0';
      const title = document.createElement('p');
      title.className = 'text-sm font-medium text-ink truncate';
      title.textContent = note.title || '(untitled)';
      const date = document.createElement('p');
      date.className = 'text-xs text-muted';
      date.textContent = new Date(note.createdAt).toLocaleString();
      info.appendChild(title);
      info.appendChild(date);

      const openBtn = document.createElement('button');
      openBtn.className = 'btn-secondary text-xs px-2 py-1';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', () => openNotePrompt(note));

      const delBtn = document.createElement('button');
      delBtn.className = 'text-err text-xs px-2 py-1 hover:opacity-75';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        const ok = await modal({
          title: 'Delete note?',
          body: `"${note.title || 'this note'}" will be permanently removed from this browser. This cannot be undone.`,
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          danger: true,
        });
        if (ok) {
          const updated = loadNotes().filter((n) => n.id !== note.id);
          saveNotes(updated);
          renderList();
        }
      });

      row.appendChild(info);
      row.appendChild(openBtn);
      row.appendChild(delBtn);
      noteList.appendChild(row);
    }
  }

  async function openNotePrompt(note: StoredNote): Promise<void> {
    const pass = (await modal({
      title: `Unlock "${note.title || 'note'}"`,
      body: 'Enter the passphrase used to encrypt this note.',
      input: { type: 'password', placeholder: 'Passphrase' },
      confirmLabel: 'Unlock',
      cancelLabel: 'Cancel',
    })) as string | null;
    if (pass === null) return;
    const plain = await openNote(note.box, pass);
    if (plain === null) {
      await modal({
        title: 'Could not unlock',
        body: 'Wrong passphrase or corrupted note.',
        confirmLabel: 'OK',
      });
      return;
    }
    noteTitle.value = note.title;
    noteContent.value = plain;
    notePass.value = '';
    status.textContent = `Opened note: ${note.title}`;
  }

  saveBtn.addEventListener('click', async () => {
    const text = noteContent.value;
    const pass = notePass.value;
    if (!text) { status.textContent = 'Nothing to save.'; return; }
    if (!pass) { status.textContent = 'Enter a passphrase.'; return; }
    status.textContent = 'Encrypting…';
    const box = await sealNote(text, pass);
    const notes = loadNotes();
    notes.unshift({ id: uid(), title: noteTitle.value || 'Untitled', box, createdAt: Date.now() });
    saveNotes(notes);
    noteTitle.value = '';
    noteContent.value = '';
    notePass.value = '';
    status.textContent = 'Note encrypted and saved.';
    renderList();
  });

  exportBtn.addEventListener('click', () => {
    const notes = loadNotes();
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `privacy0-notes-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text) as StoredNote[];
      const existing = loadNotes();
      const existingIds = new Set(existing.map((n) => n.id));
      const merged = [...existing, ...imported.filter((n) => !existingIds.has(n.id))];
      saveNotes(merged);
      status.textContent = `Imported ${merged.length - existing.length} note(s).`;
      renderList();
    } catch {
      status.textContent = 'Import failed - invalid file.';
    }
  });

  renderList();
}
