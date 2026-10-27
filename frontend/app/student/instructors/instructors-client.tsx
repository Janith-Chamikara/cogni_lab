"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Search, Users } from "lucide-react";

import type { InstructorSummary } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InstructorContactCard,
  instructorName,
} from "@/components/student/instructor-contact-card";
import { FollowButton } from "@/components/student/follow-button";

interface InstructorsClientProps {
  initialInstructors: InstructorSummary[];
  error?: string;
}

const plural = (count: number, word: string) =>
  `${count} ${count === 1 ? word : `${word}s`}`;

/** Follower count adjusted for a follow change not yet refreshed from the server. */
export const shownFollowerCount = (
  instructor: InstructorSummary,
  following: boolean,
) =>
  instructor.followerCount +
  Number(following) -
  Number(instructor.isFollowing);

function InstructorCard({ instructor }: { instructor: InstructorSummary }) {
  const [following, setFollowing] = React.useState(instructor.isFollowing);
  const followers = shownFollowerCount(instructor, following);

  return (
    <InstructorContactCard instructor={instructor}>
      <p className="text-xs text-muted-foreground">
        {plural(followers, "follower")} · {plural(instructor.labCount, "lab")}
      </p>
      <div className="flex gap-2 border-t pt-3">
        <FollowButton
          className="flex-1"
          instructorId={instructor.id}
          instructorName={instructorName(instructor)}
          initialFollowing={instructor.isFollowing}
          onFollowingChange={setFollowing}
        />
        <Button asChild size="sm" variant="ghost" className="gap-1">
          <Link
            href={`/student/instructors/${instructor.id}`}
            data-ai-action="navigate"
            data-ai-href={`/student/instructors/${instructor.id}`}
            data-ai-label={`View ${instructorName(instructor)}'s profile`}
          >
            Profile
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </InstructorContactCard>
  );
}

export function InstructorsClient({
  initialInstructors,
  error,
}: InstructorsClientProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const instructors = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return initialInstructors;
    return initialInstructors.filter((instructor) =>
      [instructor.fullName, instructor.email, instructor.university].some(
        (text) => text?.toLowerCase().includes(query),
      ),
    );
  }, [initialInstructors, searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/50 via-background to-muted/30">
      <div className="container mx-auto max-w-[96rem] space-y-8 px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
              <Link href="/student/dashboard">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Instructors
            </h1>
            <p className="mt-1 text-muted-foreground">
              Follow instructors to see their labs on your dashboard
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search instructors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background pl-10 shadow-sm sm:w-72"
            />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>All instructors</CardTitle>
            <CardDescription>
              {plural(initialInstructors.length, "instructor")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {instructors.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">
                  {searchQuery
                    ? "No instructors match your search"
                    : "No instructors yet"}
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {searchQuery
                    ? "Try a different name, email or university."
                    : "Instructors appear here once they join Cogni Lab."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {instructors.map((instructor) => (
                  <InstructorCard key={instructor.id} instructor={instructor} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
