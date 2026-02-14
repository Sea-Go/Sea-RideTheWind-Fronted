export interface DashboardPost {
  id: string;
  title: string;
  image: string | null;
  author: string;
  likes: number;
  content: string;
  publishedAt: string;
}
