import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

// Daftar pertanyaan bersama survei responden dan formulir penilaian mandiri: satu baris per pertanyaan dengan status
// jawaban, untuk berpindah langsung ke pertanyaan yang ingin diubah. Ditampilkan menggantikan isi halaman, bukan
// sebagai jendela melayang, agar tetap nyaman di layar telepon yang sempit.

export type ListItem = {
    key: string;
    label: string;
    /** done: terjawab lengkap; partial: sebagian; todo: belum. */
    status: 'done' | 'partial' | 'todo';
    statusText: string;
    current: boolean;
    disabled?: boolean;
    onSelect: () => void;
};

export type ListGroup = { key: string; title: string; items: ListItem[] };

export function QuestionList({
    title,
    closeLabel,
    groups,
    onClose,
    footer,
}: {
    title: string;
    closeLabel: string;
    groups: ListGroup[];
    onClose: () => void;
    footer?: ReactNode;
}) {
    const heading = useRef<HTMLHeadingElement>(null);
    const close = useRef(onClose);

    useEffect(() => {
        close.current = onClose;
    }, [onClose]);

    // Hanya saat dibuka: gulir ke atas, fokus ke judul, dan tombol Escape menutup daftar.
    useEffect(() => {
        window.scrollTo({ top: 0 });
        heading.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                close.current();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <section className="sv-stack" data-testid="question-list">
            <div className="sv-list-head">
                <h1 ref={heading} tabIndex={-1}>
                    {title}
                </h1>
                <button type="button" className="sv-link" onClick={onClose} data-testid="question-list-close">
                    {closeLabel}
                </button>
            </div>
            {groups.map((group) => (
                <div key={group.key} className="sv-stack">
                    {group.title ? <h2 className="sv-eyebrow">{group.title}</h2> : null}
                    <ol className="sv-qlist">
                        {group.items.map((item) => (
                            <li key={item.key}>
                                <button
                                    type="button"
                                    className={`sv-qitem sv-q-${item.status}`}
                                    aria-current={item.current ? 'step' : undefined}
                                    disabled={item.disabled}
                                    onClick={item.onSelect}
                                    data-testid="question-list-item"
                                    data-status={item.status}
                                >
                                    <span className="sv-qlabel">{item.label}</span>
                                    <span className="sv-qstatus">{item.statusText}</span>
                                </button>
                            </li>
                        ))}
                    </ol>
                </div>
            ))}
            {footer}
        </section>
    );
}
