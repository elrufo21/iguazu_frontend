import { CheckCircle2, Plus, Split, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { money } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';

export const PAYMENT_OPTIONS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'YAPE', label: 'Yape' },
  { value: 'PLIN', label: 'Plin' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
];

export type PaymentEntry = {
  paymentMethod: string;
  amount: number;
};

type PaymentSplitInputProps = {
  totalAmount: number;
  payments: PaymentEntry[];
  onChange: (payments: PaymentEntry[]) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
};

export function PaymentSplitInput({
  totalAmount,
  payments,
  onChange,
  disabled = false,
  className = '',
  label = 'Método de pago',
}: PaymentSplitInputProps) {
  const [isSplit, setIsSplit] = useState(false);

  // Determinar si ya viene con más de 1 pago
  useEffect(() => {
    if (payments.length > 1 && !isSplit) {
      setIsSplit(true);
    }
  }, [payments.length, isSplit]);

  // Si no está dividido, mantener 1 solo elemento con el monto total actualizado
  useEffect(() => {
    if (!isSplit && totalAmount > 0) {
      const currentMethod = payments[0]?.paymentMethod || 'CASH';
      if (
        payments.length !== 1 ||
        Math.abs(Number(payments[0]?.amount ?? 0) - Number(totalAmount.toFixed(2))) > 0.001 ||
        payments[0]?.paymentMethod !== currentMethod
      ) {
        onChange([{ paymentMethod: currentMethod, amount: Number(totalAmount.toFixed(2)) }]);
      }
    }
  }, [totalAmount, isSplit, payments, onChange]);

  const currentTotal = useMemo(() => {
    return Number(
      payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toFixed(2),
    );
  }, [payments]);

  const difference = Number((totalAmount - currentTotal).toFixed(2));
  const isExact = Math.abs(difference) < 0.009;
  const isOver = difference < -0.009;
  const isUnder = difference > 0.009;

  const handleSingleMethodChange = (newMethod: string) => {
    onChange([{ paymentMethod: newMethod, amount: Number(totalAmount.toFixed(2)) }]);
  };

  const handleEnableSplit = () => {
    setIsSplit(true);
    if (payments.length <= 1) {
      const firstMethod = payments[0]?.paymentMethod || 'CASH';
      const half = Number((totalAmount / 2).toFixed(2));
      const secondHalf = Number((totalAmount - half).toFixed(2));
      const nextMethod = firstMethod === 'CASH' ? 'YAPE' : 'CASH';
      onChange([
        { paymentMethod: firstMethod, amount: half },
        { paymentMethod: nextMethod, amount: secondHalf },
      ]);
    }
  };

  const handleDisableSplit = () => {
    setIsSplit(false);
    const firstMethod = payments[0]?.paymentMethod || 'CASH';
    onChange([{ paymentMethod: firstMethod, amount: Number(totalAmount.toFixed(2)) }]);
  };

  const handleRowMethodChange = (index: number, newMethod: string) => {
    const updated = [...payments];
    updated[index] = { ...updated[index], paymentMethod: newMethod };
    onChange(updated);
  };

  const handleRowAmountChange = (index: number, newAmountStr: string) => {
    const parsed = parseFloat(newAmountStr);
    const updated = [...payments];
    updated[index] = {
      ...updated[index],
      amount: isNaN(parsed) ? 0 : parsed,
    };
    onChange(updated);
  };

  const handleAddPaymentRow = () => {
    // Buscar un método que aún no esté seleccionado, o por defecto CASH
    const usedMethods = new Set(payments.map((p) => p.paymentMethod));
    const available = PAYMENT_OPTIONS.find((opt) => !usedMethods.has(opt.value));
    const nextMethod = available ? available.value : 'YAPE';
    const fillAmount = difference > 0 ? difference : 0;

    onChange([...payments, { paymentMethod: nextMethod, amount: fillAmount }]);
  };

  const handleRemovePaymentRow = (index: number) => {
    if (payments.length <= 1) return;
    const updated = payments.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  const handleAutoFillRemaining = (index: number) => {
    const otherRowsSum = payments.reduce(
      (sum, p, idx) => (idx === index ? sum : sum + (Number(p.amount) || 0)),
      0,
    );
    const remainder = Math.max(0, Number((totalAmount - otherRowsSum).toFixed(2)));
    const updated = [...payments];
    updated[index] = { ...updated[index], amount: remainder };
    onChange(updated);
  };

  if (!isSplit) {
    const currentMethod = payments[0]?.paymentMethod || 'CASH';
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <button
            type="button"
            disabled={disabled || totalAmount <= 0}
            onClick={handleEnableSplit}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50 cursor-pointer"
          >
            <Split className="h-3.5 w-3.5" />
            Dividir pago (2 o más métodos)
          </button>
        </div>
        <Select
          value={currentMethod}
          onChange={(e) => handleSingleMethodChange(e.target.value)}
          disabled={disabled}
        >
          {PAYMENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({money(totalAmount)})
            </option>
          ))}
        </Select>
      </div>
    );
  }

  return (
    <div className={`space-y-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-3.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <Label className="font-semibold text-primary">{label} (Dividido / Mixto)</Label>
          <p className="text-xs text-muted-foreground">Distribuye el total entre varios métodos de pago</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
          onClick={handleDisableSplit}
          disabled={disabled}
        >
          <Undo2 className="h-3 w-3" />
          Un solo método
        </Button>
      </div>

      <div className="space-y-2 pt-1">
        {payments.map((payment, idx) => (
          <div key={`split-${idx}`} className="flex items-center gap-2">
            <div className="w-[140px] shrink-0 sm:w-[160px]">
              <Select
                value={payment.paymentMethod}
                onChange={(e) => handleRowMethodChange(idx, e.target.value)}
                disabled={disabled}
              >
                {PAYMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                S/
              </span>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                className="pl-7 text-sm font-semibold"
                placeholder="0.00"
                value={payment.amount === 0 ? '' : payment.amount}
                onChange={(e) => handleRowAmountChange(idx, e.target.value)}
                disabled={disabled}
              />
            </div>
            {payments.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleRemovePaymentRow(idx)}
                disabled={disabled}
                title="Eliminar método"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={handleAddPaymentRow}
          disabled={disabled || payments.length >= PAYMENT_OPTIONS.length}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar método
        </Button>

        {isUnder && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs text-amber-700 dark:text-amber-400 font-medium"
            onClick={() => handleAutoFillRemaining(payments.length - 1)}
            disabled={disabled}
          >
            Completar resto ({money(difference)})
          </Button>
        )}
      </div>

      {/* Resumen de cuadre */}
      <div className="rounded-md bg-muted/60 px-3 py-2 text-xs space-y-1 border border-border/60">
        <div className="flex justify-between text-muted-foreground">
          <span>Total a cobrar:</span>
          <span className="font-semibold text-foreground">{money(totalAmount)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Total ingresado:</span>
          <span className="font-semibold text-foreground">{money(currentTotal)}</span>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-border/40 font-medium">
          <span>Estado del pago:</span>
          {isExact && (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Monto exacto
            </span>
          )}
          {isUnder && (
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              Falta {money(difference)}
            </span>
          )}
          {isOver && (
            <span className="font-semibold text-destructive">
              Exceso de {money(Math.abs(difference))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
