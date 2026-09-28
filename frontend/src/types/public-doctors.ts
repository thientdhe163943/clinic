export interface PublicDoctorListItem {
  id: string;
  userId: string;
  fullName: string;
  specialtyId: string | null;
  specialtyName: string | null;
  subspecialty: string | null;
  degree: string | null;
  yearsExperience: number | null;
  biography: string | null;
  avatarUrl: string | null;
  // Min/max price across the doctor's specialty's active EXAMINATION
  // services — null when the specialty has no matching service.
  priceFrom: number | null;
  priceTo: number | null;
}

export interface PublicDoctorDetail extends PublicDoctorListItem {
  specialtyDescription: string | null;
}

export interface ListPublicDoctorsQuery {
  search?: string;
  specialtyId?: string;
  // "YYYY-MM-DD" — when given, only doctors with at least one bookable slot
  // that day are returned.
  date?: string;
}
