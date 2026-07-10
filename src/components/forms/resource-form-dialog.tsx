import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  useForm,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";
import { resourceApi } from "../../lib/api";
import { getValue } from "../../lib/utils";
import type { AnyRow } from "../../types";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select } from "../ui/select";

export type FormValues = Record<string, unknown>;

export type FieldConfig = {
  name: string;
  label: string;
  type?:
    | "text"
    | "password"
    | "number"
    | "date"
    | "datetime-local"
    | "textarea"
    | "select"
    | "checkbox"
    | "relation"
    | "customer";
  placeholder?: string;
  options?: { label: string; value: string }[];
  endpoint?: string;
  labelKey?: string;
  optional?: boolean;
  createCustomer?: boolean;
  step?: string;
  helper?: string;
  onChange?: (value: unknown, form: UseFormReturn<FormValues>) => void;
};

export function ResourceFormDialog({
  open,
  title,
  description,
  fields,
  schema,
  initialValue,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description?: string;
  fields: FieldConfig[];
  schema: z.ZodType<any>;
  initialValue?: AnyRow | null;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: FormValues) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema as any),
  });

  useEffect(() => {
    const values = Object.fromEntries(
      fields.map((field) => [
        field.name,
        getValue(initialValue ?? {}, field.name) ?? "",
      ]),
    );
    form.reset(values);
  }, [fields, form, initialValue, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="pr-8 text-xl font-semibold">
          {title}
        </DialogTitle>
        {description && (
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        )}
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {fields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              form={form}
              error={form.formState.errors[field.name]?.message}
            />
          ))}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({
  field,
  form,
  error,
}: {
  field: FieldConfig;
  form: UseFormReturn<FormValues>;
  error?: unknown;
}) {
  const id = `field-${field.name}`;
  const common = form.register(field.name);

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    common.onChange(event);
    field.onChange?.(event.target.value, form);
  };

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    common.onChange(event);
    field.onChange?.(event.target.checked, form);
  };

  return (
    <div
      className={
        field.type === "textarea" || field.type === "customer"
          ? "space-y-2 sm:col-span-2"
          : "space-y-2"
      }
    >
      <Label htmlFor={id}>{field.label}</Label>
      {field.type === "textarea" ? (
        <Textarea
          id={id}
          placeholder={field.placeholder}
          {...common}
          onChange={handleChange}
        />
      ) : field.type === "select" ? (
        <Select id={id} {...common} onChange={handleChange}>
          <option value="">Seleccionar</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : field.type === "relation" ? (
        <RelationSelect
          id={id}
          field={field}
          form={form}
          onValueChange={field.onChange}
        />
      ) : field.type === "customer" ? (
        <CustomerField id={id} field={field} form={form} />
      ) : field.type === "checkbox" ? (
        <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm">
          <input
            type="checkbox"
            {...form.register(field.name)}
            onChange={handleCheckboxChange}
          />
          Sí
        </label>
      ) : (
        <Input
          id={id}
          type={field.type ?? "text"}
          step={field.type === "number" ? (field.step ?? "1") : undefined}
          placeholder={field.placeholder}
          {...common}
          onChange={handleChange}
        />
      )}
      {field.helper && (
        <p className="text-xs text-muted-foreground">{field.helper}</p>
      )}
      {typeof error === "string" && (
        <p className="text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}

function CustomerField({
  id,
  field,
  form,
}: {
  id: string;
  field: FieldConfig;
  form: UseFormReturn<FormValues>;
}) {
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const query = useQuery({
    queryKey: ["relation", "customers"],
    queryFn: () => resourceApi.list("customers"),
  });
  const rows = useMemo(
    () => (Array.isArray(query.data) ? (query.data as AnyRow[]) : []),
    [query.data],
  );
  const options = useMemo(
    () =>
      rows.map((row) => ({
        id: String(row.id ?? ""),
        label:
          `${String(row.fullName ?? "Sin nombre")} - ${String(row.documentType ?? "")} ${String(row.documentNumber ?? "")}`.trim(),
      })),
    [rows],
  );
  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options.slice(0, 8);
    return options
      .filter((option) => option.label.toLowerCase().includes(term))
      .slice(0, 8);
  }, [options, search]);

  const pick = (option: { id: string; label: string }) => {
    setSearch(option.label);
    form.setValue(field.name, option.id);
    setFocused(false);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <input type="hidden" {...form.register(field.name)} />
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Input
            id={id}
            value={search}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setFocused(false);
            }}
            onChange={(event) => {
              setSearch(event.target.value);
              form.setValue(field.name, "");
              setFocused(true);
            }}
            disabled={creating}
            placeholder={
              field.optional ? "Buscar cliente o dejar vacío" : "Buscar cliente"
            }
          />
          {focused && !creating && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-white p-1 shadow-lg">
              <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
                <span>Clientes</span>
                <button
                  type="button"
                  className="font-medium text-primary"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setFocused(false)}
                >
                  Cerrar
                </button>
              </div>
              {query.isLoading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Cargando clientes...
                </p>
              ) : query.isError ? (
                <p className="px-3 py-2 text-sm text-red-700">
                  No se pudieron cargar los clientes.
                </p>
              ) : filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(option)}
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No hay clientes con ese texto.
                </p>
              )}
            </div>
          )}
        </div>
        {field.createCustomer && (
          <Button
            type="button"
            variant={creating ? "secondary" : "outline"}
            onClick={() => {
              setCreating((value) => !value);
              form.setValue(field.name, "");
            }}
          >
            {creating ? "Usar existente" : "Nuevo cliente"}
          </Button>
        )}
      </div>

      {creating && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Select
              label="Tipo documento"
              {...form.register("newCustomer.documentType")}
            >
              <option value="">Seleccionar</option>
              {documentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Número documento</Label>
            <Input {...form.register("newCustomer.documentNumber")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Nombre completo</Label>
            <Input {...form.register("newCustomer.fullName")} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input {...form.register("newCustomer.phone")} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...form.register("newCustomer.email")} />
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        {field.optional
          ? "Puedes continuar sin cliente."
          : "La reserva necesita un cliente existente o nuevo."}
      </p>
    </div>
  );
}

function RelationSelect({
  id,
  field,
  form,
  onValueChange,
}: {
  id: string;
  field: FieldConfig;
  form: UseFormReturn<FormValues>;
  onValueChange?: (value: unknown, form: UseFormReturn<FormValues>) => void;
}) {
  const query = useQuery({
    queryKey: ["relation", field.endpoint],
    queryFn: () => resourceApi.list(field.endpoint ?? ""),
    enabled: Boolean(field.endpoint),
  });
  const rows = Array.isArray(query.data) ? (query.data as AnyRow[]) : [];
  const register = form.register(field.name);

  return (
    <Select
      id={id}
      {...register}
      onChange={(event) => {
        register.onChange(event);
        onValueChange?.(event.target.value, form);
      }}
    >
      <option value="">
        {field.optional ? "Sin seleccionar" : "Seleccionar"}
      </option>
      {rows.map((row) => (
        <option key={String(row.id)} value={String(row.id)}>
          {String(getValue(row, field.labelKey ?? "name") ?? `#${row.id}`)}
        </option>
      ))}
    </Select>
  );
}

const documentTypeOptions = [
  { label: "DNI", value: "DNI" },
  { label: "RUC", value: "RUC" },
  { label: "Carnet de extranjería", value: "CE" },
  { label: "Pasaporte", value: "PASAPORTE" },
];
