"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Upload, X } from "lucide-react";

import {
  labEquipmentSchema,
  type LabEquipmentFormValues,
} from "@/lib/schemas/lab-equipment";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CreateLabEquipmentPayload, LabEquipment } from "@/lib/types";
import { createLabEquipment } from "@/lib/actions";

type CreateLabEquipmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (equipment: LabEquipment) => void;
};

export function CreateLabEquipmentDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateLabEquipmentDialogProps) {
  const [createError, setCreateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<LabEquipmentFormValues>({
    resolver: zodResolver(labEquipmentSchema),
    defaultValues: {
      equipmentType: "",
      equipmentName: "",
      description: "",
      supportsConfiguration: false,
      defaultConfigJson: "",
      image: null,
    },
  });

  const supportsConfiguration = form.watch("supportsConfiguration");

  useEffect(() => {
    if (!open) {
      form.reset({
        equipmentType: "",
        equipmentName: "",
        description: "",
        supportsConfiguration: false,
        defaultConfigJson: "",
        image: null,
      });
      setImagePreviewUrl(null);
      setCreateError(null);
    }
  }, [open, form]);

  useEffect(() => {
    if (!imagePreviewUrl) {
      return;
    }

    return () => {
      if (imagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleCreate = (values: LabEquipmentFormValues) => {
    setCreateError(null);

    startTransition(async () => {
      const payload: CreateLabEquipmentPayload = {
        equipmentType: values.equipmentType,
        equipmentName: values.equipmentName,
        description: values.description?.trim() || undefined,
        supportsConfiguration: values.supportsConfiguration,
        defaultConfigJson: values.defaultConfigJson?.trim() || undefined,
        image: values.image ?? undefined,
      };

      const result = await createLabEquipment(payload);

      if (result.error) {
        setCreateError(result.error);
        return;
      }

      const created = result.data;

      if (created) {
        onCreated(created);
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create equipment</DialogTitle>
          <DialogDescription>
            Add new equipment with an optional configuration template.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleCreate)}
            className="space-y-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="equipmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment type</FormLabel>
                    <FormControl>
                      <Input placeholder="Oscilloscope" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="equipmentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment name</FormLabel>
                    <FormControl>
                      <Input placeholder="Rigol DS1102" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                      placeholder="Optional description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="supportsConfiguration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supports configuration</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ? "true" : "false"}
                        onValueChange={(value) =>
                          field.onChange(value === "true")
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">No</SelectItem>
                          <SelectItem value="true">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment image</FormLabel>
                    <FormControl>
                      <div
                        className={`relative flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                          isDragging
                            ? "border-primary bg-primary/5"
                            : "border-border bg-muted/40 hover:border-primary/50 hover:bg-muted/60"
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file && file.type.startsWith("image/")) {
                            field.onChange(file);
                            setImagePreviewUrl(URL.createObjectURL(file));
                          }
                        }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            field.onChange(file);
                            setImagePreviewUrl(
                              file ? URL.createObjectURL(file) : null,
                            );
                          }}
                        />

                        {imagePreviewUrl ? (
                          <>
                            <img
                              src={imagePreviewUrl}
                              alt="Preview"
                              className="max-h-28 rounded-lg object-contain"
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-2 rounded-full bg-destructive/90 p-1 text-destructive-foreground transition-colors hover:bg-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                field.onChange(null);
                                setImagePreviewUrl(null);
                                if (fileInputRef.current) {
                                  fileInputRef.current.value = "";
                                }
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2 p-4 text-center">
                            <Upload className="h-8 w-8 text-muted-foreground/60" />
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                Click to upload
                              </span>{" "}
                              or drag and drop
                            </div>
                            <div className="text-[10px] text-muted-foreground/70">
                              PNG, JPG, GIF up to 5MB
                            </div>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="defaultConfigJson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default config JSON</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 min-h-24 w-full resize-none rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder='{"channel":1,"scale":"5V"}'
                      disabled={!supportsConfiguration}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide valid JSON only when configuration is enabled.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {createError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {createError}
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
                {isPending ? "Creating..." : "Create equipment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
