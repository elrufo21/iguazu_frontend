import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function CashShiftsPage() {
  return <CrudPage config={modules.cashShifts} />;
}
