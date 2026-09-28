export interface PublicDoctorListItemDto {
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
  /** Min/max price across the doctor's specialty's active EXAMINATION
   * services — null when the specialty has no matching service. */
  priceFrom: number | null;
  priceTo: number | null;
}

export interface PublicDoctorDetailDto extends PublicDoctorListItemDto {
  specialtyDescription: string | null;
}
