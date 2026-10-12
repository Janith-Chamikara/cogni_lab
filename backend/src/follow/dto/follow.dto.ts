// Response shapes for the follow endpoints. They take no request body: the
// instructor id comes from the route.

export class InstructorSummaryDto {
  id: string;
  fullName: string | null;
  email: string;
  university: string | null;
  followerCount: number;
  labCount: number;
  isFollowing: boolean;
}

export class InstructorProfileDto extends InstructorSummaryDto {
  labs: unknown[];
}

export class FollowStatusDto {
  instructorId: string;
  following: boolean;
  followerCount: number;
}
