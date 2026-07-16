import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  CheckCircle2,
  Clock,
  LogOut,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ResourceFormDialog } from "../../components/forms/resource-form-dialog";
import { CashShiftSelect } from "../../components/cash-shift-select";
import { StatusBadge } from "../../components/status-badge/status-badge";
import { ConfirmDialog } from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/select";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { resourceApi } from "../../lib/api";
import { errorMessage } from "../../lib/api-error";
import { dateTime, getValue, money, productTitle } from "../../lib/utils";
import { hasPermission } from "../../lib/permissions";
import { useAuthStore } from "../../store/auth.store";
import type { AnyRow } from "../../types";
import { modules } from "../module-config";
import { normalizeRows, saveResource } from "../shared/resource-save";

type ChargeItem = {
  key: string;
  itemType: "PRODUCT" | "PENALTY" | "OTHER";
  source?: "ROOM" | "STORE";
  productId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
};

export function StaysPage() {
  const [open, setOpen] = useState(false);
  const [checkoutId, setCheckoutId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [cashShiftId, setCashShiftId] = useState("");
  const [chargeStay, setChargeStay] = useState<AnyRow | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productSource, setProductSource] = useState<
    "ROOM" | "STORE" | "MANUAL"
  >("ROOM");
  const [manualType, setManualType] = useState<"OTHER" | "PENALTY">("OTHER");
  const [manualDescription, setManualDescription] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [chargeItems, setChargeItems] = useState<ChargeItem[]>([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const config = modules.stays;
  const checkInInitialValue = useMemo(
    () => (open ? { expectedCheckOut: tomorrowAtNoonInputValue() } : null),
    [open],
  );
  const staysQuery = useQuery({
    queryKey: ["stays", "active"],
    queryFn: () => resourceApi.list("stays/active"),
  });
  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: () => resourceApi.list("rooms"),
  });
  const salesQuery = useQuery({
    queryKey: ["sales"],
    queryFn: () => resourceApi.list("sales"),
  });
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => resourceApi.list("products"),
  });
  const roomId = Number(getValue(chargeStay ?? {}, "room.id") ?? 0);
  const roomProductsQuery = useQuery({
    queryKey: ["room-products", roomId],
    queryFn: () => resourceApi.list(`rooms/${roomId}/products`),
    enabled: Boolean(roomId),
  });
  const accountQuery = useQuery({
    queryKey: ["account", checkoutId],
    queryFn: () => resourceApi.list(`sales/account/by-stay/${checkoutId}`),
    enabled: Boolean(checkoutId),
  });
  const stays = normalizeRows(staysQuery.data);
  const rooms = normalizeRows(roomsQuery.data);
  const openCharges = normalizeRows(salesQuery.data).filter(
    (sale) => sale.status === "OPEN",
  );
  const products = normalizeRows(productsQuery.data).filter(
    (product) => product.active !== false,
  );
  const roomProducts = normalizeRows(roomProductsQuery.data)
    .filter((item) => Number(item.quantity ?? 0) > 0)
    .map(
      (item): AnyRow => ({
        ...((item.product as AnyRow | undefined) ?? {}),
        id: Number(getValue(item, "product.id") ?? item.productId),
        source: "ROOM",
        roomQuantity: Number(item.quantity ?? 0),
      }),
    );
  const filteredProducts = useMemo(() => {
    const rows: AnyRow[] =
      productSource === "ROOM"
        ? roomProducts
        : productSource === "STORE"
          ? products.map((product): AnyRow => ({ ...product, source: "STORE" }))
          : [];
    const term = productSearch.trim().toLowerCase();
    if (!term) return rows.slice(0, 12);
    return rows
      .filter((product) =>
        productTitle(product).toLowerCase().includes(term),
      )
      .slice(0, 12);
  }, [productSearch, productSource, products, roomProducts]);
  const chargeTotal = chargeItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const lodgingAmount = Number(
    getValue(accountQuery.data ?? {}, "lodging.amount") ?? 0,
  );
  const lodgingPending = Number(
    getValue(accountQuery.data ?? {}, "lodging.pendingAmount") ?? lodgingAmount,
  );
  const pendingCharges = Number(
    getValue(accountQuery.data ?? {}, "totals.pendingCharges") ?? 0,
  );
  // Saldo que el backend exigirá cubrir antes de liberar la habitación.
  const lodgingDue = Math.max(0, lodgingPending + pendingCharges);
  const availableRooms = rooms.filter(
    (room) => room.status === "AVAILABLE",
  ).length;
  const cleaningRooms = rooms.filter((room) => room.status === "RESERVED");
  const canMarkClean = hasPermission(user, "PATCH /rooms/:id/clean");

  const checkIn = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      saveResource(config, values),
    onSuccess: () => {
      toast.success("Check-in realizado");
      setOpen(false);
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const checkOut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { amount: number; cashShiftId?: number; payments?: Array<{ paymentMethod: string; amount: number }> } }) =>
      resourceApi.update(`stays/${id}/check-out`, body),
    onSuccess: () => {
      toast.success("Check-out realizado. Habitación pendiente de limpieza.");
      setCheckoutId(null);
      setPaymentMethod("CASH");
      setCashShiftId("");
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const markClean = useMutation({
    mutationFn: (roomId: number) => resourceApi.update(`rooms/${roomId}/clean`),
    onSuccess: () => {
      toast.success("Limpieza confirmada");
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const addCharge = useMutation({
    mutationFn: () =>
      resourceApi.create("sales", {
        ...(cashShiftId ? { cashShiftId: Number(cashShiftId) } : {}),
        ...(getValue(chargeStay ?? {}, "customer.id")
          ? { customerId: Number(getValue(chargeStay ?? {}, "customer.id")) }
          : {}),
        stayId: Number(chargeStay?.id),
        details: chargeItems.map(({ key: _key, ...item }) => item),
      }),
    onSuccess: () => {
      toast.success("Cargos agregados a la estadía");
      setManualDescription("");
      setManualAmount("");
      setChargeItems([]);
      setCashShiftId("");
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const addProductCharge = (product: AnyRow) => {
    const productId = Number(product.id);
    const source = (product.source === "ROOM" ? "ROOM" : "STORE") as
      | "ROOM"
      | "STORE";
    setChargeItems((items) => {
      const exists = items.find(
        (item) => item.productId === productId && item.source === source,
      );
      if (exists) {
        return items.map((item) =>
          item.productId === productId && item.source === source
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...items,
        {
          key: `product-${source}-${productId}`,
          itemType: "PRODUCT",
          source,
          productId,
          description: `${productTitle(product)} (${source === "ROOM" ? "habitación" : "tienda"})`,
          quantity: 1,
          unitPrice: Number(product.salePrice ?? 0),
        },
      ];
    });
  };

  const updateChargeItem = (
    key: string,
    values: Partial<Pick<ChargeItem, "quantity" | "unitPrice">>,
  ) => {
    setChargeItems((items) =>
      items.map((item) => (item.key === key ? { ...item, ...values } : item)),
    );
  };

  const addManualCharge = () => {
    if (!manualDescription.trim() || !Number(manualAmount)) return;
    setChargeItems((items) => [
      ...items,
      {
        key: `manual-${Date.now()}`,
        itemType: manualType,
        description: manualDescription.trim(),
        quantity: 1,
        unitPrice: Number(manualAmount),
      },
    ]);
    setManualDescription("");
    setManualAmount("");
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Estadías</h1>
          <p className="text-sm text-muted-foreground">
            Control rápido de huéspedes activos y habitaciones ocupadas.
          </p>
        </div>
        <Button className="h-11" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Check-in
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Activas" value={stays.length} />
        <Metric label="Disponibles" value={availableRooms} />
        <Metric
          label="Ocupadas"
          value={rooms.filter((room) => room.status === "OCCUPIED").length}
        />
        <Metric label="Limpieza" value={cleaningRooms.length} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {stays.map((stay) => {
          const staySales = salesQuery.data ? normalizeRows(salesQuery.data).filter(
            (sale) =>
              Number(sale.stayId) === Number(stay.id) &&
              sale.status !== "CANCELLED",
          ) : [];
          const lodgingRegistered = staySales.some((sale) =>
            ((sale.details as AnyRow[] | undefined) ?? []).some(
              (detail) => detail.itemType === "ROOM_RENT",
            ),
          );
          const lodgingPendingForStay = lodgingRegistered
            ? 0
            : Number(stay.agreedPrice ?? 0);
          const pendingTotal = openCharges
            .filter((sale) => Number(sale.stayId) === Number(stay.id))
            .reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);

          return (
            <Card key={String(stay.id)} className="overflow-hidden">
              <CardHeader className="border-b border-border bg-[#10231f] text-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BedDouble className="h-5 w-5" />
                    <span className="text-lg font-semibold">
                      Hab. {String(getValue(stay, "room.roomNumber") ?? "-")}
                    </span>
                  </div>
                  <StatusBadge value={stay.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div>
                  <p className="text-lg font-semibold">
                    {String(
                      getValue(stay, "customer.fullName") ??
                        "Walk-in sin cliente",
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {String(getValue(stay, "priceType.name") ?? "Tarifa")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Ingreso</p>
                    <p className="font-medium">{dateTime(stay.checkIn)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Salida esperada</p>
                    <p className="font-medium">
                      {dateTime(stay.expectedCheckOut)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Alojamiento pendiente
                  </span>
                  <span className="text-xl font-semibold">
                    {money(lodgingPendingForStay)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                  <span className="text-sm text-muted-foreground">
                    Cargos pendientes
                  </span>
                  <span className="text-lg font-semibold">
                    {money(pendingTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm text-muted-foreground">
                    Total estimado
                  </span>
                  <span className="text-xl font-semibold">
                    {money(lodgingPendingForStay + pendingTotal)}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    className="h-11"
                    variant="outline"
                    onClick={() => setChargeStay(stay)}
                  >
                    <PackagePlus className="h-4 w-4" />
                    Agregar cargo
                  </Button>
                  <Button
                    className="h-11"
                    variant="outline"
                    onClick={() => navigate(`/sales?stayId=${stay.id}`)}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Cobrar en caja
                  </Button>
                  <Button
                    className="h-11"
                    variant="secondary"
                    disabled={pendingTotal > 0}
                    onClick={() => setCheckoutId(Number(stay.id))}
                  >
                    <LogOut className="h-4 w-4" />
                    {pendingTotal > 0 ? "Cobrar antes" : "Check-out"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {cleaningRooms.map((room) => (
          <Card key={`clean-${String(room.id)}`} className="overflow-hidden border-red-200">
            <CardHeader className="border-b border-red-800 bg-red-900 text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BedDouble className="h-5 w-5" />
                  <span className="text-lg font-semibold">
                    Hab. {String(room.roomNumber ?? "-")}
                  </span>
                </div>
                <StatusBadge value={room.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="text-lg font-semibold text-red-800">
                  Necesita limpieza
                </p>
                <p className="text-sm text-muted-foreground">
                  Confirma cuando la habitación esté lista.
                </p>
              </div>
              {canMarkClean && (
                <Button
                  className="h-11 w-full"
                  variant="outline"
                  disabled={markClean.isPending}
                  onClick={() => markClean.mutate(Number(room.id))}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar limpieza
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {staysQuery.isError && (
        <Card className="p-4 text-sm text-red-700">
          {errorMessage(staysQuery.error)}
        </Card>
      )}
      {!staysQuery.isLoading && stays.length === 0 && cleaningRooms.length === 0 && (
        <Card className="grid min-h-40 place-items-center p-6 text-center text-sm text-muted-foreground">
          <div>
            <Clock className="mx-auto mb-2 h-6 w-6" />
            No hay estadías activas.
          </div>
        </Card>
      )}

      <ResourceFormDialog
        open={open}
        title="Nuevo check-in"
        description="Elige habitación, tarifa y cliente opcional."
        fields={config.fields}
        schema={config.schema}
        initialValue={checkInInitialValue}
        saving={checkIn.isPending}
        onOpenChange={setOpen}
        onSubmit={(values) => checkIn.mutate(values)}
      />

      <ConfirmDialog
        open={checkoutId !== null && lodgingDue <= 0}
        title="Confirmar check-out"
        description="El alojamiento ya está cobrado. La habitación quedará pendiente de limpieza."
        onOpenChange={(value) => !value && setCheckoutId(null)}
        onConfirm={() =>
          checkoutId &&
          checkOut.mutate({
            id: checkoutId,
            body: {
              amount: lodgingAmount,
              ...(cashShiftId ? { cashShiftId: Number(cashShiftId) } : {}),
            },
          })
        }
      />

      <Dialog
        open={checkoutId !== null && lodgingDue > 0}
        onOpenChange={(value) => !value && setCheckoutId(null)}
      >
        <DialogContent className="p-4 sm:p-6">
          <DialogTitle className="pr-8 text-xl font-semibold">
            Cobrar alojamiento y check-out
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Saldo pendiente de la estadía. Se cobra y libera la habitación.
          </DialogDescription>

          <div className="mt-4 space-y-4">
            <CashShiftSelect value={cashShiftId} onChange={setCashShiftId} />

            <div className="rounded-md border border-border bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Alojamiento</span>
                <span className="font-medium">{money(lodgingPending)}</span>
              </div>
              {pendingCharges > 0 && (
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">
                    Cargos pendientes
                  </span>
                  <span className="font-medium">{money(pendingCharges)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-border pt-2">
                <span className="font-semibold">Total a cobrar</span>
                <span className="font-bold">{money(lodgingDue)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">Efectivo</option>
                <option value="YAPE">Yape</option>
                <option value="PLIN">Plin</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setCheckoutId(null)}
              disabled={checkOut.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                checkoutId &&
                checkOut.mutate({
                  id: checkoutId,
                  body: {
                    amount: lodgingDue,
                    ...(cashShiftId ? { cashShiftId: Number(cashShiftId) } : {}),
                    payments: [
                      {
                        paymentMethod,
                        amount: Number(lodgingDue.toFixed(2)),
                      },
                    ],
                  },
                })
              }
              disabled={checkOut.isPending}
            >
              {checkOut.isPending ? "Procesando..." : "Cobrar y check-out"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(chargeStay)}
        onOpenChange={(value) => {
          if (value) return;
          setChargeStay(null);
          setProductSource("ROOM");
          setChargeItems([]);
        }}
      >
        <DialogContent className="p-4 sm:p-6 min-h-[600px] md:w-[min(960px,calc(100vw-2rem))]">
          <DialogTitle className="pr-8 text-xl font-semibold">
            Agregar cargo a Hab.{" "}
            {String(getValue(chargeStay ?? {}, "room.roomNumber") ?? "")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            El cargo queda pendiente y se suma al total de la estadía.
          </DialogDescription>

          <div className="mt-4">
            <CashShiftSelect value={cashShiftId} onChange={setCashShiftId} />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="grid grid-cols-3 rounded-md border border-border bg-muted p-1">
                {[
                  { label: "Habitación", value: "ROOM" as const },
                  { label: "Tienda", value: "STORE" as const },
                  { label: "Manual", value: "MANUAL" as const },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      productSource === option.value
                        ? "rounded bg-white px-3 py-2 text-sm font-medium shadow-sm"
                        : "rounded px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                    }
                    onClick={() => {
                      setProductSource(option.value);
                      setProductSearch("");
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {productSource !== "MANUAL" ? (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-11 pl-9"
                      placeholder={
                        productSource === "ROOM"
                          ? "Buscar en habitación"
                          : "Buscar en tienda"
                      }
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                    />
                  </div>
                  <div className="grid max-h-[54svh] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                    {productSource === "ROOM" &&
                      !roomProductsQuery.isLoading &&
                      filteredProducts.length === 0 && (
                        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground md:col-span-2">
                          No hay productos asignados a esta habitación.
                        </p>
                      )}
                    {filteredProducts.map((product) => (
                      <button
                        key={String(product.id)}
                        type="button"
                        className="rounded-md border border-border bg-white p-3 text-left hover:border-primary disabled:opacity-50"
                        disabled={
                          addCharge.isPending ||
                          Number(
                            product.source === "ROOM"
                              ? product.roomQuantity
                              : product.stock,
                          ) <= 0
                        }
                        onClick={() => addProductCharge(product)}
                      >
                        <span className="block text-sm font-medium">
                          {productTitle(product)}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {money(product.salePrice)} ·{" "}
                          {product.source === "ROOM"
                            ? `Hab. ${String(product.roomQuantity ?? 0)}`
                            : `Tienda ${String(product.stock ?? 0)}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg bg-muted p-4">
                  <p className="font-medium">Cargo manual</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_130px_auto] md:items-end">
                    <div className="space-y-2">
                      <Select
                        label="Tipo"
                        value={manualType}
                        onChange={(event) =>
                          setManualType(
                            event.target.value as "OTHER" | "PENALTY",
                          )
                        }
                      >
                        <option value="OTHER">Otro cargo</option>
                        <option value="PENALTY">Daño o penalidad</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Descripción</Label>
                      <Input
                        value={manualDescription}
                        onChange={(event) =>
                          setManualDescription(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Monto</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={manualAmount}
                        onChange={(event) =>
                          setManualAmount(event.target.value)
                        }
                      />
                    </div>
                    <Button
                      className="h-10"
                      type="button"
                      onClick={addManualCharge}
                    >
                      Agregar
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      "Hora extra",
                      "Daño en habitación",
                      "Lavandería",
                      "Reposición",
                    ].map((label) => (
                      <Button
                        key={label}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setManualDescription(label)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3 xl:sticky xl:top-0 xl:self-start">
              <div className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-medium">
                    <ShoppingCart className="h-4 w-4" />
                    Carrito
                  </p>
                  <span className="font-semibold">{money(chargeTotal)}</span>
                </div>
                <div className="mt-3 max-h-[34svh] space-y-2 overflow-y-auto pr-1">
                  {chargeItems.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      Agrega productos o cargos antes de guardar.
                    </p>
                  ) : (
                    chargeItems.map((item) => (
                      <div key={item.key} className="rounded-md bg-muted p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {item.description}
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Cantidad</Label>
                                <Input
                                  className="mt-1 h-9"
                                  min="1"
                                  step="1"
                                  type="number"
                                  value={String(item.quantity)}
                                  onChange={(event) =>
                                    updateChargeItem(item.key, {
                                      quantity: Math.max(
                                        1,
                                        Number(event.target.value || 1),
                                      ),
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Precio</Label>
                                <Input
                                  className="mt-1 h-9"
                                  min="0"
                                  step="0.01"
                                  type="number"
                                  value={String(item.unitPrice)}
                                  onChange={(event) =>
                                    updateChargeItem(item.key, {
                                      unitPrice: Math.max(
                                        0,
                                        Number(event.target.value || 0),
                                      ),
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <p className="mt-2 text-xs font-medium text-muted-foreground">
                              Subtotal {money(item.quantity * item.unitPrice)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:bg-white hover:text-foreground"
                            onClick={() =>
                              setChargeItems((items) =>
                                items.filter((row) => row.key !== item.key),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <Button
                  className="mt-3 h-11 w-full"
                  disabled={chargeItems.length === 0 || addCharge.isPending}
                  onClick={() => addCharge.mutate()}
                >
                  {addCharge.isPending
                    ? "Guardando..."
                    : `Guardar · ${money(chargeTotal)}`}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function tomorrowAtNoonInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
