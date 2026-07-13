// Contacts — a local address book (also the basis for Email recipients later).

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  tags: string[];
  notes: string;
  createdAt: number;
}

const KEY = "echo_contacts";

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const emptyContact = (): Contact => ({
  id: newId(), name: "", email: "", phone: "", company: "", tags: [], notes: "", createdAt: Date.now(),
});

export const loadContacts = (): Contact[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
};
export const saveContacts = (contacts: Contact[]) => localStorage.setItem(KEY, JSON.stringify(contacts));

export const upsertContact = (contact: Contact): Contact[] => {
  const contacts = loadContacts();
  const idx = contacts.findIndex((c) => c.id === contact.id);
  if (idx >= 0) contacts[idx] = contact;
  else contacts.unshift(contact);
  saveContacts(contacts);
  return contacts;
};
export const deleteContact = (id: string): Contact[] => {
  const contacts = loadContacts().filter((c) => c.id !== id);
  saveContacts(contacts);
  return contacts;
};

/** Case-insensitive filter across name, email, company, and tags. */
export const filterContacts = (contacts: Contact[], query: string): Contact[] => {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter((c) =>
    c.name.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q) ||
    c.company.toLowerCase().includes(q) ||
    c.tags.some((t) => t.toLowerCase().includes(q))
  );
};

export const sortContacts = (contacts: Contact[]): Contact[] =>
  [...contacts].sort((a, b) => (a.name || "￿").localeCompare(b.name || "￿"));

/** Parses a comma/space separated tag string into a clean tag list. */
export const parseTags = (raw: string): string[] =>
  raw.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
