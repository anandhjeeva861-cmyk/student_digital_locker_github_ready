const KEYS = {
  profiles: "sdl_profiles",
  documents: "sdl_documents",
  titles: "sdl_academic_titles",
  session: "sdl_session"
};

export function uid() {
  return `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
}

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function profiles() {
  return read(KEYS.profiles, []);
}

export function saveProfiles(rows) {
  write(KEYS.profiles, rows);
}

export function documents() {
  return read(KEYS.documents, []);
}

export function saveDocuments(rows) {
  write(KEYS.documents, rows);
}

export function academicTitles() {
  return read(KEYS.titles, []);
}

export function saveAcademicTitles(rows) {
  write(KEYS.titles, rows);
}

export function currentSession() {
  return read(KEYS.session, null);
}

export function setSession(session) {
  write(KEYS.session, session);
}

export function clearSession() {
  localStorage.removeItem(KEYS.session);
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}
