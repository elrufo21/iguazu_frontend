import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function CustomersPage() {
  return <CrudPage config={modules.customers} />;
}
