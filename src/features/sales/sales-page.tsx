import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BedDouble,
  Box,
  Minus,
  PenTool,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { CashShiftSelect } from "../../components/cash-shift-select";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { resourceApi } from "../../lib/api";
import { errorMessage } from "../../lib/api-error";
import { getValue, money, productTitle } from "../../lib/utils";
import type { AnyRow } from "../../types";
import { normalizeRows } from "../shared/resource-save";

type CartItem = {
  key: string;
  itemType: "PRODUCT" | "ROOM_RENT" | "PENALTY" | "OTHER";
  productId?: number;
  stayId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
};

const paymentOptions = [
  { label: "Efectivo", value: "CASH" },
  { label: "Tarjeta", value: "CARD" },
  { label: "Yape", value: "YAPE" },
  { label: "Plin", value: "PLIN" },
  { label: "Transferencia", value: "TRANSFER" },
];

export function SalesPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [stayId, setStayId] = useState(searchParams.get("stayId") || "");
  const [cashShiftId, setCashShiftId] = useState("");

  // New states for invoice
  const [invoiceType, setInvoiceType] = useState("TICKET");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [manualType, setManualType] = useState<"OTHER" | "PENALTY">("OTHER");
  const [manualDescription, setManualDescription] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  // Cargos pendientes que ya están en BD (a pagar junto con la venta nueva)
  const [pendingSales, setPendingSales] = useState<AnyRow[]>([]);
  const prevStayIdRef = useRef("");
  const saleSummaryRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => resourceApi.list("products"),
  });
  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: () => resourceApi.list("customers"),
  });
  const staysQuery = useQuery({
    queryKey: ["stays", "active"],
    queryFn: () => resourceApi.list("stays/active"),
  });
  const salesQuery = useQuery({
    queryKey: ["sales"],
    queryFn: () => resourceApi.list("sales"),
  });

  const products = normalizeRows(productsQuery.data).filter(
    (product) => product.active !== false,
  );
  const customers = normalizeRows(customersQuery.data);
  const stays = normalizeRows(staysQuery.data);
  const sales = normalizeRows(salesQuery.data);
  const selectedStay = stays.find((stay) => String(stay.id) === stayId);
  const selectedRoomId = Number(getValue(selectedStay ?? {}, "room.id") ?? 0);
  const lodgingRegistered = useMemo(
    () =>
      sales.some(
        (sale) =>
          Number(sale.stayId) === Number(stayId) &&
          sale.status !== "CANCELLED" &&
          ((sale.details as AnyRow[] | undefined) ?? []).some(
            (detail) => detail.itemType === "ROOM_RENT",
          ),
      ),
    [sales, stayId],
  );
  const roomProductsQuery = useQuery({
    queryKey: ["room-products", selectedRoomId],
    queryFn: () => resourceApi.list(`rooms/${selectedRoomId}/products`),
    enabled: Boolean(selectedRoomId),
  });

  // Auto-cargar cliente desde la estadía
  useEffect(() => {
    if (selectedStay && !customerId) {
      const stayCustomerId = getValue(selectedStay, "customer.id");
      if (stayCustomerId) setCustomerId(String(stayCustomerId));
    }
  }, [selectedStay, customerId]);

  // Auto-cargar carrito al seleccionar una estadía
  useEffect(() => {
    if (salesQuery.isLoading) return;
    if (stayId === prevStayIdRef.current) return;
    prevStayIdRef.current = stayId;

    if (!stayId || !selectedStay) {
      // Si se deselecciona la habitación, limpiar carrito y pendientes
      setCart([]);
      setPendingSales([]);
      return;
    }

    // 1. Agregar alojamiento automáticamente solo si aún no existe.
    const stayNum = Number(selectedStay.id);
    const roomNum = String(
      getValue(selectedStay, "room.roomNumber") ?? stayNum,
    );
    const newCart: CartItem[] = lodgingRegistered
      ? []
      : [
          {
            key: `room-${stayNum}`,
            itemType: "ROOM_RENT",
            stayId: stayNum,
            description: `Alojamiento Hab. ${roomNum}`,
            quantity: 1,
            unitPrice: Number(selectedStay.agreedPrice ?? 0),
          },
        ];
    setCart(newCart);

    // 2. Cargar cargos pendientes de BD
    const stayPendingSales = sales.filter(
      (s) => Number(s.stayId) === stayNum && s.status === "OPEN",
    );
    setPendingSales(stayPendingSales);
  }, [stayId, selectedStay, sales, salesQuery.isLoading, lodgingRegistered]);

  const roomProducts = normalizeRows(roomProductsQuery.data).filter(
    (item) => Number(item.quantity ?? 0) > 0,
  );
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      productTitle(product).toLowerCase().includes(term),
    );
  }, [products, search]);
  const total = cart.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const pendingTotal = pendingSales.reduce(
    (sum, s) => sum + Number(s.total ?? 0),
    0,
  );
  const grandTotal = total + pendingTotal;
  const hasSaleItems = cart.length > 0 || pendingSales.length > 0;

  const createSale = useMutation({
    mutationFn: async ({ chargeToStay }: { chargeToStay: boolean }) => {
      if (!cart.length && !pendingSales.length)
        throw new Error("Agrega al menos un producto o cargo.");

      // 1. Primero, cobrar los cargos pendientes existentes en BD
      for (const pendingSale of pendingSales) {
        await resourceApi.post(`sales/${pendingSale.id}/pay`, {
          ...(cashShiftId ? { cashShiftId: Number(cashShiftId) } : {}),
          payments: [{ paymentMethod, amount: Number(pendingSale.total ?? 0) }],
        });
      }

      // 2. Luego, si hay ítems nuevos en el carrito, crear la nueva venta
      if (cart.length === 0) return null;
      const amount = Number(total.toFixed(2));
      return resourceApi.create("sales", {
        ...(cashShiftId ? { cashShiftId: Number(cashShiftId) } : {}),
        ...(customerId ? { customerId: Number(customerId) } : {}),
        ...(stayId ? { stayId: Number(stayId) } : {}),
        invoiceType,
        ...(invoiceNumber ? { invoiceNumber } : {}),
        details: cart.map((item) => ({
          itemType: item.itemType,
          ...(item.productId ? { productId: item.productId } : {}),
          ...(item.stayId ? { stayId: item.stayId } : {}),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          // Marcar productos del frigobar como source ROOM
          ...(item.key.startsWith("frigobar-") ? { source: "ROOM" } : {}),
        })),
        ...(chargeToStay || amount === 0 ? {} : { payments: [{ paymentMethod, amount }] }),
      });
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.chargeToStay
          ? "Cargo agregado a la habitación"
          : "Cobro registrado exitosamente",
      );
      setCart([]);
      setPendingSales([]);
      setCustomerId("");
      setStayId("");
      prevStayIdRef.current = "";
      setInvoiceNumber("");
      setCashShiftId("");
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const addProduct = (product: AnyRow) => {
    const productId = Number(product.id);
    setCart((items) => {
      const exists = items.find((item) => item.productId === productId);
      if (exists)
        return items.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      return [
        ...items,
        {
          key: `product-${productId}`,
          itemType: "PRODUCT",
          productId,
          description: productTitle(product),
          quantity: 1,
          unitPrice: Number(product.salePrice ?? 0),
        },
      ];
    });
  };

  const addRoomProduct = (item: AnyRow) => {
    const product = item.product as AnyRow;
    const key = `frigobar-${String(item.id)}`;
    const max = Number(item.quantity ?? 1);
    setCart((items) => {
      const exists = items.find((row) => row.key === key);
      if (exists) {
        return items.map((row) =>
          row.key === key
            ? { ...row, quantity: Math.min(max, row.quantity + 1) }
            : row,
        );
      }
      return [
        ...items,
        {
          key,
          itemType: "PRODUCT",
          productId: Number(product?.id ?? 0),
          description: productTitle((item.product as AnyRow | undefined) ?? {}),
          quantity: 1,
          unitPrice: Number(getValue(item, "product.salePrice") ?? 0),
        },
      ];
    });
  };

  const addManual = () => {
    if (!manualDescription.trim() || !Number(manualPrice)) return;
    setCart((items) => [
      ...items,
      {
        key: `other-${Date.now()}`,
        itemType: manualType,
        description: manualDescription.trim(),
        quantity: 1,
        unitPrice: Number(manualPrice),
      },
    ]);
    setManualDescription("");
    setManualPrice("");
    toast.success("Cargo manual agregado al carrito");
  };

  const updateQuantity = (key: string, diff: number) => {
    setCart((items) =>
      items
        .map((item) =>
          item.key === key
            ? { ...item, quantity: Math.max(0, item.quantity + diff) }
            : item,
        )
    );
  };

  const updateUnitPrice = (key: string, unitPrice: number) => {
    setCart((items) =>
      items.map((item) =>
        item.key === key ? { ...item, unitPrice: Math.max(0, unitPrice) } : item,
      ),
    );
  };

  return (
    <section className={`space-y-5 ${hasSaleItems ? "pb-24 lg:pb-0" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Ventas y cargos rápidos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cobra al momento o carga consumos a una habitación activa.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/sales/history">Historial</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Lado izquierdo: Tabs de Contenido */}
        <div className="order-2 space-y-4 lg:order-1">
          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="products" className="flex items-center gap-2">
                <Box className="h-4 w-4" /> Productos
              </TabsTrigger>
              <TabsTrigger value="room" className="flex items-center gap-2">
                <BedDouble className="h-4 w-4" /> Habitación
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <PenTool className="h-4 w-4" /> Cargo Manual
              </TabsTrigger>
            </TabsList>

            {/* TAB: PRODUCTOS */}
            <TabsContent value="products" className="space-y-4 pt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9 bg-muted/50"
                      placeholder="Buscar producto por nombre..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((product) => (
                  <button
                    key={String(product.id)}
                    type="button"
                    className="rounded-lg border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md"
                    onClick={() => addProduct(product)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm line-clamp-2 leading-tight">
                          {productTitle(product)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Stock: {String(product.stock ?? 0)}
                        </p>
                      </div>
                      <span className="font-semibold text-primary">
                        {money(product.salePrice)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>

            {/* TAB: HABITACION */}
            <TabsContent value="room" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-lg">
                    Cuenta de Habitación
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Al seleccionar una habitación, se cargará el alojamiento.
                    Agrega consumos de la habitación solo si corresponde.
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Select
                    label="Seleccionar Habitación (Estadía activa)"
                    value={stayId}
                    onChange={(e) => setStayId(e.target.value)}
                  >
                    <option value="">Sin seleccionar</option>
                    {stays.map((stay) => (
                      <option key={String(stay.id)} value={String(stay.id)}>
                        Hab.{" "}
                        {String(getValue(stay, "room.roomNumber") ?? stay.id)} -{" "}
                        {String(
                          getValue(stay, "customer.fullName") ?? "sin cliente",
                        )}
                      </option>
                    ))}
                  </Select>

                  {selectedStay ? (
                    <div className="space-y-4 border-t border-border pt-4">
                      <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Precio pactado
                          </span>
                          <span className="font-semibold">
                            {money(selectedStay.agreedPrice)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cliente</span>
                          <span className="font-medium">
                            {String(
                              getValue(selectedStay, "customer.fullName") ??
                                "Sin cliente",
                            )}
                          </span>
                        </div>
                        {pendingSales.length > 0 && (
                          <div className="flex justify-between text-amber-700 dark:text-amber-400 pt-1 border-t border-border">
                            <span>Cargos previos pendientes</span>
                            <span className="font-semibold">
                              {money(
                                pendingSales.reduce(
                                  (sum, s) => sum + Number(s.total ?? 0),
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                          Productos asignados a la habitación
                        </h4>
                        <div className="grid gap-2">
                          {roomProductsQuery.isLoading ? (
                            <p className="text-sm text-muted-foreground">
                              Cargando productos...
                            </p>
                          ) : roomProducts.length ? (
                            roomProducts.map((item) => (
                              <div
                                key={String(item.id)}
                                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5"
                              >
                                <div>
                                  <p className="font-medium text-sm">
                                    {productTitle((item.product as AnyRow | undefined) ?? {})}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Disponible: x{String(item.quantity)}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => addRoomProduct(item)}
                                >
                                  <Plus className="mr-1 h-3 w-3" /> Agregar
                                </Button>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-lg border border-dashed border-border p-6 text-center">
                              <p className="text-sm text-muted-foreground">
                                No hay productos asignados a esta habitación.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg mt-2">
                      Selecciona una estadía activa para ver su cuenta y agregar
                      cargos.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: CARGO MANUAL */}
            <TabsContent value="manual" className="pt-4">
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-lg">
                    Agregar Cargo Manual
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Usa esta opción para cobros excepcionales como lavandería o
                    penalidades.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    label="Tipo de cargo"
                    value={manualType}
                    onChange={(e) =>
                      setManualType(e.target.value as "OTHER" | "PENALTY")
                    }
                  >
                    <option value="OTHER">Otro cargo</option>
                    <option value="PENALTY">Daño o penalidad</option>
                  </Select>

                  <div className="space-y-2">
                    <Label>Sugerencias</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Hora extra",
                        "Daño en habitación",
                        "Lavandería",
                        "Reposición",
                        "Desayuno extra",
                      ].map((label) => (
                        <Button
                          key={label}
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setManualDescription(label)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-[1fr_150px] gap-4 pt-2">
                    <div className="space-y-2">
                      <Label>Descripción del cargo</Label>
                      <Input
                        placeholder="Ej. Lavado de sábanas"
                        value={manualDescription}
                        onChange={(event) =>
                          setManualDescription(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Monto (S/)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={manualPrice}
                        onChange={(event) => setManualPrice(event.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full h-11 mt-2"
                    onClick={addManual}
                    disabled={!manualDescription || !manualPrice}
                  >
                    <Plus className="mr-2 w-4 h-4" /> Añadir al carrito
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Lado derecho: Carrito de Compras (Pegajoso) */}
        <div
          ref={saleSummaryRef}
          className="order-1 lg:sticky lg:top-20 lg:order-2 lg:self-start"
        >
          <Card className="shadow-md border-primary/10">
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Resumen de Venta</h2>
                  </div>
                  <span className="text-2xl font-bold text-primary">
                    {money(grandTotal)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <CashShiftSelect value={cashShiftId} onChange={setCashShiftId} />

                {/* Cargos pendientes de BD */}
                {pendingSales.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 dark:bg-amber-950/20 dark:border-amber-900/50">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-2">
                      Cargos previos pendientes
                    </p>
                    <div className="space-y-1.5">
                      {pendingSales.map((sale) =>
                        (sale.details as AnyRow[] | undefined)?.map((d) => (
                          <div
                            key={String(d.id)}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-muted-foreground truncate mr-2">
                              {String(d.quantity)}x {String(d.description)}
                            </span>
                            <span className="font-medium whitespace-nowrap">
                              {money(Number(d.subtotal ?? 0))}
                            </span>
                          </div>
                        )),
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-900/50 flex justify-between text-sm font-semibold text-amber-800 dark:text-amber-300">
                      <span>Subtotal cargos previos</span>
                      <span>{money(pendingTotal)}</span>
                    </div>
                  </div>
                )}

                {/* Ítems nuevos del carrito */}
                <div className="space-y-3 min-h-[80px] max-h-[260px] overflow-y-auto pr-1">
                  {cart.length === 0 && pendingSales.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-2 text-muted-foreground p-6">
                      <ShoppingCart className="w-8 h-8 opacity-20" />
                      <p className="text-sm text-center">
                        Tu carrito está vacío.
                        <br />
                        Agrega productos o cargos.
                      </p>
                    </div>
                  ) : cart.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Solo cargos previos pendientes.
                    </p>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.key}
                        className="group rounded-lg border border-border/60 bg-card p-3 shadow-sm transition-all hover:border-primary/40"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-medium text-sm truncate"
                              title={item.description}
                            >
                              {item.description}
                            </p>
                          </div>
                          <span className="font-semibold text-sm whitespace-nowrap">
                            {money(item.quantity * item.unitPrice)}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-end gap-3">
                          <div className="flex items-center rounded-md border border-border">
                            <button
                              type="button"
                              className="px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              onClick={() => updateQuantity(item.key, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              className="px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              onClick={() => updateQuantity(item.key, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="min-w-0">
                            <Label className="text-xs">Precio</Label>
                            <Input
                              className="mt-1 h-8"
                              min="0"
                              step="0.01"
                              type="number"
                              value={String(item.unitPrice)}
                              onChange={(event) =>
                                updateUnitPrice(
                                  item.key,
                                  Number(event.target.value || 0),
                                )
                              }
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              setCart((items) =>
                                items.filter((row) => row.key !== item.key),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Opciones de Cobro */}
                <div className="space-y-4 border-t border-border pt-4">
                  <Select
                    label="Asignar Cliente (Opcional)"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">Consumidor Final</option>
                    {customers.map((customer) => (
                      <option
                        key={String(customer.id)}
                        value={String(customer.id)}
                      >
                        {String(
                          customer.fullName ??
                            customer.documentNumber ??
                            customer.id,
                        )}
                      </option>
                    ))}
                  </Select>

                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Comprobante"
                      value={invoiceType}
                      onChange={(e) => setInvoiceType(e.target.value)}
                    >
                      <option value="TICKET">Ticket (Interno)</option>
                      <option value="BOLETA">Boleta</option>
                      <option value="FACTURA">Factura</option>
                    </Select>
                    {invoiceType !== "TICKET" && (
                      <div className="space-y-2">
                        <Label>Nº (Opcional)</Label>
                        <Input
                          placeholder="Ej. B001-23"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <Select
                    label="Método de pago"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {paymentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>

                  <div className="space-y-2 pt-2">
                    <Button
                      className="h-12 w-full text-base font-semibold shadow-md"
                      disabled={
                        (!cart.length && !pendingSales.length) ||
                        createSale.isPending
                      }
                      onClick={() => createSale.mutate({ chargeToStay: false })}
                    >
                      {createSale.isPending
                        ? "Procesando..."
                        : `Cobrar ${money(grandTotal)}`}
                    </Button>
                    <Button
                      className="h-11 w-full"
                      variant="outline"
                      disabled={!cart.length || !stayId || createSale.isPending}
                      onClick={() => createSale.mutate({ chargeToStay: true })}
                    >
                      Dejar pendiente en Hab.{" "}
                      {selectedStay
                        ? String(getValue(selectedStay, "room.roomNumber") ?? "")
                        : ""}
                    </Button>
                  </div>
                </div>
              </CardContent>
          </Card>
        </div>
      </div>

      {hasSaleItems && (
        <div className="fixed inset-x-3 bottom-16 z-40 rounded-lg border border-border bg-card p-3 shadow-xl md:bottom-4 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Carrito</p>
              <p className="truncate text-lg font-bold text-primary">
                {money(grandTotal)}
              </p>
            </div>
            <Button
              type="button"
              className="h-11"
              onClick={() =>
                saleSummaryRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              <ShoppingCart className="h-4 w-4" />
              Ver carrito
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
