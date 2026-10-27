"use client";

import * as React from "react";
import { Check, Loader2, UserMinus, UserPlus } from "lucide-react";

import { followInstructor, unfollowInstructor } from "@/lib/actions";
import { Button } from "@/components/ui/button";

type FollowButtonProps = {
  instructorId: string;
  instructorName: string;
  initialFollowing: boolean;
  /** Called whenever the shown follow state changes, including rollbacks. */
  onFollowingChange?: (following: boolean) => void;
  size?: "sm" | "default";
  className?: string;
};

// Follow/unfollow toggle. Updates at once and rolls back if the request
// fails; while following, hovering shows "Unfollow".
export function FollowButton({
  instructorId,
  instructorName,
  initialFollowing,
  onFollowingChange,
  size = "sm",
  className,
}: FollowButtonProps) {
  const [following, setFollowing] = React.useState(initialFollowing);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Take the server's value when the page data is refreshed.
  const [serverFollowing, setServerFollowing] =
    React.useState(initialFollowing);
  if (serverFollowing !== initialFollowing) {
    setServerFollowing(initialFollowing);
    setFollowing(initialFollowing);
  }

  const show = (value: boolean) => {
    setFollowing(value);
    onFollowingChange?.(value);
  };

  const toggle = () => {
    const next = !following;
    show(next);
    setError(null);

    startTransition(async () => {
      const result = next
        ? await followInstructor(instructorId)
        : await unfollowInstructor(instructorId);

      if (result.error || !result.data) {
        show(!next);
        setError(result.error ?? "Something went wrong.");
      }
    });
  };

  return (
    <div className={className}>
      <Button
        type="button"
        size={size}
        variant={following ? "outline" : "default"}
        className="group w-full gap-2"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={following}
        aria-label={
          following
            ? `Unfollow ${instructorName}`
            : `Follow ${instructorName}`
        }
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : following ? (
          <>
            <Check className="h-4 w-4 group-hover:hidden" />
            <UserMinus className="hidden h-4 w-4 group-hover:block" />
          </>
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {following ? (
          <>
            <span className="group-hover:hidden">Following</span>
            <span className="hidden group-hover:inline">Unfollow</span>
          </>
        ) : (
          "Follow"
        )}
      </Button>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
