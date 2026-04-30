export type TrainingStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Training {
  id?: string;
  title: string;
  date: string;
  instructor: string;
  team: string;
  status: TrainingStatus;
  description: string;
  location: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export interface LibraryItem {
  id?: string;
  title: string;
  description: string;
  category: string;
  url: string;
  thumbnail?: string;
  createdAt: any;
  createdBy: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'admin' | 'member';
  lastActive: any;
}
