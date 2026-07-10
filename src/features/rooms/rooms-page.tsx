import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, PackageCheck, Plus, Power, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ResourceFormDialog } from '../../components/forms/resource-form-dialog';
import { StatusBadge } from '../../components/status-badge/status-badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { resourceApi } from '../../lib/api';
import type { AnyRow } from '../../types';
import { modules } from '../module-config';
import { normalizeRows, saveResource } from '../shared/resource-save';

type Product = AnyRow & {
  name?: string;
  stock?: number;
  active?: boolean;
};

type RoomProduct = {
  productId: number;
  quantity: number;
  product?: Product;
};

type Room = AnyRow & {
  id: number;
  roomNumber?: string;
  floor?: number;
  status?: string;
  roomType?: { name?: string };
  roomProducts?: RoomProduct[];
};

const roomConfig = modules.rooms;

export function RoomsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [productsRoom, setProductsRoom] = useState<Room | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [productSearch, setProductSearch] = useState('');

  const roomsQuery = useQuery({
    queryKey: ['resource', 'rooms'],
    queryFn: () => resourceApi.list('rooms'),
  });
  const productsQuery = useQuery({
    queryKey: ['resource', 'products'],
    queryFn: () => resourceApi.list('products'),
  });

  const rooms = useMemo(() => normalizeRows(roomsQuery.data) as Room[], [roomsQuery.data]);
  const products = useMemo(
    () => (normalizeRows(productsQuery.data) as Product[]).filter((product) => product.active !== false),
    [productsQuery.data],
  );
  const visibleProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => String(product.name ?? '').toLowerCase().includes(term));
  }, [products, productSearch]);

  useEffect(() => {
    if (!productsRoom) return;
    setProductSearch('');
    setQuantities(
      Object.fromEntries((productsRoom.roomProducts ?? []).map((item) => [item.productId, item.quantity])),
    );
  }, [productsRoom]);

  const saveRoom = useMutation({
    mutationFn: (values: Record<string, unknown>) => saveResource(roomConfig, values, editing),
    onSuccess: () => {
      toast.success(editing ? 'Habitación actualizada' : 'Habitación creada');
      setFormOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['resource', 'rooms'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo guardar la habitación'),
  });

  const saveProducts = useMutation({
    mutationFn: () =>
      resourceApi.update(`rooms/${productsRoom?.id}/products`, {
        products: products.map((product) => ({
          productId: product.id,
          quantity: Number(quantities[Number(product.id)] ?? 0),
        })),
      }),
    onSuccess: () => {
      toast.success('Productos de la habitación actualizados');
      setProductsRoom(null);
      queryClient.invalidateQueries({ queryKey: ['resource', 'rooms'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los productos'),
  });
  const toggleRoom = useMutation({
    mutationFn: (room: Room) => resourceApi.update(roomConfig.togglePath?.(room) ?? ''),
    onSuccess: () => {
      toast.success('Estado de habitación actualizado');
      queryClient.invalidateQueries({ queryKey: ['resource', 'rooms'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el estado'),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (room: Room) => {
    setEditing(room);
    setFormOpen(true);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Habitaciones</h1>
          <p className="text-sm text-muted-foreground">Estado, tipo y productos asignados a cada habitación.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva habitación
        </Button>
      </div>

      {roomsQuery.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-44 animate-pulse rounded-lg border border-border bg-muted" />
          ))}
        </div>
      ) : roomsQuery.isError ? (
        <Card>
          <CardContent>
            <p className="text-sm text-red-700">No se pudieron cargar las habitaciones.</p>
          </CardContent>
        </Card>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Todavía no hay habitaciones registradas.</p>
            <Button onClick={openCreate}>Crear primera habitación</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const assigned = (room.roomProducts ?? []).filter((item) => item.quantity > 0);

            return (
              <Card key={room.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Habitación</p>
                    <h2 className="text-2xl font-semibold">{room.roomNumber ?? room.id}</h2>
                    <p className="text-sm text-muted-foreground">
                      {room.roomType?.name ?? 'Sin tipo'}
                      {room.floor ? ` · Piso ${room.floor}` : ''}
                    </p>
                  </div>
                  <StatusBadge value={room.status} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md bg-muted p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">Productos en habitación</span>
                      <span className="text-sm font-semibold">{assigned.length}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {assigned.length
                        ? assigned.map((item) => `${item.quantity} ${item.product?.name ?? `#${item.productId}`}`).join(', ')
                        : 'Sin productos asignados.'}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button variant="outline" onClick={() => setProductsRoom(room)}>
                      <PackageCheck className="h-4 w-4" />
                      Productos
                    </Button>
                    <Button variant="ghost" onClick={() => openEdit(room)}>
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={toggleRoom.isPending}
                      onClick={() => {
                        if (window.confirm('¿Deseas cambiar el estado de esta habitación?')) toggleRoom.mutate(room);
                      }}
                    >
                      <Power className="h-4 w-4" />
                      Desactivar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ResourceFormDialog
        open={formOpen}
        title={editing ? 'Editar habitación' : (roomConfig.createLabel ?? 'Nueva habitación')}
        fields={roomConfig.fields}
        schema={roomConfig.schema}
        initialValue={editing}
        saving={saveRoom.isPending}
        onOpenChange={setFormOpen}
        onSubmit={(values) => saveRoom.mutate(values)}
      />

      <Dialog open={Boolean(productsRoom)} onOpenChange={(open) => !open && setProductsRoom(null)}>
        <DialogContent className="md:w-[min(900px,calc(100vw-2rem))]">
          <DialogTitle className="pr-8 text-xl font-semibold">Productos de habitación {productsRoom?.roomNumber}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Ajusta las cantidades que quedan físicamente en la habitación.
          </DialogDescription>

          <div className="mt-5 space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar producto"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
              />
            </div>

            {productsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando productos...</p>
            ) : productsQuery.isError ? (
              <p className="text-sm text-red-700">No se pudieron cargar los productos.</p>
            ) : visibleProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay productos activos con ese texto.</p>
            ) : (
              <div className="grid max-h-[52svh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {visibleProducts.map((product) => {
                  const productId = Number(product.id);

                  return (
                    <label
                      key={productId}
                      className="grid grid-cols-[1fr_88px] items-center gap-3 rounded-md border border-border bg-white p-3"
                    >
                      <span>
                        <span className="block text-sm font-medium">{String(product.name ?? `Producto #${productId}`)}</span>
                        <span className="block text-xs text-muted-foreground">Stock general: {Number(product.stock ?? 0)}</span>
                      </span>
                      <span className="space-y-1">
                        <Label className="sr-only">Cantidad</Label>
                        <Input
                          min="0"
                          step="1"
                          type="number"
                          value={String(quantities[productId] ?? 0)}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [productId]: Math.max(0, Number(event.target.value || 0)),
                            }))
                          }
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProductsRoom(null)}>
                Cancelar
              </Button>
              <Button type="button" disabled={saveProducts.isPending || productsQuery.isLoading} onClick={() => saveProducts.mutate()}>
                {saveProducts.isPending ? 'Guardando...' : 'Guardar productos'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
