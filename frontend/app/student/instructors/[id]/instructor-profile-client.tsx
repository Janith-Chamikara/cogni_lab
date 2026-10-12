"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FlaskConical, GraduationCap, Mail, Users } from "lucide-react";

import type {
  InstructorProfile,
  LabAttemptSummary,
  LabDraftSummary,
} from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  initialsOf,
  instructorName,
} from "@/components/student/instructor-contact-card";
import { FollowButton } from "@/components/student/follow-button";
import { LabCard } from "../../dashboard/student-dashboard-client";
import { shownFollowerCount } from "../instructors-client";

interface InstructorProfileClientProps {
  profile: InstructorProfile;
  attemptSummary: LabAttemptSummary[];
  draftSummary: LabDraftSummary[];
}

export function InstructorProfileClient({
  profile,
  attemptSummary,
  draftSummary,
}: InstructorProfileClientProps) {
  const router = useRouter();
  const [following, setFollowing] = React.useState(profile.isFollowing);
  const name = instructorName(profile);
  const followers = shownFollowerCount(profile, following);

  const attemptsByLab = React.useMemo(
    () => new Map(attemptSummary.map((summary) => [summary.labId, summary])),
    [attemptSummary],
  );
  const draftsByLab = React.useMemo(
    () => new Map(draftSummary.map((draft) => [draft.labId, draft])),
    [draftSummary],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/50 via-background to-muted/30">
      <div className="container mx-auto max-w-[96rem] space-y-8 px-6 py-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/student/instructors">
            <ArrowLeft className="h-4 w-4" />
            All instructors
          </Link>
        </Button>

        <Card className="border-0 shadow-lg">
          <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div
                aria-hidden
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary"
              >
                {initialsOf(name)}
              </div>
              <div className="min-w-0 space-y-1">
                <h1 className="truncate text-2xl font-bold tracking-tight">
                  {name}
                </h1>
                {profile.university && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    {profile.university}
                  </p>
                )}
                {profile.email && (
                  <a
                    href={`mailto:${profile.email}`}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline"
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{profile.email}</span>
                  </a>
                )}
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0" />
                  {followers} {followers === 1 ? "follower" : "followers"} ·{" "}
                  {profile.labs.length}{" "}
                  {profile.labs.length === 1 ? "lab" : "labs"}
                </p>
              </div>
            </div>
            <FollowButton
              size="default"
              className="sm:w-40"
              instructorId={profile.id}
              instructorName={name}
              initialFollowing={profile.isFollowing}
              onFollowingChange={setFollowing}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Labs by {name}</CardTitle>
            <CardDescription>
              Open a lab to start the experiment
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile.labs.length === 0 ? (
              <div className="py-12 text-center">
                <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No labs yet</h3>
                <p className="mt-2 text-muted-foreground">
                  {following
                    ? "Their new labs will show up on your dashboard."
                    : "Follow this instructor to see their new labs on your dashboard."}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {profile.labs.map((lab) => (
                  <LabCard
                    key={lab.id}
                    lab={lab}
                    summary={attemptsByLab.get(lab.id)}
                    draft={draftsByLab.get(lab.id)}
                    onStart={() => router.push(`/student/lab/${lab.id}`)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
