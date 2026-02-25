import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type EquipmentHandleCountProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export default function EquipmentsHandleCountForm({
  open,
  onOpenChange,
}: EquipmentHandleCountProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create equipment</DialogTitle>
          <DialogDescription>
            Add new equipment with an optional configuration template.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input placeholder="Oscilloscope" />

            <Input placeholder="Rigol DS1102" />
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit">Configure</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
