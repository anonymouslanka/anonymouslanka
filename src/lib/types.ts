export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED';

export interface ImageDto {
  id: string;
  width: number;
  height: number;
  thumb: string;
  medium: string;
  large: string;
}

export interface FileDto {
  id: string;
  name: string;
  ext: string;
  bytes: number;
}

export interface Category {
  slug: string;
  name: string;
  postCount?: number;
}

export interface PostSummary {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  category: Category | null;
  images: ImageDto[];
  imageCount: number;
  fileCount: number;
  /** AI = compiled by the DL-ai bot from public sources, STAFF = written by a moderator, null = public submission */
  origin?: 'AI' | 'STAFF' | null;
  commentCount: number;
  publishedAt: string | null;
}

export interface PostDetail extends PostSummary {
  content: string;
  files: FileDto[];
}

export interface OwnerPost {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: Category | null;
  status: ModerationStatus;
  rejectionReason: string | null;
  images: ImageDto[];
  files: FileDto[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  editExpiresAt: string;
}

export interface PublicComment {
  id: string;
  origin?: 'AI' | 'STAFF' | null;
  content: string;
  images: ImageDto[];
  files: FileDto[];
  createdAt: string;
}

export interface OwnerComment {
  id: string;
  postId: string;
  content: string;
  images: ImageDto[];
  files: FileDto[];
  status: ModerationStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  editExpiresAt: string;
}

export interface PageMeta {
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
  /** notification feed only: unread items for this device */
  unread?: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export interface NotificationItem {
  id: string;
  kind: 'CASE' | 'STATEMENT' | 'ANNOUNCEMENT';
  title: string;
  body: string;
  /** in-app route, never a full URL */
  url: string;
  createdAt: string;
  read: boolean;
}

export interface NotifPrefs {
  newCases: boolean;
  statements: boolean;
  announcements: boolean;
}

export interface DeviceStatus {
  prefs: NotifPrefs;
  push: { available: boolean; subscribed: boolean };
}

export interface FollowedCase {
  id: string;
  title: string;
}

export interface AnnouncementPublic {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}
