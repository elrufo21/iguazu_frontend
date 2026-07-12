import { useQuery } from "@tanstack/react-query";
import { resourceApi } from "../lib/api";
import { dateTime, getValue, money } from "../lib/utils";
import { useAuthStore } from "../store/auth.store";
import { normalizeRows } from "../features/shared/resource-save";
import { Label } from "./ui/label";
import { Select } from "./ui/select";

export function CashShiftSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const user = useAuthStore((state) => state.user);
  const shifts = useQuery({
    queryKey: ["cash-shift", "open", "all"],
    queryFn: () => resourceApi.list("cash-shift/open/all"),
    enabled: user?.role === "ADMIN",
  });

  if (user?.role !== "ADMIN") return null;

  return (
    <div className="space-y-1.5">
      <Label>Caja abierta</Label>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Seleccionar caja...</option>
        {normalizeRows(shifts.data).map((shift) => (
          <option key={String(shift.id)} value={String(shift.id)}>
            {String(
              getValue(shift, "openedBy.employee.fullName") ??
                getValue(shift, "openedBy.username") ??
                `Caja #${shift.id}`,
            )}{" "}
            - {money(shift.openingAmount)} - {dateTime(shift.openedAt)}
          </option>
        ))}
      </Select>
    </div>
  );
}
