import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function CashMovementsPage() {
  return <CrudPage config={modules.cashMovements} />;
}
