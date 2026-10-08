/**
 * Anonymous authorisation lives ONLY on this device, in namespaced localStorage keys:
 *   app:post-edit:<postId>       raw edit key for a post
 *   app:comment-edit:<commentId> raw edit key for a comment (independent of the post key)
 * Plus two small non-secret indexes so the UI can list "my posts / my comments".
 * Nothing else (no passwords, no server secrets) is ever stored in the browser.
 * Every access is wrapped: storage may be unavailable (private mode, blocked site data).
 */
const POST = 'app:post-edit:';
const COMMENT = 'app:comment-edit:';
const POST_INDEX = 'app:post-index';
const COMMENT_INDEX = 'app:comment-index:'; // + postId → commentId[]

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function drop(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
function readList(key: string): string[] {
  try {
    const v: unknown = JSON.parse(read(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
const addTo = (key: string, id: string) => {
  const list = readList(key);
  if (!list.includes(id)) write(key, JSON.stringify([id, ...list]));
};
const removeFrom = (key: string, id: string) => {
  const list = readList(key).filter((x) => x !== id);
  if (list.length) write(key, JSON.stringify(list));
  else drop(key);
};

export const storage = {
  available(): boolean {
    return write('app:probe', '1') && (drop('app:probe'), true);
  },

  savePostKey(postId: string, editKey: string): boolean {
    const ok = write(POST + postId, editKey);
    if (ok) addTo(POST_INDEX, postId);
    return ok;
  },
  getPostKey: (postId: string): string | null => read(POST + postId),
  removePost(postId: string): void {
    drop(POST + postId);
    removeFrom(POST_INDEX, postId);
  },
  listPostIds: (): string[] => readList(POST_INDEX),

  saveCommentKey(postId: string, commentId: string, editKey: string): boolean {
    const ok = write(COMMENT + commentId, editKey);
    if (ok) addTo(COMMENT_INDEX + postId, commentId);
    return ok;
  },
  getCommentKey: (commentId: string): string | null => read(COMMENT + commentId),
  removeComment(postId: string, commentId: string): void {
    drop(COMMENT + commentId);
    removeFrom(COMMENT_INDEX + postId, commentId);
  },
  listCommentIds: (postId: string): string[] => readList(COMMENT_INDEX + postId),
};
