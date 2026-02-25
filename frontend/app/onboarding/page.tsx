"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap, School } from "lucide-react";

import { completeOnboarding } from "@/lib/actions";
import {
  onboardingSchema,
  type OnboardingFormValues,
} from "@/lib/schemas/onboarding";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { user } = useUser();
  const router = useRouter();

  console.log("OnboardingPage rendered");

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      role: undefined,
      institution: "",
    },
  });

  React.useEffect(() => {
    console.log("Form state:", form.getValues());
    console.log("Form errors:", form.formState.errors);
    console.log("Form is valid:", form.formState.isValid);
  }, [form.formState.errors, form.formState.isValid, form.watch()]);

  const onSubmit = async (values: OnboardingFormValues) => {
    console.log("Form submitted with values:", values);
    setIsSubmitting(true);
    setError("");

    try {
      const res = await completeOnboarding(values);
      console.log("Onboarding response:", res);

      if (res?.message) {
        console.log("Onboarding successful, setting cookie...");
        // Set a cookie to bypass onboarding check
        document.cookie = "onboarding_complete=true; path=/; max-age=60";
        console.log("Redirecting to dashboard...");
        // Use hard navigation to ensure server-side session is refreshed
        window.location.href = "/dashboard";
      }

      if (res?.error) {
        console.error("Onboarding error:", res.error);
        setError(res.error);
      }
    } catch (error) {
      console.error("Unexpected error during onboarding:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-background to-muted/30" />
      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-muted/50 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-muted/40 blur-3xl" />

      <Card className="relative z-10 w-full max-w-lg border-border shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            Setup your account
          </CardTitle>
          <CardDescription>
            Let&apos;s get you set up. Tell us a bit about yourself.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form 
              onSubmit={form.handleSubmit(
                onSubmit,
                (errors) => {
                  console.log("Form validation failed with errors:", errors);
                  console.log("Current form values:", form.getValues());
                }
              )} 
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Role</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        console.log("Role changed to:", value);
                        field.onChange(value);
                      }}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="STUDENT">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4" />
                            <span>Student</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="INSTRUCTOR">
                          <div className="flex items-center gap-2">
                            <School className="h-4 w-4" />
                            <span>Instructor</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose whether you&apos;re a student or an instructor
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="institution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>University / Institution</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., University of Colombo"
                        {...field}
                        onChange={(e) => {
                          console.log("Institution changed to:", e.target.value);
                          field.onChange(e);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the name of your university or institution
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
                onClick={() => console.log("Button clicked! Form valid:", form.formState.isValid)}
              >
                {isSubmitting ? "Setting up..." : "Complete Setup"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
