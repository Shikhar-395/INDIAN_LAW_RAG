export interface ConstitutionalArticle {
  number: string;
  title: string | null;
  part: string | null;
  partTitle: string | null;
  chapter: string | null;
  content: string;
  pageStart: number;
  pageEnd: number;
}

export interface ConstitutionalPart {
  number: string;
  title: string;
}