import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function EmployeesPage() {
  return <CrudPage config={modules.employees} />;
}
