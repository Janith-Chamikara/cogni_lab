import { EquipmentPlacement, LabEquipment, WireConnection } from "@/lib/types";

export type PlacedEquipment = EquipmentPlacement & {
  equipment: LabEquipment;
};

export type CircuitCanvasProps = {
  placedEquipments: PlacedEquipment[];
  wireConnections: WireConnection[];
  onEquipmentMove: (index: number, x: number, y: number) => void;
  onEquipmentRemove: (index: number) => void;
  onEquipmentConfig: (index: number) => void;
  onConnectionsChange: (connections: WireConnection[]) => void;
  onEquipmentDrop: (equipmentId: string, x: number, y: number) => void;
};
