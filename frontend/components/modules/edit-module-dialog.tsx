"use client";

import { useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { updateModule } from "@/lib/actions";
import {
  moduleSchema,
  type ModuleFormValues,
} from "@/lib/schemas/module";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreateModulePayload, Module } from "@/lib/types";

type EditModuleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: Module | null;
  onUpdated: (module: Module) => void;
};

export function EditModuleDialog({
  open,
  onOpenChange,
  module,
  onUpdated,
}: EditModuleDialogProps) {
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      moduleName: "",
      description: "",
      moduleCode: "",
    },
  });

  useEffect(() => {
    if (open && module) {
      form.reset({
        moduleName: module.moduleName,
        description: module.description || "",
        moduleCode: module.moduleCode || "",
      });
      setUpdateError(null);
    }
  }, [open, module, form]);

  const handleUpdate = (values: ModuleFormValues) => {
    if (!module) return;
    
    setUpdateError(null);

    startTransition(async () => {
      const payload: Partial<CreateModulePayload> = {
        moduleName: values.moduleName.trim(),
        description: values.description?.trim() || undefined,
        moduleCode: values.moduleCode?.trim() || undefined,
      };

      const result = await updateModule(module.id, payload);

      if (result.error) {
        setUpdateError(result.error);
        return;
      }

      const updated = result.data;

      if (updated) {
        onUpdated(updated);
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit module</DialogTitle>
          <DialogDescription>
            Update the module details.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleUpdate)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="moduleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Module name</FormLabel>
                  <FormControl>
                    <Input placeholder="Introduction to Electronics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="moduleCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Module code</FormLabel>
                  <FormControl>
                    <Input placeholder="EE-101" {...field} />
                  </FormControl>
                  <FormDescription>Optional module code</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 min-h-20 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                      placeholder="Brief description of the module"
                    />
                  </FormControl>
                  <FormDescription>Optional description</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {updateError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {updateError}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}