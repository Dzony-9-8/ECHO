import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Contact as ContactIcon, Plus, Trash2, Pencil, Check, X, Search, Mail, Phone, Building2, Tag,
} from "lucide-react";
import { toast } from "sonner";
import {
  type Contact, loadContacts, upsertContact, deleteContact,
  filterContacts, sortContacts, parseTags, emptyContact,
} from "@/lib/contacts";

const initials = (name: string, email: string) => {
  const src = name.trim() || email.trim() || "?";
  const parts = src.split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || src[0].toUpperCase();
};

const ContactsView = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Contact | null>(null);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => { setContacts(loadContacts()); }, []);

  const visible = useMemo(() => sortContacts(filterContacts(contacts, query)), [contacts, query]);

  const startNew = () => { setEditing(emptyContact()); setTagInput(""); };
  const startEdit = (c: Contact) => { setEditing({ ...c }); setTagInput(c.tags.join(", ")); };

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim() && !editing.email.trim()) { toast.error("Enter a name or email"); return; }
    const record = { ...editing, name: editing.name.trim(), email: editing.email.trim(), tags: parseTags(tagInput) };
    setContacts(upsertContact(record));
    setEditing(null);
    toast.success("Contact saved");
  };

  const remove = (id: string) => { setContacts(deleteContact(id)); toast.success("Contact deleted"); };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card p-3 flex items-center gap-3 flex-wrap">
        <ContactIcon className="w-4 h-4 text-terminal-cyan" />
        <span className="text-xs font-mono text-terminal-cyan uppercase tracking-wider">Contacts</span>
        <span className="text-[10px] font-mono text-muted-foreground/50">{contacts.length}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 bg-input border border-border rounded px-2 py-1.5">
          <Search className="w-3.5 h-3.5 text-muted-foreground/50" />
          <input
            aria-label="Search contacts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, tag…"
            className="bg-transparent text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none w-48"
          />
        </div>
        <button onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-terminal-cyan/50 bg-terminal-cyan/10 text-terminal-cyan text-[10px] font-mono hover:bg-terminal-cyan/20 transition-all">
          <Plus className="w-3.5 h-3.5" /> New contact
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {editing && (
          <ContactEditor
            contact={editing}
            tagInput={tagInput}
            onChange={setEditing}
            onTagInput={setTagInput}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}

        {visible.length === 0 && !editing && (
          <div className="text-center text-[11px] font-mono text-muted-foreground/50 py-12">
            {contacts.length === 0 ? "No contacts yet." : "No matches."}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence>
            {visible.map((c) => (
              <motion.div key={c.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                className="border border-border rounded bg-card p-3 group">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-terminal-cyan/15 text-terminal-cyan text-[11px] font-mono font-semibold">
                    {initials(c.name, c.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-mono font-medium text-foreground truncate">{c.name || c.email || "Unnamed"}</div>
                    {c.company && <div className="text-[9px] font-mono text-muted-foreground/60 truncate flex items-center gap-1"><Building2 className="w-2.5 h-2.5" />{c.company}</div>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(c)} aria-label="Edit contact" className="text-muted-foreground/60 hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(c.id)} aria-label="Delete contact" className="text-muted-foreground/60 hover:text-terminal-red"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-[10px] font-mono text-terminal-cyan/80 hover:text-terminal-cyan truncate"><Mail className="w-2.5 h-2.5 flex-shrink-0" />{c.email}</a>}
                  {c.phone && <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/70"><Phone className="w-2.5 h-2.5 flex-shrink-0" />{c.phone}</div>}
                </div>
                {c.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="flex items-center gap-0.5 text-[8px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground/70">
                        <Tag className="w-2 h-2" />{t}
                      </span>
                    ))}
                  </div>
                )}
                {c.notes && <p className="mt-2 text-[9px] font-mono text-muted-foreground/50 line-clamp-2 whitespace-pre-wrap">{c.notes}</p>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// ── Editor ──────────────────────────────────────────────────────────────────
const ContactEditor = ({
  contact, tagInput, onChange, onTagInput, onSave, onCancel,
}: {
  contact: Contact;
  tagInput: string;
  onChange: (c: Contact) => void;
  onTagInput: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const field = "bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-terminal-cyan";
  return (
    <div className="border border-terminal-cyan/40 rounded bg-terminal-cyan/5 p-3 space-y-2 max-w-2xl">
      <div className="grid grid-cols-2 gap-2">
        <input aria-label="Contact name" value={contact.name} onChange={(e) => onChange({ ...contact, name: e.target.value })} placeholder="Name" className={field} />
        <input aria-label="Contact email" type="email" value={contact.email} onChange={(e) => onChange({ ...contact, email: e.target.value })} placeholder="Email" className={field} />
        <input aria-label="Contact phone" value={contact.phone} onChange={(e) => onChange({ ...contact, phone: e.target.value })} placeholder="Phone" className={field} />
        <input aria-label="Contact company" value={contact.company} onChange={(e) => onChange({ ...contact, company: e.target.value })} placeholder="Company" className={field} />
      </div>
      <input aria-label="Contact tags" value={tagInput} onChange={(e) => onTagInput(e.target.value)} placeholder="Tags (comma separated)" className={`w-full ${field}`} />
      <textarea aria-label="Contact notes" value={contact.notes} onChange={(e) => onChange({ ...contact, notes: e.target.value })} placeholder="Notes…" rows={2} className={`w-full ${field} resize-none`} />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="flex items-center gap-1 px-3 py-1.5 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /> Cancel</button>
        <button onClick={onSave} className="flex items-center gap-1 px-3 py-1.5 rounded border border-terminal-cyan bg-terminal-cyan/15 text-terminal-cyan text-[10px] font-mono hover:bg-terminal-cyan/25"><Check className="w-3 h-3" /> Save</button>
      </div>
    </div>
  );
};

export default ContactsView;
