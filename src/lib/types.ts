export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ImageDto {
  id: string;
  width: number;
  height: number;
  thumb: string;
  medium: string;
  large: string;
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
  commentCount: number;
  publishedAt: string | null;
}

export interface PostDetail extends PostSummary {
  content: string;
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
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  editExpiresAt: string;
}

export interface PublicComment {
  id: string;
  content: string;
  createdAt: string;
}

export interface OwnerComment {
  id: string;
  postId: string;
  content: string;
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
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}
