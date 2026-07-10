import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function StaffPaymentsPage() {
  return <CrudPage config={modules.staffPayments} />;
}
